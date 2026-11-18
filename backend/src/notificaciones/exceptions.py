"""Excepciones propias de la bandeja interna."""

from src.exceptions import AppException


class NotificacionInvalida(AppException):
    """Tipo, ámbito, destino o contexto fuera del contrato: se deniega por defecto."""

    status_code = 422

    def __init__(self, message: str = "La notificación no tiene un tipo o contexto válido"):
        super().__init__(message)


class NotificacionNoEncontrada(AppException):
    """Inexistente o fuera del alcance autorizado: el contrato no distingue los dos casos."""

    status_code = 404

    def __init__(self, message: str = "Notificación no encontrada"):
        super().__init__(message)
