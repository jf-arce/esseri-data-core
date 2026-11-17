"""asistente agrega estado descartado a los mensajes

Revision ID: a7c3e19d4b52
Revises: 31e5b19b81ff
Create Date: 2026-11-17 15:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c3e19d4b52"
down_revision: str | Sequence[str] | None = "31e5b19b81ff"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

CK_NOMBRE = "ck_mensaje_asistente_estado"
TABLA = "mensaje_asistente"


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(CK_NOMBRE, TABLA, type_="check")
    op.create_check_constraint(
        CK_NOMBRE, TABLA, "estado IN ('completo', 'parcial', 'error', 'descartado')"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Lo descartado al editar una pregunta no existe en el esquema viejo: queda como error, que
    # el historial y el reenvío al modelo ya ignoran.
    op.execute("UPDATE mensaje_asistente SET estado = 'error' WHERE estado = 'descartado'")
    op.drop_constraint(CK_NOMBRE, TABLA, type_="check")
    op.create_check_constraint(CK_NOMBRE, TABLA, "estado IN ('completo', 'parcial', 'error')")
