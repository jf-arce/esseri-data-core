"""Modelos Pydantic para las inscripciones."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InscripcionCreateBase(BaseModel):
    ciclo_lectivo: str = Field(min_length=4, max_length=20)
    fecha_inscripcion: date
    alumno_id: uuid.UUID
    division_id: uuid.UUID

    @field_validator("ciclo_lectivo", mode="before")
    @classmethod
    def normalizar_ciclo_lectivo(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class InscripcionNuevaCreate(InscripcionCreateBase):
    """Datos necesarios para confirmar una inscripción proveniente de admisiones."""

    solicitud_inscripcion_id: uuid.UUID


class ReinscripcionCreate(InscripcionCreateBase):
    """Datos para reinscribir a un alumno en el ciclo inmediatamente siguiente."""

    ciclo_lectivo: str = Field(min_length=4, max_length=4, pattern=r"^[1-9]\d{3}$")


class InscripcionRead(BaseModel):
    """Representación pública de una inscripción."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_inscripcion: date
    tipo: Literal["nueva", "reinscripcion", "cambio_matricula", "baja"]
    estado: Literal["activa", "finalizada", "baja"]
    updated_at: datetime
    alumno_id: uuid.UUID
    division_id: uuid.UUID
    solicitud_inscripcion_id: uuid.UUID | None


class InscripcionListadoItemRead(BaseModel):
    """Inscripción con el contexto necesario para mostrarla en el listado."""

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_inscripcion: date
    tipo: Literal["nueva", "reinscripcion", "cambio_matricula", "baja"]
    estado: Literal["activa", "finalizada", "baja"]
    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    division_id: uuid.UUID
    division_nombre: str
    anio_numero: int
    nivel_educativo_nombre: str


class InscripcionListadoRead(BaseModel):
    """Página de inscripciones junto con sus datos de paginación."""

    items: list[InscripcionListadoItemRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class SolicitudInscripcionOpcionRead(BaseModel):
    """Solicitud confirmada que todavía puede originar una inscripción nueva."""

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_solicitud: date
    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    nivel_educativo_id: uuid.UUID
    nivel_educativo_nombre: str


class DivisionOpcionRead(BaseModel):
    """División con el contexto académico necesario para mostrarla en un selector."""

    id: uuid.UUID
    nombre: str
    anio_numero: int
    nivel_educativo_id: uuid.UUID
    nivel_educativo_nombre: str


class AlumnoReinscripcionOpcionRead(BaseModel):
    """Alumno que cumple las condiciones para reinscribirse en un ciclo determinado."""

    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    ciclo_anterior: str
