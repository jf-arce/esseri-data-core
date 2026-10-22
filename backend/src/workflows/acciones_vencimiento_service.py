"""Ejecutores de vencimiento y cambio de estado. Dueño: Arce (ver #203)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.models import ExcepcionVencimiento, Factura, ResponsableEconomico
from src.models import EventLog
from src.workflows.constants import CAMBIOS_ESTADO_PERMITIDOS
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ConfigCambiarEstado, ResultadoAccion


def ejecutar_aplicar_vencimiento(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Revalida el vencimiento al ejecutar, incluso tras una aprobación o un reintento."""
    return _vencer_factura(db, evento, respetar_fecha=True)


def ejecutar_cambiar_estado(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Cambio explícito acotado por la allowlist, sin política de fechas o excepciones."""
    config = ConfigCambiarEstado.model_validate(regla.accion_config or {})
    if config.estado_nuevo not in CAMBIOS_ESTADO_PERMITIDOS.get(evento.entidad, frozenset()):
        return _error("El cambio de estado no está permitido.")
    if evento.entidad != "factura" or config.estado_nuevo != "vencida":
        return _error("El cambio de estado no tiene un ejecutor para esta entidad.")
    return _vencer_factura(db, evento, respetar_fecha=False)


def _error(motivo: str) -> ResultadoAccion:
    return ResultadoAccion(detalle=motivo, error=motivo)


def _vencer_factura(db: Session, evento: EventLog, *, respetar_fecha: bool) -> ResultadoAccion:
    if evento.entidad != "factura":
        return _error("La acción requiere una factura.")
    # populate_existing: la factura pudo pagarse mientras esperábamos el bloqueo.
    factura = db.scalar(
        select(Factura)
        .where(Factura.id == evento.entidad_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if factura is None:
        return _error("La factura del evento no existe.")
    if factura.estado == "vencida":
        return ResultadoAccion(detalle="Sin cambios: la factura ya está vencida.")
    if factura.estado == "pagada":
        return ResultadoAccion(detalle="Sin cambios: la factura ya está pagada.")
    if factura.estado != "pendiente":
        return _error("El estado de la factura no permite marcarla vencida.")

    if respetar_fecha:
        responsable = db.get(ResponsableEconomico, factura.responsable_economico_id)
        if responsable is None:
            return _error("La factura no tiene un responsable económico válido.")
        excepcion = db.scalar(
            select(func.max(ExcepcionVencimiento.fecha_vencimiento_excepcional)).where(
                ExcepcionVencimiento.familia_id == responsable.familia_id,
                ExcepcionVencimiento.anulada_at.is_(None),
            )
        )
        vencimiento = factura.fecha_vencimiento
        if excepcion is not None:
            vencimiento = max(vencimiento, excepcion)
        if fecha_operativa_argentina() <= vencimiento:
            return ResultadoAccion(
                detalle=f"Sin cambios: el vencimiento efectivo es {vencimiento.isoformat()}."
            )

    factura.estado = "vencida"
    db.flush()
    return ResultadoAccion(detalle="Factura marcada como vencida (estado anterior: pendiente).")
