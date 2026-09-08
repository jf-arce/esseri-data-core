import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.auditoria.service import listar_historial_entidad
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
    usuario_id: uuid.UUID
    usuario_email: str | None


@router.get("/{entidad}/{entidad_id}", response_model=list[HistorialEntradaRead])
def obtener_historial(
    entidad: str, entidad_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> list[dict]:
    """Historial de cambios de campo de una entidad, ordenado cronológicamente."""
    return listar_historial_entidad(db, entidad, entidad_id)
