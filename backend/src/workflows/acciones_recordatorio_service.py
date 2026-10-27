"""Acción `generar_recordatorio` (#218): un aviso a los responsables, `dias_despues` días después
del evento, solo si todavía corresponde.

El despachador no la ejecuta al llegar el evento: la toma
`despacho_service.procesar_recordatorios_vencidos` cuando se cumple el plazo. El envío es el de
`notificar`; lo propio de acá es decidir si ya no hace falta."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import JustificacionInasistencia
from src.inscripciones.models import Asistencia
from src.models import EventLog
from src.workflows import notificaciones_service
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_generar_recordatorio(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    motivo = _motivo_para_no_recordar(db, evento)
    if motivo is not None:
        # No es un error: pasó el tiempo y lo que se iba a recordar ya se resolvió.
        return ResultadoAccion(detalle=f"No se envió: {motivo}")
    return notificaciones_service.ejecutar_recordatorio(db, regla, evento, ejecucion)


def _motivo_para_no_recordar(db: Session, evento: EventLog) -> str | None:
    """Una inasistencia sin justificar deja de necesitar el recordatorio si se borró, si la familia
    ya cargó una justificación (aunque esté por revisar) o si ya se resolvió. Los demás eventos
    siempre se recuerdan."""
    if evento.entidad != "asistencia":
        return None
    asistencia = db.get(Asistencia, evento.entidad_id)
    if asistencia is None:
        return "la asistencia ya no existe."
    if asistencia.tipo != "ausente_pendiente":
        return "la inasistencia ya está resuelta."
    justificada = db.scalar(
        select(JustificacionInasistencia.id)
        .where(JustificacionInasistencia.asistencia_id == asistencia.id)
        .limit(1)
    )
    if justificada is not None:
        return "la familia ya cargó una justificación."
    return None
