"""Dependencias de FastAPI para el módulo Familias y Alumnos."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.service import (
    obtener_alumno_por_id,
    obtener_familia_por_id,
    obtener_vinculo_por_id,
)


def obtener_familia_o_404(
    familia_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Dependencia para obtener una familia por ID o retornar 404.

    Args:
        familia_id: ID de la familia a buscar
        db: Sesión de base de datos inyectada

    Returns:
        La familia encontrada

    Raises:
        HTTPException: Si la familia no existe (404)
    """
    familia = obtener_familia_por_id(db, familia_id)
    if familia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Familia con ID {familia_id} no encontrada",
        )
    return familia


def obtener_alumno_o_404(
    alumno_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Alumno:
    """Dependencia para obtener un alumno por ID o retornar 404."""
    alumno = obtener_alumno_por_id(db, alumno_id)
    if alumno is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alumno con ID {alumno_id} no encontrado",
        )
    return alumno


def obtener_vinculo_o_404(
    vinculo_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> FamiliaAlumno:
    """Dependencia para obtener un vínculo familia-alumno por ID o retornar 404."""
    vinculo = obtener_vinculo_por_id(db, vinculo_id)
    if vinculo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vínculo con ID {vinculo_id} no encontrado",
        )
    return vinculo
