"""Errores de negocio del módulo de Facturación y Cobranza."""

from src.exceptions import AppException


class ConceptoCobroDuplicado(AppException):
    status_code = 409

    def __init__(self, message: str = "Ya existe un concepto de cobro con ese nombre."):
        super().__init__(message)


class ConceptoCobroEnUso(AppException):
    status_code = 409

    def __init__(
        self,
        message: str = (
            "No se puede eliminar el concepto porque ya tiene movimientos, reglas o facturas "
            "asociadas. Marcálo como inactivo en su lugar."
        ),
    ):
        super().__init__(message)
