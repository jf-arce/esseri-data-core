from src.exceptions import AppException


class ProveedorConVinculos(AppException):
    """El proveedor ya está referenciado por el catálogo, precios u órdenes de compra:
    borrarlo dejaría esas filas apuntando a nada."""

    status_code = 409

    def __init__(
        self,
        message: str = (
            "No se puede eliminar: el proveedor tiene productos, precios u órdenes asociados"
        ),
    ):
        super().__init__(message)


class SolicitudSinArticuloNiProducto(AppException):
    """Una modificación dejaría la solicitud sin artículo ni producto de catálogo.

    En el alta lo corta el `model_validator` del schema (422), pero un update parcial puede
    llegar a lo mismo borrando el único de los dos que estaba cargado, y ahí la validación
    necesita el estado actual de la fila.
    """

    status_code = 422

    def __init__(
        self,
        message: str = "La solicitud tiene que indicar un artículo o un producto del catálogo.",
    ):
        super().__init__(message)


class ProductoServicioInexistente(AppException):
    """El `producto_servicio_id` recibido no existe en el catálogo."""

    status_code = 422

    def __init__(self, message: str = "El producto o servicio indicado no existe en el catálogo."):
        super().__init__(message)


class ProductoServicioEnUso(AppException):
    """El ítem del catálogo ya está referenciado por una solicitud, una orden o un precio.

    Borrarlo rompería la trazabilidad de compras que ya pasaron. La baja correcta es
    `activo = False`, que lo saca de las compras nuevas sin tocar el historial.
    """

    status_code = 409

    def __init__(
        self,
        message: str = (
            "No se puede eliminar: el ítem ya se usó en solicitudes, órdenes o precios. "
            "Marcalo como inactivo en vez de borrarlo."
        ),
    ):
        super().__init__(message)
