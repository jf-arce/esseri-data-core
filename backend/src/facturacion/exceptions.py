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


class FamiliaNoVinculadaAlAlumno(AppException):
    status_code = 422

    def __init__(self, message: str = "La familia debe estar vinculada al alumno."):
        super().__init__(message)


class ResponsableEconomicoSinCambios(AppException):
    status_code = 409

    def __init__(
        self,
        message: str = "La familia indicada ya es el responsable económico vigente o programado.",
    ):
        super().__init__(message)


class ResponsableEconomicoNoEncontrado(AppException):
    status_code = 404

    def __init__(self, message: str = "El alumno no tiene un responsable económico asignado."):
        super().__init__(message)


class FacturaNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La factura indicada no existe."):
        super().__init__(message)


class InscripcionNoFacturable(AppException):
    status_code = 422

    def __init__(self, message: str = "La inscripción indicada no está activa o no existe."):
        super().__init__(message)


class ResponsableEconomicoNoVigente(AppException):
    status_code = 422

    def __init__(
        self,
        message: str = "El alumno no tiene responsable económico vigente en la fecha de emisión.",
    ):
        super().__init__(message)


class ConceptoCobroInvalido(AppException):
    status_code = 422

    def __init__(
        self, message: str = "Todos los conceptos de cobro deben existir y estar activos."
    ):
        super().__init__(message)


class FacturaNoEditable(AppException):
    status_code = 409

    def __init__(self, message: str = "Solo se pueden modificar facturas pendientes sin pagos."):
        super().__init__(message)


class FacturaEnUso(AppException):
    status_code = 409

    def __init__(
        self,
        message: str = "No se puede eliminar una factura que ya tiene pagos o movimientos.",
    ):
        super().__init__(message)


class FechaVencimientoInvalida(AppException):
    status_code = 422

    def __init__(
        self, message: str = "La fecha de vencimiento no puede ser anterior a la emisión."
    ):
        super().__init__(message)


class MontoFacturaInvalido(AppException):
    status_code = 422

    def __init__(self, message: str = "El total de la factura supera el máximo permitido."):
        super().__init__(message)


class ReglaFacturacionNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La regla de facturación indicada no existe."):
        super().__init__(message)


class ReglaFacturacionIncompatible(AppException):
    status_code = 409

    def __init__(
        self,
        message: str = (
            "Ya existe una regla activa incompatible para ese concepto, población y vigencia."
        ),
    ):
        super().__init__(message)


class ReglaFacturacionInvalida(AppException):
    status_code = 422

    def __init__(self, message: str = "La configuración de la regla de facturación no es válida."):
        super().__init__(message)
