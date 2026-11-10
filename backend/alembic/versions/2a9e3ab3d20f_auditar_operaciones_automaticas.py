"""auditar operaciones automaticas

Revision ID: 2a9e3ab3d20f
Revises: 38ea2e285478
Create Date: 2026-11-10 02:23:06.847053

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2a9e3ab3d20f"
down_revision: str | Sequence[str] | None = "38ea2e285478"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table("audit_log") as batch:
        batch.alter_column("usuario_id", existing_type=sa.Uuid(), nullable=True)
        batch.add_column(
            sa.Column("actor_tipo", sa.String(), nullable=False, server_default="usuario")
        )
        batch.add_column(sa.Column("origen", sa.String(), nullable=True))
        batch.add_column(sa.Column("motivo", sa.String(), nullable=True))
        batch.add_column(sa.Column("referencia_entidad", sa.String(), nullable=True))
        batch.add_column(sa.Column("referencia_id", sa.Uuid(), nullable=True))
    op.execute(
        "ALTER TABLE audit_log ADD CONSTRAINT ck_audit_log_actor_tipo "
        "CHECK (actor_tipo IN ('usuario', 'sistema')) NOT VALID"
    )
    op.execute("ALTER TABLE audit_log VALIDATE CONSTRAINT ck_audit_log_actor_tipo")


def downgrade() -> None:
    """Downgrade schema."""
    pendientes = (
        op.get_bind()
        .execute(sa.text("select count(*) from audit_log where usuario_id is null"))
        .scalar_one()
    )
    if pendientes:
        raise RuntimeError("No se puede revertir: existen auditorías de sistema sin usuario")
    with op.batch_alter_table("audit_log") as batch:
        batch.drop_constraint("ck_audit_log_actor_tipo", type_="check")
        batch.drop_column("referencia_id")
        batch.drop_column("referencia_entidad")
        batch.drop_column("motivo")
        batch.drop_column("origen")
        batch.drop_column("actor_tipo")
        batch.alter_column("usuario_id", existing_type=sa.Uuid(), nullable=False)
