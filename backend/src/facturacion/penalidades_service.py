"""Motor de penalidades por tramos de mora (`REGLA_PENALIDAD`) y su configuración, junto con las
prórrogas de vencimiento por familia (`EXCEPCION_VENCIMIENTO`)."""

import uuid
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.facturacion.exceptions import (
    ConceptoCobroInvalido,
    ExcepcionVencimientoNoEncontrada,
    ExcepcionVencimientoYaAnulada,
    ReglaPenalidadNoEncontrada,
    TramoPenalidadSuperpuesto,
)
from src.facturacion.models import (
    ConceptoCobro,
    ExcepcionVencimiento,
    Factura,
    Movimiento,
    ReglaPenalidad,
)
from src.facturacion.schemas import (
    ExcepcionVencimientoCreate,
    ReglaPenalidadCreate,
    ReglaPenalidadEstadoUpdate,
    ReglaPenalidadUpdate,
)

CENTAVO = Decimal("0.01")
ENTIDAD_REGLA = "REGLA_PENALIDAD"
ENTIDAD_EXCEPCION = "EXCEPCION_VENCIMIENTO"


def resolver_tramo(db: Session, dias_vencido: int) -> ReglaPenalidad | None:
    """Tramo activo de mayor `desde_dia_vencido` que alcanzó el atraso.

    Pasado el último tramo la deuda conserva su penalidad ("continúa como deuda vencida con las
    penalidades correspondientes", respuesta 5 del cliente), igual que en `vencimientos_service`.
    """
    return db.scalar(
        select(ReglaPenalidad)
        .where(ReglaPenalidad.activo.is_(True), ReglaPenalidad.desde_dia_vencido <= dias_vencido)
        .order_by(ReglaPenalidad.desde_dia_vencido.desc())
        .limit(1)
    )


def penalidades_registradas(db: Session, factura_id: uuid.UUID) -> Decimal:
    """Penalidades ya imputadas a la factura: debe sin detalle, con un concepto de penalidad."""
    return db.scalar(
        select(func.coalesce(func.sum(Movimiento.monto), Decimal("0.00"))).where(
            Movimiento.factura_id == factura_id,
            Movimiento.tipo == "debe",
            Movimiento.detalle_factura_id.is_(None),
            Movimiento.concepto_cobro_id.in_(select(ReglaPenalidad.concepto_cobro_id)),
        )
    ) or Decimal("0.00")


def calcular_penalidad(db: Session, factura: Factura, regla: ReglaPenalidad) -> Decimal:
    """Lo que falta cobrar para que la penalidad de la factura sea el porcentaje del tramo.

    Los tramos no se suman: con 16–30 días la penalidad total es el 30 % del monto de la factura,
    no 20 % + 30 %. Restar lo ya registrado vuelve idempotente el cálculo.
    """
    objetivo = (Decimal(factura.monto_total) * Decimal(regla.porcentaje) / 100).quantize(
        CENTAVO, ROUND_HALF_UP
    )
    return max(objetivo - penalidades_registradas(db, factura.id), Decimal("0.00"))


def listar_reglas_penalidad(db: Session) -> list[ReglaPenalidad]:
    return list(
        db.scalars(
            select(ReglaPenalidad).order_by(
                ReglaPenalidad.activo.desc(), ReglaPenalidad.desde_dia_vencido
            )
        ).all()
    )


def obtener_regla_penalidad_o_error(db: Session, regla_id: uuid.UUID) -> ReglaPenalidad:
    regla = db.get(ReglaPenalidad, regla_id)
    if regla is None:
        raise ReglaPenalidadNoEncontrada()
    return regla


def _validar_concepto_activo(db: Session, concepto_id: uuid.UUID) -> None:
    concepto = db.get(ConceptoCobro, concepto_id)
    if concepto is None or not concepto.activo:
        raise ConceptoCobroInvalido("El concepto de cobro debe existir y estar activo.")


def _validar_sin_superposicion(db: Session, regla: ReglaPenalidad) -> None:
    """Dos tramos activos no pueden cubrir el mismo día: el cálculo sería ambiguo."""
    if not regla.activo:
        return
    otros = db.scalars(
        select(ReglaPenalidad).where(ReglaPenalidad.activo.is_(True), ReglaPenalidad.id != regla.id)
    ).all()
    infinito = float("inf")
    hasta = regla.hasta_dia_vencido if regla.hasta_dia_vencido is not None else infinito
    for otro in otros:
        hasta_otro = otro.hasta_dia_vencido if otro.hasta_dia_vencido is not None else infinito
        if regla.desde_dia_vencido <= hasta_otro and otro.desde_dia_vencido <= hasta:
            raise TramoPenalidadSuperpuesto(
                f"El tramo se superpone con el tramo activo que empieza el día "
                f"{otro.desde_dia_vencido}."
            )


