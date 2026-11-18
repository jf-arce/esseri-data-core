"""Despacho de eventos pendientes, en dos pasos.

1. Evaluar y registrar: se recorre el árbol de cada regla activa, se evalúan las condiciones y se
   crea, en la misma transacción que marca el evento como procesado, una `WorkflowExecution` por
   cada acción alcanzada (`pendiente`).
2. Ejecutar: cada acción registrada que no necesita aprobación se ejecuta y confirma por separado.
   Si el proceso cae entre los dos pasos, `recuperar_ejecuciones_en_cola` retoma las que quedaron
   registradas y sin terminar aunque el evento ya figure procesado.

Lo guardado en el nodo se vuelve a validar contra la allowlist antes de ejecutarlo."""

import logging
import uuid
from collections.abc import Callable
from datetime import timedelta

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
    arbol_service,
    notificaciones_service,
    tareas_service,
)
from src.workflows.accion_contexto import AccionContexto
from src.workflows.constants import (
    ACCIONES_DIFERIDAS,
    ERROR_ACCION_NO_IMPLEMENTADA,
    VENTANA_RECORDATORIOS_DIAS,
)
from src.workflows.exceptions import TipoEventoNoEncontrado
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowNodo, WorkflowRule
from src.workflows.schemas import (
    ConfigRecordatorio,
    ResultadoAccion,
    ResumenDespacho,
)
from src.workflows.service import tipos_de_campos, validar_accion

logger = logging.getLogger(__name__)


# Una acción recibe la sesión (dentro de un savepoint), la regla con su nodo, el evento y la
# ejecución en
# curso, y devuelve el detalle y, si falló sin perder lo ya escrito, el motivo. Las acciones de
# notificación confirman su reserva antes del HTTP y por eso pueden hacer commit; el despachador
# no las envuelve en un savepoint. Las acciones sin ejecutor real apuntan a un stub por dueño
# (ver README del backend).
AccionHandler = Callable[[Session, AccionContexto, EventLog, WorkflowExecution], ResultadoAccion]
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
ACCIONES_CON_RESERVA = frozenset({"notificar", "alerta_interna", "generar_recordatorio"})
DETALLE_ESPERANDO_APROBACION = "Esperando aprobación humana."
ERROR_YA_NO_APLICA = "La regla ya no aplica al evento original."
# Una ejecución registrada que lleva más que esto sin ejecutarse se da por abandonada y se retoma.
MINUTOS_PARA_RECUPERAR = 2


def procesar_eventos_pendientes(db: Session, limite: int = 100) -> ResumenDespacho:
    """Toma los eventos `pendiente` más antiguos, registra las acciones que les corresponden y
    las ejecuta.

    Cada evento se toma con `FOR UPDATE SKIP LOCKED` y se confirma por separado: dos
    despachadores a la vez (el job y el endpoint manual) no pisan el mismo evento, y una falla
    en uno no revierte los ya procesados.
    """
    notificaciones_service.recuperar_reservas_notificacion(db)
    recuperar_ejecuciones_en_cola(db)
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
            registradas, por_ejecutar = _registrar_evento(db, evento)
            evento.estado = "procesado"
            db.commit()
        except Exception as error:
            db.rollback()
            logger.error("Falló el despacho de un evento (tipo=%s)", type(error).__name__)
            _marcar_evento_fallido(db, evento_id)
            resumen.eventos_fallidos += 1
            continue
        resumen.eventos_procesados += 1
        resumen.ejecuciones_creadas += registradas
        for ejecucion_id in por_ejecutar:
            _ejecutar_registrada(db, ejecucion_id)
    return resumen


def recuperar_ejecuciones_en_cola(db: Session, limite: int = 100) -> int:
    """Ejecuta las acciones que se registraron (paso 1) pero no llegaron a correr (paso 2) porque
    el proceso cayó. Las que esperan aprobación tienen detalle y no se tocan."""
    corte = db.scalar(select(func.localtimestamp())) - timedelta(minutes=MINUTOS_PARA_RECUPERAR)
    ids = db.scalars(
        select(WorkflowExecution.id)
        .where(
            WorkflowExecution.estado == "pendiente",
            WorkflowExecution.detalle.is_(None),
            WorkflowExecution.started_at <= corte,
        )
        .order_by(WorkflowExecution.started_at)
        .limit(limite)
    ).all()
    return sum(1 for ejecucion_id in ids if _ejecutar_registrada(db, ejecucion_id))


