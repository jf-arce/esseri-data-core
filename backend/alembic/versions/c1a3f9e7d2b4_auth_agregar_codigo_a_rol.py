"""auth agregar codigo a rol

Revision ID: c1a3f9e7d2b4
Revises: 58d7c7ac8e3c
Create Date: 2026-09-13 00:00:00.000000

"""
import re
import unicodedata
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c1a3f9e7d2b4'
down_revision: Union[str, Sequence[str], None] = '58d7c7ac8e3c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Copia deliberada de `src.auth.constants.slug_ascii`: una migración no debe depender del código
# de la app, que puede evolucionar (o renombrarse) después de que esta migración ya haya corrido
# en algún entorno.
def _slug_ascii(texto: str) -> str:
    sin_acentos = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "_", sin_acentos.lower()).strip("_")


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Columna nullable primero: la tabla ya tiene filas en cualquier entorno con el seed de
    #    grupo-a cargado, así que un NOT NULL de una sola pasada rompería la migración.
    op.add_column("rol", sa.Column("codigo", sa.String(), nullable=True))

    # 2. Backfill: derivar `codigo` para cada fila existente con la misma fórmula que usa
    #    `Rol.__init__` (copiada arriba, ver comentario).
    conn = op.get_bind()
    filas = conn.execute(sa.text("SELECT id, nombre FROM rol"))
    for rol_id, nombre in filas:
        codigo = _slug_ascii(nombre)
        conn.execute(
            sa.text("UPDATE rol SET codigo = :codigo WHERE id = :id"),
            {"codigo": codigo, "id": rol_id},
        )

    # 3. Ahora sí, NOT NULL + UNIQUE: la clave de identidad estable pasa a ser este código ASCII,
    #    no el `nombre` editable desde la UI.
    op.alter_column("rol", "codigo", nullable=False)
    op.create_unique_constraint("uq_rol_codigo", "rol", ["codigo"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("uq_rol_codigo", "rol", type_="unique")
    op.drop_column("rol", "codigo")
