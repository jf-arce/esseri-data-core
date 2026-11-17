"""Textos que ve la persona cuando algo falla o necesita elegir."""

from src.llm_client import (
    IaNoConfigurada,
    IaNoDisponible,
    IaRespuestaInvalida,
)

MENSAJE_AMBIGUEDAD = (
    "Lo que escribiste coincide con más de una persona. Elegí a cuál te referís (tocá la "
    "tarjeta) y volvé a hacer la pregunta."
)
MENSAJE_DEMASIADAS_COINCIDENCIAS = (
    "Lo que escribiste coincide con demasiadas personas. Mencioná a la persona con @ para "
    "elegirla y volvé a hacer la pregunta."
)
MENSAJE_SIN_RESPUESTA = "No pude armar una respuesta. Probá reformular la pregunta."
MENSAJE_ERROR_INESPERADO = "Ocurrió un error al generar la respuesta. Probá de nuevo."


def mensaje_para_usuario(error: Exception) -> str:
    """Texto claro para quien usa el asistente: dice qué pasó y qué hacer, sin códigos ni
    referencias a la tecnología o al proveedor que hay detrás."""
    if isinstance(error, IaNoConfigurada):
        return "El asistente no está disponible por el momento. Avisale a un administrador."
    if isinstance(error, IaRespuestaInvalida):
        return "No pude armar una respuesta. Probá reformular la pregunta."
    if isinstance(error, IaNoDisponible):
        if error.status_proveedor == 429:
            return "Alcanzaste el límite de consultas de IA. Esperá un minuto y volvé a intentar."
        if error.status_proveedor in (401, 403):
            return "El asistente no está disponible por el momento. Avisale a un administrador."
        return "El asistente no está disponible en este momento. Probá de nuevo en unos segundos."
    return MENSAJE_ERROR_INESPERADO
