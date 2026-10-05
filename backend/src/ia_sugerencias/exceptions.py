from src.exceptions import AppException


class SugerenciaYaRevisada(AppException):
    """La sugerencia ya fue aprobada o rechazada: la revisión es una sola decisión.

    Si se pudiera volver a decidir, `fecha_revision` y el revisor se pisarían y se perdería
    quién tomó la decisión original.
    """

    status_code = 409

    def __init__(self, message: str = "La sugerencia ya fue revisada y no se puede modificar."):
        super().__init__(message)


class IaNoConfigurada(AppException):
    """Falta `OPENAI_API_KEY`: no se puede redactar nada."""

    status_code = 503

    def __init__(self, message: str = "La integración con el proveedor de IA no está configurada."):
        super().__init__(message)


class IaNoDisponible(AppException):
    """El proveedor no respondió (conexión o timeout) o respondió con un error."""

    status_code = 502

    def __init__(self, message: str = "No se pudo contactar al proveedor de IA."):
        super().__init__(message)


class IaRespuestaInvalida(AppException):
    """El proveedor respondió, pero el borrador no se puede usar.

    No tiene la forma pedida, se pasa de los límites de una plantilla o usa marcadores que el
    evento no tiene. Se rechaza en vez de guardarlo: una plantilla con un marcador inexistente
    fallaría recién al enviarse.
    """

    status_code = 502

    def __init__(
        self,
        message: str = "El proveedor de IA devolvió un borrador inutilizable. Probá de nuevo.",
    ):
        super().__init__(message)


class SugerenciaIlegible(AppException):
    """Una sugerencia de comunicación cuyo contenido no es el borrador que guarda este módulo."""

    status_code = 409

    def __init__(
        self,
        message: str = "El contenido de la sugerencia no es un borrador de comunicación válido.",
    ):
        super().__init__(message)
