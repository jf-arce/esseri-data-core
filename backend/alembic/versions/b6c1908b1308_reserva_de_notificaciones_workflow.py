"""reserva de notificaciones workflow

Revision ID: b6c1908b1308
Revises: acaac2ab5d24
Create Date: 2026-11-10 20:50:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b6c1908b1308"
down_revision: str | Sequence[str] | None = "acaac2ab5d24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("notificacion", sa.Column("lease_until", sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("notificacion", "lease_until")
