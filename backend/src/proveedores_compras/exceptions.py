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
