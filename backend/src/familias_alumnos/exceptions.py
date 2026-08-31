from src.exceptions import AppException


class FamiliaConVinculos(AppException):
    """La familia tiene alumnos vinculados: borrarla dejaría FAMILIA_ALUMNO apuntando a nada."""

    status_code = 409

    def __init__(self, message: str = "No se puede eliminar: la familia tiene alumnos vinculados"):
        super().__init__(message)


class AlumnoConVinculos(AppException):
    """El alumno tiene familias vinculadas: borrarlo dejaría FAMILIA_ALUMNO apuntando a nada."""

    status_code = 409

    def __init__(self, message: str = "No se puede eliminar: el alumno tiene familias vinculadas"):
        super().__init__(message)


class VinculoDuplicado(AppException):
    """Ya existe un vínculo entre esa familia y ese alumno."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un vínculo entre esa familia y ese alumno"):
        super().__init__(message)


class VinculoNoEncontrado(AppException):
    """No existe el vínculo familia-alumno solicitado."""

    status_code = 404

    def __init__(self, message: str = "Vínculo familia-alumno no encontrado"):
        super().__init__(message)


class LegajoDuplicado(AppException):
    """Ya existe un alumno con ese número de legajo."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un alumno con ese número de legajo"):
        super().__init__(message)
