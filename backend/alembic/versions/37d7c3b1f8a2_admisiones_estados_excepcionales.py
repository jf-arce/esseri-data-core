"""admisiones estados excepcionales

Revision ID: 37d7c3b1f8a2
Revises: 0aa9a6090f5b
Create Date: 2026-08-30 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "37d7c3b1f8a2"
down_revision: str | Sequence[str] | None = "0aa9a6090f5b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Permitir reflejar en el historial una reversión o un desistimiento."""

    op.drop_constraint("ck_etapa_solicitud_estado", "etapa_solicitud", type_="check")
    op.create_check_constraint(
        "ck_etapa_solicitud_estado",
        "etapa_solicitud",
        "estado IN ('en_proceso', 'completada', 'rechazada', 'revertida', 'desistida')",
    )


def downgrade() -> None:
    """Restaurar los estados originales del historial de etapas."""

    op.drop_constraint("ck_etapa_solicitud_estado", "etapa_solicitud", type_="check")
    op.create_check_constraint(
        "ck_etapa_solicitud_estado",
        "etapa_solicitud",
        "estado IN ('en_proceso', 'completada', 'rechazada')",
    )
