"""academico agrega color a materia

Revision ID: bbaa88d6e3ea
Revises: e0483c8d9e9c
Create Date: 2026-11-10

Cada materia del catálogo tiene un color (#rrggbb) para identificarla en el horario. Las
materias existentes reciben uno de la lista sugerida, repartidos por orden de nombre.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "bbaa88d6e3ea"
down_revision: str | Sequence[str] | None = "e0483c8d9e9c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

COLORES = [
    "#2563eb",
    "#0d9488",
    "#16a34a",
    "#ca8a04",
    "#ea580c",
    "#9333ea",
    "#db2777",
    "#0891b2",
    "#4f46e5",
    "#65a30d",
    "#7c3aed",
    "#0284c7",
]


def upgrade() -> None:
    op.add_column("materia", sa.Column("color", sa.String(length=7), nullable=True))
    conexion = op.get_bind()
    ids = conexion.execute(sa.text("SELECT id FROM materia ORDER BY nombre")).scalars().all()
    for indice, materia_id in enumerate(ids):
        conexion.execute(
            sa.text("UPDATE materia SET color = :color WHERE id = :id"),
            {"color": COLORES[indice % len(COLORES)], "id": materia_id},
        )
    op.alter_column("materia", "color", nullable=False)


def downgrade() -> None:
    op.drop_column("materia", "color")
