import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.constants import PERMISO_INSCRIPCIONES_CREAR, PERMISO_INSCRIPCIONES_LEER
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.inscripciones import service
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    DivisionOpcionRead,
    InscripcionListadoRead,
    InscripcionNuevaCreate,
    InscripcionRead,
    ReinscripcionCreate,
    SolicitudInscripcionOpcionRead,
)

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_INSCRIPCIONES_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_INSCRIPCIONES_LEER))]


@router.get("")
def listar_inscripciones(
    db: DbSession,
    _: PuedeLeer,
    ciclo_lectivo: Annotated[str | None, Query(min_length=1, max_length=20)] = None,
    estado: Annotated[Literal["activa", "finalizada", "baja"] | None, Query()] = None,
    tipo: Annotated[
        Literal["nueva", "reinscripcion", "cambio_matricula", "baja"] | None,
        Query(),
    ] = None,
    alumno_id: Annotated[uuid.UUID | None, Query()] = None,
    division_id: Annotated[uuid.UUID | None, Query()] = None,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InscripcionListadoRead:
    return service.listar_inscripciones(
        db,
        ciclo_lectivo=ciclo_lectivo.strip() if ciclo_lectivo else None,
        estado=estado,
        tipo=tipo,
        alumno_id=alumno_id,
        division_id=division_id,
        buscar=buscar,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


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


@router.get("/opciones/solicitudes")
def listar_solicitudes_disponibles(
    db: DbSession,
    _: PuedeLeer,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[SolicitudInscripcionOpcionRead]:
    return service.listar_solicitudes_disponibles(db, buscar=buscar, limite=limite)


@router.get("/opciones/divisiones")
def listar_divisiones_disponibles(db: DbSession, _: PuedeLeer) -> list[DivisionOpcionRead]:
    return service.listar_divisiones_disponibles(db)


@router.get("/opciones/reinscripciones")
def listar_alumnos_elegibles_reinscripcion(
    db: DbSession,
    _: PuedeLeer,
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
def obtener_inscripcion(inscripcion_id: uuid.UUID, db: DbSession, _: PuedeLeer) -> InscripcionRead:
    inscripcion = service.obtener_inscripcion(db, inscripcion_id)
    return InscripcionRead.model_validate(inscripcion)
