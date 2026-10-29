import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from src.auth.constants import (
    PERMISO_COMUNICACIONES_ACTUALIZAR,
    PERMISO_COMUNICACIONES_CREAR,
    PERMISO_COMUNICACIONES_LEER,
)
from src.auth.dependencies import DbSession, RolActivo, requiere_permiso
from src.auth.models import Usuario
from src.comunicaciones import service
from src.comunicaciones.schemas import BorradorInput, ComunicacionRead, Listado

router = APIRouter(prefix="/comunicaciones", tags=["Comunicaciones"])
Crear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_CREAR))]
Editar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_ACTUALIZAR))]
Leer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_COMUNICACIONES_LEER))]


def gestion(rol: str | None):
    if rol == "familia":
        raise HTTPException(403, "Usá tu bandeja familiar")


def familiar(rol: str | None, response: Response):
    response.headers["Cache-Control"] = "private, no-store"
    if rol != "familia":
        raise HTTPException(403, "Esta operación requiere el rol Familia")


@router.get("/familia")
def bandeja(
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
    response: Response,
    pagina: Annotated[int, Query(ge=1)] = 1,
    buscar: Annotated[str, Query(max_length=200)] = "",
    no_leidas: bool = False,
) -> Listado:
    familiar(rol, response)
    return service.listar(db, usuario, pagina, buscar, no_leidas, familia=True)


@router.get("/familia/{id}")
def detalle(
    id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo, response: Response
) -> ComunicacionRead:
    familiar(rol, response)
    return service.detalle_familia(db, id, usuario)


@router.put("/familia/{id}/lectura")
def lectura(
    id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo, response: Response
) -> ComunicacionRead:
    familiar(rol, response)
    return service.detalle_familia(db, id, usuario, leer=True)


@router.get("/opciones")
def opciones(db: DbSession, _: Crear, rol: RolActivo):
    gestion(rol)
    return service.opciones(db)


@router.post("/vista-previa")
def vista_previa(data: BorradorInput, db: DbSession, _: Crear, rol: RolActivo):
    gestion(rol)
    return {"destinatarios": len(service.resolver(db, data.audiencia))}


@router.get("")
def listado(
    db: DbSession,
    usuario: Leer,
    rol: RolActivo,
    pagina: Annotated[int, Query(ge=1)] = 1,
    buscar: Annotated[str, Query(max_length=200)] = "",
) -> Listado:
    gestion(rol)
    return service.listar(db, usuario, pagina, buscar, False)


@router.post("", status_code=201)
def crear(data: BorradorInput, db: DbSession, usuario: Crear, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.crear(db, data, usuario)


@router.get("/{id}")
def obtener(id: uuid.UUID, db: DbSession, usuario: Leer, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.respuesta(db, service.obtener(db, id, usuario))


@router.put("/{id}")
def editar(
    id: uuid.UUID, data: BorradorInput, db: DbSession, usuario: Editar, rol: RolActivo
) -> ComunicacionRead:
    gestion(rol)
    return service.editar(db, id, data, usuario)


@router.post("/{id}/publicar")
def publicar(id: uuid.UUID, db: DbSession, usuario: Crear, rol: RolActivo) -> ComunicacionRead:
    gestion(rol)
    return service.publicar(db, id, usuario)
