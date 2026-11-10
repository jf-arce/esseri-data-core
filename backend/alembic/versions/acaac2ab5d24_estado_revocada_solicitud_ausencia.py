"""estado revocada solicitud ausencia

Revision ID: acaac2ab5d24
Revises: 2a9e3ab3d20f
Create Date: 2026-11-10 02:24:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "acaac2ab5d24"
down_revision: str | Sequence[str] | None = "2a9e3ab3d20f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("solicitud_ausencia_periodo") as batch:
        batch.drop_constraint("ck_solicitud_ausencia_estado", type_="check")
        batch.create_check_constraint(
            "ck_solicitud_ausencia_estado",
            "estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada', 'revocada')",
        )


def downgrade() -> None:
    """Downgrade schema."""
    revocadas = (
        op.get_bind()
        .execute(
            sa.text("select count(*) from solicitud_ausencia_periodo where estado = 'revocada'")
        )
        .scalar_one()
    )
    if revocadas:
        raise RuntimeError(
            "No se puede revertir: existen solicitudes revocadas que el estado anterior no admite"
        )
    with op.batch_alter_table("solicitud_ausencia_periodo") as batch:
        batch.drop_constraint("ck_solicitud_ausencia_estado", type_="check")
        batch.create_check_constraint(
            "ck_solicitud_ausencia_estado",
            "estado IN ('pendiente', 'aprobada', 'rechazada', 'cancelada')",
        )
