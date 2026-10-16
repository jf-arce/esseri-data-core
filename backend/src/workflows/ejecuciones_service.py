"""Historial de ejecuciones de workflows (RF-23): listado, reintentos y decisiones sobre las
pendientes de aprobación humana. El despacho de eventos vive en `despacho_service.py`."""

import uuid
from datetime import datetime

from sqlalchemy import and_, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from src.auditoria.service import log_audit
from src.models import EventLog
from src.workflows import despacho_service, notificaciones_service
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.despacho_service import ERROR_ACCION, ERROR_CONFIGURACION, ERROR_EVALUACION
from src.workflows.exceptions import (
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
from src.workflows.service import tipos_de_campos


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


def _consulta_ejecuciones():
    # Mismas condiciones que valida `reintentar_ejecucion`, que sigue siendo la fuente de verdad.
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
    )


def _error_detail_publico(error_detail: str | None, tipo_accion: str) -> str | None:
    if error_detail is None:
        return None
    controlados = {
        ERROR_EVALUACION,
        ERROR_CONFIGURACION,
        ERROR_ACCION,
        *notificaciones_service.ERRORES_CONTROLADOS,
        "La regla ya no aplica al evento original.",
        ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion=tipo_accion),
    }
    return error_detail if error_detail in controlados else ERROR_ACCION