def procesar_recordatorios_vencidos(db: Session, limite: int = 100) -> int:
    """Ejecuta las acciones diferidas (`generar_recordatorio`) de los eventos que ya cumplieron sus
    `dias_despues`. Devuelve cuántas ejecuciones creó.

    El despachador saltea esas acciones al llegar el evento, así que "el nodo no tiene ejecución
    para el evento" significa "todavía no le tocaba" y no hace falta ninguna tabla nueva. Solo se
    miran los eventos posteriores a la creación del nodo (como cualquier otro, no actúa sobre lo
    anterior) y de los últimos `VENTANA_RECORDATORIOS_DIAS` días después del plazo. Cada evento se
    confirma por separado, igual que en el despacho."""
    # La hora de la base, que es la que guarda `EventLog.timestamp` y `WorkflowNodo.created_at`.
    notificaciones_service.recuperar_reservas_notificacion(db)
    ahora = db.scalar(select(func.localtimestamp()))
    ejecutadas = 0
    filas = db.execute(
        select(WorkflowNodo, WorkflowRule)
        .join(WorkflowRule, WorkflowRule.id == WorkflowNodo.workflow_rule_id)
        .where(
            WorkflowNodo.tipo_accion.in_(ACCIONES_DIFERIDAS),
            WorkflowNodo.eliminado_at.is_(None),
            WorkflowRule.activo.is_(True),
        )
        .order_by(WorkflowRule.nombre, WorkflowNodo.orden)
    ).all()
    for nodo, regla in filas:
        if ejecutadas >= limite:
            break
        try:
            dias = ConfigRecordatorio.model_validate(nodo.accion_config or {}).dias_despues
        except Exception:
            logger.warning("La configuración del nodo %s no es válida", nodo.id, exc_info=True)
            continue
        vencido = ahora - timedelta(days=dias)
        desde = max(nodo.created_at, vencido - timedelta(days=VENTANA_RECORDATORIOS_DIAS))
        eventos = db.scalars(
            select(EventLog)
            .where(
                EventLog.tipo_evento_id == regla.tipo_evento_id,
                EventLog.estado == "procesado",
                EventLog.timestamp >= desde,
                EventLog.timestamp <= vencido,
                ~exists().where(
                    WorkflowExecution.workflow_nodo_id == nodo.id,
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
                ejecucion = _recordar(db, regla, nodo, evento, tipo_evento, campos)
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("Falló el recordatorio %s del evento %s", nodo.id, evento.id)
                continue
            if ejecucion is not None:
                ejecutadas += 1
    return ejecutadas


def _recordar(
    db: Session,
    regla: WorkflowRule,
    nodo: WorkflowNodo,
    evento: EventLog,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
) -> WorkflowExecution | None:
    nodos = arbol_service.cargar_nodos(db, regla.id)
    por_id = {n.id: n for n in nodos}
    try:
        arbol_service.verificar_entidad(tipo_evento.nombre, evento)
        recorrido = arbol_service.recorrer_arbol(nodos, campos, evento.payload or {})
    except Exception as error:
        logger.warning("No se pudo evaluar una regla (tipo=%s)", type(error).__name__)
        ejecucion = _nueva_ejecucion(regla, nodo, evento, intento=1)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION)
        return ejecucion
    camino = arbol_service.camino_hasta(nodo, por_id)
    if any(recorrido.condiciones.get(c.id) == "error" for c in camino):
        ejecucion = _nueva_ejecucion(regla, nodo, evento, intento=1)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION)
        return ejecucion
    if nodo not in recorrido.acciones:
        return None
    return _registrar_accion(
        db, regla, nodo, evento, tipo_evento, campos, intento=1, ejecutar_ya=True
    )


def _registrar_evento(db: Session, evento: EventLog) -> tuple[int, list[uuid.UUID]]:
    """Paso 1: crea las ejecuciones del evento. Devuelve cuántas creó y cuáles hay que ejecutar
    (paso 2): las que no esperan aprobación ni fallaron al registrarse."""
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
    por_ejecutar: list[uuid.UUID] = []
    for regla in reglas:
        for ejecucion in _registrar_regla(db, regla, evento, tipo_evento, campos):
            creadas += 1
            if ejecucion.estado == "pendiente" and ejecucion.detalle is None:
                por_ejecutar.append(ejecucion.id)
    return creadas, por_ejecutar


def _registrar_regla(
    db: Session,
    regla: WorkflowRule,
    evento: EventLog,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
) -> list[WorkflowExecution]:
    nodos = arbol_service.cargar_nodos(db, regla.id)
    if not nodos:
        return []
    creadas: list[WorkflowExecution] = []
    # Cada regla se evalúa aislada: una que no se puede evaluar queda como ejecución fallida
    # y no impide que se procesen las demás del mismo evento.
    try:
        arbol_service.verificar_entidad(tipo_evento.nombre, evento)
        recorrido = arbol_service.recorrer_arbol(nodos, campos, evento.payload or {})
    except Exception as error:
        logger.warning("No se pudo evaluar una regla (tipo=%s)", type(error).__name__)
        raiz = next((n for n in nodos if n.padre_id is None), nodos[0])
        ejecucion = _nueva_ejecucion(regla, raiz, evento, intento=1)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION)
        return [ejecucion]

    por_id = {n.id: n for n in nodos}
    for nodo_id in recorrido.errores:
        ejecucion = _nueva_ejecucion(regla, por_id[nodo_id], evento, intento=1)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION)
        creadas.append(ejecucion)
    for nodo in recorrido.acciones:
        if nodo.tipo_accion in ACCIONES_DIFERIDAS:
            # Sin ejecución todavía: le toca a `procesar_recordatorios_vencidos`.
            continue
        creadas.append(_registrar_accion(db, regla, nodo, evento, tipo_evento, campos, intento=1))
    return creadas


