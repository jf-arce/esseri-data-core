"""workflows unique nombre en tipo_evento

Revision ID: b36d4578e908
Revises: 651cff5fc63a
Create Date: 2026-09-30 20:43:03.282259

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b36d4578e908'
down_revision: Union[str, Sequence[str], None] = '651cff5fc63a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # `emit_event()` resuelve el TipoEvento por nombre: sin UNIQUE, un duplicado haría ambigua
    # la búsqueda.
    op.create_unique_constraint('uq_tipo_evento_nombre', 'tipo_evento', ['nombre'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_tipo_evento_nombre', 'tipo_evento', type_='unique')
