"""unificar ramas de migraciones de admision y permisos

Revision ID: 525d185f86ec
Revises: 20b905cd940e, c1a3f9e7d2b4
Create Date: 2026-09-14 18:40:38.012158

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '525d185f86ec'
down_revision: Union[str, Sequence[str], None] = ('20b905cd940e', 'c1a3f9e7d2b4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
