"""merge debitos con main

Revision ID: 69c46ab7a359
Revises: 31e5b19b81ff, 91553e2163be
Create Date: 2026-11-17 18:05:52.805978

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "69c46ab7a359"
down_revision: str | Sequence[str] | None = ("31e5b19b81ff", "91553e2163be")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
