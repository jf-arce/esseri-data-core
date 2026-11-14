import json
import uuid
from collections.abc import Iterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from src.asistente import service
from src.asistente.dependencies import Sesion, TransportProveedor, exigir_habilitado
from src.asistente.schemas import (
    AliasResueltoRead,
    ConversacionListadoRead,
    ConversacionRead,
    MensajeCreate,
    MensajeListadoRead,
    ResolverCreate,
    ResolverRead,
)
from src.asistente.seudonimos_service import resolver_aliases
from src.database import get_db

router = APIRouter(
    prefix="/asistente", tags=["asistente"], dependencies=[Depends(exigir_habilitado)]
)

DbSession = Annotated[Session, Depends(get_db)]


@router.post("/conversaciones", status_code=status.HTTP_201_CREATED)
def crear_conversacion(db: DbSession, sesion: Sesion) -> ConversacionRead:
    conversacion = service.crear_conversacion(db, sesion.usuario, sesion.rol_codigo)
    return ConversacionRead.model_validate(conversacion)


@router.get("/conversaciones")
def listar_conversaciones(
    db: DbSession,
    sesion: Sesion,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio: Annotated[int, Query(ge=1, le=50)] = 20,
) -> ConversacionListadoRead:
    items, total = service.listar_conversaciones(
        db, sesion.usuario, sesion.rol_codigo, pagina=pagina, tamanio=tamanio
    )
    return ConversacionListadoRead(
        items=[ConversacionRead.model_validate(item) for item in items],
        total=total,
        pagina=pagina,
        tamanio=tamanio,
    )


@router.get("/conversaciones/{conversacion_id}/mensajes")
def listar_mensajes(
    conversacion_id: uuid.UUID,
    db: DbSession,
    sesion: Sesion,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio: Annotated[int, Query(ge=1, le=200)] = 100,
) -> MensajeListadoRead:
    conversacion = service.obtener_conversacion_propia(
        db, sesion.usuario, sesion.rol_codigo, conversacion_id
    )
    items, total = service.listar_mensajes(db, conversacion, pagina=pagina, tamanio=tamanio)
    return MensajeListadoRead.model_validate(
        {"items": items, "total": total, "pagina": pagina, "tamanio": tamanio}
    )


@router.delete("/conversaciones/{conversacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_conversacion(conversacion_id: uuid.UUID, db: DbSession, sesion: Sesion) -> None:
    conversacion = service.obtener_conversacion_propia(
        db, sesion.usuario, sesion.rol_codigo, conversacion_id
    )
    service.eliminar_conversacion(db, conversacion)


@router.post("/conversaciones/{conversacion_id}/mensajes")
def enviar_mensaje(
    conversacion_id: uuid.UUID,
    datos: MensajeCreate,
    db: DbSession,
    sesion: Sesion,
    transport: TransportProveedor,
) -> StreamingResponse:
    """Responde por SSE con los eventos `herramienta`, `texto`, `tarjeta`, `navegar`, `fin` y
    `error`, cada uno con el `solicitud_id` de este envío."""
    conversacion = service.obtener_conversacion_propia(
        db, sesion.usuario, sesion.rol_codigo, conversacion_id
    )
    envio = service.iniciar_envio(db, sesion.usuario, sesion.rol_codigo, conversacion, datos)

    def _flujo() -> Iterator[str]:
        for evento in service.generar_respuesta(db, sesion.usuario, envio, transport=transport):
            yield _formatear_sse(evento)

    return StreamingResponse(
        _flujo(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/resolver")
def resolver(datos: ResolverCreate, db: DbSession, sesion: Sesion) -> ResolverRead:
    """Rehidrata alias con nombres reales, si la conversación es de quien pregunta y su rol
    activo puede leer esas personas."""
    conversacion = service.obtener_conversacion_propia(
        db, sesion.usuario, sesion.rol_codigo, datos.conversacion_id
    )
    resueltos = resolver_aliases(
        db,
        conversacion_id=conversacion.id,
        usuario_id=sesion.usuario.id,
        rol_codigo=sesion.rol_codigo,
        aliases=datos.aliases,
    )
    return ResolverRead(
        items=[AliasResueltoRead.model_validate(r, from_attributes=True) for r in resueltos]
    )


def _formatear_sse(evento: dict[str, Any]) -> str:
    datos = json.dumps(evento["datos"], ensure_ascii=False, default=str)
    return f"event: {evento['evento']}\ndata: {datos}\n\n"
