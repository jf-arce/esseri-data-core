from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from pydantic import ValidationError

from src.auth.dependencies import DbSession, RolActivo, UsuarioAutenticado
from src.comunicaciones import adjuntos_conversacion
from src.comunicaciones import conversaciones_service as service
from src.comunicaciones.adjuntos_router import respuesta_archivo_privado
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


def respuesta_privada(response: Response) -> None:
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(
    prefix="/comunicaciones/conversaciones",
    tags=["Conversaciones contextuales"],
    dependencies=[Depends(respuesta_privada)],
)
Limite = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]


def mensaje_formulario(
    texto: Annotated[str, Form(max_length=5000)], clave: Annotated[UUID, Form()]
) -> MensajeCreate:
    try:
        return MensajeCreate(texto=texto, clave=clave)
    except ValidationError as exc:
        raise HTTPException(422, "El mensaje no puede estar vacío.") from exc


MensajeFormulario = Annotated[MensajeCreate, Depends(mensaje_formulario)]
Archivos = Annotated[list[UploadFile], File()]


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


@router.post("/contextos/{tipo}/{id_contexto}/con-adjuntos", status_code=201)
def abrir_con_adjuntos(
    tipo: TipoContexto,
    id_contexto: UUID,
    datos: MensajeFormulario,
    archivos: Archivos,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
) -> ConversacionRead:
    service.estado_contexto(db, usuario, rol, tipo, id_contexto)
    return service.abrir(
        db, usuario, rol, tipo, id_contexto, datos, adjuntos_conversacion.preparar(archivos)
    )


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


@router.post("/{id_hilo}/mensajes/con-adjuntos", status_code=201)
def responder_con_adjuntos(
    id_hilo: UUID,
    datos: MensajeFormulario,
    archivos: Archivos,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
) -> MensajeRead:
    service.buscar_hilo(db, usuario, rol, id_hilo)
    return service.responder(
        db, usuario, rol, id_hilo, datos, adjuntos_conversacion.preparar(archivos)
    )


@router.get("/{id_hilo}/mensajes/{id_mensaje}/adjuntos/{id_adjunto}")
def descargar_adjunto(
    id_hilo: UUID,
    id_mensaje: UUID,
    id_adjunto: UUID,
    db: DbSession,
    usuario: UsuarioAutenticado,
    rol: RolActivo,
) -> Response:
    service.buscar_hilo(db, usuario, rol, id_hilo)
    adjunto, contenido = adjuntos_conversacion.descargar(db, id_hilo, id_mensaje, id_adjunto)
    return respuesta_archivo_privado(adjunto.nombre, adjunto.tipo_contenido, contenido)


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
