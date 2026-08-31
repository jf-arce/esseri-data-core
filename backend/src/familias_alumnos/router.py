"""Endpoints HTTP del módulo Familias y Alumnos."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR,
    PERMISO_FAMILIAS_ALUMNOS_CREAR,
    PERMISO_FAMILIAS_ALUMNOS_ELIMINAR,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.familias_alumnos.dependencies import (
    obtener_alumno_o_404,
    obtener_familia_o_404,
    obtener_vinculo_o_404,
)
from src.familias_alumnos.exceptions import (
    AlumnoConVinculos,
    LegajoDuplicado,
    VinculoDuplicado,
)
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.schemas import (
    AltaAlumnoCreate,
    AltaAlumnoResponse,
    AltaFamiliaCreate,
    AltaFamiliaResponse,
    AlumnoCreate,
    AlumnoResponse,
    AlumnoUpdate,
    FamiliaCreate,
    FamiliaResponse,
    FamiliaUpdate,
    VinculoCreate,
    VinculoResponse,
    VinculoUpdate,
)
from src.familias_alumnos.service import (
    actualizar_alumno,
    actualizar_familia,
    actualizar_vinculo,
    crear_alta_alumno,
    crear_alta_familia,
    crear_alumno,
    crear_familia,
    desvincular_alumno_familia,
    eliminar_alumno,
    eliminar_familia,
    listar_alumnos,
    listar_familias,
    listar_vinculos_de_alumno,
    listar_vinculos_de_familia,
    vincular_alumno_familia,
)

router = APIRouter(prefix="/familias-alumnos", tags=["familias_alumnos"])


@router.post(
    "/alta-completa",
    response_model=AltaFamiliaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_alta_completa(
    datos: AltaFamiliaCreate,
    usuario: Annotated[
        Usuario,
        Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_CREAR)),
    ],
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    """Crear Persona responsable, Usuario con rol familia y Familia."""
    try:
        persona, familia = crear_alta_familia(db, datos, usuario.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return {"persona": persona, "familia": familia}


@router.post("/familias", response_model=FamiliaResponse, status_code=201)
def crear_familia_endpoint(
    familia_data: FamiliaCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Crear una nueva Familia."""
    return crear_familia(db, familia_data, usuario.id)


@router.get("/familias", response_model=list[FamiliaResponse])
def listar_familias_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Familia]:
    """Listar todas las familias."""
    return listar_familias(db)


@router.get("/familias/{familia_id}", response_model=FamiliaResponse)
def obtener_familia_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
) -> Familia:
    """Obtener una familia por su ID."""
    return familia


@router.put("/familias/{familia_id}", response_model=FamiliaResponse)
def actualizar_familia_endpoint(
    familia_data: FamiliaUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR))],
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Actualizar una familia existente."""
    return actualizar_familia(db, familia, familia_data, usuario.id)


@router.delete("/familias/{familia_id}", status_code=204)
def eliminar_familia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ELIMINAR))],
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una familia (baja física).

    TODO: Considerar si debería ser soft-delete en lugar de baja física
    """
    eliminar_familia(db, familia, usuario.id)


# --- ABM de Alumno (RF-03) ---------------------------------------------------------------


@router.post(
    "/alumnos/alta-completa",
    response_model=AltaAlumnoResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear_alta_alumno_endpoint(
    datos: AltaAlumnoCreate,
    usuario: Annotated[
        Usuario,
        Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_CREAR)),
    ],
    db: Session = Depends(get_db),  # noqa: B008
) -> dict:
    """Crear Persona y Alumno en una única transacción."""
    try:
        persona, alumno = crear_alta_alumno(db, datos, usuario.id)
    except LegajoDuplicado as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
    return {"persona": persona, "alumno": alumno}


@router.post("/alumnos", response_model=AlumnoResponse, status_code=201)
def crear_alumno_endpoint(
    alumno_data: AlumnoCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Alumno:
    """Crear un nuevo Alumno."""
    try:
        return crear_alumno(db, alumno_data, usuario.id)
    except LegajoDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/alumnos", response_model=list[AlumnoResponse])
def listar_alumnos_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Alumno]:
    """Listar todos los alumnos."""
    return listar_alumnos(db)


@router.get("/alumnos/{alumno_id}", response_model=AlumnoResponse)
def obtener_alumno_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    alumno: Alumno = Depends(obtener_alumno_o_404),  # noqa: B008
) -> Alumno:
    """Obtener un alumno por su ID."""
    return alumno


@router.put("/alumnos/{alumno_id}", response_model=AlumnoResponse)
def actualizar_alumno_endpoint(
    alumno_data: AlumnoUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR))],
    alumno: Alumno = Depends(obtener_alumno_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Alumno:
    """Actualizar un alumno existente."""
    try:
        return actualizar_alumno(db, alumno, alumno_data, usuario.id)
    except LegajoDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/alumnos/{alumno_id}", status_code=204)
def eliminar_alumno_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ELIMINAR))],
    alumno: Alumno = Depends(obtener_alumno_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un alumno (baja física)."""
    try:
        eliminar_alumno(db, alumno, usuario.id)
    except AlumnoConVinculos as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Vincular / desvincular alumno↔familia (RF-03) --------------------------------------


@router.post("/vinculos", response_model=VinculoResponse, status_code=201)
def vincular_alumno_familia_endpoint(
    datos: VinculoCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> FamiliaAlumno:
    """Vincular un alumno con una familia."""
    try:
        return vincular_alumno_familia(db, datos, usuario.id)
    except VinculoDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/vinculos/{vinculo_id}", response_model=VinculoResponse)
def obtener_vinculo_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    vinculo: FamiliaAlumno = Depends(obtener_vinculo_o_404),  # noqa: B008
) -> FamiliaAlumno:
    """Obtener un vínculo familia-alumno por su ID."""
    return vinculo


@router.put("/vinculos/{vinculo_id}", response_model=VinculoResponse)
def actualizar_vinculo_endpoint(
    datos: VinculoUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ACTUALIZAR))],
    vinculo: FamiliaAlumno = Depends(obtener_vinculo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> FamiliaAlumno:
    """Actualizar un vínculo existente (parentesco, responsable_principal, etc.)."""
    return actualizar_vinculo(db, vinculo, datos, usuario.id)


@router.delete("/vinculos/{vinculo_id}", status_code=204)
def desvincular_alumno_familia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_ELIMINAR))],
    vinculo: FamiliaAlumno = Depends(obtener_vinculo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Desvincular un alumno de una familia."""
    desvincular_alumno_familia(db, vinculo, usuario.id)


@router.get("/alumnos/{alumno_id}/vinculos", response_model=list[VinculoResponse])
def listar_vinculos_alumno_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    alumno: Alumno = Depends(obtener_alumno_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[FamiliaAlumno]:
    """Listar todas las familias vinculadas a un alumno."""
    return listar_vinculos_de_alumno(db, alumno.id)


@router.get("/familias/{familia_id}/vinculos", response_model=list[VinculoResponse])
def listar_vinculos_familia_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_FAMILIAS_ALUMNOS_LEER))],
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[FamiliaAlumno]:
    """Listar todos los alumnos vinculados a una familia."""
    return listar_vinculos_de_familia(db, familia.id)
