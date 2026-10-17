"""Historial de ejecuciones de workflows (RF-23): listado, reintentos y decisiones sobre las
pendientes de aprobación humana. El despacho de eventos vive en `despacho_service.py`."""

import logging
import uuid
from datetime import datetime

from sqlalchemy import and_, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from src.auditoria.service import log_audit
from src.models import EventLog
from src.workflows import despacho_service, notificaciones_service, tareas_service
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.despacho_service import ERROR_ACCION, ERROR_CONFIGURACION, ERROR_EVALUACION
from src.workflows.exceptions import (
    EjecucionNoDecidible,
    EjecucionNoEncontrada,
    EjecucionNoReintentable,
    TipoEventoNoEncontrado,
)
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from src.workflows.schemas import (
    EstadoWorkflowExecution,
    WorkflowExecutionListadoRead,
    WorkflowExecutionRead,
)
from src.workflows.service import tipos_de_campos, validar_accion

logger = logging.getLogger(__name__)


def listar_ejecuciones(
    db: Session,
    *,
    estado: EstadoWorkflowExecution | None,
    pagina: int,
    tamanio_pagina: int,
) -> WorkflowExecutionListadoRead:
    filtros = [] if estado is None else [WorkflowExecution.estado == estado]
    total = db.scalar(select(func.count(WorkflowExecution.id)).where(*filtros)) or 0
    filas = db.execute(
        _consulta_ejecuciones()
        .where(*filtros)
        .order_by(WorkflowExecution.started_at.desc(), WorkflowExecution.id.desc())
        .offset((pagina - 1) * tamanio_pagina)
        .limit(tamanio_pagina)
    ).all()
    return WorkflowExecutionListadoRead(
        items=[_fila_ejecucion_read(*fila) for fila in filas],
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=(total + tamanio_pagina - 1) // tamanio_pagina,
    )


def obtener_ejecucion_read(db: Session, ejecucion_id: uuid.UUID) -> WorkflowExecutionRead:
    fila = db.execute(
        _consulta_ejecuciones().where(WorkflowExecution.id == ejecucion_id)
    ).one_or_none()
    if fila is None:
        raise EjecucionNoEncontrada()
    return _fila_ejecucion_read(*fila)


