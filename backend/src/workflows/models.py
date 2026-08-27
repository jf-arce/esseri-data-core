"""Modelos SQLAlchemy propios del Motor de Workflows y Notificaciones."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import JSON_TYPE, Base

_TIPOS_ACCION = (
    "notificar",
    "alerta_interna",
    "cambiar_estado",
    "crear_tarea",
    "generar_cargo",
    "aplicar_vencimiento",
    "aplicar_penalidad",
    "registrar_pago",
    "registrar_rechazo",
    "actualizar_cuenta_corriente",
    "generar_recordatorio",
    "escalar_caso",
    "crear_registro_relacionado",
    "generar_orden_compra",
    "generar_comunicacion",
)
_CK_TIPO_ACCION = "tipo_accion IN (" + ", ".join(f"'{t}'" for t in _TIPOS_ACCION) + ")"


class CampoEvento(Base):
    """Variables disponibles por `TipoEvento`, para condiciones y plantillas."""

    __tablename__ = "campo_evento"
    __table_args__ = (
        sa.CheckConstraint(
            "tipo_dato IN ('numero', 'texto', 'fecha')", name="ck_campo_evento_tipo_dato"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre_interno: Mapped[str] = mapped_column(sa.String)
    etiqueta: Mapped[str] = mapped_column(sa.String)
    tipo_dato: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    tipo_evento_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("tipo_evento.id"))


class TipoEvento(Base):
    __tablename__ = "tipo_evento"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    descripcion: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class WorkflowRule(Base):
    """`condicion`/`accion_config` no son código ejecutable: el backend los
    interpreta contra una allowlist, nunca los ejecuta directamente."""

    __tablename__ = "workflow_rule"
    __table_args__ = (
        sa.CheckConstraint(_CK_TIPO_ACCION, name="ck_workflow_rule_tipo_accion"),
        sa.CheckConstraint(
            "criticidad IN ('baja', 'media', 'alta', 'critica')", name="ck_workflow_rule_criticidad"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    condicion: Mapped[dict] = mapped_column(JSON_TYPE)
    tipo_accion: Mapped[str] = mapped_column(sa.String)
    accion_config: Mapped[dict | None] = mapped_column(JSON_TYPE)
    criticidad: Mapped[str] = mapped_column(sa.String)
    requiere_aprobacion_humana: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    tipo_evento_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("tipo_evento.id"))
    notificacion_template_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("notificacion_template.id")
    )


class NotificacionTemplate(Base):
    """`cuerpo` usa placeholders tipo `{{nombre_familia}}`."""

    __tablename__ = "notificacion_template"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    asunto: Mapped[str] = mapped_column(sa.String)
    cuerpo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class WorkflowExecution(Base):
    __tablename__ = "workflow_execution"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('exitoso', 'fallido', 'pendiente')", name="ck_workflow_execution_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    intento: Mapped[int] = mapped_column(sa.Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    finished_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    detalle: Mapped[str | None] = mapped_column(sa.String)
    error_detail: Mapped[str | None] = mapped_column(sa.String)
    workflow_rule_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_rule.id"))
    event_log_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("event_log.id"))


class Notificacion(Base):
    """Snapshot al momento del envío — no se reescribe si la plantilla cambia después."""

    __tablename__ = "notificacion"
    __table_args__ = (
        sa.CheckConstraint(
            "destinatario_tipo IN ('familia', 'usuario')", name="ck_notificacion_destinatario_tipo"
        ),
        sa.CheckConstraint(
            "estado_envio IN ('enviado', 'fallido', 'pendiente')",
            name="ck_notificacion_estado_envio",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    destinatario_tipo: Mapped[str] = mapped_column(sa.String)
    canal: Mapped[str] = mapped_column(sa.String, default="email")
    destinatario_snapshot: Mapped[str] = mapped_column(sa.String)
    asunto_snapshot: Mapped[str] = mapped_column(sa.String)
    cuerpo_snapshot: Mapped[str] = mapped_column(sa.String)
    estado_envio: Mapped[str] = mapped_column(sa.String, default="pendiente")
    sent_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    workflow_execution_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_execution.id"))
    familia_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("familia.id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))


class Tarea(Base):
    """`entidad`/`entidad_id` sin FK real, mismo criterio que `EventLog`."""

    __tablename__ = "tarea"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('pendiente', 'en_progreso', 'completada', 'escalada')",
            name="ck_tarea_estado",
        ),
        sa.CheckConstraint("prioridad IN ('baja', 'media', 'alta')", name="ck_tarea_prioridad"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    entidad: Mapped[str | None] = mapped_column(sa.String)
    entidad_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid)
    titulo: Mapped[str] = mapped_column(sa.String)
    descripcion: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    prioridad: Mapped[str] = mapped_column(sa.String)
    fecha_vencimiento: Mapped[datetime | None] = mapped_column(sa.DateTime)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    workflow_execution_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("workflow_execution.id")
    )
    tarea_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("tarea.id"))


class ReglaDestinatario(Base):
    __tablename__ = "regla_destinatario"
    __table_args__ = (
        sa.CheckConstraint(
            "destinatario_tipo IN ('rol', 'usuario')", name="ck_regla_destinatario_tipo"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    destinatario_tipo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    workflow_rule_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_rule.id"))
    rol_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("rol.id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))
