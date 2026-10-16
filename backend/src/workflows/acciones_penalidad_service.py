"""Stub de la acción aplicar_penalidad. Dueño: Carreon (ver #199)."""

from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_aplicar_penalidad(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(
        error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="aplicar_penalidad")
    )
