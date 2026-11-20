import hashlib
from collections import defaultdict
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.comunicaciones.adjuntos_service import (
    MAX_ADJUNTOS_POR_COMUNICACION,
    MAX_BYTES_TOTAL,
    preparar_adjunto_privado,
)
from src.comunicaciones.contextos_conversacion import no_encontrado
from src.comunicaciones.models import (
    AdjuntoMensajeConversacion,
    ContenidoAdjuntoMensaje,
    MensajeConversacion,
)


@dataclass(frozen=True)
class ArchivoPreparado:
    nombre: str
    tipo_contenido: str
    contenido: bytes
    checksum: str


def preparar(archivos: list[UploadFile]) -> tuple[ArchivoPreparado, ...]:
    if len(archivos) > MAX_ADJUNTOS_POR_COMUNICACION:
        raise HTTPException(422, f"Podés adjuntar hasta {MAX_ADJUNTOS_POR_COMUNICACION} archivos.")
    preparados = []
    total = 0
    for archivo in archivos:
        nombre, tipo, contenido = preparar_adjunto_privado(archivo)
        total += len(contenido)
        if total > MAX_BYTES_TOTAL:
            raise HTTPException(413, "Los adjuntos superan el tamaño total permitido.")
        preparados.append(
            ArchivoPreparado(nombre, tipo, contenido, hashlib.sha256(contenido).hexdigest())
        )
    return tuple(preparados)


def registrar(db: Session, id_mensaje: UUID, archivos: tuple[ArchivoPreparado, ...]) -> None:
    for orden, archivo in enumerate(archivos):
        adjunto = AdjuntoMensajeConversacion(
            mensaje_id=id_mensaje,
            orden=orden,
            nombre=archivo.nombre,
            tipo_contenido=archivo.tipo_contenido,
            tamanio=len(archivo.contenido),
            checksum=archivo.checksum,
        )
        db.add(adjunto)
        db.flush()
        db.add(ContenidoAdjuntoMensaje(adjunto_id=adjunto.id, contenido=archivo.contenido))


def listar(db: Session, ids: list[UUID]) -> dict[UUID, list[AdjuntoMensajeConversacion]]:
    por_mensaje = defaultdict(list)
    if ids:
        stmt = (
            select(AdjuntoMensajeConversacion)
            .where(AdjuntoMensajeConversacion.mensaje_id.in_(ids))
            .order_by(AdjuntoMensajeConversacion.orden)
        )
        for adjunto in db.scalars(stmt):
            por_mensaje[adjunto.mensaje_id].append(adjunto)
    return por_mensaje


def coincide(db: Session, id_mensaje: UUID, archivos: tuple[ArchivoPreparado, ...]) -> bool:
    existentes = listar(db, [id_mensaje]).get(id_mensaje, [])
    return [(a.nombre, a.checksum) for a in existentes] == [
        (a.nombre, a.checksum) for a in archivos
    ]


def descargar(db: Session, hilo_id: UUID, mensaje_id: UUID, adjunto_id: UUID):
    fila = db.execute(
        select(AdjuntoMensajeConversacion, ContenidoAdjuntoMensaje.contenido)
        .join(MensajeConversacion, MensajeConversacion.id == AdjuntoMensajeConversacion.mensaje_id)
        .join(
            ContenidoAdjuntoMensaje,
            ContenidoAdjuntoMensaje.adjunto_id == AdjuntoMensajeConversacion.id,
        )
        .where(
            MensajeConversacion.conversacion_id == hilo_id,
            MensajeConversacion.id == mensaje_id,
            AdjuntoMensajeConversacion.id == adjunto_id,
        )
    ).one_or_none()
    if fila is None:
        raise no_encontrado()
    return fila
