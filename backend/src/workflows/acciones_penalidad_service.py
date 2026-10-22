"""Ejecutor de aplicar_penalidad. Dueño: Canu (ver #204)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.facturacion.cuenta_corriente_service import registrar_penalidad_en_transaccion
from src.facturacion.models import Factura, ReglaPenalidad
from src.facturacion.penalidades_service import calcular_penalidad, resolver_tramo
from src.models import EventLog
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ConfigAplicarPenalidad, ResultadoAccion


def ejecutar_aplicar_penalidad(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Registra en la cuenta corriente la penalidad del tramo que alcanzó el atraso del evento."""
    if evento.entidad != "factura":
        return _error("La acción requiere una factura.")
    dias_vencido = (evento.payload or {}).get("dias_vencido")
    if not isinstance(dias_vencido, int):
        return _error("El evento no informa los días de vencimiento.")
    # El bloqueo impide que dos ejecuciones lean a la vez la misma penalidad previa.
    factura = db.scalar(
        select(Factura)
        .where(Factura.id == evento.entidad_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if factura is None:
        return _error("La factura del evento no existe.")
    # Fechas y prórrogas las decide aplicar_vencimiento: acá solo se penaliza lo que ya venció.
    if factura.estado != "vencida":
        return ResultadoAccion(detalle=f"Sin cambios: la factura está {factura.estado}.")

    config = ConfigAplicarPenalidad.model_validate(regla.accion_config or {})
    if config.regla_penalidad_id is not None:
        tramo = db.get(ReglaPenalidad, config.regla_penalidad_id)
        if tramo is None or not tramo.activo:
            return _error("La regla de penalidad indicada no existe o está inactiva.")
    else:
        tramo = resolver_tramo(db, dias_vencido)
        if tramo is None:
            return ResultadoAccion(
                detalle=f"Sin cambios: ningún tramo activo alcanza {dias_vencido} días."
            )

    nombre = _nombre_tramo(tramo)
    monto = calcular_penalidad(db, factura, tramo)
    if monto <= 0:
        if tramo.porcentaje == 0:
            return ResultadoAccion(detalle=f"Sin cambios: el tramo {nombre} no genera penalidad.")
        return ResultadoAccion(
            detalle=f"Sin cambios: la factura ya tiene la penalidad del tramo {nombre}."
        )
    registrar_penalidad_en_transaccion(
        db,
        factura,
        tramo,
        monto=monto,
        observacion=f"Penalidad por mora: tramo {nombre} ({tramo.porcentaje} %)",
        event_log_id=evento.id,
    )
    return ResultadoAccion(detalle=f"Penalidad de ${monto} registrada (tramo {nombre}).")


def _error(motivo: str) -> ResultadoAccion:
    return ResultadoAccion(detalle=motivo, error=motivo)


def _nombre_tramo(tramo: ReglaPenalidad) -> str:
    if tramo.hasta_dia_vencido is None:
        return f"desde {tramo.desde_dia_vencido} días"
    return f"{tramo.desde_dia_vencido}–{tramo.hasta_dia_vencido} días"
