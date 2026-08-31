"""Reglas y ejecución idempotente de facturación recurrente."""

import calendar
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.facturacion import facturas_service
from src.facturacion.exceptions import (
    ConceptoCobroInvalido,
    ReglaFacturacionIncompatible,
    ReglaFacturacionInvalida,
    ReglaFacturacionNoEncontrada,
)
from src.facturacion.models import (
    CargoFacturacionGenerado,
    ConceptoCobro,
    EjecucionFacturacion,
    ReglaFacturacion,
    ResponsableEconomico,
)
from src.facturacion.schemas import (
    DetalleFacturaCreate,
    EjecucionFacturacionRead,
    FacturaCreate,
    GeneracionFacturacionResumenRead,
    ReglaFacturacionCreate,
    ReglaFacturacionEstadoUpdate,
    ReglaFacturacionUpdate,
)
from src.inscripciones.models import Inscripcion


@dataclass(frozen=True)
class CargoPlanificado:
    regla: ReglaFacturacion
    inscripcion: Inscripcion
    fecha_vencimiento: date


@dataclass(frozen=True)
class PlanGeneracion:
    periodo: date
    reglas: list[ReglaFacturacion]
    cargos_aptos: list[CargoPlanificado]
    cargos_omitidos: list[CargoPlanificado]
    cargos_bloqueados: list[CargoPlanificado]
    alumnos_alcanzados: int


def _mes_final(periodo: date) -> date:
    return date(periodo.year, periodo.month, calendar.monthrange(periodo.year, periodo.month)[1])


def _fecha_vencimiento(periodo: date, dia: int) -> date:
    return date(periodo.year, periodo.month, min(dia, _mes_final(periodo).day))


def _regla_aplica_periodo(regla: ReglaFacturacion, periodo: date) -> bool:
    if regla.vigencia_desde > _mes_final(periodo) or regla.vigencia_hasta < periodo:
        return False
    return regla.periodicidad == "mensual" or regla.mes_aplicacion == periodo.month


def _validar_destino(db: Session, regla: ReglaFacturacion) -> None:
    if regla.criterio_aplicacion == "nivel":
        if db.get(NivelEducativo, regla.nivel_educativo_id) is None:
            raise ReglaFacturacionInvalida("El nivel educativo indicado no existe.")
    elif regla.criterio_aplicacion == "anio" and db.get(Anio, regla.anio_id) is None:
        raise ReglaFacturacionInvalida("El año indicado no existe.")
    elif regla.criterio_aplicacion == "division" and db.get(Division, regla.division_id) is None:
        raise ReglaFacturacionInvalida("La división indicada no existe.")


def _nivel_de_anio(db: Session, anio_id: uuid.UUID) -> uuid.UUID | None:
    return db.scalar(select(Anio.nivel_educativo_id).where(Anio.id == anio_id))


def _anio_de_division(db: Session, division_id: uuid.UUID) -> uuid.UUID | None:
    return db.scalar(select(Division.anio_id).where(Division.id == division_id))


def _alcances_se_superponen(
    db: Session, primera: ReglaFacturacion, segunda: ReglaFacturacion
) -> bool:
    if "todas_inscripciones" in {primera.criterio_aplicacion, segunda.criterio_aplicacion}:
        return True
    if primera.criterio_aplicacion == segunda.criterio_aplicacion:
        atributo = f"{primera.criterio_aplicacion}_id"
        return getattr(primera, atributo) == getattr(segunda, atributo)

    por_criterio = {primera.criterio_aplicacion: primera, segunda.criterio_aplicacion: segunda}
    nivel = por_criterio.get("nivel")
    anio = por_criterio.get("anio")
    division = por_criterio.get("division")
    if nivel is not None and anio is not None:
        return _nivel_de_anio(db, anio.anio_id) == nivel.nivel_educativo_id
    if nivel is not None and division is not None:
        anio_division = _anio_de_division(db, division.division_id)
        return (
            anio_division is not None
            and _nivel_de_anio(db, anio_division) == nivel.nivel_educativo_id
        )
    if anio is not None and division is not None:
        return _anio_de_division(db, division.division_id) == anio.anio_id
    return False


def _validar_sin_conflictos(db: Session, regla: ReglaFacturacion) -> None:
    if regla.estado != "activa":
        return
    candidatas = db.scalars(
        select(ReglaFacturacion).where(
            ReglaFacturacion.id != regla.id,
            ReglaFacturacion.estado == "activa",
            ReglaFacturacion.ciclo_lectivo == regla.ciclo_lectivo,
            ReglaFacturacion.concepto_cobro_id == regla.concepto_cobro_id,
            ReglaFacturacion.vigencia_desde <= regla.vigencia_hasta,
            ReglaFacturacion.vigencia_hasta >= regla.vigencia_desde,
        )
    ).all()
    if any(_alcances_se_superponen(db, regla, candidata) for candidata in candidatas):
        raise ReglaFacturacionIncompatible()


