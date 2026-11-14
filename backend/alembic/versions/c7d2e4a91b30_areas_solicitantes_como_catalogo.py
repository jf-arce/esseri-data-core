"""proveedores y compras: áreas solicitantes como catálogo

Revision ID: c7d2e4a91b30
Revises: a01af7fecd81
Create Date: 2026-11-13

`solicitud_compra.area_solicitante` deja de ser texto libre y pasa a ser una FK al
catálogo nuevo `area_solicitante`:

1. Crea el catálogo.
2. Agrega `area_solicitante_id` (nullable: el historial que no matchee ninguna área queda
   sin área hasta que alguien lo edite).
3. Da de alta un área por cada texto distinto ya cargado y repunta las filas.
4. Elimina la columna de texto.

La lista inicial de áreas vive en el seed (`database/seeds/03_seed_grupo_b.py`), que es
idempotente. Acá solo se crean las que ya estaban en uso para no perder el dato.
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c7d2e4a91b30"
down_revision: Union[str, Sequence[str], None] = "a01af7fecd81"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    op.create_table(
        "area_solicitante",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_area_solicitante_nombre"),
    )

    op.add_column("solicitud_compra", sa.Column("area_solicitante_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_solicitud_compra_area_solicitante",
        "solicitud_compra",
        "area_solicitante",
        ["area_solicitante_id"],
        ["id"],
    )

    # Un área por cada valor de texto ya cargado, para que el backfill no pierda ninguno.
    nombres = bind.execute(
        sa.text(
            "SELECT DISTINCT btrim(area_solicitante) FROM solicitud_compra "
            "WHERE area_solicitante IS NOT NULL AND btrim(area_solicitante) <> ''"
        )
    ).scalars().all()
    for nombre in nombres:
        bind.execute(
            sa.text(
                "INSERT INTO area_solicitante (id, nombre, activo, created_at, updated_at) "
                "VALUES (:id, :nombre, true, now(), now())"
            ),
            {"id": uuid.uuid4(), "nombre": nombre},
        )

    bind.execute(
        sa.text(
            "UPDATE solicitud_compra s SET area_solicitante_id = a.id "
            "FROM area_solicitante a WHERE a.nombre = btrim(s.area_solicitante)"
        )
    )

    op.drop_column("solicitud_compra", "area_solicitante")


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    op.add_column("solicitud_compra", sa.Column("area_solicitante", sa.String(), nullable=True))
    bind.execute(
        sa.text(
            "UPDATE solicitud_compra s SET area_solicitante = a.nombre "
            "FROM area_solicitante a WHERE a.id = s.area_solicitante_id"
        )
    )

    op.drop_constraint(
        "fk_solicitud_compra_area_solicitante", "solicitud_compra", type_="foreignkey"
    )
    op.drop_column("solicitud_compra", "area_solicitante_id")
    op.drop_table("area_solicitante")
