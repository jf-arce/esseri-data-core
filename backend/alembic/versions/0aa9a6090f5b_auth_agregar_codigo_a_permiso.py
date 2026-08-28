"""auth agregar codigo a permiso

Revision ID: 0aa9a6090f5b
Revises: 9b8fc5e775c0
Create Date: 2026-08-28 13:09:02.157791

"""
import re
import unicodedata
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '0aa9a6090f5b'
down_revision: Union[str, Sequence[str], None] = '9b8fc5e775c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Copia deliberada de `src.auth.constants.SLUG_POR_MODULO`/`codigo_de`: una migración no debe
# depender del código de la app, que puede evolucionar (o renombrarse) después de que esta
# migración ya haya corrido en algún entorno.
_SLUG_POR_MODULO = {
    "Autenticación": "autenticacion",
    "Familias y Alumnos": "familias_alumnos",
    "Académico": "academico",
    "Inscripciones": "inscripciones",
    "Facturación": "facturacion",
    "Proveedores y Compras": "proveedores_compras",
    "Workflows": "workflows",
    "Auditoría": "auditoria",
    "Panel Administrativo": "panel_administrativo",
    "IA/Sugerencias": "ia_sugerencias",
}


def _slug_de_modulo(modulo: str) -> str:
    conocido = _SLUG_POR_MODULO.get(modulo)
    if conocido is not None:
        return conocido
    sin_acentos = unicodedata.normalize("NFKD", modulo).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "_", sin_acentos.lower()).strip("_")


def _codigo_de(modulo: str, accion: str, tipo_informacion: str | None) -> str:
    base = f"{_slug_de_modulo(modulo)}.{accion}"
    if tipo_informacion is None:
        return base
    return f"{base}:{tipo_informacion}"


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Columna nullable primero: la tabla ya tiene filas en cualquier entorno con el seed
    #    de grupo-b cargado, así que un NOT NULL de una sola pasada rompería la migración.
    op.add_column("permiso", sa.Column("codigo", sa.String(), nullable=True))

    # 2. Backfill: derivar `codigo` para cada fila existente con la misma fórmula que usa
    #    `src.auth.constants.codigo_de` (copiada arriba, ver comentario).
    conn = op.get_bind()
    filas = conn.execute(sa.text("SELECT id, modulo, accion, tipo_informacion FROM permiso"))
    for permiso_id, modulo, accion, tipo_informacion in filas:
        codigo = _codigo_de(modulo, accion, tipo_informacion)
        conn.execute(
            sa.text("UPDATE permiso SET codigo = :codigo WHERE id = :id"),
            {"codigo": codigo, "id": permiso_id},
        )

    # 3. Ahora sí, NOT NULL + UNIQUE: la clave de autorización real pasa a ser este código
    #    ASCII estable, no el par (modulo, accion) con acentos y espacios.
    op.alter_column("permiso", "codigo", nullable=False)
    op.create_unique_constraint("uq_permiso_codigo", "permiso", ["codigo"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_permiso_codigo", "permiso", type_="unique")
    op.drop_column("permiso", "codigo")
