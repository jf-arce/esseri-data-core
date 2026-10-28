"""Ejecutor de generar_orden_compra y stub de generar_comunicacion. Dueño: Canu (ver #199)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.exceptions import AppException
from src.models import EventLog
from src.proveedores_compras.models import (
    OrdenCompraSolicitud,
    ProductoProveedor,
    Proveedor,
    SolicitudCompra,
)
from src.proveedores_compras.schemas import OrdenCompraCreate, OrdenCompraDetalleCreate
from src.proveedores_compras.service import crear_orden_compra_en_transaccion
from src.workflows.constants import ERROR_ACCION_NO_IMPLEMENTADA
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.schemas import ResultadoAccion


def ejecutar_generar_orden_compra(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Emite la orden de una solicitud aprobada con el único proveedor activo de su ítem.

    Solo automatiza el caso sin ambigüedad: con un artículo fuera de catálogo o con varios
    proveedores posibles falla con un motivo claro y la orden se emite a mano.
    """
    if evento.entidad != "solicitud_compra":
        return _error("La acción requiere una solicitud de compra.")
    # El bloqueo evita que dos ejecuciones armen dos órdenes para la misma solicitud.
    solicitud = db.scalar(
        select(SolicitudCompra)
        .where(SolicitudCompra.id == evento.entidad_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if solicitud is None:
        return _error("La solicitud del evento no existe.")
    en_orden = db.scalar(
        select(OrdenCompraSolicitud.orden_compra_id).where(
            OrdenCompraSolicitud.solicitud_compra_id == solicitud.id
        )
    )
    if en_orden is not None:
        return ResultadoAccion(detalle="Sin cambios: la solicitud ya está en una orden de compra.")
    if solicitud.estado != "aprobada":
        return ResultadoAccion(detalle=f"Sin cambios: la solicitud está {solicitud.estado}.")
    if solicitud.producto_servicio_id is None:
        return _error(
            f"'{solicitud.articulo}' está fuera del catálogo: la orden se emite a mano "
            "eligiendo el ítem y el proveedor."
        )

    proveedores = db.scalars(
        select(Proveedor)
        .join(ProductoProveedor, ProductoProveedor.proveedor_id == Proveedor.id)
        .where(
            ProductoProveedor.producto_servicio_id == solicitud.producto_servicio_id,
            Proveedor.estado == "activo",
        )
    ).all()
    if not proveedores:
        return _error("El ítem de la solicitud no tiene un proveedor activo asociado.")
    if len(proveedores) > 1:
        return _error(
            f"El ítem tiene {len(proveedores)} proveedores activos: la orden se emite a mano "
            "eligiendo uno."
        )
    proveedor = proveedores[0]

    try:
        crear_orden_compra_en_transaccion(
            db,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(
                        producto_servicio_id=solicitud.producto_servicio_id,
                        cantidad_pedida=solicitud.cantidad,
                    )
                ],
            ),
            evento.usuario_id,
        )
    except AppException as error:
        return _error(error.message)
    return ResultadoAccion(
        detalle=f"Orden de compra emitida a {proveedor.nombre} por {solicitud.cantidad} unidad(es)."
    )


def ejecutar_generar_comunicacion(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    return ResultadoAccion(
        error=ERROR_ACCION_NO_IMPLEMENTADA.format(tipo_accion="generar_comunicacion")
    )


def _error(motivo: str) -> ResultadoAccion:
    return ResultadoAccion(detalle=motivo, error=motivo)
