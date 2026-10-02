"""Despacho de eventos pendientes: evalúa las reglas activas de cada evento y ejecuta su acción.

Comparte con `service.py` (ABM de reglas) la validación contra la allowlist: lo que se guardó en
la regla se vuelve a validar acá antes de ejecutarlo."""

import logging
import operator
import uuid
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import and_, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, aliased

from src.auditoria.service import log_audit
from src.models import EventLog
from src.workflows import notificaciones_service
from src.workflows.constants import ENTIDAD_POR_EVENTO
from src.workflows.eventos_service import coaccionar_valor
from src.workflows.exceptions import (
    EjecucionNoEncontrada,
    EjecucionNoReintentable,
    EntidadDeEventoInvalida,
    TipoEventoNoEncontrado,
)
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from src.workflows.schemas import (
    EstadoWorkflowExecution,
    ResultadoAccion,
    ResumenDespacho,
    WorkflowExecutionListadoRead,
    WorkflowExecutionRead,
)
from src.workflows.service import tipos_de_campos, validar_accion, validar_condicion

logger = logging.getLogger(__name__)


# Una acción recibe la sesión (dentro de un savepoint), la regla, el evento y la ejecución en
# curso, y devuelve el detalle y, si falló sin perder lo ya escrito, el motivo. Nunca hace commit.
# Cada tipo de acción se registra acá al implementarse (ver #68 y #89).
AccionHandler = Callable[[Session, WorkflowRule, EventLog, WorkflowExecution], ResultadoAccion]
ACCIONES: dict[str, AccionHandler] = {"notificar": notificaciones_service.ejecutar_notificar}

ERROR_EVALUACION = "No se pudo evaluar la regla con los datos del evento."
ERROR_CONFIGURACION = "La configuración de la acción no es válida."
ERROR_ACCION = "La acción no pudo completarse."
ERROR_ACCION_NO_IMPLEMENTADA = "La acción '{tipo_accion}' todavía no está implementada."


def procesar_eventos_pendientes(db: Session, limite: int = 100) -> ResumenDespacho:
    """Toma los eventos `pendiente` más antiguos y ejecuta las reglas activas de su tipo.

    Cada evento se toma con `FOR UPDATE SKIP LOCKED` y se confirma por separado: dos
    despachadores a la vez (el job y el endpoint manual) no pisan el mismo evento, y una falla
    en uno no revierte los ya procesados.
    """
    resumen = ResumenDespacho()
    for _ in range(limite):
        evento = db.scalars(
            select(EventLog)
            .where(EventLog.estado == "pendiente")
            .order_by(EventLog.timestamp)
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if evento is None:
            break

        evento_id = evento.id
        try:
            resumen.ejecuciones_creadas += _despachar_evento(db, evento)
            evento.estado = "procesado"
            db.commit()
            resumen.eventos_procesados += 1
        except Exception:
            db.rollback()
            logger.exception("Falló el despacho del evento %s", evento_id)
            _marcar_evento_fallido(db, evento_id)
            resumen.eventos_fallidos += 1
    return resumen


def _despachar_evento(db: Session, evento: EventLog) -> int:
    tipo_evento = db.get(TipoEvento, evento.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    campos = tipos_de_campos(db, tipo_evento.id)
    reglas = db.scalars(
        select(WorkflowRule)
        .where(WorkflowRule.tipo_evento_id == evento.tipo_evento_id, WorkflowRule.activo.is_(True))
        .order_by(WorkflowRule.nombre)
    ).all()

    creadas = 0
    for regla in reglas:
        ejecucion = _procesar_regla(db, regla, evento, tipo_evento, campos, intento=1)
        if ejecucion is not None:
            creadas += 1
    return creadas


def _procesar_regla(
    db: Session,
    regla: WorkflowRule,
    evento: EventLog,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
    *,
    intento: int,
    registrar_si_no_aplica: bool = False,
) -> WorkflowExecution | None:
    ejecucion = WorkflowExecution(
        workflow_rule_id=regla.id,
        event_log_id=evento.id,
        intento=intento,
    )
    # Cada regla se evalúa aislada: una que no se puede evaluar queda como ejecución fallida
    # y no impide que se procesen las demás del mismo evento.
    try:
        aplica = _regla_aplica(regla, evento, tipo_evento.nombre, campos)
    except Exception:
        logger.warning("No se pudo evaluar la regla %s", regla.id, exc_info=True)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION)
        return ejecucion

    if not aplica:
        if not registrar_si_no_aplica:
            return None
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, "La regla ya no aplica al evento original.")
        return ejecucion

    try:
        validar_accion(
            db,
            regla.tipo_accion,
            regla.accion_config,
            tipo_evento.nombre,
            campos,
            regla.notificacion_template_id,
        )
    except Exception:
        logger.warning("La configuración de la regla %s no es válida", regla.id, exc_info=True)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_CONFIGURACION)
        return ejecucion

    # La fila se inserta antes de cualquier efecto de la acción. La restricción única evita
    # ejecutar dos veces el mismo número de intento aun si el bloqueo no está disponible.
    _reservar_ejecucion(db, ejecucion)
    if regla.requiere_aprobacion_humana:
        ejecucion.estado = "pendiente"
        ejecucion.detalle = "Esperando aprobación humana."
    else:
        _ejecutar_accion(db, regla, evento, ejecucion)
    return ejecucion


