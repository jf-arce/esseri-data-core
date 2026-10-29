"""Despacho de eventos pendientes: evalúa las reglas activas de cada evento y ejecuta su acción.

Comparte con `service.py` (ABM de reglas) la validación contra la allowlist: lo que se guardó en
la regla se vuelve a validar acá antes de ejecutarlo."""

import logging
import operator
import uuid
from collections.abc import Callable
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from src.fechas import ahora_utc
from src.models import EventLog
from src.workflows import (
    acciones_admision_service,
    acciones_compras_service,
    acciones_pagos_service,
    acciones_penalidad_service,
    acciones_recordatorio_service,
    acciones_vencimiento_service,
    notificaciones_service,
    tareas_service,
)
from src.workflows.constants import (
    ACCIONES_DIFERIDAS,
    ENTIDAD_POR_EVENTO,
    ERROR_ACCION_NO_IMPLEMENTADA,
    VENTANA_RECORDATORIOS_DIAS,
)
from src.workflows.eventos_service import coaccionar_valor
from src.workflows.exceptions import (
    EntidadDeEventoInvalida,
    TipoEventoNoEncontrado,
)
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from src.workflows.schemas import (
    ConfigRecordatorio,
    ResultadoAccion,
    ResumenDespacho,
)
from src.workflows.service import tipos_de_campos, validar_accion, validar_condicion

logger = logging.getLogger(__name__)


# Una acción recibe la sesión (dentro de un savepoint), la regla, el evento y la ejecución en
# curso, y devuelve el detalle y, si falló sin perder lo ya escrito, el motivo. Nunca hace commit.
# Las acciones sin ejecutor real apuntan a un stub por dueño (ver README del backend).
AccionHandler = Callable[[Session, WorkflowRule, EventLog, WorkflowExecution], ResultadoAccion]
ACCIONES: dict[str, AccionHandler] = {
    "notificar": notificaciones_service.ejecutar_notificar,
    "alerta_interna": notificaciones_service.ejecutar_alerta_interna,
    "aplicar_vencimiento": acciones_vencimiento_service.ejecutar_aplicar_vencimiento,
    "cambiar_estado": acciones_vencimiento_service.ejecutar_cambiar_estado,
    "aplicar_penalidad": acciones_penalidad_service.ejecutar_aplicar_penalidad,
    "generar_cargo": acciones_admision_service.ejecutar_generar_cargo,
    "generar_orden_compra": acciones_compras_service.ejecutar_generar_orden_compra,
    "generar_comunicacion": acciones_compras_service.ejecutar_generar_comunicacion,
    "crear_tarea": tareas_service.ejecutar_crear_tarea,
    "escalar_caso": tareas_service.ejecutar_escalar_caso,
    "generar_recordatorio": acciones_recordatorio_service.ejecutar_generar_recordatorio,
    "registrar_rechazo": acciones_pagos_service.ejecutar_registrar_rechazo,
}

ERROR_EVALUACION = "No se pudo evaluar la regla con los datos del evento."
ERROR_CONFIGURACION = "La configuración de la acción no es válida."
ERROR_ACCION = "La acción no pudo completarse."


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
        except Exception as error:
            db.rollback()
            logger.error("Falló el despacho de un evento (tipo=%s)", type(error).__name__)
            _marcar_evento_fallido(db, evento_id)
            resumen.eventos_fallidos += 1
    return resumen


def procesar_recordatorios_vencidos(db: Session, limite: int = 100) -> int:
    """Ejecuta las reglas diferidas (`generar_recordatorio`) de los eventos que ya cumplieron sus
    `dias_despues`. Devuelve cuántas ejecuciones creó.

    El despachador saltea esas reglas al llegar el evento, así que "la regla no tiene ejecución
    para el evento" significa "todavía no le tocaba" y no hace falta ninguna tabla nueva. Solo se
    miran los eventos posteriores a la creación de la regla (como cualquier otra regla, no actúa
    sobre lo anterior) y de los últimos `VENTANA_RECORDATORIOS_DIAS` días después del plazo.
    Cada evento se confirma por separado, igual que en el despacho."""
    # La hora de la base, que es la que guarda `EventLog.timestamp` y `WorkflowRule.created_at`.
    ahora = db.scalar(select(func.localtimestamp()))
    ejecutadas = 0
    reglas = db.scalars(
        select(WorkflowRule)
        .where(WorkflowRule.tipo_accion.in_(ACCIONES_DIFERIDAS), WorkflowRule.activo.is_(True))
        .order_by(WorkflowRule.nombre)
    ).all()
    for regla in reglas:
        if ejecutadas >= limite:
            break
        try:
            dias = ConfigRecordatorio.model_validate(regla.accion_config or {}).dias_despues
        except Exception:
            logger.warning("La configuración de la regla %s no es válida", regla.id, exc_info=True)
            continue
        vencido = ahora - timedelta(days=dias)
        desde = max(regla.created_at, vencido - timedelta(days=VENTANA_RECORDATORIOS_DIAS))
        eventos = db.scalars(
            select(EventLog)
            .where(
                EventLog.tipo_evento_id == regla.tipo_evento_id,
                EventLog.estado == "procesado",
                EventLog.timestamp >= desde,
                EventLog.timestamp <= vencido,
                ~exists().where(
                    WorkflowExecution.workflow_rule_id == regla.id,
                    WorkflowExecution.event_log_id == EventLog.id,
                ),
            )
            .order_by(EventLog.timestamp)
            .with_for_update(skip_locked=True)
        ).all()
        if not eventos:
            continue
        tipo_evento = db.get(TipoEvento, regla.tipo_evento_id)
        if tipo_evento is None:
            continue
        campos = tipos_de_campos(db, tipo_evento.id)
        for evento in eventos:
            if ejecutadas >= limite:
                break
            try:
                ejecucion = _procesar_regla(db, regla, evento, tipo_evento, campos, intento=1)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("Falló el recordatorio %s del evento %s", regla.id, evento.id)
                continue
            if ejecucion is not None:
                ejecutadas += 1
    return ejecutadas


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
        if regla.tipo_accion in ACCIONES_DIFERIDAS:
            # Sin ejecución todavía: le toca a `procesar_recordatorios_vencidos`.
            continue
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
    except Exception as error:
        logger.warning("No se pudo evaluar una regla (tipo=%s)", type(error).__name__)
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
    except Exception as error:
        logger.warning("La configuración de una regla no es válida (tipo=%s)", type(error).__name__)
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
    ejecucion.finished_at = ahora_utc()


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
    except Exception as error:
        logger.error("Falló la ejecución de una acción de workflow (tipo=%s)", type(error).__name__)
        _marcar_fallida(ejecucion, ERROR_ACCION)
        return
    ejecucion.detalle = resultado.detalle
    if resultado.error is not None:
        _marcar_fallida(ejecucion, resultado.error)
        return
    ejecucion.estado = "exitoso"
    ejecucion.finished_at = ahora_utc()


def _marcar_evento_fallido(db: Session, evento_id: uuid.UUID) -> None:
    evento = db.get(EventLog, evento_id)
    if evento is not None:
        evento.estado = "fallido"
        db.commit()