def reintentar_accion(
    db: Session,
    regla: WorkflowRule,
    nodo: WorkflowNodo,
    evento: EventLog,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
    *,
    intento: int,
) -> WorkflowExecution:
    """Registra y ejecuta un intento nuevo de una acción. Si con los datos del evento el recorrido
    ya no llega a ella, el intento queda fallido."""
    nodos = arbol_service.cargar_nodos(db, regla.id)
    try:
        arbol_service.verificar_entidad(tipo_evento.nombre, evento)
        recorrido = arbol_service.recorrer_arbol(nodos, campos, evento.payload or {})
        alcanzada = nodo in recorrido.acciones
        con_error = False
    except Exception as error:
        logger.warning("No se pudo evaluar una regla (tipo=%s)", type(error).__name__)
        alcanzada, con_error = False, True
    if not alcanzada:
        ejecucion = _nueva_ejecucion(regla, nodo, evento, intento=intento)
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_EVALUACION if con_error else ERROR_YA_NO_APLICA)
        return ejecucion
    return _registrar_accion(
        db, regla, nodo, evento, tipo_evento, campos, intento=intento, ejecutar_ya=True
    )


def _snapshot(nodo: WorkflowNodo) -> dict[str, object]:
    if nodo.tipo == "condicion":
        return {"tipo": "condicion", "condicion": nodo.condicion}
    return {
        "tipo": "accion",
        "tipo_accion": nodo.tipo_accion,
        "accion_config": nodo.accion_config,
        "notificacion_template_id": (
            None if nodo.notificacion_template_id is None else str(nodo.notificacion_template_id)
        ),
        "requiere_aprobacion_humana": nodo.requiere_aprobacion_humana,
    }


