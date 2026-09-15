"""agregar archivo a justificacion de inasistencia

Revision ID: d4e7c2a1b809
Revises: 525d185f86ec
Create Date: 2026-09-15 13:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "d4e7c2a1b809"
down_revision: str | Sequence[str] | None = "525d185f86ec"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "archivo_justificacion_inasistencia",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("tipo_contenido", sa.String(), nullable=False),
        sa.Column("tamanio", sa.Integer(), nullable=False),
        sa.Column("contenido", sa.LargeBinary(), nullable=False),
        sa.Column("justificacion_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(["justificacion_id"], ["justificacion_inasistencia.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("justificacion_id"),
    )


def downgrade() -> None:
    op.drop_table("archivo_justificacion_inasistencia")
