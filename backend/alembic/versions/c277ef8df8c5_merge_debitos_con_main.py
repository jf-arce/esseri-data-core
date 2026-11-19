"""merge debitos con main

Revision ID: c277ef8df8c5
Revises: 69c46ab7a359, dee4ed8e494b
Create Date: 2026-11-19 02:25:54.576954

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c277ef8df8c5'
down_revision: Union[str, Sequence[str], None] = ('69c46ab7a359', 'dee4ed8e494b')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
