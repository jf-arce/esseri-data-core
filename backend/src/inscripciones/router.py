import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from src.auth.constants import ACCION_CREAR, ACCION_LEER, MODULO_INSCRIPCIONES
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.inscripciones import service
from src.inscripciones.schemas import InscripcionNuevaCreate, InscripcionRead, ReinscripcionCreate

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(MODULO_INSCRIPCIONES, ACCION_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(MODULO_INSCRIPCIONES, ACCION_LEER))]


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_inscripcion(
    datos: InscripcionNuevaCreate, db: DbSession, _: PuedeCrear
) -> InscripcionRead:
    inscripcion = service.crear_inscripcion_nueva(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.post("/reinscripciones", status_code=status.HTTP_201_CREATED)
def crear_reinscripcion(
    datos: ReinscripcionCreate, db: DbSession, _: PuedeCrear
) -> InscripcionRead:
    inscripcion = service.crear_reinscripcion(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.get("/{inscripcion_id}")
def obtener_inscripcion(inscripcion_id: uuid.UUID, db: DbSession, _: PuedeLeer) -> InscripcionRead:
    inscripcion = service.obtener_inscripcion(db, inscripcion_id)
    return InscripcionRead.model_validate(inscripcion)
