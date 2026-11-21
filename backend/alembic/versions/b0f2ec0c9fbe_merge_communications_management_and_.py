"""merge communications management and conversations migrations

Revision ID: b0f2ec0c9fbe
Revises: 2b00dcea780a, dd3ad6076c35
Create Date: 2026-11-21 16:45:19.095532

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b0f2ec0c9fbe'
down_revision: Union[str, Sequence[str], None] = ('2b00dcea780a', 'dd3ad6076c35')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