def reintentar_ejecucion(
    db: Session, ejecucion_id: uuid.UUID, usuario_id: uuid.UUID
) -> WorkflowExecutionRead:
    anterior = db.scalar(
        select(WorkflowExecution).where(WorkflowExecution.id == ejecucion_id).with_for_update()
    )
    if anterior is None:
        raise EjecucionNoEncontrada()

    # La regla es el ancla estable que serializa reintentos concurrentes del mismo workflow.
    regla = db.scalar(
        select(WorkflowRule).where(WorkflowRule.id == anterior.workflow_rule_id).with_for_update()
    )
    if regla is None:
        raise EjecucionNoReintentable("La regla asociada ya no existe.")
    if not regla.activo:
        raise EjecucionNoReintentable("No se puede reintentar una regla inactiva.")

    ultimo = db.scalars(
        select(WorkflowExecution)
        .where(
            WorkflowExecution.workflow_rule_id == anterior.workflow_rule_id,
            WorkflowExecution.event_log_id == anterior.event_log_id,
        )
        .order_by(WorkflowExecution.intento.desc())
        .limit(1)
    ).one()
    if ultimo.id != anterior.id:
        raise EjecucionNoReintentable("La ejecución indicada ya tiene un intento posterior.")
    if anterior.estado != "fallido":
        raise EjecucionNoReintentable("Solo se pueden reintentar ejecuciones fallidas.")
    if regla.updated_at > anterior.started_at:
        raise EjecucionNoReintentable(
            "La regla fue modificada después de esta ejecución; debe generarse un evento nuevo."
        )

    evento = db.get(EventLog, anterior.event_log_id)
    if evento is None:
        raise EjecucionNoReintentable("El evento original ya no existe.")
    tipo_evento = db.get(TipoEvento, evento.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()

    try:
        nueva = despacho_service._procesar_regla(
            db,
            regla,
            evento,
            tipo_evento,
            tipos_de_campos(db, tipo_evento.id),
            intento=anterior.intento + 1,
            registrar_si_no_aplica=True,
        )
    except IntegrityError as error:
        db.rollback()
        raise EjecucionNoReintentable(
            "Otro reintento de esta ejecución ya fue registrado."
        ) from error
    if nueva is None:
        raise RuntimeError("El reintento no generó una ejecución.")
    db.flush()
    log_audit(
        db,
        entidad="WORKFLOW_EXECUTION",
        entidad_id=nueva.id,
        campo="__reintento__",
        valor_anterior=str(anterior.id),
        valor_nuevo=f"intento={nueva.intento}",
        usuario_id=usuario_id,
    )
    db.commit()
    return obtener_ejecucion_read(db, nueva.id)


def _bloquear_pendiente(db: Session, ejecucion_id: uuid.UUID) -> WorkflowExecution:
    """Toma la ejecución con `FOR UPDATE`: dos decisiones simultáneas se serializan y la
    segunda, al conseguir el lock, ya no la ve `pendiente`."""
    ejecucion = db.scalar(
        select(WorkflowExecution).where(WorkflowExecution.id == ejecucion_id).with_for_update()
    )
    if ejecucion is None:
        raise EjecucionNoEncontrada()
    if ejecucion.estado != "pendiente":
        raise EjecucionNoDecidible("Solo se pueden decidir ejecuciones pendientes de aprobación.")
    return ejecucion


def aprobar_ejecucion(
    db: Session, ejecucion_id: uuid.UUID, usuario_id: uuid.UUID
) -> WorkflowExecutionRead:
    ejecucion = _bloquear_pendiente(db, ejecucion_id)
    regla = db.scalar(
        select(WorkflowRule).where(WorkflowRule.id == ejecucion.workflow_rule_id).with_for_update()
    )
    if regla is None:
        raise EjecucionNoDecidible("La regla asociada ya no existe.")
    if not regla.activo:
        raise EjecucionNoDecidible("No se puede aprobar una regla inactiva.")
    if regla.updated_at > ejecucion.started_at:
        raise EjecucionNoDecidible(
            "La regla cambió desde que quedó pendiente; rechazala y generá un evento nuevo."
        )
    evento = db.get(EventLog, ejecucion.event_log_id)
    if evento is None:
        raise EjecucionNoDecidible("El evento original ya no existe.")
    tipo_evento = db.get(TipoEvento, evento.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()

    # Si no se limpia, "Esperando aprobación humana." sobrevive cuando la acción falla.
    ejecucion.detalle = None
    try:
        validar_accion(
            db,
            regla.tipo_accion,
            regla.accion_config,
            tipo_evento.nombre,
            tipos_de_campos(db, tipo_evento.id),
            regla.notificacion_template_id,
        )
    except Exception:
        logger.warning("La configuración de la regla %s no es válida", regla.id, exc_info=True)
        despacho_service._marcar_fallida(ejecucion, ERROR_CONFIGURACION)
    else:
        despacho_service._ejecutar_accion(db, regla, evento, ejecucion)

    log_audit(
        db,
        entidad="WORKFLOW_EXECUTION",
        entidad_id=ejecucion.id,
        campo="__aprobacion__",
        valor_anterior="pendiente",
        valor_nuevo=ejecucion.estado,
        usuario_id=usuario_id,
    )
    db.commit()
    return obtener_ejecucion_read(db, ejecucion.id)


def rechazar_ejecucion(
    db: Session, ejecucion_id: uuid.UUID, motivo: str, usuario_id: uuid.UUID
) -> WorkflowExecutionRead:
    # No valida la regla: una pendiente cuya regla se editó o desactivó siempre se puede cerrar.
    ejecucion = _bloquear_pendiente(db, ejecucion_id)
    ejecucion.estado = "rechazado"
    # Va en `detalle` y no en `error_detail`, que `_error_detail_publico` enmascara.
    ejecucion.detalle = f"Rechazada: {motivo}"
    ejecucion.finished_at = datetime.now()
    log_audit(
        db,
        entidad="WORKFLOW_EXECUTION",
        entidad_id=ejecucion.id,
        campo="__rechazo__",
        valor_anterior="pendiente",
        valor_nuevo=motivo,
        usuario_id=usuario_id,
    )
    db.commit()
    return obtener_ejecucion_read(db, ejecucion.id)


def _consulta_ejecuciones():
    # `reintentable` y `aprobable` repiten lo que validan `reintentar_ejecucion` y
    # `aprobar_ejecucion`, que siguen siendo la fuente de verdad.
    posterior = aliased(WorkflowExecution)
    reintentable = and_(
        WorkflowExecution.estado == "fallido",
        WorkflowRule.activo,
        WorkflowRule.updated_at <= WorkflowExecution.started_at,
        ~exists().where(
            posterior.workflow_rule_id == WorkflowExecution.workflow_rule_id,
            posterior.event_log_id == WorkflowExecution.event_log_id,
            posterior.intento > WorkflowExecution.intento,
        ),
    )
    aprobable = and_(
        WorkflowExecution.estado == "pendiente",
        WorkflowRule.activo,
        WorkflowRule.updated_at <= WorkflowExecution.started_at,
    )
    return (
        select(
            WorkflowExecution,
            WorkflowRule.nombre,
            WorkflowRule.tipo_accion,
            TipoEvento.nombre,
            EventLog.timestamp,
            EventLog.entidad,
            EventLog.entidad_id,
            reintentable.label("reintentable"),
            aprobable.label("aprobable"),
        )
        .join(WorkflowRule, WorkflowRule.id == WorkflowExecution.workflow_rule_id)
        .join(EventLog, EventLog.id == WorkflowExecution.event_log_id)
        .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
    )


def _fila_ejecucion_read(
    ejecucion: WorkflowExecution,
    regla_nombre: str,
    tipo_accion: str,
    tipo_evento: str,
    evento_timestamp: datetime,
    entidad: str,
    entidad_id: uuid.UUID,
    reintentable: bool,
    aprobable: bool,
) -> WorkflowExecutionRead:
    return WorkflowExecutionRead(
        id=ejecucion.id,
        intento=ejecucion.intento,
        started_at=ejecucion.started_at,
        finished_at=ejecucion.finished_at,
        estado=ejecucion.estado,
        detalle=ejecucion.detalle,
        error_detail=_error_detail_publico(ejecucion.error_detail, tipo_accion),
        workflow_rule_id=ejecucion.workflow_rule_id,
        workflow_rule_nombre=regla_nombre,
        tipo_accion=tipo_accion,
        event_log_id=ejecucion.event_log_id,
        tipo_evento=tipo_evento,
        evento_timestamp=evento_timestamp,
        entidad=entidad,
        entidad_id=entidad_id,
        reintentable=reintentable,
        aprobable=aprobable,
    )


def _error_detail_publico(error_detail: str | None, tipo_accion: str) -> str | None:
    if error_detail is None:
        return None
    controlados = {
        ERROR_EVALUACION,
        ERROR_CONFIGURACION,
        ERROR_ACCION,
        *notificaciones_service.ERRORES_CONTROLADOS,
        *tareas_service.ERRORES_CONTROLADOS,
        "La regla ya no aplica al evento original.",
        ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion=tipo_accion),
    }
    return error_detail if error_detail in controlados else ERROR_ACCION
