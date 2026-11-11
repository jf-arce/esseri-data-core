"""debitos automaticos revisiones y reservas

Revision ID: 91553e2163be
Revises: fb836637c05a
Create Date: 2026-11-11 18:14:24.911583

Additive schema for durable response reviews, visible demo metadata and database-enforced
invoice reservations. Existing demo batches keep working through nullable human codes and
the ``exportado`` default; the new import tables never touch real invoice columns.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "91553e2163be"
down_revision: str | Sequence[str] | None = "fb836637c05a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "importacion_cobranza",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lote_id", sa.Uuid(), nullable=False),
        sa.Column("archivo_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "estado",
            sa.String(length=20),
            server_default="en_revision",
            nullable=False,
        ),
        sa.Column("usuario_id", sa.Uuid(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("confirmada_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "estado IN ('en_revision', 'confirmada')", name="ck_importacion_estado"
        ),
        sa.ForeignKeyConstraint(["lote_id"], ["lote_cobranza.id"]),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("lote_id", "archivo_hash", name="uq_importacion_lote_hash"),
    )
    op.create_index(
        "ix_importacion_cobranza_lote", "importacion_cobranza", ["lote_id"], unique=False
    )
    op.create_table(
        "factura_cobranza_demo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("factura_id", sa.Uuid(), nullable=False),
        sa.Column("numero", sa.String(length=40), nullable=False),
        sa.Column("periodo", sa.String(length=7), nullable=False),
        sa.Column("medio", sa.String(length=10), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "medio IN ('cbu', 'tarjeta')", name="ck_factura_cobranza_demo_medio"
        ),
        sa.ForeignKeyConstraint(["factura_id"], ["factura.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("factura_id", name="uq_factura_cobranza_demo_factura"),
        sa.UniqueConstraint("numero", name="uq_factura_cobranza_demo_numero"),
    )
    op.create_table(
        "importacion_cobranza_detalle",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("importacion_id", sa.Uuid(), nullable=False),
        sa.Column("linea", sa.Integer(), nullable=False),
        sa.Column("referencia", sa.String(length=36), nullable=True),
        sa.Column("resultado", sa.String(length=30), nullable=True),
        sa.Column("importe", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column("fecha_procesamiento", sa.Date(), nullable=True),
        sa.Column("codigo", sa.String(length=30), nullable=True),
        sa.Column("descripcion", sa.String(length=250), nullable=True),
        sa.Column("factura_id", sa.Uuid(), nullable=True),
        sa.Column("numero_factura", sa.String(length=40), nullable=True),
        sa.Column("alumno_nombre", sa.String(length=160), nullable=True),
        sa.Column("debito_id", sa.Uuid(), nullable=True),
        sa.Column("resultado_hash", sa.String(length=64), nullable=True),
        sa.Column("estado", sa.String(length=20), nullable=False),
        sa.Column("mensaje", sa.Text(), nullable=False),
        sa.Column("pago_id", sa.Uuid(), nullable=True),
        sa.CheckConstraint(
            "estado IN ('listo', 'aplicado', 'rechazado', 'duplicado', 'error')",
            name="ck_importacion_detalle_estado",
        ),
        sa.ForeignKeyConstraint(["debito_id"], ["debito_cobranza.id"]),
        sa.ForeignKeyConstraint(["factura_id"], ["factura.id"]),
        sa.ForeignKeyConstraint(["importacion_id"], ["importacion_cobranza.id"]),
        sa.ForeignKeyConstraint(["pago_id"], ["pago.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "importacion_id", "linea", name="uq_importacion_detalle_linea"
        ),
    )
    op.create_index(
        "ix_importacion_detalle_estado",
        "importacion_cobranza_detalle",
        ["importacion_id", "estado"],
        unique=False,
    )
    op.add_column(
        "debito_cobranza",
        sa.Column(
            "reserva_activa",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
    )
    op.create_index(
        "uq_debito_reserva_activa_factura",
        "debito_cobranza",
        ["factura_id"],
        unique=True,
        sqlite_where=sa.text("reserva_activa"),
        postgresql_where=sa.text("reserva_activa"),
    )
    # SQLite cannot ALTER constraints in place; batch mode keeps this migration portable.
    with op.batch_alter_table("lote_cobranza") as batch:
        batch.add_column(sa.Column("codigo", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("periodo", sa.String(length=7), nullable=True))
        batch.add_column(
            sa.Column(
                "estado",
                sa.String(length=20),
                server_default="exportado",
                nullable=False,
            )
        )
        batch.add_column(sa.Column("liberado_por_id", sa.Uuid(), nullable=True))
        batch.add_column(
            sa.Column("liberado_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch.add_column(sa.Column("motivo_liberacion", sa.String(length=500), nullable=True))
        batch.create_check_constraint(
            "ck_lote_cobranza_estado",
            "estado IN ('exportado', 'en_revision', 'pagos_registrados', 'liberado')",
        )
        batch.create_unique_constraint("uq_lote_cobranza_codigo", ["codigo"])
        batch.create_foreign_key(
            "fk_lote_cobranza_liberado_por",
            "usuario",
            ["liberado_por_id"],
            ["id"],
        )
    op.create_index(
        "ix_lote_cobranza_periodo_estado",
        "lote_cobranza",
        ["periodo", "estado"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_lote_cobranza_periodo_estado", table_name="lote_cobranza")
    with op.batch_alter_table("lote_cobranza") as batch:
        batch.drop_constraint("fk_lote_cobranza_liberado_por", type_="foreignkey")
        batch.drop_constraint("uq_lote_cobranza_codigo", type_="unique")
        batch.drop_constraint("ck_lote_cobranza_estado", type_="check")
        batch.drop_column("motivo_liberacion")
        batch.drop_column("liberado_at")
        batch.drop_column("liberado_por_id")
        batch.drop_column("estado")
        batch.drop_column("periodo")
        batch.drop_column("codigo")
    op.drop_index(
        "uq_debito_reserva_activa_factura",
        table_name="debito_cobranza",
        sqlite_where=sa.text("reserva_activa"),
        postgresql_where=sa.text("reserva_activa"),
    )
    op.drop_column("debito_cobranza", "reserva_activa")
    op.drop_index(
        "ix_importacion_detalle_estado", table_name="importacion_cobranza_detalle"
    )
    op.drop_table("importacion_cobranza_detalle")
    op.drop_table("factura_cobranza_demo")
    op.drop_index("ix_importacion_cobranza_lote", table_name="importacion_cobranza")
    op.drop_table("importacion_cobranza")
