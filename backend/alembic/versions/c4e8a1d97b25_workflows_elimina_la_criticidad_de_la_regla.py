"""workflows elimina la criticidad de la regla

Revision ID: c4e8a1d97b25
Revises: 8b0cbab76489
Create Date: 2026-11-16 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c4e8a1d97b25'
down_revision: Union[str, Sequence[str], None] = '8b0cbab76489'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint('ck_workflow_rule_criticidad', 'workflow_rule', type_='check')
    op.drop_column('workflow_rule', 'criticidad')


def downgrade() -> None:
    """Downgrade schema.

    Las reglas existentes vuelven con criticidad 'media': el valor original no se conserva.
    """
    op.add_column(
        'workflow_rule',
        sa.Column('criticidad', sa.String(), nullable=False, server_default='media'),
    )
    op.alter_column('workflow_rule', 'criticidad', server_default=None)
    op.create_check_constraint(
        'ck_workflow_rule_criticidad',
        'workflow_rule',
        "criticidad IN ('baja', 'media', 'alta', 'critica')",
    )