def crear_regla_penalidad(
    db: Session, datos: ReglaPenalidadCreate, usuario_id: uuid.UUID | None = None
) -> ReglaPenalidad:
    _validar_concepto_activo(db, datos.concepto_cobro_id)
    regla = ReglaPenalidad(**datos.model_dump())
    db.add(regla)
    db.flush()
    try:
        _validar_sin_superposicion(db, regla)
    except Exception:
        db.rollback()
        raise
    log_audit(
        db,
        entidad=ENTIDAD_REGLA,
        entidad_id=regla.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"{regla.desde_dia_vencido}-{regla.hasta_dia_vencido}: {regla.porcentaje}%",
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(regla)
    return regla


def actualizar_regla_penalidad(
    db: Session,
    regla: ReglaPenalidad,
    datos: ReglaPenalidadUpdate,
    usuario_id: uuid.UUID | None = None,
) -> ReglaPenalidad:
    _validar_concepto_activo(db, datos.concepto_cobro_id)
    nuevos = datos.model_dump()
    anteriores = {campo: getattr(regla, campo) for campo in nuevos}
    for campo, valor in nuevos.items():
        setattr(regla, campo, valor)
    try:
        _validar_sin_superposicion(db, regla)
        for campo, anterior in anteriores.items():
            if anterior == nuevos[campo]:
                continue
            log_audit(
                db,
                entidad=ENTIDAD_REGLA,
                entidad_id=regla.id,
                campo=campo,
                valor_anterior=str(anterior) if anterior is not None else None,
                valor_nuevo=str(nuevos[campo]) if nuevos[campo] is not None else None,
                usuario_id=usuario_id,
            )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(regla)
    return regla


def actualizar_estado_regla_penalidad(
    db: Session,
    regla: ReglaPenalidad,
    datos: ReglaPenalidadEstadoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> ReglaPenalidad:
    """Baja lógica: el tramo no se borra porque puede haber penalidades cobradas con él."""
    anterior = regla.activo
    regla.activo = datos.activo
    try:
        _validar_sin_superposicion(db, regla)
        log_audit(
            db,
            entidad=ENTIDAD_REGLA,
            entidad_id=regla.id,
            campo="activo",
            valor_anterior=str(anterior),
            valor_nuevo=str(datos.activo),
            usuario_id=usuario_id,
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(regla)
    return regla


def listar_excepciones_familia(db: Session, familia_id: uuid.UUID) -> list[ExcepcionVencimiento]:
    return list(
        db.scalars(
            select(ExcepcionVencimiento)
            .where(ExcepcionVencimiento.familia_id == familia_id)
            .order_by(ExcepcionVencimiento.fecha_vencimiento_excepcional.desc())
        ).all()
    )


def crear_excepcion_vencimiento(
    db: Session, familia_id: uuid.UUID, datos: ExcepcionVencimientoCreate, usuario_id: uuid.UUID
) -> ExcepcionVencimiento:
    excepcion = ExcepcionVencimiento(
        familia_id=familia_id, usuario_id=usuario_id, **datos.model_dump()
    )
    db.add(excepcion)
    db.flush()
    log_audit(
        db,
        entidad=ENTIDAD_EXCEPCION,
        entidad_id=excepcion.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=excepcion.fecha_vencimiento_excepcional.isoformat(),
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(excepcion)
    return excepcion


def anular_excepcion_vencimiento(
    db: Session, excepcion_id: uuid.UUID, usuario_id: uuid.UUID
) -> ExcepcionVencimiento:
    """No se edita ni se borra: queda anulada, con quién y cuándo, y deja de postergar."""
    excepcion = db.get(ExcepcionVencimiento, excepcion_id)
    if excepcion is None:
        raise ExcepcionVencimientoNoEncontrada()
    if excepcion.anulada_at is not None:
        raise ExcepcionVencimientoYaAnulada()
    excepcion.anulada_at = datetime.now(UTC)
    excepcion.usuario_anulacion_id = usuario_id
    log_audit(
        db,
        entidad=ENTIDAD_EXCEPCION,
        entidad_id=excepcion.id,
        campo="anulada_at",
        valor_anterior=None,
        valor_nuevo=excepcion.anulada_at.isoformat(),
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(excepcion)
    return excepcion
