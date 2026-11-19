"""auth agrega tabla sesion

Revision ID: c4d8a2f61b07
Revises: a7c3e19d4b52
Create Date: 2026-11-18 12:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4d8a2f61b07"
down_revision: str | Sequence[str] | None = "a7c3e19d4b52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "sesion",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("familia_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("rol_activo", sa.String(), nullable=True),
        sa.Column("creada_en", sa.DateTime(), nullable=False),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column("expira_absoluta_en", sa.DateTime(), nullable=False),
        sa.Column("revocada_en", sa.DateTime(), nullable=True),
        sa.Column("reemplazada_en", sa.DateTime(), nullable=True),
        sa.Column("ip_origen", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_sesion_familia_id"), "sesion", ["familia_id"], unique=False)
    op.create_index(op.f("ix_sesion_token_hash"), "sesion", ["token_hash"], unique=True)
    op.create_index(op.f("ix_sesion_usuario_id"), "sesion", ["usuario_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_sesion_usuario_id"), table_name="sesion")
    op.drop_index(op.f("ix_sesion_token_hash"), table_name="sesion")
    op.drop_index(op.f("ix_sesion_familia_id"), table_name="sesion")
    op.drop_table("sesion")
