"""extend manual communication types

Revision ID: a7d7c2b03525
Revises: 7b60ea457979
Create Date: 2026-10-30 23:51:46.455934

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7d7c2b03525"
down_revision: str | Sequence[str] | None = "7b60ea457979"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Alembic does not detect changes to existing CHECK expressions automatically.
    op.drop_constraint("ck_comunicacion_tipo", "comunicacion", type_="check")
    op.create_check_constraint(
        "ck_comunicacion_tipo",
        "comunicacion",
        "tipo IN ('institucional', 'curso', 'administrativa', 'otro')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    count = op.get_bind().scalar(
        sa.text("SELECT count(*) FROM comunicacion WHERE tipo IN ('administrativa', 'otro')")
    )
    if count:
        raise RuntimeError("Cannot downgrade while administrative or other communications exist")
    op.drop_constraint("ck_comunicacion_tipo", "comunicacion", type_="check")
    op.create_check_constraint(
        "ck_comunicacion_tipo", "comunicacion", "tipo IN ('institucional', 'curso')"
    )
