from src.exceptions import AppException


class SugerenciaYaRevisada(AppException):
    """La sugerencia ya fue aprobada o rechazada: la revisión es una sola decisión.

    Si se pudiera volver a decidir, `fecha_revision` y el revisor se pisarían y se perdería
    quién tomó la decisión original.
    """

    status_code = 409

    def __init__(self, message: str = "La sugerencia ya fue revisada y no se puede modificar."):
        super().__init__(message)


class SugerenciaIlegible(AppException):
    """Una sugerencia de comunicación cuyo contenido no es el borrador que guarda este módulo."""

    status_code = 409

    def __init__(
        self,
        message: str = "El contenido de la sugerencia no es un borrador de comunicación válido.",
    ):
        super().__init__(message)
