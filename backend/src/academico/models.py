"""Modelos SQLAlchemy propios de Académico. Heredan de `src.models.Base`."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class NivelEducativo(Base):
    __tablename__ = "nivel_educativo"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class Anio(Base):
    __tablename__ = "anio"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    numero: Mapped[int] = mapped_column(sa.Integer)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    nivel_educativo_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("nivel_educativo.id"))


class Division(Base):
    __tablename__ = "division"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    anio_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("anio.id"))


class Materia(Base):
    """`division_id` nulo = común al año; con valor = específica de la división."""

    __tablename__ = "materia"
    __table_args__ = (
        sa.CheckConstraint("tipo IN ('materia', 'taller')", name="ck_materia_tipo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    tipo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    anio_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("anio.id"))
    division_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("division.id"))


class Docente(Base):
    __tablename__ = "docente"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    legajo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    persona_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("persona.id"))


class AsignacionDocente(Base):
    __tablename__ = "asignacion_docente"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    ciclo_lectivo: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    docente_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("docente.id"))
    materia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("materia.id"))
    division_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("division.id"))


class MotivoJustificacion(Base):
    __tablename__ = "motivo_justificacion"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class JustificacionInasistencia(Base):
    """La familia carga la justificación; Secretaría/Dirección la resuelve."""

    __tablename__ = "justificacion_inasistencia"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('pendiente', 'aprobada', 'rechazada')",
            name="ck_justificacion_inasistencia_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    observacion: Mapped[str | None] = mapped_column(sa.String)
    archivo: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    fecha_carga: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    fecha_resolucion: Mapped[datetime | None] = mapped_column(sa.DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    asistencia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("asistencia.id"))
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"))
    motivo_justificacion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("motivo_justificacion.id")
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
