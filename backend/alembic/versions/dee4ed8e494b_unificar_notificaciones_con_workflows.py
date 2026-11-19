"""unificar notificaciones con workflows

Revision ID: dee4ed8e494b
Revises: 652a29fa8e8d, a7c3e19d4b52
Create Date: 2026-11-18 15:24:43.910335

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dee4ed8e494b'
down_revision: Union[str, Sequence[str], None] = ('652a29fa8e8d', 'a7c3e19d4b52')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
