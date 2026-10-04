"""Errores de negocio del módulo de Workflows y Notificaciones."""

from src.exceptions import AppException


class TipoEventoNoRegistrado(AppException):
    """Un módulo emitió un evento cuyo tipo no está en el catálogo `tipo_evento`."""

    status_code = 500

    def __init__(self, nombre: str):
        super().__init__(f"El tipo de evento '{nombre}' no está registrado en el catálogo.")


class EntidadDeEventoInvalida(AppException):
    """Un evento informó una entidad distinta de la que corresponde a su tipo."""

    status_code = 500

    def __init__(self, tipo: str, entidad: str, esperada: str):
        super().__init__(
            f"El evento '{tipo}' se emitió con la entidad '{entidad}'; corresponde '{esperada}'."
        )


class TipoEventoNoEncontrado(AppException):
    status_code = 404

    def __init__(self, message: str = "El tipo de evento indicado no existe."):
        super().__init__(message)


class PlantillaNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La plantilla de notificación indicada no existe."):
        super().__init__(message)


class PlantillaDuplicada(AppException):
    status_code = 409

    def __init__(self, message: str = "Ya existe una plantilla con ese nombre."):
        super().__init__(message)


class PlantillaEnUso(AppException):
    status_code = 409

    def __init__(self, message: str = "La plantilla está en uso y no se puede eliminar."):
        super().__init__(message)


class PlantillaInvalida(AppException):
    status_code = 422

    def __init__(self, message: str):
        super().__init__(message)


class DestinatariosInvalidos(AppException):
    status_code = 422

    def __init__(self, message: str):
        super().__init__(message)


class DestinatariosEnConflicto(AppException):
    status_code = 409

    def __init__(
        self,
        message: str = "Los destinatarios fueron modificados por otra operación.",
    ):
        super().__init__(message)


class DestinatarioNoEncontrado(AppException):
    status_code = 404

    def __init__(self, message: str):
        super().__init__(message)


class ReglaNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La regla de workflow indicada no existe."):
        super().__init__(message)


class EjecucionNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La ejecución de workflow indicada no existe."):
        super().__init__(message)


class NotificacionNoEncontrada(AppException):
    status_code = 404

    def __init__(self, message: str = "La notificación indicada no existe."):
        super().__init__(message)


class EjecucionNoReintentable(AppException):
    status_code = 409

    def __init__(self, message: str):
        super().__init__(message)


class N8nNoConfigurado(AppException):
    status_code = 503

    def __init__(self, message: str = "La integración con n8n no está configurada."):
        super().__init__(message)


class N8nEnvioFallido(AppException):
    status_code = 502

    def __init__(self, message: str = "n8n no pudo procesar el envío."):
        super().__init__(message)


class N8nNoDisponible(N8nEnvioFallido):
    """No hubo respuesta de n8n (conexión o timeout), a diferencia de un 4xx/5xx."""

    def __init__(self, message: str = "No se pudo contactar a n8n."):
        super().__init__(message)


class AccionConfigInvalida(AppException):
    status_code = 422

    def __init__(self, message: str):
        super().__init__(message)


class CondicionInvalida(AppException):
    status_code = 422

    def __init__(self, message: str):
        super().__init__(message)
