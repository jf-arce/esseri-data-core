"""Registro de herramientas del Asistente.

El modelo solo ve las herramientas que el rol activo puede usar, y cada ejecución vuelve a
validar los permisos: lo que el modelo "recuerda" de pasos anteriores no autoriza nada.
"""

import logging
from typing import Any

from pydantic import ValidationError

from src.asistente import (
    herramientas_academico,
    herramientas_finanzas,
    herramientas_indicadores,
    herramientas_navegacion,
    herramientas_workflows,
)
from src.asistente.exceptions import AliasInvalido
from src.asistente.herramientas_base import ContextoHerramienta, Herramienta, ResultadoHerramienta

logger = logging.getLogger(__name__)

REGISTRO: dict[str, Herramienta] = {
    herramienta.nombre: herramienta
    for modulo in (
        herramientas_indicadores,
        herramientas_finanzas,
        herramientas_academico,
        herramientas_workflows,
        herramientas_navegacion,
    )
    for herramienta in modulo.HERRAMIENTAS
}


def disponibles(contexto: ContextoHerramienta) -> list[Herramienta]:
    return [h for h in REGISTRO.values() if h.disponible_para(contexto)]


def definiciones(contexto: ContextoHerramienta) -> list[dict[str, Any]]:
    return [h.definicion() for h in disponibles(contexto)]


def _error(mensaje: str) -> ResultadoHerramienta:
    return ResultadoHerramienta(para_llm={"error": mensaje})


def ejecutar(
    contexto: ContextoHerramienta,
    nombre: str,
    argumentos: dict[str, Any],
    *,
    argumentos_validos: bool = True,
) -> ResultadoHerramienta:
    """Ejecuta una herramienta; nunca levanta: el modelo recibe el error y puede corregirse."""
    herramienta = REGISTRO.get(nombre)
    if herramienta is None:
        return _error("Esa herramienta no existe.")
    if not herramienta.disponible_para(contexto):
        return _error("El rol activo no tiene permiso para usar esa herramienta.")
    if not argumentos_validos:
        return _error("Los argumentos no son un JSON válido.")
    try:
        parametros = herramienta.parametros.model_validate(argumentos)
    except ValidationError as error:
        # Solo los nombres de campo: el detalle puede repetir valores enviados por el modelo.
        campos = ", ".join(
            sorted({".".join(str(parte) for parte in e["loc"]) for e in error.errors()})
        )
        return _error(f"Argumentos inválidos: {campos}.")

    try:
        with contexto.db.begin_nested():
            return herramienta.ejecutar(contexto, parametros)
    except AliasInvalido as error:
        return _error(error.message)
    except Exception as error:
        logger.error("Falló la herramienta %s (tipo=%s)", nombre, type(error).__name__)
        return _error("La herramienta no pudo completarse.")
