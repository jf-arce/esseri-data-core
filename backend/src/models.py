"""Base declarativa de SQLAlchemy + entidades y enums compartidos por 2+ módulos.

Los modelos propios de un solo módulo van en el `models.py` de ese módulo
(`src/<modulo>/models.py`), no acá. Ver ARCHITECTURE.md.
"""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JSON_TYPE = sa.JSON().with_variant(JSONB(), "postgresql")


class Base(DeclarativeBase):
    pass


class Persona(Base):
    """Identidad compartida por USUARIO/DOCENTE/FAMILIA."""

    __tablename__ = "persona"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    apellido: Mapped[str] = mapped_column(sa.String)
    dni: Mapped[str] = mapped_column(sa.String)
    telefono: Mapped[str | None] = mapped_column(sa.String)
    sexo: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class AuditLog(Base):
    """Auditoría genérica de cambios de campo. `entidad`/`entidad_id` sin FK
    real (validación queda del lado del backend)."""

    __tablename__ = "audit_log"
    __table_args__ = (
        sa.Index("ix_audit_log_entidad_entidad_id_fecha", "entidad", "entidad_id", "fecha"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    entidad: Mapped[str] = mapped_column(sa.String)
    entidad_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    campo: Mapped[str] = mapped_column(sa.String)
    valor_anterior: Mapped[str | None] = mapped_column(sa.String)
    valor_nuevo: Mapped[str | None] = mapped_column(sa.String)
    fecha: Mapped[datetime] = mapped_column(sa.DateTime)
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class EventLog(Base):
    """Log append-only de hechos de negocio, consumido por Workflows."""

    __tablename__ = "event_log"
    __table_args__ = (
        sa.CheckConstraint("actor_tipo IN ('usuario', 'sistema')", name="ck_event_log_actor_tipo"),
        sa.CheckConstraint(
            "estado IN ('pendiente', 'procesado', 'fallido')", name="ck_event_log_estado"
        ),
        sa.Index("ix_event_log_estado_timestamp", "estado", "timestamp"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    actor_tipo: Mapped[str] = mapped_column(sa.String)
    timestamp: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    payload: Mapped[dict | None] = mapped_column(JSON_TYPE)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    entidad: Mapped[str] = mapped_column(sa.String)
    entidad_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
    tipo_evento_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("tipo_evento.id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))
