"""workflows agrega estado rechazado a ejecuciones

Revision ID: 6f4f9fd8caa4
Revises: bcfb712e3a60
Create Date: 2026-10-16 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6f4f9fd8caa4"
down_revision: str | Sequence[str] | None = "bcfb712e3a60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CK_NOMBRE = "ck_workflow_execution_estado"
TABLA = "workflow_execution"


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(CK_NOMBRE, TABLA, type_="check")
    op.create_check_constraint(
        CK_NOMBRE, TABLA, "estado IN ('exitoso', 'fallido', 'pendiente', 'rechazado')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # El rechazo queda en AUDIT_LOG y en `detalle`; el estado viejo más cercano es fallido.
    op.execute("UPDATE workflow_execution SET estado = 'fallido' WHERE estado = 'rechazado'")
    op.drop_constraint(CK_NOMBRE, TABLA, type_="check")
    op.create_check_constraint(CK_NOMBRE, TABLA, "estado IN ('exitoso', 'fallido', 'pendiente')")
