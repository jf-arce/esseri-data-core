"""Endpoints HTTP del módulo Proveedores y Compras."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
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
from src.exports import respuesta_csv, texto_o_vacio
from src.proveedores_compras.dependencies import (
    obtener_orden_compra_o_404,
    obtener_producto_servicio_o_404,
    obtener_proveedor_o_404,
    obtener_solicitud_o_404,
)
from src.proveedores_compras.models import (
    OrdenCompra,
    ProductoServicio,
    Proveedor,
    RecepcionCompra,
    SolicitudCompra,
)
from src.proveedores_compras.schemas import (
    LineaPendienteResponse,
    OrdenCompraCambioEstado,
    OrdenCompraCreate,
    OrdenCompraListado,
    OrdenCompraResponse,
    ProductoServicioCreate,
    ProductoServicioResponse,
    ProductoServicioUpdate,
    ProveedorCreate,
    ProveedorResponse,
    ProveedorUpdate,
    RecepcionCompraCreate,
    RecepcionCompraResponse,
    SolicitudCompraCambioEstado,
    SolicitudCompraCreate,
    SolicitudCompraResponse,
    SolicitudCompraUpdate,
)
from src.proveedores_compras.service import (
    actualizar_producto_servicio,
    actualizar_proveedor,
    actualizar_solicitud,
    buscar_ordenes_compra,
    calcular_pendientes_de_orden,
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_recepcion,
    crear_solicitud,
    eliminar_producto_servicio,
    eliminar_proveedor,
    eliminar_solicitud,
    filas_export_ordenes,
    filas_export_proveedores,
    listar_ordenes_compra,
    listar_productos_servicios,
    listar_proveedores,
    listar_recepciones_de_orden,
    listar_solicitudes,
    obtener_detalles_de_orden,
    obtener_detalles_de_recepcion,
    obtener_solicitudes_de_orden,
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


def _armar_respuesta_orden(db: Session, orden: OrdenCompra) -> OrdenCompraResponse:
    """La orden vive en tres tablas (cabecera, detalle y vínculos con solicitudes): esto las
    junta en la forma que espera el frontend, para que no tenga que hacer tres llamadas."""
    return OrdenCompraResponse(
        id=orden.id,
        fecha=orden.fecha,
        estado=orden.estado,
        proveedor_id=orden.proveedor_id,
        updated_at=orden.updated_at,
        detalles=obtener_detalles_de_orden(db, orden.id),
        solicitud_ids=obtener_solicitudes_de_orden(db, orden.id),
    )


@router.post("/ordenes", response_model=OrdenCompraResponse, status_code=201)
def crear_orden_compra_endpoint(
    orden_data: OrdenCompraCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> OrdenCompraResponse:
    """Emitir una orden de compra a partir de solicitudes aprobadas (RF-21)."""
    orden = crear_orden_compra(db, orden_data, usuario.id)
    return _armar_respuesta_orden(db, orden)


@router.get("/ordenes", response_model=list[OrdenCompraResponse])
def listar_ordenes_compra_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[OrdenCompraResponse]:
    """Listar las órdenes, de la más reciente a la más vieja, con su detalle."""
    return [_armar_respuesta_orden(db, orden) for orden in listar_ordenes_compra(db)]


@router.get("/ordenes/{orden_id}", response_model=OrdenCompraResponse)
def obtener_orden_compra_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    orden: OrdenCompra = Depends(obtener_orden_compra_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> OrdenCompraResponse:
    """Obtener una orden con su detalle y las solicitudes que la originaron."""
    return _armar_respuesta_orden(db, orden)


@router.patch("/ordenes/{orden_id}/estado", response_model=OrdenCompraResponse)
def cancelar_orden_compra_endpoint(
    cambio: OrdenCompraCambioEstado,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_ACTUALIZAR))],
    orden: OrdenCompra = Depends(obtener_orden_compra_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> OrdenCompraResponse:
    """Cancelar una orden emitida.

    Es el único cambio de estado manual: `recibida` lo va a poner la recepción de compras
    (issue #111) a partir de mercadería real, no una edición a mano. Por eso cualquier otro
    destino se rechaza con 422 en vez de aplicarse.
    """
    if cambio.estado != "cancelada":
        raise HTTPException(
            status_code=422,
            detail="Desde acá solo se puede cancelar una orden; 'recibida' lo define la recepción.",
        )
    orden = cancelar_orden_compra(db, orden, usuario.id)
    return _armar_respuesta_orden(db, orden)


def _armar_respuesta_recepcion(db: Session, recepcion: RecepcionCompra) -> RecepcionCompraResponse:
    """Junta la recepción con sus líneas, para que el frontend no haga dos llamadas."""
    return RecepcionCompraResponse(
        id=recepcion.id,
        fecha=recepcion.fecha,
        tipo=recepcion.tipo,
        remito=recepcion.remito,
        observaciones=recepcion.observaciones,
        orden_compra_id=recepcion.orden_compra_id,
        usuario_id=recepcion.usuario_id,
        updated_at=recepcion.updated_at,
        detalles=obtener_detalles_de_recepcion(db, recepcion.id),
    )


@router.get("/ordenes/{orden_id}/pendientes", response_model=list[LineaPendienteResponse])
def listar_pendientes_de_orden_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    orden: OrdenCompra = Depends(obtener_orden_compra_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[LineaPendienteResponse]:
    """Cuánto se pidió, cuánto llegó y cuánto falta por línea.

    Es lo que necesita el formulario de recepción para precargar las cantidades sin que nadie
    tenga que sacar la cuenta a mano.
    """
    return calcular_pendientes_de_orden(db, orden.id)


@router.post(
    "/ordenes/{orden_id}/recepciones", response_model=RecepcionCompraResponse, status_code=201
)
def crear_recepcion_endpoint(
    recepcion_data: RecepcionCompraCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_CREAR))],
    orden: OrdenCompra = Depends(obtener_orden_compra_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> RecepcionCompraResponse:
    """Registrar una recepción, total o parcial, contra una orden emitida.

    El responsable que recibe sale de la sesión, y el tipo se deriva de las cantidades.
    """
    recepcion = crear_recepcion(db, orden, recepcion_data, usuario.id)
    return _armar_respuesta_recepcion(db, recepcion)


@router.get("/ordenes/{orden_id}/recepciones", response_model=list[RecepcionCompraResponse])
def listar_recepciones_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    orden: OrdenCompra = Depends(obtener_orden_compra_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[RecepcionCompraResponse]:
    """Historial de recepciones de una orden."""
    return [
        _armar_respuesta_recepcion(db, recepcion)
        for recepcion in listar_recepciones_de_orden(db, orden.id)
    ]


@router.get("/ordenes-buscar", response_model=OrdenCompraListado)
def buscar_ordenes_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    buscar: str | None = Query(None, description="Busca por nombre de proveedor, sin tildes"),
    estado: str | None = Query(None, description="emitida, recibida o cancelada"),
    pagina: int = Query(1, ge=1),
    tamanio_pagina: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),  # noqa: B008
) -> OrdenCompraListado:
    """Buscar órdenes por proveedor y estado, paginado (RF-34/RF-35).

    Va en `/ordenes-buscar` y no en `/ordenes` para no romper a quien ya consume el listado
    completo: son dos contratos distintos (una lista contra una página de resultados).
    """
    return buscar_ordenes_compra(
        db, buscar=buscar, estado=estado, pagina=pagina, tamanio_pagina=tamanio_pagina
    )


@router.get("/proveedores-exportar")
def exportar_proveedores_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> StreamingResponse:
    """Descargar el listado de proveedores en CSV (RF-38)."""
    filas = [[texto_o_vacio(celda) for celda in fila] for fila in filas_export_proveedores(db)]
    return respuesta_csv(
        "proveedores",
        ["Nombre", "Categoría", "Teléfono", "Email", "Estado"],
        filas,
    )


@router.get("/ordenes-exportar")
def exportar_ordenes_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> StreamingResponse:
    """Descargar el listado de órdenes de compra en CSV (RF-38)."""
    filas = [[texto_o_vacio(celda) for celda in fila] for fila in filas_export_ordenes(db)]
    return respuesta_csv(
        "ordenes-de-compra",
        ["Fecha", "Proveedor", "Estado", "Ítems", "Unidades pedidas", "Solicitudes"],
        filas,
    )
