"""Modelos SQLAlchemy propios de Familias y Alumnos. Heredan de `src.models.Base`."""

import uuid
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base, Persona


class Familia(Base):
    """Cada fila = un responsable/tutor, no un hogar completo."""

    __tablename__ = "familia"
    __table_args__ = (
        sa.CheckConstraint(
            "estado_deuda IN ('al_dia', 'con_deuda', 'en_mora')", name="ck_familia_estado_deuda"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    estado_deuda: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    persona_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("persona.id"))
    persona: Mapped[Persona] = relationship(lazy="joined")

    @property
    def persona_nombre(self) -> str:
        return self.persona.nombre

    @property
    def persona_apellido(self) -> str:
        return self.persona.apellido

    @property
    def persona_dni(self) -> str:
        return self.persona.dni

    @property
    def persona_telefono(self) -> str | None:
        return self.persona.telefono

    @property
    def persona_sexo(self) -> str | None:
        return self.persona.sexo


class Alumno(Base):
    __tablename__ = "alumno"
    __table_args__ = (
        sa.CheckConstraint("estado IN ('activo', 'inactivo', 'egresado')", name="ck_alumno_estado"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    numero_legajo: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    persona_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("persona.id"))
    persona: Mapped[Persona] = relationship(lazy="joined")

    @property
    def persona_nombre(self) -> str:
        return self.persona.nombre

    @property
    def persona_apellido(self) -> str:
        return self.persona.apellido

    @property
    def persona_dni(self) -> str:
        return self.persona.dni

    @property
    def persona_telefono(self) -> str | None:
        return self.persona.telefono

    @property
    def persona_sexo(self) -> str | None:
        return self.persona.sexo


class FamiliaAlumno(Base):
    """Tabla intermedia. Un alumno puede tener varias familias; una familia, varios alumnos."""

    __tablename__ = "familia_alumno"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    parentesco: Mapped[str | None] = mapped_column(sa.String)
    responsable_principal: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    recibe_comunicaciones: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"))
    alumno_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("alumno.id"))
    familia: Mapped[Familia] = relationship(lazy="joined")
    alumno: Mapped[Alumno] = relationship(lazy="joined")

    @property
    def alumno_nombre(self) -> str:
        return f"{self.alumno.persona_nombre} {self.alumno.persona_apellido}"

    @property
    def alumno_legajo(self) -> str:
        return self.alumno.numero_legajo

    @property
    def familia_nombre(self) -> str:
        return f"{self.familia.persona_nombre} {self.familia.persona_apellido}"
