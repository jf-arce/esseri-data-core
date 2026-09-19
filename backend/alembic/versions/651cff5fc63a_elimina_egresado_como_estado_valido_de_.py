"""elimina egresado como estado valido de alumno

Revision ID: 651cff5fc63a
Revises: d4e7c2a1b809
Create Date: 2026-09-19 03:34:42.907170

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '651cff5fc63a'
down_revision: str | Sequence[str] | None = 'd4e7c2a1b809'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Autogenerate no detecta cambios de CheckConstraint (ver skill db-migration,
    # seccion Gotchas) y ademas trajo drift no relacionado de otro modulo
    # (documento_solicitud) que se descarto a mano; este archivo solo contiene
    # el cambio real: sacar 'egresado' como valor valido de alumno.estado.
    op.drop_constraint('ck_alumno_estado', 'alumno', type_='check')
    op.create_check_constraint('ck_alumno_estado', 'alumno', "estado IN ('activo', 'inactivo')")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('ck_alumno_estado', 'alumno', type_='check')
    op.create_check_constraint(
        'ck_alumno_estado', 'alumno', "estado IN ('activo', 'inactivo', 'egresado')"
    )
