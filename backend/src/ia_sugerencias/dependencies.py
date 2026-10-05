"""Dependencias de FastAPI para el módulo IA/Sugerencias."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.service import obtener_sugerencia_por_id


def obtener_sugerencia_o_404(
    sugerencia_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> IaSugerencia:
    """Obtener una sugerencia por ID o cortar con 404.

    Args:
        sugerencia_id: ID de la sugerencia a buscar
        db: Sesión de base de datos inyectada

    Returns:
        La sugerencia encontrada

    Raises:
        HTTPException: Si la sugerencia no existe (404)
    """
    sugerencia = obtener_sugerencia_por_id(db, sugerencia_id)
    if sugerencia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Sugerencia con ID {sugerencia_id} no encontrada",
        )
    return sugerencia
