"""Lógica de negocio del motor de Workflows: emisión de eventos, reglas y despacho."""

import logging
import uuid

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import TipoEventoNombre
from src.workflows.exceptions import TipoEventoNoRegistrado
from src.workflows.models import CampoEvento, TipoEvento

logger = logging.getLogger(__name__)


def emit_event(
    db: Session,
    *,
    tipo: TipoEventoNombre,
    entidad: str,
    entidad_id: uuid.UUID,
    payload: dict[str, object] | None = None,
    usuario_id: uuid.UUID | None = None,
) -> EventLog:
    """Registra un hecho de negocio en `EVENT_LOG` para que lo consuma el motor.

    No hace `commit`: el evento queda en la transacción del llamador, así que solo existe si la
    operación de negocio que lo originó también se confirma. `payload` debería traer los campos
    declarados en `CAMPO_EVENTO` para ese tipo (si falta alguno se loggea un warning, no se
    rechaza el evento) y nunca datos sensibles innecesarios (RNF-15).
    """
    tipo_evento = db.scalar(select(TipoEvento).where(TipoEvento.nombre == tipo))
    if tipo_evento is None:
        raise TipoEventoNoRegistrado(tipo)

    datos: dict[str, object] | None = None
    if payload is not None:
        datos = jsonable_encoder(payload)
    _advertir_campos_faltantes(db, tipo_evento, datos or {})

    evento = EventLog(
        actor_tipo="usuario" if usuario_id is not None else "sistema",
        payload=datos,
        estado="pendiente",
        entidad=entidad,
        entidad_id=entidad_id,
        tipo_evento_id=tipo_evento.id,
        usuario_id=usuario_id,
    )
    db.add(evento)
    db.flush()
    return evento


def _advertir_campos_faltantes(
    db: Session, tipo_evento: TipoEvento, payload: dict[str, object]
) -> None:
    declarados = set(
        db.scalars(
            select(CampoEvento.nombre_interno).where(CampoEvento.tipo_evento_id == tipo_evento.id)
        )
    )
    faltantes = sorted(declarados - payload.keys())
    if faltantes:
        logger.warning(
            "El evento %s se emitió sin los campos declarados: %s",
            tipo_evento.nombre,
            ", ".join(faltantes),
        )
