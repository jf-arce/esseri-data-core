"""Endpoints HTTP del módulo Académico."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.academico.dependencies import (
    obtener_anio_o_404,
    obtener_division_o_404,
    obtener_nivel_educativo_o_404,
)
from src.academico.exceptions import (
    AnioConDivisiones,
    AnioDuplicado,
    DivisionConAsignaciones,
    DivisionDuplicada,
    NivelEducativoConAnios,
    NombreNivelDuplicado,
)
from src.academico.models import Anio, Division, NivelEducativo
from src.academico.schemas import (
    AnioCreate,
    AnioResponse,
    AnioUpdate,
    DivisionCreate,
    DivisionResponse,
    DivisionUpdate,
    NivelEducativoCreate,
    NivelEducativoResponse,
    NivelEducativoUpdate,
)
from src.academico.service import (
    actualizar_anio,
    actualizar_division,
    actualizar_nivel_educativo,
    crear_anio,
    crear_division,
    crear_nivel_educativo,
    eliminar_anio,
    eliminar_division,
    eliminar_nivel_educativo,
    listar_anios,
    listar_anios_por_nivel,
    listar_divisiones,
    listar_divisiones_por_anio,
    listar_niveles_educativos,
)
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR,
    PERMISO_ACADEMICO_CREAR,
    PERMISO_ACADEMICO_ELIMINAR,
    PERMISO_ACADEMICO_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db

router = APIRouter(prefix="/academico", tags=["academico"])


# --- NivelEducativo ----------------------------------------------------------------------


@router.post("/niveles", response_model=NivelEducativoResponse, status_code=201)
def crear_nivel_educativo_endpoint(
    datos: NivelEducativoCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> NivelEducativo:
    """Crear un nuevo nivel educativo."""
    try:
        return crear_nivel_educativo(db, datos, usuario.id)
    except NombreNivelDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/niveles", response_model=list[NivelEducativoResponse])
def listar_niveles_educativos_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[NivelEducativo]:
    """Listar todos los niveles educativos."""
    return listar_niveles_educativos(db)


@router.get("/niveles/{nivel_educativo_id}", response_model=NivelEducativoResponse)
def obtener_nivel_educativo_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
) -> NivelEducativo:
    """Obtener un nivel educativo por su ID."""
    return nivel


@router.put("/niveles/{nivel_educativo_id}", response_model=NivelEducativoResponse)
def actualizar_nivel_educativo_endpoint(
    datos: NivelEducativoUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> NivelEducativo:
    """Actualizar un nivel educativo existente."""
    try:
        return actualizar_nivel_educativo(db, nivel, datos, usuario.id)
    except NombreNivelDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/niveles/{nivel_educativo_id}", status_code=204)
def eliminar_nivel_educativo_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un nivel educativo."""
    try:
        eliminar_nivel_educativo(db, nivel, usuario.id)
    except NivelEducativoConAnios as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Anio --------------------------------------------------------------------------------


@router.post("/anios", response_model=AnioResponse, status_code=201)
def crear_anio_endpoint(
    datos: AnioCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Anio:
    """Crear un nuevo año."""
    try:
        return crear_anio(db, datos, usuario.id)
    except AnioDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/anios", response_model=list[AnioResponse])
def listar_anios_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    nivel_educativo_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Anio]:
    """Listar años. Opcionalmente filtrar por nivel educativo con ?nivel_educativo_id="""
    if nivel_educativo_id is not None:
        return listar_anios_por_nivel(db, nivel_educativo_id)
    return listar_anios(db)


@router.get("/anios/{anio_id}", response_model=AnioResponse)
def obtener_anio_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
) -> Anio:
    """Obtener un año por su ID."""
    return anio


@router.put("/anios/{anio_id}", response_model=AnioResponse)
def actualizar_anio_endpoint(
    datos: AnioUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Anio:
    """Actualizar un año existente."""
    try:
        return actualizar_anio(db, anio, datos, usuario.id)
    except AnioDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/anios/{anio_id}", status_code=204)
def eliminar_anio_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un año."""
    try:
        eliminar_anio(db, anio, usuario.id)
    except AnioConDivisiones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Division ----------------------------------------------------------------------------


@router.post("/divisiones", response_model=DivisionResponse, status_code=201)
def crear_division_endpoint(
    datos: DivisionCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Division:
    """Crear una nueva división."""
    try:
        return crear_division(db, datos, usuario.id)
    except DivisionDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/divisiones", response_model=list[DivisionResponse])
def listar_divisiones_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    anio_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Division]:
    """Listar divisiones. Opcionalmente filtrar por año con ?anio_id="""
    if anio_id is not None:
        return listar_divisiones_por_anio(db, anio_id)
    return listar_divisiones(db)


@router.get("/divisiones/{division_id}", response_model=DivisionResponse)
def obtener_division_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
) -> Division:
    """Obtener una división por su ID."""
    return division


@router.put("/divisiones/{division_id}", response_model=DivisionResponse)
def actualizar_division_endpoint(
    datos: DivisionUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Division:
    """Actualizar una división existente."""
    try:
        return actualizar_division(db, division, datos, usuario.id)
    except DivisionDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/divisiones/{division_id}", status_code=204)
def eliminar_division_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una división."""
    try:
        eliminar_division(db, division, usuario.id)
    except DivisionConAsignaciones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
