"""Dependencias de FastAPI para el módulo Familias y Alumnos."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.familias_alumnos.models import Familia
from src.familias_alumnos.service import obtener_familia_por_id


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
