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


class ProveedorYaAsociado(AppException):
    """El proveedor ya ofrece ese ítem del catálogo: el par no se repite."""

    status_code = 409

    def __init__(self, message: str = "El proveedor ya está asociado a este ítem del catálogo."):
        super().__init__(message)


class ProveedorNoAsociado(AppException):
    """Se quiso cargar un precio para un proveedor que no ofrece ese ítem.

    El precio cuelga del par producto + proveedor: sin la asociación, quedaría un precio de
    alguien que el catálogo no reconoce como proveedor de ese ítem.
    """

    status_code = 422

    def __init__(
        self,
        message: str = (
            "El proveedor no está asociado a este ítem. Asocialo antes de cargarle un precio."
        ),
    ):
        super().__init__(message)


class AsociacionInexistente(AppException):
    """Se quiso quitar un proveedor que no está asociado a ese ítem."""

    status_code = 404

    def __init__(self, message: str = "El proveedor no está asociado a este ítem del catálogo."):
        super().__init__(message)


class AsociacionConPrecios(AppException):
    """El par producto + proveedor ya tiene precios cargados.

    Quitar la asociación dejaría ese histórico sin dueño visible, que es justo lo que el cliente
    pidió conservar (respuesta 12: "precios históricos").
    """

    status_code = 409

    def __init__(
        self,
        message: str = (
            "No se puede quitar el proveedor: ya tiene precios cargados para este ítem y se "
            "perdería el histórico."
        ),
    ):
        super().__init__(message)


class VigenciaNoPosterior(AppException):
    """El precio nuevo empieza el mismo día o antes que el último ya cargado.

    Un precio nuevo cierra al anterior el día previo; si empezara antes, el anterior quedaría
    con una vigencia negativa. Para arreglar un dato mal cargado está la corrección.
    """

    status_code = 422

    def __init__(
        self,
        message: str = (
            "La vigencia tiene que empezar después de la del último precio cargado. Si ese "
            "precio está mal, corregilo en vez de cargar uno nuevo."
        ),
    ):
        super().__init__(message)


class VigenciaFueraDeRango(AppException):
    """La fecha corregida pisaría la vigencia de otro precio del mismo par."""

    status_code = 422

    def __init__(
        self,
        message: str = (
            "La fecha tiene que quedar después del inicio del precio anterior y no pasarse del "
            "fin de vigencia de este."
        ),
    ):
        super().__init__(message)
