"""asistente: agrega docente a los tipos de alias

Revision ID: 3ed8f33af510
Revises: 753115d13560
Create Date: 2026-11-13 13:10:25.409080

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ed8f33af510'
down_revision: Union[str, Sequence[str], None] = '753115d13560'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Autogenerate no detecta cambios en un CHECK: se reemplaza a mano.
    op.drop_constraint("ck_alias_conversacion_tipo", "alias_conversacion", type_="check")
    op.create_check_constraint(
        "ck_alias_conversacion_tipo",
        "alias_conversacion",
        "tipo IN ('ALUMNO', 'FAMILIA', 'DOCENTE')",
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Los alias de docentes no caben en la restricción anterior: se descartan antes.
    op.execute("DELETE FROM alias_conversacion WHERE tipo = 'DOCENTE'")
    op.drop_constraint("ck_alias_conversacion_tipo", "alias_conversacion", type_="check")
    op.create_check_constraint(
        "ck_alias_conversacion_tipo",
        "alias_conversacion",
        "tipo IN ('ALUMNO', 'FAMILIA')",
    )
