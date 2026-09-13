"""corrige permiso de asistencia del rol docente

Revision ID: 58d7c7ac8e3c
Revises: 919d280ab368
Create Date: 2026-09-13 14:45:34.767763

Migración de datos (zona sensible, AGENTS.md), no de esquema: el YAML de permisos
(`database/seeds/grupo-b.yaml`) separó hace poco el `academico.actualizar` genérico del
docente en la variante tipada `academico.actualizar:asistencia` (RF-06) — para que un docente
no pueda editar la estructura curricular, solo tomar asistencia. Pero el seed
(`03_seed_grupo_b.py`) solo agrega vínculos `rol_permiso`, nunca los saca, así que cualquier
base ya sembrada con el YAML viejo se quedó con el docente teniendo el permiso amplio. Esta
migración corrige esa base existente; en una base nueva (migraciones antes que seeds) no
encuentra nada que corregir y no hace nada.
"""

import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "58d7c7ac8e3c"
down_revision: Union[str, Sequence[str], None] = "919d280ab368"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

PERMISO_ESTRUCTURA_CODIGO = "academico.actualizar"
PERMISO_ASISTENCIA_CODIGO = "academico.actualizar:asistencia"


def upgrade() -> None:
    """Docente pasa de `academico.actualizar` (estructura) a `academico.actualizar:asistencia`."""
    bind = op.get_bind()

    rol_id = bind.execute(sa.text("SELECT id FROM rol WHERE nombre = 'docente'")).scalar()
    if rol_id is None:
        return

    vinculo_estructura = bind.execute(
        sa.text(
            "SELECT rp.id FROM rol_permiso rp "
            "JOIN permiso p ON p.id = rp.permiso_id "
            "WHERE rp.rol_id = :rol_id AND p.codigo = :codigo"
        ),
        {"rol_id": rol_id, "codigo": PERMISO_ESTRUCTURA_CODIGO},
    ).scalar()
    if vinculo_estructura is None:
        # Base ya sembrada con el YAML corregido, o migración corrida dos veces: nada que hacer.
        return

    permiso_asistencia_id = bind.execute(
        sa.text("SELECT id FROM permiso WHERE codigo = :codigo"),
        {"codigo": PERMISO_ASISTENCIA_CODIGO},
    ).scalar()
    if permiso_asistencia_id is None:
        permiso_asistencia_id = uuid.uuid4()
        bind.execute(
            sa.text(
                "INSERT INTO permiso (id, codigo, modulo, accion, tipo_informacion) "
                "VALUES (:id, :codigo, 'Académico', 'actualizar', 'asistencia')"
            ),
            {"id": permiso_asistencia_id, "codigo": PERMISO_ASISTENCIA_CODIGO},
        )

    ya_vinculado = bind.execute(
        sa.text("SELECT 1 FROM rol_permiso WHERE rol_id = :rol_id AND permiso_id = :permiso_id"),
        {"rol_id": rol_id, "permiso_id": permiso_asistencia_id},
    ).scalar()
    if ya_vinculado is None:
        bind.execute(
            sa.text(
                "INSERT INTO rol_permiso (id, rol_id, permiso_id) "
                "VALUES (:id, :rol_id, :permiso_id)"
            ),
            {"id": uuid.uuid4(), "rol_id": rol_id, "permiso_id": permiso_asistencia_id},
        )

    # Solo el vínculo puntual docente↔estructura, nunca la fila de `permiso`: puede seguir en
    # uso por otros roles (secretaría, coordinación académica, administrador del sistema).
    bind.execute(
        sa.text("DELETE FROM rol_permiso WHERE id = :id"),
        {"id": vinculo_estructura},
    )


def downgrade() -> None:
    """Docente vuelve a tener `academico.actualizar` (estructura) en vez de `..._asistencia`."""
    bind = op.get_bind()

    rol_id = bind.execute(sa.text("SELECT id FROM rol WHERE nombre = 'docente'")).scalar()
    if rol_id is None:
        return

    permiso_estructura_id = bind.execute(
        sa.text("SELECT id FROM permiso WHERE codigo = :codigo"),
        {"codigo": PERMISO_ESTRUCTURA_CODIGO},
    ).scalar()
    if permiso_estructura_id is None:
        # No debería pasar (es un permiso base, usado por otros roles), pero sin la fila no hay
        # nada a lo que revincular.
        return

    ya_vinculado = bind.execute(
        sa.text("SELECT 1 FROM rol_permiso WHERE rol_id = :rol_id AND permiso_id = :permiso_id"),
        {"rol_id": rol_id, "permiso_id": permiso_estructura_id},
    ).scalar()
    if ya_vinculado is None:
        bind.execute(
            sa.text(
                "INSERT INTO rol_permiso (id, rol_id, permiso_id) "
                "VALUES (:id, :rol_id, :permiso_id)"
            ),
            {"id": uuid.uuid4(), "rol_id": rol_id, "permiso_id": permiso_estructura_id},
        )

    bind.execute(
        sa.text(
            "DELETE FROM rol_permiso rp USING permiso p "
            "WHERE rp.permiso_id = p.id AND rp.rol_id = :rol_id AND p.codigo = :codigo"
        ),
        {"rol_id": rol_id, "codigo": PERMISO_ASISTENCIA_CODIGO},
    )
