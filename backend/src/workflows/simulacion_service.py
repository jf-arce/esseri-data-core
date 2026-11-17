"""Simulación de un borrador de regla contra un evento real, sin escribir nada.

Dice qué nodos alcanza el recorrido, no qué resultado tendrían los ejecutores: por eso las
acciones figuran como "alcanzada" y no como "se ejecutaría"."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.exceptions import AppException
from src.models import EventLog
from src.workflows import arbol_service, despacho_service
from src.workflows.constants import ACCIONES_DIFERIDAS, ACCIONES_NO_IMPLEMENTADAS
from src.workflows.exceptions import ArbolInvalido, TipoEventoNoEncontrado
from src.workflows.models import CampoEvento, TipoEvento, WorkflowNodo
from src.workflows.resumen_service import resumen_de_evento
from src.workflows.schemas import (
    ConfigRecordatorio,
    NodoSimulado,
    SimulacionEntrada,
    SimulacionRead,
)
from src.workflows.service import aprobacion_por_defecto, tipos_de_campos, validar_accion


def simular(db: Session, datos: SimulacionEntrada) -> SimulacionRead:
    tipo_evento = db.get(TipoEvento, datos.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    evento = db.get(EventLog, datos.event_log_id)
    if evento is None or evento.tipo_evento_id != tipo_evento.id:
        raise ArbolInvalido("El evento elegido no corresponde al disparador de la regla.")
    campos = tipos_de_campos(db, tipo_evento.id)

    # Nodos transitorios: no se agregan a la sesión, así que nada se escribe.
    nodos = [
        WorkflowNodo(
            id=n.id,
            tipo=n.tipo,
            padre_id=n.padre_id,
            rama=n.rama,
            orden=indice,
            condicion=None if n.condicion is None else n.condicion.model_dump(mode="json"),
            tipo_accion=n.tipo_accion,
            accion_config=n.accion_config,
            notificacion_template_id=n.notificacion_template_id,
            requiere_aprobacion_humana=bool(n.requiere_aprobacion_humana),
        )
        for indice, n in enumerate(datos.nodos)
    ]
    entrada = {n.id: n for n in datos.nodos}
    arbol_service.verificar_entidad(tipo_evento.nombre, evento)
    recorrido = arbol_service.recorrer_arbol(nodos, campos, evento.payload or {})

    resultado: dict[uuid.UUID, NodoSimulado] = {}
    for nodo_id, estado in recorrido.condiciones.items():
        resultado[nodo_id] = NodoSimulado(
            id=nodo_id, estado=estado, detalle=recorrido.errores.get(nodo_id)
        )
    for nodo in recorrido.acciones:
        resultado[nodo.id] = _simular_accion(
            db, nodo, entrada[nodo.id].requiere_aprobacion_humana, tipo_evento, campos
        )
    for nodo in nodos:
        resultado.setdefault(nodo.id, NodoSimulado(id=nodo.id, estado="no_alcanzado"))

    campos_catalogo = list(
        db.scalars(
            select(CampoEvento)
            .where(CampoEvento.tipo_evento_id == tipo_evento.id)
            .order_by(CampoEvento.nombre_interno)
        )
    )
    return SimulacionRead(
        evento=resumen_de_evento(evento, tipo_evento.nombre, campos_catalogo),
        nodos=[resultado[n.id] for n in nodos],
    )


def _simular_accion(
    db: Session,
    nodo: WorkflowNodo,
    aprobacion: bool | None,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
) -> NodoSimulado:
    tipo = nodo.tipo_accion or ""
    if tipo in ACCIONES_NO_IMPLEMENTADAS or tipo not in despacho_service.ACCIONES:
        return NodoSimulado(
            id=nodo.id, estado="no_implementada", detalle="Todavía no se puede ejecutar."
        )
    try:
        config = validar_accion(
            db, tipo, nodo.accion_config, tipo_evento.nombre, campos, nodo.notificacion_template_id
        )
    except AppException as error:
        return NodoSimulado(id=nodo.id, estado="config_invalida", detalle=error.message)
    if tipo in ACCIONES_DIFERIDAS:
        dias = ConfigRecordatorio.model_validate(config).dias_despues
        return NodoSimulado(
            id=nodo.id, estado="diferida", detalle=f"Corre {dias} día(s) después del evento."
        )
    requiere = aprobacion_por_defecto(tipo) if aprobacion is None else aprobacion
    if requiere:
        return NodoSimulado(
            id=nodo.id, estado="requiere_aprobacion", detalle="Espera la aprobación de una persona."
        )
    return NodoSimulado(id=nodo.id, estado="alcanzada")
