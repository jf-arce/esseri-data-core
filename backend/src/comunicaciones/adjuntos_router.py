"""Attachment routes for communications, kept apart from the message router.

Every route is active-role explicit: administration/secretaría use the base permissions
(rejecting teacher and family roles through `gestion`), teachers use the typed `docente`
permissions and the Docente role, and families only reach a published attachment whose receipt
they hold. Downloads are always `attachment`, `nosniff`, `private, no-store`.
"""

import uuid
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Response, UploadFile

from src.auth.constants import (
    PERMISO_COMUNICACIONES_ACTUALIZAR,
    PERMISO_COMUNICACIONES_ACTUALIZAR_DOCENTE,
    PERMISO_COMUNICACIONES_CREAR,
    PERMISO_COMUNICACIONES_CREAR_DOCENTE,
    PERMISO_COMUNICACIONES_LEER,
    PERMISO_COMUNICACIONES_LEER_DOCENTE,
)
from src.auth.dependencies import DbSession, RolActivo, requiere_permiso
from src.auth.models import Usuario
from src.comunicaciones import adjuntos_service
from src.comunicaciones.models import ComunicacionAdjunto
from src.comunicaciones.router import familiar, gestion, solo_docente
from src.comunicaciones.service import obtener as obtener_comunicacion

router = APIRouter(prefix="/comunicaciones", tags=["Comunicaciones"])

Crear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_CREAR))]
Editar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_ACTUALIZAR))]
Leer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_LEER))]
CrearDocente = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_CREAR_DOCENTE))]
EditarDocente = Annotated[
    Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_ACTUALIZAR_DOCENTE))
]
LeerDocente = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_LEER_DOCENTE))]

EXTENSIONES = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}


def _respuesta_descarga(adjunto: ComunicacionAdjunto, contenido: bytes) -> Response:
    nombre = quote(adjunto.nombre, safe="")
    respaldo = f"adjunto{EXTENSIONES.get(adjunto.tipo_contenido, '')}"
    disposicion = f"attachment; filename=\"{respaldo}\"; filename*=UTF-8''{nombre}"
    return Response(
        content=contenido,
        media_type=adjunto.tipo_contenido,
        headers={
            "Content-Disposition": disposicion,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


# --- Familia -----------------------------------------------------------------------------


@router.get("/familia/{comunicacion_id}/adjuntos/{adjunto_id}/archivo")
def descargar_familia(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
    response: Response,
) -> Response:
    familiar(rol, response)
    adjunto, contenido = adjuntos_service.descargar_familia(
        db, comunicacion_id, adjunto_id, usuario
    )
    return _respuesta_descarga(adjunto, contenido)


# --- Docente -----------------------------------------------------------------------------


@router.post("/docente/{comunicacion_id}/adjuntos", status_code=201)
def subir_docente(
    comunicacion_id: uuid.UUID,
    archivo: Annotated[UploadFile, File()],
    db: DbSession,
    usuario: CrearDocente,
    rol: RolActivo,
) -> dict:
    solo_docente(rol)
    return adjuntos_service.subir(db, comunicacion_id, usuario, archivo, tipo="curso")


@router.get("/docente/{comunicacion_id}/adjuntos")
def listar_docente(
    comunicacion_id: uuid.UUID, db: DbSession, usuario: LeerDocente, rol: RolActivo
) -> list[dict]:
    solo_docente(rol)
    obtener_comunicacion(db, comunicacion_id, usuario, tipo="curso")
    return adjuntos_service.listar_metadata(db, comunicacion_id)


@router.get("/docente/{comunicacion_id}/adjuntos/{adjunto_id}/archivo")
def descargar_docente(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: LeerDocente,
    rol: RolActivo,
) -> Response:
    solo_docente(rol)
    adjunto, contenido = adjuntos_service.descargar(
        db, comunicacion_id, adjunto_id, usuario, tipo="curso"
    )
    return _respuesta_descarga(adjunto, contenido)


@router.post("/docente/{comunicacion_id}/adjuntos/{adjunto_id}/analizar")
def analizar_docente(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: EditarDocente,
    rol: RolActivo,
) -> dict:
    solo_docente(rol)
    return adjuntos_service.analizar(db, comunicacion_id, adjunto_id, usuario, tipo="curso")


@router.delete("/docente/{comunicacion_id}/adjuntos/{adjunto_id}", status_code=204)
def eliminar_docente(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: EditarDocente,
    rol: RolActivo,
) -> Response:
    solo_docente(rol)
    adjuntos_service.eliminar(db, comunicacion_id, adjunto_id, usuario, tipo="curso")
    return Response(status_code=204)


# --- Administración / Dirección ----------------------------------------------------------


@router.post("/{comunicacion_id}/adjuntos", status_code=201)
def subir(
    comunicacion_id: uuid.UUID,
    archivo: Annotated[UploadFile, File()],
    db: DbSession,
    usuario: Crear,
    rol: RolActivo,
) -> dict:
    gestion(rol)
    return adjuntos_service.subir(db, comunicacion_id, usuario, archivo)


@router.get("/{comunicacion_id}/adjuntos")
def listar(comunicacion_id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo) -> list[dict]:
    gestion(rol)
    obtener_comunicacion(db, comunicacion_id, usuario)
    return adjuntos_service.listar_metadata(db, comunicacion_id)


@router.get("/{comunicacion_id}/adjuntos/{adjunto_id}/archivo")
def descargar(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
) -> Response:
    gestion(rol)
    adjunto, contenido = adjuntos_service.descargar(db, comunicacion_id, adjunto_id, usuario)
    return _respuesta_descarga(adjunto, contenido)


@router.post("/{comunicacion_id}/adjuntos/{adjunto_id}/analizar")
def analizar(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: Editar,
    rol: RolActivo,
) -> dict:
    gestion(rol)
    return adjuntos_service.analizar(db, comunicacion_id, adjunto_id, usuario, tipo=None)


@router.delete("/{comunicacion_id}/adjuntos/{adjunto_id}", status_code=204)
def eliminar(
    comunicacion_id: uuid.UUID,
    adjunto_id: uuid.UUID,
    db: DbSession,
    usuario: Editar,
    rol: RolActivo,
) -> Response:
    gestion(rol)
    adjuntos_service.eliminar(db, comunicacion_id, adjunto_id, usuario, tipo=None)
    return Response(status_code=204)
