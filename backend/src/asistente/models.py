"""Modelos SQLAlchemy propios del Asistente. Heredan de `src.models.Base`."""

import uuid
from datetime import datetime
from typing import Any

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import JSON_TYPE, Base


class Conversacion(Base):
    """Cada rol activo de una cuenta tiene su propio historial (`rol_codigo`)."""

    __tablename__ = "conversacion_asistente"
    __table_args__ = (
        sa.CheckConstraint("estado IN ('libre', 'generando')", name="ck_conversacion_estado"),
        sa.Index(
            "ix_conversacion_usuario_rol_actualizada",
            "usuario_id",
            "rol_codigo",
            "actualizada_en",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    rol_codigo: Mapped[str] = mapped_column(sa.String)
    titulo: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="libre")
    generando_desde: Mapped[datetime | None] = mapped_column(sa.DateTime)
    creada_en: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    actualizada_en: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class MensajeAsistente(Base):
    """`contenido` y `tool_calls` guardan solo texto seudonimizado (lo mismo que ve el proveedor).

    `tarjetas` son los bloques tipados (kpi, tabla, tarjeta) que arma el backend para el
    navegador; los alias que traen se rehidratan recién al mostrarlos.
    """

    __tablename__ = "mensaje_asistente"
    __table_args__ = (
        sa.CheckConstraint("autor IN ('usuario', 'asistente')", name="ck_mensaje_asistente_autor"),
        sa.CheckConstraint(
            "estado IN ('completo', 'parcial', 'error')", name="ck_mensaje_asistente_estado"
        ),
        sa.UniqueConstraint("conversacion_id", "orden", name="uq_mensaje_asistente_orden"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    conversacion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("conversacion_asistente.id", ondelete="CASCADE")
    )
    orden: Mapped[int] = mapped_column(sa.Integer)
    autor: Mapped[str] = mapped_column(sa.String)
    contenido: Mapped[str] = mapped_column(sa.Text, default="")
    tool_calls: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON_TYPE)
    tarjetas: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON_TYPE)
    estado: Mapped[str] = mapped_column(sa.String, default="completo")
    creado_en: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())


class AliasConversacion(Base):
    """Un alias por persona y conversación; fila propia para evitar pisadas concurrentes."""

    __tablename__ = "alias_conversacion"
    __table_args__ = (
        sa.UniqueConstraint("conversacion_id", "alias", name="uq_alias_conversacion_alias"),
        sa.UniqueConstraint(
            "conversacion_id", "tipo", "entidad_id", name="uq_alias_conversacion_entidad"
        ),
        sa.CheckConstraint("tipo IN ('ALUMNO', 'FAMILIA')", name="ck_alias_conversacion_tipo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    conversacion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("conversacion_asistente.id", ondelete="CASCADE")
    )
    alias: Mapped[str] = mapped_column(sa.String)
    tipo: Mapped[str] = mapped_column(sa.String)
    entidad_id: Mapped[uuid.UUID] = mapped_column(sa.Uuid)
