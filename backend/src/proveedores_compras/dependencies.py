"""Dependencias de FastAPI para el módulo Proveedores y Compras."""

import uuid

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database import get_db
from src.proveedores_compras.models import ProductoServicio, Proveedor, SolicitudCompra
from src.proveedores_compras.service import (
    obtener_producto_servicio_por_id,
    obtener_proveedor_por_id,
    obtener_solicitud_por_id,
)


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


def obtener_solicitud_o_404(
    solicitud_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> SolicitudCompra:
    """Obtener una solicitud de compra por ID o cortar con 404.

    Args:
        solicitud_id: ID de la solicitud a buscar
        db: Sesión de base de datos inyectada

    Returns:
        La solicitud encontrada

    Raises:
        HTTPException: Si la solicitud no existe (404)
    """
    solicitud = obtener_solicitud_por_id(db, solicitud_id)
    if solicitud is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Solicitud de compra con ID {solicitud_id} no encontrada",
        )
    return solicitud


def obtener_producto_servicio_o_404(
    producto_id: uuid.UUID,
    db: Session = Depends(get_db),  # noqa: B008
) -> ProductoServicio:
    """Obtener un ítem del catálogo por ID o cortar con 404.

    Args:
        producto_id: ID del producto o servicio a buscar
        db: Sesión de base de datos inyectada

    Returns:
        El ítem encontrado

    Raises:
        HTTPException: Si no existe (404)
    """
    producto = obtener_producto_servicio_por_id(db, producto_id)
    if producto is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Producto o servicio con ID {producto_id} no encontrado",
        )
    return producto
