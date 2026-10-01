"""workflows agrega unicidad a intentos de ejecucion

Revision ID: f912c5af849e
Revises: b36d4578e908
Create Date: 2026-10-01 00:32:12.948291

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f912c5af849e"
down_revision: str | Sequence[str] | None = "b36d4578e908"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint(
        "uq_workflow_execution_regla_evento_intento",
        "workflow_execution",
        ["workflow_rule_id", "event_log_id", "intento"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_workflow_execution_regla_evento_intento",
        "workflow_execution",
        type_="unique",
    )
