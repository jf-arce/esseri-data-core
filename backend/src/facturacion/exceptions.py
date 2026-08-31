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