def _reservar_ejecucion(db: Session, ejecucion: WorkflowExecution) -> None:
    db.add(ejecucion)
    db.flush()


def _regla_aplica(
    regla: WorkflowRule, evento: EventLog, tipo_evento_nombre: str, campos: dict[str, str]
) -> bool:
    esperada = ENTIDAD_POR_EVENTO.get(tipo_evento_nombre)
    if esperada != evento.entidad:
        raise EntidadDeEventoInvalida(tipo_evento_nombre, evento.entidad, esperada or "ninguna")
    return _cumple_condicion(regla.condicion, campos, evento.payload or {})


_Comparable = Decimal | date | str
_COMPARADORES: dict[str, Callable[[_Comparable, _Comparable], bool]] = {
    "==": operator.eq,
    "!=": operator.ne,
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
}


def _cumple_condicion(
    condicion: dict[str, object], campos: dict[str, str], payload: dict[str, object]
) -> bool:
    """Evalúa `{campo, operador, valor}` contra el payload del evento. Sin condición, siempre
    se cumple. Un campo ausente o de tipo equivocado no se compara: se informa como error."""
    parseada = validar_condicion(condicion, campos)
    if parseada is None:
        return True
    tipo_dato = campos[parseada.campo]
    if parseada.campo not in payload:
        raise ValueError(f"El evento no trae el campo '{parseada.campo}'.")
    try:
        actual = coaccionar_valor(tipo_dato, payload[parseada.campo])
    except ValueError as error:
        raise ValueError(f"Campo '{parseada.campo}' del evento: {error}") from error
    esperado = coaccionar_valor(tipo_dato, parseada.valor)
    if parseada.operador == "contiene":
        return str(esperado).lower() in str(actual).lower()
    return _COMPARADORES[parseada.operador](actual, esperado)


def _marcar_fallida(ejecucion: WorkflowExecution, motivo: str) -> None:
    ejecucion.estado = "fallido"
    ejecucion.error_detail = motivo
    ejecucion.finished_at = datetime.now()


def _ejecutar_accion(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> None:
    handler = ACCIONES.get(regla.tipo_accion)
    if handler is None:
        _marcar_fallida(
            ejecucion,
            ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion=regla.tipo_accion),
        )
        return
    try:
        # Savepoint: si la acción falla a mitad de camino, sus escrituras se revierten sin
        # perder la ejecución ni las de otras reglas del mismo evento.
        with db.begin_nested():
            resultado = handler(db, regla, evento, ejecucion)
    except Exception:
        logger.exception("Falló la acción '%s' de la regla %s", regla.tipo_accion, regla.id)
        _marcar_fallida(ejecucion, ERROR_ACCION)
        return
    ejecucion.detalle = resultado.detalle
    if resultado.error is not None:
        _marcar_fallida(ejecucion, resultado.error)
        return
    ejecucion.estado = "exitoso"
    ejecucion.finished_at = datetime.now()


def _marcar_evento_fallido(db: Session, evento_id: uuid.UUID) -> None:
    evento = db.get(EventLog, evento_id)
    if evento is not None:
        evento.estado = "fallido"
        db.commit()


# --- Historial y reintentos (RF-23) ------------------------------------------------------


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
        nueva = _procesar_regla(
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
