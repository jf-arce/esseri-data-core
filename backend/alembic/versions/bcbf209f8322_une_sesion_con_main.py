"""une sesion con main

Revision ID: bcbf209f8322
Revises: c277ef8df8c5, c4d8a2f61b07
Create Date: 2026-11-19 10:49:36.697083

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "bcbf209f8322"
down_revision: str | Sequence[str] | None = ("c277ef8df8c5", "c4d8a2f61b07")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
