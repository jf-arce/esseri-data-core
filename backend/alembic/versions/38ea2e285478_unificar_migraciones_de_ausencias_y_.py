"""unificar migraciones de ausencias y materias

Revision ID: 38ea2e285478
Revises: 5ff26cba86c4, 9f2c4b7a1e63
Create Date: 2026-11-09 17:25:05.258120

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "38ea2e285478"
down_revision: str | Sequence[str] | None = ("5ff26cba86c4", "9f2c4b7a1e63")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
