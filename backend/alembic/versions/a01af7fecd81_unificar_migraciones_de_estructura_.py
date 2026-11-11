"""unificar migraciones de estructura academica con main

Revision ID: a01af7fecd81
Revises: b6c1908b1308, bbaa88d6e3ea
Create Date: 2026-11-11 19:01:16.603924

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a01af7fecd81'
down_revision: Union[str, Sequence[str], None] = ('b6c1908b1308', 'bbaa88d6e3ea')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
