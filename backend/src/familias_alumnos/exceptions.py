from src.exceptions import AppException


class FamiliaConVinculos(AppException):
    """La familia tiene alumnos vinculados: borrarla dejaría FAMILIA_ALUMNO apuntando a nada."""

    status_code = 409

    def __init__(self, message: str = "No se puede eliminar: la familia tiene alumnos vinculados"):
        super().__init__(message)
