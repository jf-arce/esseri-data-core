"""Modelos SQLAlchemy propios del Motor de Workflows y Notificaciones."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.models import JSON_TYPE, Base
from src.workflows.constants import TIPOS_ACCION

# `condicion` y `accion_config` guardan NULL de SQL (no el JSON `null`): los checks por tipo de nodo
# preguntan `IS NULL`.
_JSON_NULO = sa.JSON(none_as_null=True).with_variant(JSONB(none_as_null=True), "postgresql")
_CK_TIPO_ACCION = "tipo_accion IN (" + ", ".join(f"'{t}'" for t in TIPOS_ACCION) + ")"


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
    __table_args__ = (sa.UniqueConstraint("nombre", name="uq_tipo_evento_nombre"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    descripcion: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class WorkflowRule(Base):
    """Cabecera de la regla: el disparador (`tipo_evento_id`) y los datos propios. Lo que la regla
    hace vive en su árbol de `WorkflowNodo` (condiciones y acciones)."""

    __tablename__ = "workflow_rule"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    tipo_evento_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("tipo_evento.id"))


class WorkflowRuleBorrador(Base):
    """Bloques del editor que no están conectados al flujo. Se guardan tal cual los armó la persona
    (pueden estar incompletos) y el motor nunca los lee. Va aparte para que editarlos no toque el
    `updated_at` funcional de la regla."""

    __tablename__ = "workflow_rule_borrador"

    workflow_rule_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("workflow_rule.id"), primary_key=True
    )
    bloques_sueltos: Mapped[list[dict[str, object]]] = mapped_column(JSON_TYPE)


class WorkflowNodo(Base):
    """Nodo del árbol de una regla. `condicion` es `{logica, comparaciones}` y `accion_config` se
    interpretan contra una allowlist, nunca se ejecutan. `padre_id` nulo = cuelga del disparador.
    La baja es lógica (`eliminado_at`) cuando el nodo ya tiene ejecuciones."""

    __tablename__ = "workflow_nodo"
    __table_args__ = (
        sa.CheckConstraint("tipo IN ('condicion', 'accion')", name="ck_workflow_nodo_tipo"),
        sa.CheckConstraint("rama IS NULL OR rama IN ('si', 'no')", name="ck_workflow_nodo_rama"),
        sa.CheckConstraint(
            "(tipo = 'condicion' AND condicion IS NOT NULL AND tipo_accion IS NULL) OR "
            "(tipo = 'accion' AND tipo_accion IS NOT NULL AND condicion IS NULL)",
            name="ck_workflow_nodo_contenido",
        ),
        sa.CheckConstraint(
            f"tipo_accion IS NULL OR {_CK_TIPO_ACCION}", name="ck_workflow_nodo_tipo_accion"
        ),
        sa.Index("ix_workflow_nodo_regla", "workflow_rule_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    workflow_rule_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_rule.id"))
    tipo: Mapped[str] = mapped_column(sa.String)
    padre_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("workflow_nodo.id"))
    rama: Mapped[str | None] = mapped_column(sa.String)
    orden: Mapped[int] = mapped_column(sa.Integer, default=0)
    condicion: Mapped[dict | None] = mapped_column(_JSON_NULO)
    tipo_accion: Mapped[str | None] = mapped_column(sa.String)
    accion_config: Mapped[dict | None] = mapped_column(_JSON_NULO)
    notificacion_template_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("notificacion_template.id")
    )
    requiere_aprobacion_humana: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    eliminado_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class WorkflowNodoPosicion(Base):
    """Posición del nodo en el lienzo. Va aparte para que mover un nodo no toque el `updated_at`
    funcional (que invalida pendientes y reintentos)."""

    __tablename__ = "workflow_nodo_posicion"

    workflow_nodo_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("workflow_nodo.id"), primary_key=True
    )
    x: Mapped[float] = mapped_column(sa.Float)
    y: Mapped[float] = mapped_column(sa.Float)


class NotificacionTemplate(Base):
    """`cuerpo` usa placeholders tipo `{{nombre_familia}}`."""

    __tablename__ = "notificacion_template"
    __table_args__ = (sa.UniqueConstraint("nombre", name="uq_notificacion_template_nombre"),)

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
            "estado IN ('exitoso', 'fallido', 'pendiente', 'rechazado')",
            name="ck_workflow_execution_estado",
        ),
        sa.UniqueConstraint(
            "workflow_nodo_id",
            "event_log_id",
            "intento",
            name="uq_workflow_execution_nodo_evento_intento",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    intento: Mapped[int] = mapped_column(sa.Integer, default=1)
    started_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    finished_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    detalle: Mapped[str | None] = mapped_column(sa.String)
    error_detail: Mapped[str | None] = mapped_column(sa.String)
    # Config de la acción al momento de ejecutar: trazabilidad sin versionar la regla.
    accion_snapshot: Mapped[dict | None] = mapped_column(JSON_TYPE)
    workflow_rule_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_rule.id"))
    workflow_nodo_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_nodo.id"))
    event_log_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("event_log.id"))


class Notificacion(Base):
    """Snapshot al momento del envío — no se reescribe si la plantilla cambia después."""

    __tablename__ = "notificacion"
    __table_args__ = (
        sa.CheckConstraint(
            "destinatario_tipo IN ('familia', 'usuario')", name="ck_notificacion_destinatario_tipo"
        ),
        sa.CheckConstraint(
            "estado_envio IN ('enviado', 'fallido', 'pendiente', 'presentado', 'incierto')",
            name="ck_notificacion_estado_envio",
        ),
        sa.CheckConstraint(
            "(workflow_execution_id IS NOT NULL AND envio_id IS NULL) OR "
            "(workflow_execution_id IS NULL AND envio_id IS NOT NULL)",
            name="ck_notificacion_origen",
        ),
        sa.UniqueConstraint("envio_id", "numero_intento", name="uq_notificacion_envio_intento"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    destinatario_tipo: Mapped[str] = mapped_column(sa.String)
    canal: Mapped[str] = mapped_column(sa.String, default="email")
    destinatario_snapshot: Mapped[str] = mapped_column(sa.String)
    asunto_snapshot: Mapped[str] = mapped_column(sa.String)
    cuerpo_snapshot: Mapped[str] = mapped_column(sa.String)
    estado_envio: Mapped[str] = mapped_column(sa.String, default="pendiente")
    sent_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    workflow_execution_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("workflow_execution.id")
    )
    envio_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("envio_notificacion.id", name="fk_notificacion_envio")
    )
    numero_intento: Mapped[int | None] = mapped_column(sa.Integer)
    started_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    lease_until: Mapped[datetime | None] = mapped_column(sa.DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    proveedor_iniciado: Mapped[bool] = mapped_column(
        sa.Boolean, default=False, server_default=sa.false()
    )
    referencia_proveedor: Mapped[str | None] = mapped_column(sa.String(200))
    error_codigo: Mapped[str | None] = mapped_column(sa.String(50))
    familia_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("familia.id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))


class EnvioNotificacion(Base):
    """Durable manual-origin transport intention, drained by the existing dispatcher."""

    __tablename__ = "envio_notificacion"
    __table_args__ = (
        sa.UniqueConstraint("comunicacion_id", "familia_id", "email", name="uq_envio_destino"),
        sa.UniqueConstraint(
            "mensaje_conversacion_id", "familia_id", "email", name="uq_envio_mensaje_destino"
        ),
        sa.CheckConstraint(
            "(comunicacion_id IS NULL) <> (mensaje_conversacion_id IS NULL)",
            name="ck_envio_origen_exclusivo",
        ),
        sa.CheckConstraint(
            "estado IN ('pendiente','procesando','presentado','fallido','incierto','sin_email')",
            name="ck_envio_estado",
        ),
    )
    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    comunicacion_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("comunicacion.id"))
    mensaje_conversacion_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("mensaje_conversacion.id", name="fk_envio_mensaje_conversacion")
    )
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"))
    email: Mapped[str] = mapped_column(sa.String(320))
    asunto: Mapped[str] = mapped_column(sa.String(200))
    cuerpo: Mapped[str] = mapped_column(sa.Text)
    estado: Mapped[str] = mapped_column(sa.String(20), default="pendiente", index=True)
    # `intentos` es el total histórico: numera los intentos y nunca se reutiliza. El tope de
    # reintentos automáticos se cuenta por ciclo; un reintento autorizado abre un ciclo nuevo.
    intentos: Mapped[int] = mapped_column(sa.Integer, default=0)
    reintentos_ciclo: Mapped[int] = mapped_column(sa.Integer, default=0)
    disponible_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    lease_at: Mapped[datetime | None] = mapped_column(sa.DateTime)
    intento_actual_id: Mapped[uuid.UUID | None] = mapped_column(sa.Uuid)


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
        sa.CheckConstraint(
            "(destinatario_tipo = 'rol' AND rol_id IS NOT NULL AND usuario_id IS NULL) "
            "OR (destinatario_tipo = 'usuario' AND usuario_id IS NOT NULL AND rol_id IS NULL)",
            name="ck_regla_destinatario_referencia",
        ),
        sa.UniqueConstraint(
            "workflow_nodo_id",
            "rol_id",
            name="uq_regla_destinatario_nodo_rol",
        ),
        sa.UniqueConstraint(
            "workflow_nodo_id",
            "usuario_id",
            name="uq_regla_destinatario_nodo_usuario",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    destinatario_tipo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    workflow_nodo_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("workflow_nodo.id"))
    rol_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("rol.id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))
