"""merge comunicaciones y conversaciones

Revision ID: 2b00dcea780a
Revises: 2cda2b1779e7, 72e8aa0fa672
Create Date: 2026-11-21 02:46:29.370263

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "2b00dcea780a"
down_revision: str | Sequence[str] | None = ("2cda2b1779e7", "72e8aa0fa672")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """No-op: une las dos líneas de migraciones ya aplicadas por separado."""


def downgrade() -> None:
    """No-op: el grafo vuelve a las dos cabezas anteriores."""