def _nueva_ejecucion(
    regla: WorkflowRule, nodo: WorkflowNodo, evento: EventLog, *, intento: int
) -> WorkflowExecution:
    return WorkflowExecution(
        workflow_rule_id=regla.id,
        workflow_nodo_id=nodo.id,
        event_log_id=evento.id,
        intento=intento,
        accion_snapshot=_snapshot(nodo),
    )


def _registrar_accion(
    db: Session,
    regla: WorkflowRule,
    nodo: WorkflowNodo,
    evento: EventLog,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
    *,
    intento: int,
    ejecutar_ya: bool = False,
) -> WorkflowExecution:
    """Inserta la ejecución de una acción alcanzada. La fila se crea antes de cualquier efecto: la
    restricción única evita ejecutar dos veces el mismo intento aun sin bloqueo. Con
    `ejecutar_ya` (reintentos y recordatorios) corre en el momento; si no, queda `pendiente` para
    el paso 2."""
    ejecucion = _nueva_ejecucion(regla, nodo, evento, intento=intento)
    try:
        validar_accion(
            db,
            nodo.tipo_accion or "",
            nodo.accion_config,
            tipo_evento.nombre,
            campos,
            nodo.notificacion_template_id,
        )
    except Exception as error:
        logger.warning(
            "La configuración de una acción no es válida (tipo=%s)", type(error).__name__
        )
        _reservar_ejecucion(db, ejecucion)
        _marcar_fallida(ejecucion, ERROR_CONFIGURACION)
        return ejecucion

    _reservar_ejecucion(db, ejecucion)
    if nodo.requiere_aprobacion_humana:
        ejecucion.detalle = DETALLE_ESPERANDO_APROBACION
    elif ejecutar_ya:
        _ejecutar_accion(db, AccionContexto(regla, nodo), evento, ejecucion)
    return ejecucion


def _ejecutar_registrada(db: Session, ejecucion_id: uuid.UUID) -> bool:
    """Paso 2 para una ejecución registrada. Devuelve si la ejecutó."""
    try:
        ejecucion = db.scalar(
            select(WorkflowExecution)
            .where(WorkflowExecution.id == ejecucion_id)
            .with_for_update(skip_locked=True)
        )
        if ejecucion is None or ejecucion.estado != "pendiente" or ejecucion.detalle is not None:
            db.rollback()
            return False
        regla = db.get(WorkflowRule, ejecucion.workflow_rule_id)
        nodo = db.get(WorkflowNodo, ejecucion.workflow_nodo_id)
        evento = db.get(EventLog, ejecucion.event_log_id)
        if regla is None or nodo is None or evento is None:
            _marcar_fallida(ejecucion, ERROR_ACCION)
        else:
            _ejecutar_accion(db, AccionContexto(regla, nodo), evento, ejecucion)
        db.commit()
        return True
    except Exception:
        db.rollback()
        logger.exception("Falló la ejecución registrada %s", ejecucion_id)
        return False


def _reservar_ejecucion(db: Session, ejecucion: WorkflowExecution) -> None:
    db.add(ejecucion)
    db.flush()


def _marcar_fallida(ejecucion: WorkflowExecution, motivo: str) -> None:
    ejecucion.estado = "fallido"
    ejecucion.error_detail = motivo
    ejecucion.finished_at = ahora_utc()


def _ejecutar_accion(
    db: Session, accion: AccionContexto, evento: EventLog, ejecucion: WorkflowExecution
) -> None:
    handler = ACCIONES.get(accion.tipo_accion)
    if handler is None:
        _marcar_fallida(
            ejecucion,
            ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion=accion.tipo_accion),
        )
        return
    try:
        if accion.tipo_accion in ACCIONES_CON_RESERVA:
            # La reserva de notificación confirma evento, ejecución y filas antes del HTTP;
            # no puede vivir dentro de un savepoint que se cerraría con ese commit.
            resultado = handler(db, accion, evento, ejecucion)
        else:
            # Savepoint: si la acción falla a mitad de camino, sus escrituras se revierten sin
            # perder la ejecución ni las de otras acciones del mismo evento.
            with db.begin_nested():
                resultado = handler(db, accion, evento, ejecucion)
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
