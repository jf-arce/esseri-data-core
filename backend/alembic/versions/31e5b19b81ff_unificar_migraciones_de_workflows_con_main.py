"""unificar migraciones de workflows con main

Revision ID: 31e5b19b81ff
Revises: c4e8a1d97b25, c7d2e4a91b30
Create Date: 2026-11-17 00:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31e5b19b81ff'
down_revision: Union[str, Sequence[str], None] = ('c4e8a1d97b25', 'c7d2e4a91b30')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
