"""Dependencias de FastAPI para el módulo Académico."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, Materia, NivelEducativo
from src.academico.service import (
    obtener_anio_por_id,
    obtener_division_por_id,
    obtener_materia_por_id,
    obtener_nivel_educativo_por_id,
)
from src.database import get_db


def obtener_nivel_educativo_o_404(
    nivel_educativo_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> NivelEducativo:
    """Dependencia para obtener un nivel educativo por ID o retornar 404."""
    nivel = obtener_nivel_educativo_por_id(db, nivel_educativo_id)
    if nivel is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nivel educativo con ID {nivel_educativo_id} no encontrado",
        )
    return nivel


def obtener_anio_o_404(
    anio_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Anio:
    """Dependencia para obtener un año por ID o retornar 404."""
    anio = obtener_anio_por_id(db, anio_id)
    if anio is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Año con ID {anio_id} no encontrado",
        )
    return anio


def obtener_division_o_404(
    division_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Division:
    """Dependencia para obtener una división por ID o retornar 404."""
    division = obtener_division_por_id(db, division_id)
    if division is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"División con ID {division_id} no encontrada",
        )
    return division


def obtener_materia_o_404(
    materia_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Materia:
    """Dependencia para obtener una materia por ID o retornar 404."""
    materia = obtener_materia_por_id(db, materia_id)
    if materia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Materia con ID {materia_id} no encontrada",
        )
    return materia
