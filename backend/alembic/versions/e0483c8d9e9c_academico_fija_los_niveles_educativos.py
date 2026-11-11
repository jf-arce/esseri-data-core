"""academico fija los niveles educativos

Revision ID: e0483c8d9e9c
Revises: 38ea2e285478
Create Date: 2026-11-10

Los niveles son siempre Inicial, Primario y Secundario. Esta migración inserta los que
falten (comparando por nombre normalizado, sin mayúsculas, acentos ni prefijo "nivel").
No renombra ni borra niveles existentes.
"""

import unicodedata
import uuid
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "e0483c8d9e9c"
down_revision: str | Sequence[str] | None = "38ea2e285478"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NIVELES_FIJOS = ("Inicial", "Primario", "Secundario")


def _normalizar(valor: str) -> str:
    sin_acentos = "".join(
        c for c in unicodedata.normalize("NFD", valor) if unicodedata.category(c) != "Mn"
    )
    texto = " ".join(sin_acentos.lower().split())
    return texto.removeprefix("nivel").strip()


def upgrade() -> None:
    conexion = op.get_bind()
    existentes = {
        _normalizar(nombre)
        for (nombre,) in conexion.execute(sa.text("SELECT nombre FROM nivel_educativo"))
    }
    for nombre in NIVELES_FIJOS:
        if _normalizar(nombre) not in existentes:
            conexion.execute(
                sa.text("INSERT INTO nivel_educativo (id, nombre) VALUES (:id, :nombre)"),
                {"id": uuid.uuid4(), "nombre": nombre},
            )


def downgrade() -> None:
    # Datos maestros: no se borran.
    pass
