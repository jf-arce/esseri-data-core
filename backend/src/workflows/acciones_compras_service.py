"""Stubs de generar_orden_compra y generar_comunicacion. Dueño: Canu (ver #199)."""

from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_generar_orden_compra(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(
        error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="generar_orden_compra")
    )


def ejecutar_generar_comunicacion(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(
        error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="generar_comunicacion")
    )
