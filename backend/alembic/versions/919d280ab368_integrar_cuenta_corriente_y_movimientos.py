"""Integrar cuenta corriente y movimientos.

Revision ID: 919d280ab368
Revises: f3258843c61f
Create Date: 2026-09-07 16:57:06.105671

"""

import uuid
from collections.abc import Sequence
from datetime import UTC, date, datetime, time
from zoneinfo import ZoneInfo

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "919d280ab368"
down_revision: str | Sequence[str] | None = "f3258843c61f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ZONA_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")


def _instante_fecha(fecha: date | datetime) -> datetime:
    if isinstance(fecha, datetime):
        return fecha if fecha.tzinfo is not None else fecha.replace(tzinfo=UTC)
    return datetime.combine(fecha, time.min, tzinfo=ZONA_ARGENTINA).astimezone(UTC)


def _backfill_cuenta_corriente() -> None:
    """Reconstruye el libro inicial desde facturas y pagos aprobados ya existentes."""

    bind = op.get_bind()
    alumnos = bind.execute(
        sa.text(
            """
            SELECT DISTINCT i.alumno_id
            FROM factura f
            JOIN inscripcion i ON i.id = f.inscripcion_id
            """
        )
    ).scalars()
    cuentas = dict(bind.execute(sa.text("SELECT alumno_id, id FROM cuenta_corriente")).all())
    for alumno_id in alumnos:
        if alumno_id not in cuentas:
            cuenta_id = uuid.uuid4()
            bind.execute(
                sa.text("INSERT INTO cuenta_corriente (id, alumno_id) VALUES (:id, :alumno_id)"),
                {"id": cuenta_id, "alumno_id": alumno_id},
            )
            cuentas[alumno_id] = cuenta_id

    detalles = bind.execute(
        sa.text(
            """
            SELECT df.id AS detalle_id, df.descripcion, df.monto,
                   df.concepto_cobro_id, f.id AS factura_id,
                   f.fecha_emision, i.alumno_id
            FROM detalle_factura df
            JOIN factura f ON f.id = df.factura_id
            JOIN inscripcion i ON i.id = f.inscripcion_id
            """
        )
    ).mappings()
    for detalle in detalles:
        bind.execute(
            sa.text(
                """
                INSERT INTO movimiento (
                    id, fecha, tipo, monto, observacion, cuenta_corriente_id,
                    concepto_cobro_id, factura_id, detalle_factura_id
                ) VALUES (
                    :id, :fecha, 'debe', :monto, :observacion, :cuenta_id,
                    :concepto_id, :factura_id, :detalle_id
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "fecha": _instante_fecha(detalle["fecha_emision"]),
                "monto": detalle["monto"],
                "observacion": detalle["descripcion"],
                "cuenta_id": cuentas[detalle["alumno_id"]],
                "concepto_id": detalle["concepto_cobro_id"],
                "factura_id": detalle["factura_id"],
                "detalle_id": detalle["detalle_id"],
            },
        )

    pagos = bind.execute(
        sa.text(
            """
            SELECT p.id AS pago_id, p.fecha, p.fecha_operacion, p.monto,
                   p.factura_id, i.alumno_id
            FROM pago p
            JOIN factura f ON f.id = p.factura_id
            JOIN inscripcion i ON i.id = f.inscripcion_id
            WHERE p.estado = 'aprobado'
            """
        )
    ).mappings()
    for pago in pagos:
        bind.execute(
            sa.text(
                """
                INSERT INTO movimiento (
                    id, fecha, tipo, monto, observacion, cuenta_corriente_id,
                    factura_id, pago_id
                ) VALUES (
                    :id, :fecha, 'haber', :monto, 'Pago aprobado', :cuenta_id,
                    :factura_id, :pago_id
                )
                """
            ),
            {
                "id": uuid.uuid4(),
                "fecha": _instante_fecha(pago["fecha_operacion"] or pago["fecha"]),
                "monto": pago["monto"],
                "cuenta_id": cuentas[pago["alumno_id"]],
                "factura_id": pago["factura_id"],
                "pago_id": pago["pago_id"],
            },
        )


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("movimiento", sa.Column("detalle_factura_id", sa.Uuid(), nullable=True))
    op.alter_column("movimiento", "concepto_cobro_id", existing_type=sa.UUID(), nullable=True)
    op.create_foreign_key(
        "fk_movimiento_detalle_factura",
        "movimiento",
        "detalle_factura",
        ["detalle_factura_id"],
        ["id"],
    )
    _backfill_cuenta_corriente()
    op.create_index(
        "uq_movimiento_detalle_factura",
        "movimiento",
        ["detalle_factura_id"],
        unique=True,
        postgresql_where=sa.text("detalle_factura_id IS NOT NULL"),
    )
    op.create_index(
        "uq_movimiento_pago",
        "movimiento",
        ["pago_id"],
        unique=True,
        postgresql_where=sa.text("pago_id IS NOT NULL"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("uq_movimiento_pago", table_name="movimiento")
    op.drop_index("uq_movimiento_detalle_factura", table_name="movimiento")
    op.execute(
        sa.text(
            "DELETE FROM movimiento WHERE detalle_factura_id IS NOT NULL "
            "OR (pago_id IS NOT NULL AND concepto_cobro_id IS NULL)"
        )
    )
    op.drop_constraint("fk_movimiento_detalle_factura", "movimiento", type_="foreignkey")
    op.alter_column("movimiento", "concepto_cobro_id", existing_type=sa.UUID(), nullable=False)
    op.drop_column("movimiento", "detalle_factura_id")
