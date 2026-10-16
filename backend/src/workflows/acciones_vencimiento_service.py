"""Acciones de vencimiento de facturas. Dueño: Carreon. Stub: ver #199."""

from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_aplicar_vencimiento(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(
        error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="aplicar_vencimiento")
    )


def ejecutar_cambiar_estado(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="cambiar_estado"))
