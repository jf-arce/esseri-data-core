"""Stubs de crear_tarea y escalar_caso. Dueño: Arce (ver #199)."""

from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_crear_tarea(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="crear_tarea"))


def ejecutar_escalar_caso(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="escalar_caso"))
