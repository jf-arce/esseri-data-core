"""Registro de eventos de negocio en `EVENT_LOG`.

Archivo aparte de `service.py` a propósito: es lo único de Workflows que importan los demás
módulos, y no debe depender de ningún módulo de negocio. Así los módulos pueden llamar a
`emit_event()` sin que el despachador (que sí importará sus servicios al ejecutar acciones)
genere imports circulares. Mismo criterio que `log_audit()` en `auditoria/service.py`.
"""

import logging
import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import EventLog
from src.workflows.constants import ENTIDAD_POR_EVENTO, TipoEventoNombre
from src.workflows.exceptions import EntidadDeEventoInvalida, TipoEventoNoRegistrado
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
    declarados en `CAMPO_EVENTO` para ese tipo (si falta alguno o tiene un tipo equivocado se
    loggea un warning, no se rechaza el evento) y nunca datos sensibles innecesarios (RNF-15).
    `entidad` tiene que ser la que corresponde al tipo (`ENTIDAD_POR_EVENTO`): las acciones
    operan sobre ella.
    """
    if entidad != ENTIDAD_POR_EVENTO[tipo]:
        raise EntidadDeEventoInvalida(tipo, entidad, ENTIDAD_POR_EVENTO[tipo])

    tipo_evento = db.scalar(select(TipoEvento).where(TipoEvento.nombre == tipo))
    if tipo_evento is None:
        raise TipoEventoNoRegistrado(tipo)

    datos: dict[str, object] | None = None
    if payload is not None:
        datos = jsonable_encoder(payload)
    _advertir_payload_inconsistente(db, tipo_evento, datos or {})

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


def coaccionar_valor(tipo_dato: str, valor: object) -> Decimal | date | str:
    """Convierte un valor de payload o de condición al tipo de su `CAMPO_EVENTO`.

    Estricto: `null`, booleanos como número y fechas que no son ISO se rechazan con `ValueError`.
    El mensaje nunca incluye el valor (puede ser un dato personal y termina en `error_detail`),
    solo el tipo que llegó.
    """
    recibido = type(valor).__name__
    if tipo_dato == "numero":
        if isinstance(valor, bool) or not isinstance(valor, int | float | Decimal):
            raise ValueError(f"se esperaba un número y llegó {recibido}")
        numero = Decimal(str(valor))
        if not numero.is_finite():
            raise ValueError("se esperaba un número finito")
        return numero
    if tipo_dato == "fecha":
        if not isinstance(valor, str):
            raise ValueError(f"se esperaba una fecha ISO y llegó {recibido}")
        try:
            return datetime.fromisoformat(valor).date()
        except ValueError:
            raise ValueError("se esperaba una fecha ISO válida") from None
    if tipo_dato == "texto":
        if not isinstance(valor, str):
            raise ValueError(f"se esperaba un texto y llegó {recibido}")
        return valor
    raise ValueError(f"tipo de dato desconocido: {tipo_dato}")


def _advertir_payload_inconsistente(
    db: Session, tipo_evento: TipoEvento, payload: dict[str, object]
) -> None:
    declarados = {
        nombre: tipo_dato
        for nombre, tipo_dato in db.execute(
            select(CampoEvento.nombre_interno, CampoEvento.tipo_dato).where(
                CampoEvento.tipo_evento_id == tipo_evento.id
            )
        )
    }
    faltantes = sorted(declarados.keys() - payload.keys())
    if faltantes:
        logger.warning(
            "El evento %s se emitió sin los campos declarados: %s",
            tipo_evento.nombre,
            ", ".join(faltantes),
        )
    mal_tipados = []
    for nombre in sorted(declarados.keys() & payload.keys()):
        try:
            coaccionar_valor(declarados[nombre], payload[nombre])
        except ValueError:
            mal_tipados.append(nombre)
    if mal_tipados:
        logger.warning(
            "El evento %s se emitió con campos de tipo equivocado: %s",
            tipo_evento.nombre,
            ", ".join(mal_tipados),
        )
