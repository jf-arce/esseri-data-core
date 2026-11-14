from src.exceptions import AppException


class AsistenteDeshabilitado(AppException):
    status_code = 503

    def __init__(self, message: str = "El asistente está deshabilitado."):
        super().__init__(message)


class ConversacionNoEncontrada(AppException):
    """No existe, o es de otra cuenta u otro rol: no se distingue para no filtrar su existencia."""

    status_code = 404

    def __init__(self, message: str = "Conversación no encontrada."):
        super().__init__(message)


class ConversacionOcupada(AppException):
    status_code = 409

    def __init__(self, message: str = "La conversación ya está generando una respuesta."):
        super().__init__(message)


class CuotaDiariaAgotada(AppException):
    status_code = 429

    def __init__(self, message: str = "Se alcanzó el máximo de mensajes diarios del asistente."):
        super().__init__(message)


class MensajeInvalido(AppException):
    status_code = 422

    def __init__(self, message: str = "El mensaje no es válido."):
        super().__init__(message)


class AliasInvalido(AppException):
    """Alias que no fue emitido en esta conversación."""

    status_code = 422

    def __init__(self, message: str = "El alias no pertenece a esta conversación."):
        super().__init__(message)
