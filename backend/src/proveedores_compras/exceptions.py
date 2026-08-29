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


class ProveedorInexistente(AppException):
    """El `proveedor_id` recibido no existe."""

    status_code = 422

    def __init__(self, message: str = "El proveedor indicado no existe."):
        super().__init__(message)


class SolicitudNoAprobada(AppException):
    """Se quiso meter en una orden una solicitud que no está aprobada.

    RF-21 es explícito: la orden se genera a partir de solicitud(es) **aprobada(s)**. Comprar
    contra un pedido pendiente o rechazado saltearía la autorización.
    """

    status_code = 422

    def __init__(self, message: str = "Solo se pueden incluir solicitudes aprobadas en una orden."):
        super().__init__(message)


class SolicitudYaEnOrden(AppException):
    """La solicitud ya está vinculada a otra orden de compra.

    Sin esto, el mismo pedido podría comprarse dos veces sin que nada avise.
    """

    status_code = 409

    def __init__(
        self, message: str = "Alguna de las solicitudes ya está incluida en otra orden de compra."
    ):
        super().__init__(message)


class ProductoServicioInactivo(AppException):
    """Se quiso pedir un ítem dado de baja del catálogo."""

    status_code = 422

    def __init__(
        self,
        message: str = (
            "Alguno de los ítems está inactivo en el catálogo y no se puede pedir en una "
            "orden nueva."
        ),
    ):
        super().__init__(message)


class OrdenCompraNoCancelable(AppException):
    """Solo una orden `emitida` se puede cancelar: una ya recibida tiene mercadería asociada."""

    status_code = 409

    def __init__(
        self, message: str = "Solo se puede cancelar una orden emitida, no una ya recibida."
    ):
        super().__init__(message)


class OrdenNoRecibible(AppException):
    """Solo se puede recibir mercadería contra una orden emitida.

    Una cancelada nunca va a llegar, y una ya recibida no tiene nada pendiente.
    """

    status_code = 409

    def __init__(
        self,
        message: str = "Solo se puede registrar una recepción sobre una orden emitida.",
    ):
        super().__init__(message)


class LineaAjenaALaOrden(AppException):
    """La línea que se quiere recibir pertenece a otra orden de compra."""

    status_code = 422

    def __init__(
        self, message: str = "Alguna de las líneas recibidas no pertenece a esta orden de compra."
    ):
        super().__init__(message)


class RecepcionExcedeLoPedido(AppException):
    """Se quiso recibir más de lo que se había pedido en esa línea.

    Recibir de más no es un ajuste silencioso: o hubo un error de carga, o el proveedor mandó
    de más y eso se resuelve con una orden nueva, no inflando la original.
    """

    status_code = 422

    def __init__(
        self,
        message: str = (
            "La cantidad recibida supera lo pedido en alguna línea. Revisá las cantidades."
        ),
    ):
        super().__init__(message)
