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
from src.familias_alumnos.dependencies import obtener_familia_o_404
from src.familias_alumnos.models import Familia
from src.familias_alumnos.schemas import (
    AltaFamiliaCreate,
    AltaFamiliaResponse,
    FamiliaCreate,
    FamiliaResponse,
    FamiliaUpdate,
)
from src.familias_alumnos.service import (
    actualizar_familia,
    crear_alta_familia,
    crear_familia,
    eliminar_familia,
)

router = APIRouter(prefix="/familias-alumnos", tags=["familias_alumnos"])


@router.post("/alta-completa", response_model=AltaFamiliaResponse, status_code=status.HTTP_201_CREATED)
def crear_alta_completa(
    datos: AltaFamiliaCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(MODULO_FAMILIAS_ALUMNOS, ACCION_CREAR))],
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
