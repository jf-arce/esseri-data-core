"""facturacion agrega anulacion a excepcion_vencimiento

Revision ID: 816bb6cab47b
Revises: 6f4f9fd8caa4
Create Date: 2026-10-22 19:42:59.716654

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "816bb6cab47b"
down_revision: Union[str, Sequence[str], None] = "6f4f9fd8caa4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FK_USUARIO_ANULACION = "excepcion_vencimiento_usuario_anulacion_id_fkey"


def upgrade() -> None:
    """Las prórrogas existentes quedan vigentes (`anulada_at` nulo)."""
    op.add_column(
        "excepcion_vencimiento", sa.Column("anulada_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "excepcion_vencimiento", sa.Column("usuario_anulacion_id", sa.Uuid(), nullable=True)
    )
    op.create_foreign_key(
        FK_USUARIO_ANULACION, "excepcion_vencimiento", "usuario", ["usuario_anulacion_id"], ["id"]
    )


def downgrade() -> None:
    op.drop_constraint(FK_USUARIO_ANULACION, "excepcion_vencimiento", type_="foreignkey")
    op.drop_column("excepcion_vencimiento", "usuario_anulacion_id")
    op.drop_column("excepcion_vencimiento", "anulada_at")
