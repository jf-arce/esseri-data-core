"""Alta, lectura y borrado de conversaciones del Asistente."""

import uuid
from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from src.asistente.constants import (
    ESTADO_MENSAJE_DESCARTADO,
)
from src.asistente.exceptions import (
    ConversacionNoEncontrada,
)
from src.asistente.models import AliasConversacion, Conversacion, MensajeAsistente
from src.auth.models import Usuario
from src.config import settings
from src.fechas import ahora_utc


def crear_conversacion(db: Session, usuario: Usuario, rol_codigo: str) -> Conversacion:
    conversacion = Conversacion(usuario_id=usuario.id, rol_codigo=rol_codigo)
    db.add(conversacion)
    db.commit()
    db.refresh(conversacion)
    return conversacion


def obtener_conversacion_propia(
    db: Session, usuario: Usuario, rol_codigo: str, conversacion_id: uuid.UUID
) -> Conversacion:
    """Solo la dueña, y solo con el mismo rol con el que la creó: cada rol tiene su historial."""
    conversacion = db.scalar(
        select(Conversacion).where(
            Conversacion.id == conversacion_id,
            Conversacion.usuario_id == usuario.id,
            Conversacion.rol_codigo == rol_codigo,
        )
    )
    if conversacion is None:
        raise ConversacionNoEncontrada()
    return conversacion


def listar_conversaciones(
    db: Session, usuario: Usuario, rol_codigo: str, *, pagina: int, tamanio: int
) -> tuple[list[Conversacion], int]:
    filtro = (Conversacion.usuario_id == usuario.id, Conversacion.rol_codigo == rol_codigo)
    total = db.scalar(select(func.count(Conversacion.id)).where(*filtro)) or 0
    items = list(
        db.scalars(
            select(Conversacion)
            .where(*filtro)
            .order_by(Conversacion.actualizada_en.desc(), Conversacion.id)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        )
    )
    return items, total


def listar_mensajes(
    db: Session, conversacion: Conversacion, *, pagina: int, tamanio: int
) -> tuple[list[MensajeAsistente], int]:
    total = (
        db.scalar(
            select(func.count(MensajeAsistente.id)).where(
                MensajeAsistente.conversacion_id == conversacion.id,
                MensajeAsistente.estado != ESTADO_MENSAJE_DESCARTADO,
            )
        )
        or 0
    )
    items = list(
        db.scalars(
            select(MensajeAsistente)
            .where(
                MensajeAsistente.conversacion_id == conversacion.id,
                MensajeAsistente.estado != ESTADO_MENSAJE_DESCARTADO,
            )
            .order_by(MensajeAsistente.orden)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        )
    )
    return items, total


def eliminar_conversacion(db: Session, conversacion: Conversacion) -> None:
    _borrar_conversaciones(db, [conversacion.id])
    db.commit()


def _borrar_conversaciones(db: Session, ids: list[uuid.UUID]) -> None:
    # Se borran los hijos a mano: la cascada vive en la base, pero SQLite no la aplica.
    db.execute(delete(MensajeAsistente).where(MensajeAsistente.conversacion_id.in_(ids)))
    db.execute(delete(AliasConversacion).where(AliasConversacion.conversacion_id.in_(ids)))
    db.execute(delete(Conversacion).where(Conversacion.id.in_(ids)))


def borrar_conversaciones_vencidas(db: Session) -> int:
    """Retención: borra lo que no se tocó en `ASISTENTE_RETENCION_DIAS` días."""
    limite = ahora_utc() - timedelta(days=settings.ASISTENTE_RETENCION_DIAS)
    ids = list(db.scalars(select(Conversacion.id).where(Conversacion.actualizada_en < limite)))
    if ids:
        _borrar_conversaciones(db, ids)
        db.commit()
    return len(ids)