def _validar_concepto_activo(db: Session, concepto_id: uuid.UUID) -> None:
    concepto = db.get(ConceptoCobro, concepto_id)
    if concepto is None or not concepto.activo:
        raise ConceptoCobroInvalido()


def crear_regla_facturacion(db: Session, datos: ReglaFacturacionCreate) -> ReglaFacturacion:
    _validar_concepto_activo(db, datos.concepto_cobro_id)
    regla = ReglaFacturacion(**datos.model_dump())
    _validar_destino(db, regla)
    _validar_sin_conflictos(db, regla)
    db.add(regla)
    db.commit()
    db.refresh(regla)
    return regla


def obtener_regla_facturacion(db: Session, regla_id: uuid.UUID) -> ReglaFacturacion | None:
    return db.get(ReglaFacturacion, regla_id)


def listar_reglas_facturacion(db: Session) -> list[ReglaFacturacion]:
    return list(
        db.scalars(
            select(ReglaFacturacion).order_by(
                ReglaFacturacion.ciclo_lectivo.desc(), ReglaFacturacion.nombre
            )
        ).all()
    )


def actualizar_regla_facturacion(
    db: Session, regla: ReglaFacturacion, datos: ReglaFacturacionUpdate
) -> ReglaFacturacion:
    _validar_concepto_activo(db, datos.concepto_cobro_id)
    valores_anteriores = {campo: getattr(regla, campo) for campo in datos.model_fields_set}
    for campo, valor in datos.model_dump().items():
        setattr(regla, campo, valor)
    try:
        _validar_destino(db, regla)
        _validar_sin_conflictos(db, regla)
        db.commit()
    except Exception:
        db.rollback()
        for campo, valor in valores_anteriores.items():
            setattr(regla, campo, valor)
        raise
    db.refresh(regla)
    return regla


def actualizar_estado_regla_facturacion(
    db: Session, regla: ReglaFacturacion, datos: ReglaFacturacionEstadoUpdate
) -> ReglaFacturacion:
    estado_anterior = regla.estado
    regla.estado = datos.estado
    try:
        _validar_sin_conflictos(db, regla)
        db.commit()
    except Exception:
        db.rollback()
        regla.estado = estado_anterior
        raise
    db.refresh(regla)
    return regla


def _inscripciones_de_regla(db: Session, regla: ReglaFacturacion) -> list[Inscripcion]:
    consulta = (
        select(Inscripcion)
        .join(Division, Inscripcion.division_id == Division.id)
        .join(Anio, Division.anio_id == Anio.id)
        .where(
            Inscripcion.estado == "activa",
            Inscripcion.ciclo_lectivo == regla.ciclo_lectivo,
        )
    )
    if regla.criterio_aplicacion == "nivel":
        consulta = consulta.where(Anio.nivel_educativo_id == regla.nivel_educativo_id)
    elif regla.criterio_aplicacion == "anio":
        consulta = consulta.where(Anio.id == regla.anio_id)
    elif regla.criterio_aplicacion == "division":
        consulta = consulta.where(Inscripcion.division_id == regla.division_id)
    return list(db.scalars(consulta).all())


def _reglas_aplicables(db: Session, periodo: date) -> list[ReglaFacturacion]:
    reglas = db.scalars(
        select(ReglaFacturacion).where(
            ReglaFacturacion.estado == "activa",
            ReglaFacturacion.ciclo_lectivo == str(periodo.year),
            ReglaFacturacion.vigencia_desde <= _mes_final(periodo),
            ReglaFacturacion.vigencia_hasta >= periodo,
        )
    ).all()
    return [regla for regla in reglas if _regla_aplica_periodo(regla, periodo)]


def _responsables_vigentes(
    db: Session, alumno_ids: set[uuid.UUID], fecha: date
) -> dict[uuid.UUID, ResponsableEconomico]:
    if not alumno_ids:
        return {}
    responsables = db.scalars(
        select(ResponsableEconomico)
        .where(
            ResponsableEconomico.alumno_id.in_(alumno_ids),
            ResponsableEconomico.vigencia_desde <= fecha,
            or_(
                ResponsableEconomico.vigencia_hasta.is_(None),
                ResponsableEconomico.vigencia_hasta >= fecha,
            ),
        )
        .order_by(ResponsableEconomico.vigencia_desde.desc())
    ).all()
    resultado: dict[uuid.UUID, ResponsableEconomico] = {}
    for responsable in responsables:
        resultado.setdefault(responsable.alumno_id, responsable)
    return resultado


