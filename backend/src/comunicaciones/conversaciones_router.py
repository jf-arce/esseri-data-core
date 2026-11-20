from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from src.auth.dependencies import DbSession, RolActivo, UsuarioAutenticado
from src.comunicaciones import conversaciones_service as service
from src.comunicaciones.conversaciones_schemas import (
    BandejaRead,
    ConversacionRead,
    EstadoContextoRead,
    EstadoConversacion,
    HistorialRead,
    MensajeCreate,
    MensajeRead,
    TipoContexto,
)

router = APIRouter(prefix="/comunicaciones/conversaciones", tags=["Conversaciones contextuales"])
Limite = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


@router.get("")
def bandeja(
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
    estado: EstadoConversacion | None = None,
    tipo: TipoContexto | None = None,
    limite: Limite = 25,
    offset: Offset = 0,
) -> BandejaRead:
    return service.bandeja(db, usuario, rol, estado, tipo, limite, offset)


@router.get("/contextos/{tipo}/{id_contexto}")
def estado_contexto(
    tipo: TipoContexto,
    id_contexto: UUID,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
) -> EstadoContextoRead:
    return service.estado_contexto(db, usuario, rol, tipo, id_contexto)


@router.post("/contextos/{tipo}/{id_contexto}", status_code=201)
def abrir(
    tipo: TipoContexto,
    id_contexto: UUID,
    datos: MensajeCreate,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
) -> ConversacionRead:
    return service.abrir(db, usuario, rol, tipo, id_contexto, datos)


@router.get("/{id_hilo}")
def detalle(
    id_hilo: UUID, db: DbSession, usuario: UsuarioAutenticado, rol: RolActivo
) -> ConversacionRead:
    return service.detalle(db, usuario, rol, id_hilo)


@router.get("/{id_hilo}/mensajes")
def historial(
    id_hilo: UUID,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
    limite: Limite = 30,
    antes: UUID | None = None,
) -> HistorialRead:
    return service.historial(db, usuario, rol, id_hilo, limite, antes)


@router.post("/{id_hilo}/mensajes", status_code=201)
def responder(
    id_hilo: UUID, datos: MensajeCreate, db: DbSession, usuario: UsuarioAutenticado, rol: RolActivo
) -> MensajeRead:
    return service.responder(db, usuario, rol, id_hilo, datos)


@router.post("/{id_hilo}/resolver")
def resolver(
    id_hilo: UUID, db: DbSession, usuario: UsuarioAutenticado, rol: RolActivo
) -> ConversacionRead:
    return service.cambiar_estado(db, usuario, rol, id_hilo, resolver=True)


@router.post("/{id_hilo}/reabrir")
def reabrir(
    id_hilo: UUID, db: DbSession, usuario: UsuarioAutenticado, rol: RolActivo
) -> ConversacionRead:
    return service.cambiar_estado(db, usuario, rol, id_hilo, resolver=False)
