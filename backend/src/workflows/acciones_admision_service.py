"""Ejecutor de generar_cargo. Dueño: Canu (ver #199 y #208)."""

import calendar
import uuid
from datetime import date, timedelta

from sqlalchemy import and_, extract, or_, select
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division
from src.exceptions import AppException
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.facturas_service import crear_factura_en_transaccion
from src.facturacion.models import (
    ConceptoCobro,
    DetalleFactura,
    Factura,
    Pago,
    ReglaFacturacion,
    ResponsableEconomico,
)
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.inscripciones.models import Inscripcion
from src.models import EventLog
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ConfigGenerarCargo, ResultadoAccion

# Sin regla de facturación de donde tomar el día, un cargo con monto fijo vence a los 10 días.
DIAS_PARA_VENCER_SIN_REGLA = 10


def ejecutar_generar_cargo(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Emite el cargo del concepto de la regla en la cuenta corriente del alumno del evento.

    Idempotente por alumno, concepto y período, no por inscripción: un cambio de matrícula crea
    otra inscripción y no tiene que volver a cobrar la matrícula del ciclo. El período es el ciclo
    lectivo en `inscripcion.confirmada` y el mes del pago en `pago.rechazado`.
    """
    config = ConfigGenerarCargo.model_validate(regla.accion_config or {})
    inscripcion, mes = _origen(db, evento)
    if inscripcion is None:
        return _error("No se encontró la inscripción del evento.")
    concepto = db.get(ConceptoCobro, config.concepto_cobro_id)
    if concepto is None or not concepto.activo:
        return _error("El concepto de cobro indicado no existe o está inactivo.")
    if _ya_cobrado(db, inscripcion, concepto.id, mes):
        return ResultadoAccion(
            detalle=f"Sin cambios: el alumno ya tiene un cargo de {concepto.nombre} en el período."
        )

    hoy = fecha_operativa_argentina()
    regla_facturacion, motivo = _regla_facturacion(db, inscripcion, concepto.id)
    if config.monto is None and regla_facturacion is None:
        return _error(motivo)
    monto = config.monto if config.monto is not None else regla_facturacion.importe
    vencimiento = _vencimiento(hoy, regla_facturacion)

    responsable = _responsable(db, inscripcion.alumno_id, hoy)
    if responsable is None:
        return _error("El alumno no tiene un responsable económico asignado.")
    try:
        factura = crear_factura_en_transaccion(
            db,
            FacturaCreate(
                fecha_emision=hoy,
                fecha_vencimiento=vencimiento,
                inscripcion_id=inscripcion.id,
                detalles=[
                    DetalleFacturaCreate(
                        descripcion=f"{concepto.nombre} {inscripcion.ciclo_lectivo}",
                        monto=monto,
                        concepto_cobro_id=concepto.id,
                    )
                ],
            ),
            evento.usuario_id,
            responsable,
        )
    except AppException as error:
        return _error(error.message)
    return ResultadoAccion(
        detalle=(
            f"Cargo de {concepto.nombre} por ${factura.monto_total} emitido "
            f"(vence el {vencimiento.strftime('%d/%m/%Y')})."
        )
    )


def _error(motivo: str) -> ResultadoAccion:
    return ResultadoAccion(detalle=motivo, error=motivo)


def _origen(db: Session, evento: EventLog) -> tuple[Inscripcion | None, date | None]:
    """La inscripción a la que se imputa el cargo y, si el período es mensual, su mes."""
    if evento.entidad == "inscripcion":
        return db.get(Inscripcion, evento.entidad_id), None
    if evento.entidad == "pago":
        fila = db.execute(
            select(Factura.inscripcion_id, Pago.fecha)
            .join(Pago, Pago.factura_id == Factura.id)
            .where(Pago.id == evento.entidad_id)
        ).first()
        if fila is None:
            return None, None
        return db.get(Inscripcion, fila.inscripcion_id), fila.fecha
    return None, None


def _ya_cobrado(
    db: Session, inscripcion: Inscripcion, concepto_id: uuid.UUID, mes: date | None
) -> bool:
    consulta = (
        select(DetalleFactura.id)
        .join(Factura, Factura.id == DetalleFactura.factura_id)
        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
        .where(
            Inscripcion.alumno_id == inscripcion.alumno_id,
            DetalleFactura.concepto_cobro_id == concepto_id,
        )
    )
    if mes is None:
        consulta = consulta.where(Inscripcion.ciclo_lectivo == inscripcion.ciclo_lectivo)
    else:
        consulta = consulta.where(
            extract("year", Factura.fecha_emision) == mes.year,
            extract("month", Factura.fecha_emision) == mes.month,
        )
    return db.scalar(consulta.limit(1)) is not None


def _regla_facturacion(
    db: Session, inscripcion: Inscripcion, concepto_id: uuid.UUID
) -> tuple[ReglaFacturacion | None, str]:
    """La regla de facturación activa del concepto que alcanza a la inscripción, o el motivo por
    el que no hay una sola."""
    division = db.get(Division, inscripcion.division_id)
    anio = db.get(Anio, division.anio_id) if division else None
    criterio = ReglaFacturacion.criterio_aplicacion
    alcances = [
        criterio == "todas_inscripciones",
        and_(criterio == "division", ReglaFacturacion.division_id == inscripcion.division_id),
    ]
    if anio is not None:
        alcances += [
            and_(criterio == "anio", ReglaFacturacion.anio_id == anio.id),
            and_(
                criterio == "nivel", ReglaFacturacion.nivel_educativo_id == anio.nivel_educativo_id
            ),
        ]
    candidatas = db.scalars(
        select(ReglaFacturacion).where(
            ReglaFacturacion.estado == "activa",
            ReglaFacturacion.concepto_cobro_id == concepto_id,
            ReglaFacturacion.ciclo_lectivo == inscripcion.ciclo_lectivo,
            or_(*alcances),
        )
    ).all()
    if len(candidatas) == 1:
        return candidatas[0], ""
    if not candidatas:
        return None, (
            "No hay una regla de facturación activa de ese concepto para la inscripción: "
            "cargala en Reglas de facturación o fijá el monto en la regla de Workflows."
        )
    return None, "Hay más de una regla de facturación de ese concepto para la inscripción."


def _vencimiento(hoy: date, regla: ReglaFacturacion | None) -> date:
    """El día de vencimiento de la regla de facturación: este mes o, si ya pasó, el siguiente."""
    if regla is None:
        return hoy + timedelta(days=DIAS_PARA_VENCER_SIN_REGLA)
    este_mes = _dia_del_mes(hoy.year, hoy.month, regla.dia_vencimiento)
    if este_mes >= hoy:
        return este_mes
    anio, mes = (hoy.year + 1, 1) if hoy.month == 12 else (hoy.year, hoy.month + 1)
    return _dia_del_mes(anio, mes, regla.dia_vencimiento)


def _dia_del_mes(anio: int, mes: int, dia: int) -> date:
    return date(anio, mes, min(dia, calendar.monthrange(anio, mes)[1]))


def _responsable(db: Session, alumno_id: uuid.UUID, hoy: date) -> ResponsableEconomico | None:
    """El vigente hoy o, en un alta nueva, el ya programado: su vigencia arranca el mes que viene
    pero es la familia que lo inscribió."""
    return db.scalar(
        select(ResponsableEconomico)
        .where(
            ResponsableEconomico.alumno_id == alumno_id,
            or_(
                ResponsableEconomico.vigencia_hasta.is_(None),
                ResponsableEconomico.vigencia_hasta >= hoy,
            ),
        )
        .order_by(
            (ResponsableEconomico.vigencia_desde > hoy).asc(),
            ResponsableEconomico.vigencia_desde.desc(),
        )
        .limit(1)
    )
