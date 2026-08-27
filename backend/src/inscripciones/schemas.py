"""Modelos Pydantic para las inscripciones."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InscripcionNuevaCreate(BaseModel):
    """Datos necesarios para confirmar una inscripción proveniente de admisiones."""

    ciclo_lectivo: str = Field(min_length=4, max_length=20)
    fecha_inscripcion: date
    alumno_id: uuid.UUID
    division_id: uuid.UUID
    solicitud_inscripcion_id: uuid.UUID

    @field_validator("ciclo_lectivo", mode="before")
    @classmethod
    def normalizar_ciclo_lectivo(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


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
