"""grant system administrator communications access

Revision ID: 98d809a30507
Revises: d42435882574
Create Date: 2026-10-30 00:35:44.113488

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '98d809a30507'
down_revision: Union[str, Sequence[str], None] = 'd42435882574'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Grant explicit management capabilities without bypassing active-role guards."""
    bind = op.get_bind()
    roles = sa.table('rol', sa.column('id', sa.Uuid()), sa.column('codigo', sa.String()))
    permisos = sa.table('permiso', sa.column('id', sa.Uuid()), sa.column('codigo', sa.String()))
    vinculos = sa.table(
        'rol_permiso', sa.column('id', sa.Uuid()), sa.column('rol_id', sa.Uuid()),
        sa.column('permiso_id', sa.Uuid()),
    )
    rol_id = bind.scalar(sa.select(roles.c.id).where(roles.c.codigo == 'administrador_del_sistema'))
    if rol_id is None:
        return  # Fresh installations receive these grants from the canonical seed.
    for accion in ('crear', 'leer', 'actualizar'):
        permiso_id = bind.scalar(sa.select(permisos.c.id).where(
            permisos.c.codigo == f'comunicaciones.{accion}'
        ))
        if permiso_id is None:
            raise RuntimeError('Required institutional communications permission is missing')
        existe = bind.scalar(sa.select(vinculos.c.id).where(
            vinculos.c.rol_id == rol_id, vinculos.c.permiso_id == permiso_id,
        ))
        if existe is None:
            bind.execute(vinculos.insert().values(
                id=uuid.uuid5(uuid.NAMESPACE_URL, f'{revision}/{rol_id}/{permiso_id}'),
                rol_id=rol_id, permiso_id=permiso_id,
            ))


def downgrade() -> None:
    """Remove only links created here, preserving any pre-existing seed or manual grants."""
    bind = op.get_bind()
    roles = sa.table('rol', sa.column('id', sa.Uuid()), sa.column('codigo', sa.String()))
    permisos = sa.table('permiso', sa.column('id', sa.Uuid()), sa.column('codigo', sa.String()))
    vinculos = sa.table('rol_permiso', sa.column('id', sa.Uuid()))
    rol_id = bind.scalar(sa.select(roles.c.id).where(roles.c.codigo == 'administrador_del_sistema'))
    if rol_id is None:
        return
    for permiso_id in bind.scalars(sa.select(permisos.c.id).where(permisos.c.codigo.in_([
        'comunicaciones.crear', 'comunicaciones.leer', 'comunicaciones.actualizar',
    ]))):
        link_id = uuid.uuid5(uuid.NAMESPACE_URL, f'{revision}/{rol_id}/{permiso_id}')
        bind.execute(vinculos.delete().where(vinculos.c.id == link_id))
