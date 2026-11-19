"""habilitar publicar comunicacion en workflows

Revision ID: 260e3555f2b7
Revises: bcbf209f8322
Create Date: 2026-11-19 20:27:28.901824

"""

from alembic import op

revision = "260e3555f2b7"
down_revision = "bcbf209f8322"
branch_labels = None
depends_on = None

_TABLA = "workflow_nodo"
_CONSTRAINT = "ck_workflow_nodo_tipo_accion"
_TIPOS_ANTERIORES = (
    "'notificar', 'alerta_interna', 'cambiar_estado', 'crear_tarea', 'generar_cargo', "
    "'aplicar_vencimiento', 'aplicar_penalidad', 'registrar_pago', 'registrar_rechazo', "
    "'actualizar_cuenta_corriente', 'generar_recordatorio', 'escalar_caso', "
    "'crear_registro_relacionado', 'generar_orden_compra', 'generar_comunicacion'"
)


def _reemplazar_constraint(tipos: str) -> None:
    op.drop_constraint(_CONSTRAINT, _TABLA, type_="check")
    op.create_check_constraint(
        _CONSTRAINT, _TABLA, f"tipo_accion IS NULL OR tipo_accion IN ({tipos})"
    )


def upgrade() -> None:
    """Upgrade schema."""
    _reemplazar_constraint(f"{_TIPOS_ANTERIORES}, 'publicar_comunicacion'")


def downgrade() -> None:
    """Downgrade schema."""
    # Refuse the downgrade while any node still uses the new action; never delete a rule.
    _reemplazar_constraint(_TIPOS_ANTERIORES)