def planificar_generacion_facturacion(db: Session, periodo: date) -> PlanGeneracion:
    reglas = _reglas_aplicables(db, periodo)
    candidatos = [
        CargoPlanificado(regla, inscripcion, _fecha_vencimiento(periodo, regla.dia_vencimiento))
        for regla in reglas
        for inscripcion in _inscripciones_de_regla(db, regla)
    ]
    claves_existentes = set(
        db.execute(
            select(
                CargoFacturacionGenerado.inscripcion_id,
                CargoFacturacionGenerado.concepto_cobro_id,
            ).where(CargoFacturacionGenerado.periodo == periodo)
        ).all()
    )
    omitidos = [
        cargo
        for cargo in candidatos
        if (cargo.inscripcion.id, cargo.regla.concepto_cobro_id) in claves_existentes
    ]
    sin_duplicados = [cargo for cargo in candidatos if cargo not in omitidos]
    responsables = _responsables_vigentes(
        db, {cargo.inscripcion.alumno_id for cargo in sin_duplicados}, periodo
    )
    bloqueados = [
        cargo for cargo in sin_duplicados if cargo.inscripcion.alumno_id not in responsables
    ]
    aptos = [cargo for cargo in sin_duplicados if cargo not in bloqueados]
    return PlanGeneracion(
        periodo=periodo,
        reglas=reglas,
        cargos_aptos=aptos,
        cargos_omitidos=omitidos,
        cargos_bloqueados=bloqueados,
        alumnos_alcanzados=len({cargo.inscripcion.alumno_id for cargo in candidatos}),
    )


def resumen_plan_generacion(plan: PlanGeneracion) -> GeneracionFacturacionResumenRead:
    return GeneracionFacturacionResumenRead(
        periodo=plan.periodo,
        reglas_aplicables=len(plan.reglas),
        alumnos_alcanzados=plan.alumnos_alcanzados,
        cargos_aptos=len(plan.cargos_aptos),
        cargos_omitidos=len(plan.cargos_omitidos),
        cargos_bloqueados=len(plan.cargos_bloqueados),
        monto_estimado=sum((cargo.regla.importe for cargo in plan.cargos_aptos), Decimal("0.00")),
    )


def _detalle_de_cargo(cargo: CargoPlanificado, periodo: date) -> DetalleFacturaCreate:
    return DetalleFacturaCreate(
        descripcion=f"{cargo.regla.nombre} · {periodo.strftime('%m/%Y')}",
        monto=cargo.regla.importe,
        concepto_cobro_id=cargo.regla.concepto_cobro_id,
    )


def generar_facturacion(
    db: Session, periodo: date, usuario_id: uuid.UUID | None, *, _reintento: bool = False
) -> EjecucionFacturacionRead:
    plan = planificar_generacion_facturacion(db, periodo)
    resumen = resumen_plan_generacion(plan)
    responsables = _responsables_vigentes(
        db, {cargo.inscripcion.alumno_id for cargo in plan.cargos_aptos}, periodo
    )
    ejecucion = EjecucionFacturacion(
        periodo=periodo,
        cargos_omitidos=resumen.cargos_omitidos,
        cargos_bloqueados=resumen.cargos_bloqueados,
        usuario_id=usuario_id,
    )
    facturas_generadas = 0
    try:
        db.add(ejecucion)
        db.flush()
        por_factura: dict[tuple[uuid.UUID, date], list[CargoPlanificado]] = defaultdict(list)
        for cargo in plan.cargos_aptos:
            por_factura[(cargo.inscripcion.id, cargo.fecha_vencimiento)].append(cargo)

        for (inscripcion_id, vencimiento), cargos in por_factura.items():
            factura = facturas_service.construir_factura(
                db,
                datos=FacturaCreate(
                    fecha_emision=periodo,
                    fecha_vencimiento=vencimiento,
                    inscripcion_id=inscripcion_id,
                    detalles=[_detalle_de_cargo(cargo, periodo) for cargo in cargos],
                ),
                responsable=responsables[cargos[0].inscripcion.alumno_id],
            )
            db.add(factura)
            db.flush()
            db.add_all(
                [
                    CargoFacturacionGenerado(
                        periodo=periodo,
                        fecha_vencimiento=cargo.fecha_vencimiento,
                        importe=cargo.regla.importe,
                        regla_facturacion_id=cargo.regla.id,
                        ejecucion_facturacion_id=ejecucion.id,
                        factura_id=factura.id,
                        inscripcion_id=cargo.inscripcion.id,
                        concepto_cobro_id=cargo.regla.concepto_cobro_id,
                    )
                    for cargo in cargos
                ]
            )
            facturas_generadas += 1
        ejecucion.facturas_generadas = facturas_generadas
        ejecucion.cargos_generados = len(plan.cargos_aptos)
        ejecucion.monto_total = resumen.monto_estimado
        db.commit()
    except IntegrityError:
        db.rollback()
        if _reintento:
            raise
        return generar_facturacion(db, periodo, usuario_id, _reintento=True)

    db.refresh(ejecucion)
    return EjecucionFacturacionRead(
        id=ejecucion.id,
        fecha_ejecucion=ejecucion.fecha_ejecucion,
        facturas_generadas=ejecucion.facturas_generadas,
        cargos_generados=ejecucion.cargos_generados,
        monto_total=ejecucion.monto_total,
        **resumen.model_dump(),
    )


def obtener_regla_o_error(db: Session, regla_id: uuid.UUID) -> ReglaFacturacion:
    regla = obtener_regla_facturacion(db, regla_id)
    if regla is None:
        raise ReglaFacturacionNoEncontrada()
    return regla
