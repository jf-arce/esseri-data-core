"""preserve published originals and removed drafts

Revision ID: dd3ad6076c35
Revises: b14ac40bb88e
Create Date: 2026-11-21 03:13:42.414041

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "dd3ad6076c35"
down_revision: str | Sequence[str] | None = "b14ac40bb88e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("comunicacion", sa.Column("eliminada_at", sa.DateTime(), nullable=True))
    op.add_column(
        "comunicacion", sa.Column("edicion_portal", sa.JSON(none_as_null=True), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    if op.get_bind().scalar(
        sa.text(
            "SELECT EXISTS (SELECT 1 FROM comunicacion "
            "WHERE eliminada_at IS NOT NULL OR edicion_portal IS NOT NULL)"
        )
    ):
        raise RuntimeError("Cannot downgrade after editing publications or removing drafts")
    op.drop_column("comunicacion", "edicion_portal")
    op.drop_column("comunicacion", "eliminada_at")
