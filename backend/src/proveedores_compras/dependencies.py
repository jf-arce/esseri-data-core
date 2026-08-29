"""Dependencias de FastAPI para el módulo Proveedores y Compras."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.proveedores_compras.models import Proveedor
from src.proveedores_compras.service import obtener_proveedor_por_id


def obtener_proveedor_o_404(
    proveedor_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> Proveedor:
    """Obtener un proveedor por ID o cortar con 404.

    Args:
        proveedor_id: ID del proveedor a buscar
        db: Sesión de base de datos inyectada

    Returns:
        El proveedor encontrado

    Raises:
        HTTPException: Si el proveedor no existe (404)
    """
    proveedor = obtener_proveedor_por_id(db, proveedor_id)
    if proveedor is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proveedor con ID {proveedor_id} no encontrado",
        )
    return proveedor
