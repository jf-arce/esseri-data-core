import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.auditoria.service import (
    listar_auditoria,
    listar_historial_entidad,
    listar_opciones_auditoria,
)
from src.auth.constants import PERMISO_AUDITORIA_LEER
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db

router = APIRouter(prefix="/auditoria", tags=["auditoria"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUDITORIA_LEER))]


class HistorialEntradaRead(BaseModel):
    id: uuid.UUID
    campo: str
    valor_anterior: str | None
    valor_nuevo: str | None
    fecha: datetime
    usuario_id: uuid.UUID | None
    usuario_email: str | None
    usuario_nombre: str | None
    actor_tipo: str
    origen: str | None
    motivo: str | None
    referencia_entidad: str | None
    referencia_id: uuid.UUID | None


class AuditoriaItemRead(HistorialEntradaRead):
    entidad: str
    entidad_id: uuid.UUID


class AuditoriaListadoRead(BaseModel):
    items: list[AuditoriaItemRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class OpcionUsuarioAuditoriaRead(BaseModel):
    id: uuid.UUID
    email: str
    nombre: str | None


class OpcionesAuditoriaRead(BaseModel):
    entidades: list[str]
    campos: list[str]
    origenes: list[str]
    usuarios: list[OpcionUsuarioAuditoriaRead]


@router.get("", response_model=AuditoriaListadoRead)
def listar_auditoria_global(
    db: DbSession,
    _: PuedeLeer,
    entidad: Annotated[str | None, Query(max_length=100)] = None,
    campo: Annotated[str | None, Query(max_length=100)] = None,
    usuario_id: uuid.UUID | None = None,
    actor_tipo: Literal["usuario", "sistema"] | None = None,
    origen: Annotated[str | None, Query(max_length=100)] = None,
    referencia_entidad: Annotated[str | None, Query(max_length=100)] = None,
    referencia_id: uuid.UUID | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    orden: Literal["fecha-desc", "fecha-asc"] = "fecha-desc",
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    """Todos los registros de AUDIT_LOG, con filtros y paginación (administrador)."""
    return listar_auditoria(
        db,
        entidad=entidad,
        campo=campo,
        usuario_id=usuario_id,
        actor_tipo=actor_tipo,
        origen=origen,
        referencia_entidad=referencia_entidad,
        referencia_id=referencia_id,
        desde=desde,
        hasta=hasta,
        buscar=buscar,
        orden=orden,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.get("/opciones", response_model=OpcionesAuditoriaRead)
def obtener_opciones_auditoria(db: DbSession, _: PuedeLeer) -> dict:
    """Valores distintos para poblar los filtros del listado."""
    return listar_opciones_auditoria(db)


@router.get("/{entidad}/{entidad_id}", response_model=list[HistorialEntradaRead])
def obtener_historial(
    entidad: str, entidad_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> list[dict]:
    """Historial de cambios de campo de una entidad, ordenado cronológicamente."""
    return listar_historial_entidad(db, entidad, entidad_id)
