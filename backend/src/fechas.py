"""Instantes en UTC, compartidos entre módulos.

Vive en `src/` porque lo usan Auth, Workflows y Facturación. Las columnas `DateTime` sin zona
guardan UTC (la sesión de Postgres está fijada en UTC, ver `database.py`); los esquemas le agregan
la zona al salir para que la API devuelva siempre `...Z`.
"""

from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator


def a_utc(valor: datetime) -> datetime:
    """Sin zona se toma como UTC; con zona se convierte a UTC."""

    if valor.tzinfo is None:
        return valor.replace(tzinfo=UTC)
    return valor.astimezone(UTC)


def ahora_utc() -> datetime:
    """Ahora en UTC sin zona, para escribir en columnas `DateTime` sin zona."""

    return datetime.now(UTC).replace(tzinfo=None)


InstanteUtc = Annotated[datetime, AfterValidator(a_utc)]
