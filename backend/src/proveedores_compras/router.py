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
from src.proveedores_compras.dependencies import (
    obtener_producto_servicio_o_404,
    obtener_proveedor_o_404,
    obtener_solicitud_o_404,
)
from src.proveedores_compras.models import ProductoServicio, Proveedor, SolicitudCompra
from src.proveedores_compras.schemas import (
    ProductoServicioCreate,
    ProductoServicioResponse,
    ProductoServicioUpdate,
    ProveedorCreate,
    ProveedorResponse,
    ProveedorUpdate,
    SolicitudCompraCambioEstado,
    SolicitudCompraCreate,
    SolicitudCompraResponse,
    SolicitudCompraUpdate,
)
from src.proveedores_compras.service import (
    actualizar_producto_servicio,
    actualizar_proveedor,
    actualizar_solicitud,
    cambiar_estado_solicitud,
    crear_producto_servicio,
    crear_proveedor,
    crear_solicitud,
    eliminar_producto_servicio,
    eliminar_proveedor,
    eliminar_solicitud,
    listar_productos_servicios,
    listar_proveedores,
    listar_solicitudes,
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


@router.post("/solicitudes", response_model=SolicitudCompraResponse, status_code=201)
def crear_solicitud_endpoint(
    solicitud_data: SolicitudCompraCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> SolicitudCompra:
    """Registrar una solicitud interna de compra (RF-20).

    El solicitante sale de la sesión, no del payload.
    """
    return crear_solicitud(db, solicitud_data, usuario.id)


@router.get("/solicitudes", response_model=list[SolicitudCompraResponse])
def listar_solicitudes_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[SolicitudCompra]:
    """Listar las solicitudes, de la más reciente a la más vieja."""
    return listar_solicitudes(db)


@router.get("/solicitudes/{solicitud_id}", response_model=SolicitudCompraResponse)
def obtener_solicitud_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    solicitud: SolicitudCompra = Depends(obtener_solicitud_o_404),  # noqa: B008
) -> SolicitudCompra:
    """Obtener una solicitud por su ID."""
    return solicitud


@router.put("/solicitudes/{solicitud_id}", response_model=SolicitudCompraResponse)
def actualizar_solicitud_endpoint(
    solicitud_data: SolicitudCompraUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR))],
    solicitud: SolicitudCompra = Depends(obtener_solicitud_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> SolicitudCompra:
    """Corregir los datos de una solicitud. Para aprobar o rechazar, ver el endpoint de estado."""
    return actualizar_solicitud(db, solicitud, solicitud_data, usuario.id)


@router.patch("/solicitudes/{solicitud_id}/estado", response_model=SolicitudCompraResponse)
def cambiar_estado_solicitud_endpoint(
    cambio: SolicitudCompraCambioEstado,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR))],
    solicitud: SolicitudCompra = Depends(obtener_solicitud_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> SolicitudCompra:
    """Aprobar o rechazar una solicitud (RF-20).

    Endpoint propio en vez de un campo más del PUT: cambiar el estado es una decisión de
    negocio, no una corrección de datos, y así queda auditable por separado.
    """
    return cambiar_estado_solicitud(db, solicitud, cambio.estado, usuario.id)


@router.delete("/solicitudes/{solicitud_id}", status_code=204)
def eliminar_solicitud_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ELIMINAR))],
    solicitud: SolicitudCompra = Depends(obtener_solicitud_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una solicitud."""
    eliminar_solicitud(db, solicitud, usuario.id)


@router.post("/productos", response_model=ProductoServicioResponse, status_code=201)
def crear_producto_servicio_endpoint(
    producto_data: ProductoServicioCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> ProductoServicio:
    """Dar de alta un ítem en el catálogo de compras."""
    return crear_producto_servicio(db, producto_data, usuario.id)


@router.get("/productos", response_model=list[ProductoServicioResponse])
def listar_productos_servicios_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[ProductoServicio]:
    """Listar el catálogo completo, activos e inactivos, ordenado por nombre."""
    return listar_productos_servicios(db)


@router.get("/productos/{producto_id}", response_model=ProductoServicioResponse)
def obtener_producto_servicio_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    producto: ProductoServicio = Depends(obtener_producto_servicio_o_404),  # noqa: B008
) -> ProductoServicio:
    """Obtener un ítem del catálogo por su ID."""
    return producto


@router.put("/productos/{producto_id}", response_model=ProductoServicioResponse)
def actualizar_producto_servicio_endpoint(
    producto_data: ProductoServicioUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR))],
    producto: ProductoServicio = Depends(obtener_producto_servicio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> ProductoServicio:
    """Modificar un ítem del catálogo. Para darlo de baja, alcanza con `activo = false`."""
    return actualizar_producto_servicio(db, producto, producto_data, usuario.id)


@router.delete("/productos/{producto_id}", status_code=204)
def eliminar_producto_servicio_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ELIMINAR))],
    producto: ProductoServicio = Depends(obtener_producto_servicio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un ítem del catálogo que todavía no se usó.

    Da 409 si ya está referenciado por una compra: ahí corresponde `activo = false`.
    """
    eliminar_producto_servicio(db, producto, usuario.id)
