"""Endpoints HTTP del módulo Proveedores y Compras."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR,
    PERMISO_PROVEEDORES_COMPRAS_CREAR,
    PERMISO_PROVEEDORES_COMPRAS_ELIMINAR,
    PERMISO_PROVEEDORES_COMPRAS_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.proveedores_compras.dependencies import obtener_proveedor_o_404
from src.proveedores_compras.models import Proveedor
from src.proveedores_compras.schemas import (
    ProveedorCreate,
    ProveedorResponse,
    ProveedorUpdate,
)
from src.proveedores_compras.service import (
    actualizar_proveedor,
    crear_proveedor,
    eliminar_proveedor,
    listar_proveedores,
)

router = APIRouter(prefix="/proveedores-compras", tags=["proveedores_compras"])


@router.post("/proveedores", response_model=ProveedorResponse, status_code=201)
def crear_proveedor_endpoint(
    proveedor_data: ProveedorCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Proveedor:
    """Dar de alta un proveedor (RF-19)."""
    return crear_proveedor(db, proveedor_data, usuario.id)


@router.get("/proveedores", response_model=list[ProveedorResponse])
def listar_proveedores_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Proveedor]:
    """Listar los proveedores, ordenados por nombre."""
    return listar_proveedores(db)


@router.get("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
def obtener_proveedor_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    proveedor: Proveedor = Depends(obtener_proveedor_o_404),  # noqa: B008
) -> Proveedor:
    """Obtener un proveedor por su ID."""
    return proveedor


@router.put("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
def actualizar_proveedor_endpoint(
    proveedor_data: ProveedorUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR))],
    proveedor: Proveedor = Depends(obtener_proveedor_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Proveedor:
    """Modificar un proveedor existente (RF-19)."""
    return actualizar_proveedor(db, proveedor, proveedor_data, usuario.id)


@router.delete("/proveedores/{proveedor_id}", status_code=204)
def eliminar_proveedor_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ELIMINAR))],
    proveedor: Proveedor = Depends(obtener_proveedor_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un proveedor (baja física).

    Da 409 si el proveedor ya está referenciado por catálogo, precios u órdenes.
    """
    eliminar_proveedor(db, proveedor, usuario.id)
