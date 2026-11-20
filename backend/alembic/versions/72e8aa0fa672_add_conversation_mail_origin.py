"""route contextual conversation mail through existing transport

Revision ID: 72e8aa0fa672
Revises: 22ef0bbf4f3c
Create Date: 2026-11-20 02:01:29.873014

"""

import sqlalchemy as sa

from alembic import op

revision = "72e8aa0fa672"
down_revision = "22ef0bbf4f3c"
branch_labels = None
depends_on = None

TABLA = "envio_notificacion"


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(TABLA, sa.Column("mensaje_conversacion_id", sa.Uuid(), nullable=True))
    op.alter_column(TABLA, "comunicacion_id", existing_type=sa.UUID(), nullable=True)
    op.create_unique_constraint(
        "uq_envio_mensaje_destino", TABLA, ["mensaje_conversacion_id", "familia_id", "email"]
    )
    op.create_foreign_key(
        "fk_envio_mensaje_conversacion",
        TABLA,
        "mensaje_conversacion",
        ["mensaje_conversacion_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_envio_origen_exclusivo",
        TABLA,
        "(comunicacion_id IS NULL) <> (mensaje_conversacion_id IS NULL)",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL refuses this transaction once conversation delivery history exists.
    # Do not discard or repurpose that history to pretend it came from a publication.
    op.alter_column(TABLA, "comunicacion_id", existing_type=sa.UUID(), nullable=False)
    op.drop_constraint("ck_envio_origen_exclusivo", TABLA, type_="check")
    op.drop_constraint("fk_envio_mensaje_conversacion", TABLA, type_="foreignkey")
    op.drop_constraint("uq_envio_mensaje_destino", TABLA, type_="unique")
    op.drop_column(TABLA, "mensaje_conversacion_id")
