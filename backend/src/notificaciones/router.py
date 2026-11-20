"""Endpoints de la bandeja interna del Portal Familia.

Todas las respuestas son privadas y sin caché. No hay entrada de `usuario_id`: el alcance sale
de la sesión y de la familia vigente. Un id inaccesible responde 404, igual que uno inexistente.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Query, Response

from src.auth.dependencies import DbSession, UsuarioAutenticado
from src.notificaciones import service
from src.notificaciones.dependencies import BandejaVigente
from src.notificaciones.schemas import (
    LecturaNotificacion,
    LecturasMasivas,
    ListadoNotificaciones,
    ResumenNotificaciones,
)

router = APIRouter(prefix="/notificaciones", tags=["Notificaciones"])


def _privada(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


@router.get("", response_model=ListadoNotificaciones)
def listar_notificaciones(
    response: Response,
    db: DbSession,
    usuario: UsuarioAutenticado,
    alcance: BandejaVigente,
    no_leidas: bool = False,
    limite: Annotated[int, Query(ge=1, le=service.LIMITE_MAXIMO)] = service.LIMITE_POR_DEFECTO,
    cursor: str | None = None,
) -> ListadoNotificaciones:
    """Listado descendente y paginado por `(created_at, id)`, sin efectos de lectura."""
    _privada(response)
    return service.listar(
        db,
        usuario.id,
        alcance,
        no_leidas=no_leidas,
        limite=limite,
        cursor=cursor,
    )


@router.get("/resumen", response_model=ResumenNotificaciones)
def resumen_notificaciones(
    response: Response,
    db: DbSession,
    usuario: UsuarioAutenticado,
    alcance: BandejaVigente,
) -> ResumenNotificaciones:
    """Contador de no leídas para la campanita."""
    _privada(response)
    return service.resumen(db, usuario.id, alcance)


@router.patch("/{notificacion_id}/lectura", response_model=LecturaNotificacion)
def marcar_notificacion_leida(
    notificacion_id: uuid.UUID,
    response: Response,
    db: DbSession,
    usuario: UsuarioAutenticado,
    alcance: BandejaVigente,
) -> LecturaNotificacion:
    """Primera lectura inmutable: repetir devuelve el instante ya persistido."""
    _privada(response)
    return service.marcar_lectura(db, usuario.id, alcance, notificacion_id)


@router.post("/lecturas", response_model=LecturasMasivas)
def marcar_notificaciones_leidas(
    response: Response,
    db: DbSession,
    usuario: UsuarioAutenticado,
    alcance: BandejaVigente,
) -> LecturasMasivas:
    """Marca todo lo no leído de la foto autorizada, en una sola sentencia."""
    _privada(response)
    return service.marcar_todas(db, usuario.id, alcance)
