"""Modelos SQLAlchemy propios de Inscripciones (incluye el pipeline de Admisiones)."""

import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from src.models import Base


class SolicitudInscripcion(Base):
    """Pipeline de Admisiones, previo a la inscripción — solo para `tipo = nueva`."""

    __tablename__ = "solicitud_inscripcion"
    __table_args__ = (
        sa.CheckConstraint(
            "etapa IN ('consulta_lead', 'entrevista', 'postulacion', 'evaluacion_aprobacion', "
            "'reserva_matricula', 'documentacion_contrato', 'inscripcion_confirmada')",
            name="ck_solicitud_inscripcion_etapa",
        ),
        sa.CheckConstraint(
            "estado IN ('en_proceso', 'aprobada', 'rechazada', 'desistida')",
            name="ck_solicitud_inscripcion_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    ciclo_lectivo: Mapped[str] = mapped_column(sa.String)
    etapa: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="en_proceso")
    fecha_solicitud: Mapped[date] = mapped_column(sa.Date)
    fecha_resolucion: Mapped[date | None] = mapped_column(sa.Date)
    observaciones: Mapped[str | None] = mapped_column(sa.String)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    aspirante_persona_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("persona.id"))
    contacto_persona_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("persona.id"))
    nivel_educativo_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("nivel_educativo.id"))
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class EtapaSolicitud(Base):
    """Historial por etapa; `SolicitudInscripcion.etapa` es solo la vigente."""

    __tablename__ = "etapa_solicitud"
    __table_args__ = (
        sa.CheckConstraint(
            "etapa IN ('consulta_lead', 'entrevista', 'postulacion', 'evaluacion_aprobacion', "
            "'reserva_matricula', 'documentacion_contrato', 'inscripcion_confirmada')",
            name="ck_etapa_solicitud_etapa",
        ),
        sa.CheckConstraint(
            "estado IN ('en_proceso', 'completada', 'rechazada')", name="ck_etapa_solicitud_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    etapa: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String)
    fecha: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    observaciones: Mapped[str | None] = mapped_column(sa.String)
    solicitud_inscripcion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("solicitud_inscripcion.id")
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class DocumentoSolicitud(Base):
    """La inscripción no queda confirmada hasta validar documentación/contrato."""

    __tablename__ = "documento_solicitud"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('pendiente', 'validado', 'rechazado')",
            name="ck_documento_solicitud_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    tipo_documento: Mapped[str] = mapped_column(sa.String)
    archivo: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    fecha_carga: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    solicitud_inscripcion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("solicitud_inscripcion.id")
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class Inscripcion(Base):
    """Un alumno acumula varias inscripciones a lo largo del tiempo (una por ciclo lectivo)."""

    __tablename__ = "inscripcion"
    __table_args__ = (
        sa.CheckConstraint(
            "tipo IN ('nueva', 'reinscripcion', 'cambio_matricula', 'baja')",
            name="ck_inscripcion_tipo",
        ),
        sa.CheckConstraint(
            "estado IN ('activa', 'finalizada', 'baja')", name="ck_inscripcion_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    ciclo_lectivo: Mapped[str] = mapped_column(sa.String)
    fecha_inscripcion: Mapped[date] = mapped_column(sa.Date)
    tipo: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    alumno_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("alumno.id"))
    division_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("division.id"))
    solicitud_inscripcion_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("solicitud_inscripcion.id")
    )


class Asistencia(Base):
    """Se toma por día, conectada solo a `Inscripcion` (nunca directo a `Alumno`)."""

    __tablename__ = "asistencia"
    __table_args__ = (
        sa.CheckConstraint(
            "tipo IN ('presente', 'tardanza', 'ausente_pendiente', "
            "'ausente_justificado', 'ausente_injustificado')",
            name="ck_asistencia_tipo",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[date] = mapped_column(sa.Date)
    tipo: Mapped[str] = mapped_column(sa.String)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    inscripcion_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("inscripcion.id"))
