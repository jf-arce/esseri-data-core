"""Modelos SQLAlchemy propios de Autenticación y Roles. Heredan de `src.models.Base`.

Zona sensible (AGENTS.md): JWT y permisos, cambios en modo plan.
"""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class Usuario(Base):
    __tablename__ = "usuario"
    __table_args__ = (
        sa.CheckConstraint("estado IN ('activo', 'inactivo')", name="ck_usuario_estado"),
        sa.CheckConstraint("auth_provider IN ('google', 'local')", name="ck_usuario_auth_provider"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(sa.String)
    password_hash: Mapped[str | None] = mapped_column(sa.String)
    auth_provider: Mapped[str] = mapped_column(sa.String)
    provider_subject: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="activo")
    fecha_creacion: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    ultimo_acceso: Mapped[datetime | None] = mapped_column(sa.DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    persona_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("persona.id"))


class Rol(Base):
    __tablename__ = "rol"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    descripcion: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class UsuarioRol(Base):
    """Tabla intermedia. Un usuario puede tener más de un rol simultáneo."""

    __tablename__ = "usuario_rol"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    rol_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("rol.id"))


class Permiso(Base):
    """Cubre RF-28: permisos diferenciados por módulo y acción."""

    __tablename__ = "permiso"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    modulo: Mapped[str] = mapped_column(sa.String)
    accion: Mapped[str] = mapped_column(sa.String)
    tipo_informacion: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class RolPermiso(Base):
    """Tabla intermedia."""

    __tablename__ = "rol_permiso"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    rol_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("rol.id"))
    permiso_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("permiso.id"))


class LogAcceso(Base):
    """Cubre RF-27: intentos fallidos de login. Distinto de AuditLog/EventLog."""

    __tablename__ = "log_acceso"
    __table_args__ = (
        sa.CheckConstraint("resultado IN ('exitoso', 'fallido')", name="ck_log_acceso_resultado"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    resultado: Mapped[str] = mapped_column(sa.String)
    ip_origen: Mapped[str | None] = mapped_column(sa.String)
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
