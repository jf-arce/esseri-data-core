import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.inscripciones import service
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    DivisionOpcionRead,
    InscripcionNuevaCreate,
    InscripcionRead,
    ReinscripcionCreate,
    SolicitudInscripcionOpcionRead,
)

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

DbSession = Annotated[Session, Depends(get_db)]


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_inscripcion(datos: InscripcionNuevaCreate, db: DbSession) -> InscripcionRead:
    inscripcion = service.crear_inscripcion_nueva(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.post("/reinscripciones", status_code=status.HTTP_201_CREATED)
def crear_reinscripcion(datos: ReinscripcionCreate, db: DbSession) -> InscripcionRead:
    inscripcion = service.crear_reinscripcion(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.get("/opciones/solicitudes")
def listar_solicitudes_disponibles(
    db: DbSession,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[SolicitudInscripcionOpcionRead]:
    return service.listar_solicitudes_disponibles(db, buscar=buscar, limite=limite)


@router.get("/opciones/divisiones")
def listar_divisiones_disponibles(db: DbSession) -> list[DivisionOpcionRead]:
    return service.listar_divisiones_disponibles(db)


@router.get("/opciones/reinscripciones")
def listar_alumnos_elegibles_reinscripcion(
    db: DbSession,
    ciclo_lectivo: Annotated[
        str,
        Query(min_length=4, max_length=4, pattern=r"^[1-9]\d{3}$"),
    ],
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[AlumnoReinscripcionOpcionRead]:
    return service.listar_alumnos_elegibles_reinscripcion(
        db,
        ciclo_lectivo,
        buscar=buscar,
        limite=limite,
    )


@router.get("/{inscripcion_id}")
def obtener_inscripcion(inscripcion_id: uuid.UUID, db: DbSession) -> InscripcionRead:
    inscripcion = service.obtener_inscripcion(db, inscripcion_id)
    return InscripcionRead.model_validate(inscripcion)
