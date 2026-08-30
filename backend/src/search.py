"""Normalización de términos de búsqueda, compartida entre módulos.

Vive en `src/` y no dentro de un módulo porque la usan Inscripciones (búsqueda de alumnos) y
Proveedores y Compras (búsqueda de órdenes por proveedor). Nació en `inscripciones/service.py`
a partir del fix de búsqueda sin tildes (commit 1f8bf3a) y subió acá cuando la necesitó el
segundo módulo, según el criterio de `AGENTS.md`.
"""

import unicodedata

from sqlalchemy import func


def normalizar_texto_busqueda(valor: str) -> str:
    """Quita tildes y unifica mayúsculas para comparar términos de búsqueda."""

    return "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", valor.casefold())
        if unicodedata.category(caracter) != "Mn"
    )


def normalizar_columna_busqueda(columna):
    """Expresión SQL portable para búsquedas sin tildes en SQLite y PostgreSQL.

    No se usa `unaccent` de Postgres a propósito: es una extensión que hay que instalar en la
    base, y los tests corren sobre SQLite en memoria. Un `replace` anidado es más feo pero
    funciona igual en las dos, que es lo que importa para que el test valga.
    """

    resultado = func.lower(columna)
    for origen, destino in (
        ("á", "a"),
        ("é", "e"),
        ("í", "i"),
        ("ó", "o"),
        ("ú", "u"),
        ("ü", "u"),
        ("ñ", "n"),
        ("Á", "a"),
        ("É", "e"),
        ("Í", "i"),
        ("Ó", "o"),
        ("Ú", "u"),
        ("Ü", "u"),
        ("Ñ", "n"),
    ):
        resultado = func.replace(resultado, origen, destino)
    return resultado
