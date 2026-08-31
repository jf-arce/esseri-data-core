from src.exceptions import AppException


class NivelEducativoConAnios(AppException):
    """El nivel educativo tiene años asociados: borrarlo dejaría ANIO apuntando a nada."""

    status_code = 409

    def __init__(self, message: str = "No se puede eliminar: el nivel educativo tiene años asociados"):
        super().__init__(message)


class AnioConDivisiones(AppException):
    """El año tiene divisiones asociadas: borrarlo dejaría DIVISION apuntando a nada."""

    status_code = 409

    def __init__(self, message: str = "No se puede eliminar: el año tiene divisiones asociadas"):
        super().__init__(message)


class DivisionConAsignaciones(AppException):
    """La división tiene asignaciones docentes: borrarla dejaría referencias colgando."""

    status_code = 409

    def __init__(
        self, message: str = "No se puede eliminar: la división tiene asignaciones docentes"
    ):
        super().__init__(message)


class NombreNivelDuplicado(AppException):
    """Ya existe un nivel educativo con ese nombre."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un nivel educativo con ese nombre"):
        super().__init__(message)


class AnioDuplicado(AppException):
    """Ya existe un año con ese número para ese nivel educativo."""

    status_code = 409

    def __init__(self, message: str = "Ya existe un año con ese número para ese nivel educativo"):
        super().__init__(message)


class DivisionDuplicada(AppException):
    """Ya existe una división con ese nombre para ese año."""

    status_code = 409

    def __init__(self, message: str = "Ya existe una división con ese nombre para ese año"):
        super().__init__(message)
