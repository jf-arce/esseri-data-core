"""notificaciones internas académicas

Revision ID: 652a29fa8e8d
Revises: c7d2e4a91b30
Create Date: 2026-11-17

Crea la bandeja interna de la primera entrega. La tabla es genérica y aditiva: no toca el log
de intentos de email de Workflows (`NOTIFICACION`) ni los recibos de lectura de Comunicaciones.
La identidad lógica `(usuario_id, ambito, clave_hecho)` impide duplicar el mismo hecho para una
cuenta; `familia_id`/`alumno_id` congelan el contexto académico y `leida_at` guarda la primera
lectura. No hay backfill: las notificaciones solo se generan desde las transiciones nuevas.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "652a29fa8e8d"
down_revision: str | Sequence[str] | None = "c7d2e4a91b30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "notificacion_interna",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("familia_id", sa.Uuid(), nullable=True),
        sa.Column("alumno_id", sa.Uuid(), nullable=True),
        sa.Column("ambito", sa.String(), nullable=False),
        sa.Column("clave_hecho", sa.String(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("titulo", sa.String(), nullable=False),
        sa.Column("mensaje", sa.String(), nullable=False),
        sa.Column(
            "contexto",
            sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql"),
            nullable=False,
        ),
        sa.Column("destino_tipo", sa.String(), nullable=False),
        sa.Column("destino_id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("leida_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["alumno_id"],
            ["alumno.id"],
        ),
        sa.ForeignKeyConstraint(
            ["familia_id"],
            ["familia.id"],
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"],
            ["usuario.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "usuario_id",
            "ambito",
            "clave_hecho",
            name="uq_notificacion_interna_usuario_ambito_clave",
        ),
    )
    op.create_index(
        "ix_notificacion_interna_usuario_created_at",
        "notificacion_interna",
        ["usuario_id", "created_at", "id"],
        unique=False,
    )
    op.create_index(
        "ix_notificacion_interna_usuario_leida_at",
        "notificacion_interna",
        ["usuario_id", "leida_at"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_notificacion_interna_usuario_leida_at", table_name="notificacion_interna")
    op.drop_index("ix_notificacion_interna_usuario_created_at", table_name="notificacion_interna")
    op.drop_table("notificacion_interna")
