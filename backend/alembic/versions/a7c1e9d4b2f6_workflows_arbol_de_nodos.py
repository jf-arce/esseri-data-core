"""workflows arbol de nodos

Cada regla pasa a ser un árbol de nodos (condiciones y acciones). Las reglas existentes se
convierten en (condición -> acción por Sí) o en una acción directa, y las ejecuciones y los
destinatarios se reasignan a ese nodo.

Revision ID: a7c1e9d4b2f6
Revises: 3ed8f33af510
Create Date: 2026-11-14 12:00:00.000000

"""

import json
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7c1e9d4b2f6"
down_revision: str | Sequence[str] | None = "3ed8f33af510"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_JSON = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), "postgresql")


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "workflow_nodo",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workflow_rule_id", sa.Uuid(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("padre_id", sa.Uuid(), nullable=True),
        sa.Column("rama", sa.String(), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("condicion", _JSON, nullable=True),
        sa.Column("tipo_accion", sa.String(), nullable=True),
        sa.Column("accion_config", _JSON, nullable=True),
        sa.Column("notificacion_template_id", sa.Uuid(), nullable=True),
        sa.Column(
            "requiere_aprobacion_humana", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("eliminado_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("tipo IN ('condicion', 'accion')", name="ck_workflow_nodo_tipo"),
        sa.CheckConstraint("rama IS NULL OR rama IN ('si', 'no')", name="ck_workflow_nodo_rama"),
        sa.CheckConstraint(
            "(tipo = 'condicion' AND condicion IS NOT NULL AND tipo_accion IS NULL) OR "
            "(tipo = 'accion' AND tipo_accion IS NOT NULL AND condicion IS NULL)",
            name="ck_workflow_nodo_contenido",
        ),
        sa.CheckConstraint(
            "tipo_accion IS NULL OR tipo_accion IN ("
            "'notificar', 'alerta_interna', 'cambiar_estado', 'crear_tarea', 'generar_cargo', "
            "'aplicar_vencimiento', 'aplicar_penalidad', 'registrar_pago', 'registrar_rechazo', "
            "'actualizar_cuenta_corriente', 'generar_recordatorio', 'escalar_caso', "
            "'crear_registro_relacionado', 'generar_orden_compra', 'generar_comunicacion')",
            name="ck_workflow_nodo_tipo_accion",
        ),
        sa.ForeignKeyConstraint(["workflow_rule_id"], ["workflow_rule.id"]),
        sa.ForeignKeyConstraint(["padre_id"], ["workflow_nodo.id"]),
        sa.ForeignKeyConstraint(["notificacion_template_id"], ["notificacion_template.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_workflow_nodo_regla", "workflow_nodo", ["workflow_rule_id"])
    op.create_table(
        "workflow_nodo_posicion",
        sa.Column("workflow_nodo_id", sa.Uuid(), nullable=False),
        sa.Column("x", sa.Float(), nullable=False),
        sa.Column("y", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(["workflow_nodo_id"], ["workflow_nodo.id"]),
        sa.PrimaryKeyConstraint("workflow_nodo_id"),
    )

    op.add_column("workflow_execution", sa.Column("workflow_nodo_id", sa.Uuid(), nullable=True))
    op.add_column("workflow_execution", sa.Column("accion_snapshot", _JSON, nullable=True))
    op.add_column("regla_destinatario", sa.Column("workflow_nodo_id", sa.Uuid(), nullable=True))

    _convertir_reglas_a_nodos()

    op.alter_column("workflow_execution", "workflow_nodo_id", nullable=False)
    op.alter_column("regla_destinatario", "workflow_nodo_id", nullable=False)
    op.create_foreign_key(
        "fk_workflow_execution_nodo",
        "workflow_execution",
        "workflow_nodo",
        ["workflow_nodo_id"],
        ["id"],
    )
    op.create_foreign_key(
        "fk_regla_destinatario_nodo",
        "regla_destinatario",
        "workflow_nodo",
        ["workflow_nodo_id"],
        ["id"],
    )

    op.drop_constraint(
        "uq_workflow_execution_regla_evento_intento", "workflow_execution", type_="unique"
    )
    op.create_unique_constraint(
        "uq_workflow_execution_nodo_evento_intento",
        "workflow_execution",
        ["workflow_nodo_id", "event_log_id", "intento"],
    )
    op.drop_constraint("uq_regla_destinatario_regla_rol", "regla_destinatario", type_="unique")
    op.drop_constraint("uq_regla_destinatario_regla_usuario", "regla_destinatario", type_="unique")
    op.drop_column("regla_destinatario", "workflow_rule_id")
    op.create_unique_constraint(
        "uq_regla_destinatario_nodo_rol", "regla_destinatario", ["workflow_nodo_id", "rol_id"]
    )
    op.create_unique_constraint(
        "uq_regla_destinatario_nodo_usuario",
        "regla_destinatario",
        ["workflow_nodo_id", "usuario_id"],
    )

    op.drop_constraint("ck_workflow_rule_tipo_accion", "workflow_rule", type_="check")
    for columna in (
        "condicion",
        "tipo_accion",
        "accion_config",
        "notificacion_template_id",
        "requiere_aprobacion_humana",
    ):
        op.drop_column("workflow_rule", columna)


def _convertir_reglas_a_nodos() -> None:
    conexion = op.get_bind()
    reglas = conexion.execute(
        sa.text(
            "SELECT id, condicion, tipo_accion, accion_config, notificacion_template_id, "
            "requiere_aprobacion_humana, created_at, updated_at FROM workflow_rule"
        )
    ).all()
    insertar = sa.text(
        "INSERT INTO workflow_nodo (id, workflow_rule_id, tipo, padre_id, rama, orden, condicion, "
        "tipo_accion, accion_config, notificacion_template_id, requiere_aprobacion_humana, "
        "created_at, updated_at) VALUES (:id, :regla, :tipo, :padre, :rama, 0, "
        "CAST(:condicion AS JSONB), :tipo_accion, CAST(:accion_config AS JSONB), :plantilla, "
        ":aprobacion, :created_at, :updated_at)"
    )
    for regla in reglas:
        condicion = _como_dict(regla.condicion)
        accion_id = uuid.uuid4()
        padre_id = None
        rama = None
        if condicion:
            padre_id = uuid.uuid4()
            rama = "si"
            conexion.execute(
                insertar,
                {
                    "id": padre_id,
                    "regla": regla.id,
                    "tipo": "condicion",
                    "padre": None,
                    "rama": None,
                    "condicion": json.dumps({"logica": "todas", "comparaciones": [condicion]}),
                    "tipo_accion": None,
                    "accion_config": None,
                    "plantilla": None,
                    "aprobacion": False,
                    "created_at": regla.created_at,
                    "updated_at": regla.updated_at,
                },
            )
        config = _como_dict(regla.accion_config)
        conexion.execute(
            insertar,
            {
                "id": accion_id,
                "regla": regla.id,
                "tipo": "accion",
                "padre": padre_id,
                "rama": rama,
                "condicion": None,
                "tipo_accion": regla.tipo_accion,
                "accion_config": None if regla.accion_config is None else json.dumps(config),
                "plantilla": regla.notificacion_template_id,
                "aprobacion": bool(regla.requiere_aprobacion_humana),
                "created_at": regla.created_at,
                "updated_at": regla.updated_at,
            },
        )
        snapshot = json.dumps(
            {
                "tipo_accion": regla.tipo_accion,
                "accion_config": config,
                "notificacion_template_id": (
                    None
                    if regla.notificacion_template_id is None
                    else str(regla.notificacion_template_id)
                ),
                "requiere_aprobacion_humana": bool(regla.requiere_aprobacion_humana),
                "migrado": True,
            }
        )
        conexion.execute(
            sa.text(
                "UPDATE workflow_execution SET workflow_nodo_id = :nodo, "
                "accion_snapshot = CAST(:snapshot AS JSONB) WHERE workflow_rule_id = :regla"
            ),
            {"nodo": accion_id, "snapshot": snapshot, "regla": regla.id},
        )
        conexion.execute(
            sa.text(
                "UPDATE regla_destinatario SET workflow_nodo_id = :nodo "
                "WHERE workflow_rule_id = :regla"
            ),
            {"nodo": accion_id, "regla": regla.id},
        )

    # Verificación antes de borrar las columnas viejas: nada puede quedar sin nodo.
    for tabla in ("workflow_execution", "regla_destinatario"):
        huerfanas = conexion.scalar(
            sa.text(f"SELECT count(*) FROM {tabla} WHERE workflow_nodo_id IS NULL")  # noqa: S608
        )
        if huerfanas:
            raise RuntimeError(f"La migración dejó {huerfanas} filas de {tabla} sin nodo.")
    cantidad_reglas = conexion.scalar(sa.text("SELECT count(*) FROM workflow_rule"))
    reglas_con_accion = conexion.scalar(
        sa.text("SELECT count(DISTINCT workflow_rule_id) FROM workflow_nodo WHERE tipo = 'accion'")
    )
    if cantidad_reglas != reglas_con_accion:
        raise RuntimeError("La migración no creó una acción por cada regla.")


def _como_dict(valor: object) -> dict[str, object]:
    if valor is None:
        return {}
    if isinstance(valor, str):
        return json.loads(valor)
    if isinstance(valor, dict):
        return valor
    return dict(valor)


def downgrade() -> None:
    """Downgrade schema. Falla si el árbol no cabe en el modelo viejo (1 condición + 1 acción)."""
    conexion = op.get_bind()
    _verificar_downgrade_posible(conexion)

    op.add_column("workflow_rule", sa.Column("condicion", _JSON, nullable=True))
    op.add_column("workflow_rule", sa.Column("tipo_accion", sa.String(), nullable=True))
    op.add_column("workflow_rule", sa.Column("accion_config", _JSON, nullable=True))
    op.add_column("workflow_rule", sa.Column("notificacion_template_id", sa.Uuid(), nullable=True))
    op.add_column(
        "workflow_rule",
        sa.Column("requiere_aprobacion_humana", sa.Boolean(), nullable=True),
    )
    op.add_column("regla_destinatario", sa.Column("workflow_rule_id", sa.Uuid(), nullable=True))

    acciones = conexion.execute(
        sa.text(
            "SELECT a.id, a.workflow_rule_id, a.padre_id, a.tipo_accion, a.accion_config, "
            "a.notificacion_template_id, a.requiere_aprobacion_humana "
            "FROM workflow_nodo a WHERE a.tipo = 'accion'"
        )
    ).all()
    for accion in acciones:
        condicion: dict[str, object] = {}
        if accion.padre_id is not None:
            grupo = _como_dict(
                conexion.scalar(
                    sa.text("SELECT condicion FROM workflow_nodo WHERE id = :id"),
                    {"id": accion.padre_id},
                )
            )
            condicion = grupo["comparaciones"][0]
        conexion.execute(
            sa.text(
                "UPDATE workflow_rule SET condicion = CAST(:condicion AS JSONB), "
                "tipo_accion = :tipo_accion, accion_config = CAST(:config AS JSONB), "
                "notificacion_template_id = :plantilla, "
                "requiere_aprobacion_humana = :aprobacion WHERE id = :regla"
            ),
            {
                "condicion": json.dumps(condicion),
                "tipo_accion": accion.tipo_accion,
                "config": None
                if accion.accion_config is None
                else json.dumps(_como_dict(accion.accion_config)),
                "plantilla": accion.notificacion_template_id,
                "aprobacion": bool(accion.requiere_aprobacion_humana),
                "regla": accion.workflow_rule_id,
            },
        )
        conexion.execute(
            sa.text(
                "UPDATE regla_destinatario SET workflow_rule_id = :regla "
                "WHERE workflow_nodo_id = :nodo"
            ),
            {"regla": accion.workflow_rule_id, "nodo": accion.id},
        )

    op.alter_column("workflow_rule", "condicion", nullable=False)
    op.alter_column("workflow_rule", "tipo_accion", nullable=False)
    op.alter_column("workflow_rule", "requiere_aprobacion_humana", nullable=False)
    op.alter_column("regla_destinatario", "workflow_rule_id", nullable=False)
    op.create_foreign_key(
        "regla_destinatario_workflow_rule_id_fkey",
        "regla_destinatario",
        "workflow_rule",
        ["workflow_rule_id"],
        ["id"],
    )
    op.create_foreign_key(
        "workflow_rule_notificacion_template_id_fkey",
        "workflow_rule",
        "notificacion_template",
        ["notificacion_template_id"],
        ["id"],
    )
    op.create_check_constraint(
        "ck_workflow_rule_tipo_accion",
        "workflow_rule",
        "tipo_accion IN ("
        "'notificar', 'alerta_interna', 'cambiar_estado', 'crear_tarea', 'generar_cargo', "
        "'aplicar_vencimiento', 'aplicar_penalidad', 'registrar_pago', 'registrar_rechazo', "
        "'actualizar_cuenta_corriente', 'generar_recordatorio', 'escalar_caso', "
        "'crear_registro_relacionado', 'generar_orden_compra', 'generar_comunicacion')",
    )
    op.create_unique_constraint(
        "uq_regla_destinatario_regla_rol", "regla_destinatario", ["workflow_rule_id", "rol_id"]
    )
    op.create_unique_constraint(
        "uq_regla_destinatario_regla_usuario",
        "regla_destinatario",
        ["workflow_rule_id", "usuario_id"],
    )

    # Las ejecuciones vuelven a colgar solo de la regla.
    op.drop_constraint(
        "uq_workflow_execution_nodo_evento_intento", "workflow_execution", type_="unique"
    )
    op.drop_constraint("fk_workflow_execution_nodo", "workflow_execution", type_="foreignkey")
    op.drop_column("workflow_execution", "workflow_nodo_id")
    op.drop_column("workflow_execution", "accion_snapshot")
    op.create_unique_constraint(
        "uq_workflow_execution_regla_evento_intento",
        "workflow_execution",
        ["workflow_rule_id", "event_log_id", "intento"],
    )

    op.drop_constraint("uq_regla_destinatario_nodo_rol", "regla_destinatario", type_="unique")
    op.drop_constraint("uq_regla_destinatario_nodo_usuario", "regla_destinatario", type_="unique")
    op.drop_constraint("fk_regla_destinatario_nodo", "regla_destinatario", type_="foreignkey")
    op.drop_column("regla_destinatario", "workflow_nodo_id")

    op.drop_table("workflow_nodo_posicion")
    op.drop_index("ix_workflow_nodo_regla", table_name="workflow_nodo")
    op.drop_table("workflow_nodo")


def _verificar_downgrade_posible(conexion: sa.Connection) -> None:
    """El modelo viejo guarda una sola acción con a lo sumo una condición simple."""
    nodos = conexion.execute(
        sa.text(
            "SELECT id, workflow_rule_id, tipo, padre_id, rama, condicion, eliminado_at "
            "FROM workflow_nodo"
        )
    ).all()
    acciones_por_regla: dict[object, int] = {}
    por_id = {nodo.id: nodo for nodo in nodos}
    motivo = (
        "No se puede volver atrás: hay reglas con ramas, varias acciones, condiciones compuestas "
        "o nodos dados de baja que el modelo anterior no puede representar."
    )
    for nodo in nodos:
        if nodo.eliminado_at is not None:
            raise RuntimeError(motivo)
        if nodo.tipo == "accion":
            acciones_por_regla[nodo.workflow_rule_id] = (
                acciones_por_regla.get(nodo.workflow_rule_id, 0) + 1
            )
            padre = por_id.get(nodo.padre_id) if nodo.padre_id is not None else None
            if padre is not None and (padre.padre_id is not None or nodo.rama != "si"):
                raise RuntimeError(motivo)
        else:
            grupo = _como_dict(nodo.condicion)
            if nodo.padre_id is not None or len(grupo.get("comparaciones", [])) != 1:
                raise RuntimeError(motivo)
    regla_ids = {fila[0] for fila in conexion.execute(sa.text("SELECT id FROM workflow_rule"))}
    if any(cantidad != 1 for cantidad in acciones_por_regla.values()) or regla_ids != set(
        acciones_por_regla
    ):
        raise RuntimeError(motivo)
