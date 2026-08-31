"""Schemas Pydantic para Académico.

Forma de los datos que entran y salen por la API del módulo.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# --- NivelEducativo ----------------------------------------------------------------------


class NivelEducativoCreate(BaseModel):
    """Schema para crear un nuevo NivelEducativo."""

    nombre: str = Field(..., min_length=1, description="Nombre del nivel educativo")


class NivelEducativoUpdate(BaseModel):
    """Schema para actualizar un NivelEducativo existente."""

    nombre: str | None = Field(None, min_length=1, description="Nombre del nivel educativo")


class NivelEducativoResponse(BaseModel):
    """Schema para responder con datos de NivelEducativo."""

    id: uuid.UUID
    nombre: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Anio --------------------------------------------------------------------------------


class AnioCreate(BaseModel):
    """Schema para crear un nuevo Anio."""

    numero: int = Field(..., ge=1, description="Número del año (1, 2, 3, etc.)")
    nivel_educativo_id: uuid.UUID = Field(
        ..., description="ID del nivel educativo al que pertenece"
    )


class AnioUpdate(BaseModel):
    """Schema para actualizar un Anio existente."""

    numero: int | None = Field(None, ge=1, description="Número del año")
    nivel_educativo_id: uuid.UUID | None = Field(None, description="ID del nivel educativo")


class AnioResponse(BaseModel):
    """Schema para responder con datos de Anio."""

    id: uuid.UUID
    numero: int
    nivel_educativo_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Division ----------------------------------------------------------------------------


class DivisionCreate(BaseModel):
    """Schema para crear una nueva Division."""

    nombre: str = Field(..., min_length=1, description="Nombre de la división (A, B, C, etc.)")
    anio_id: uuid.UUID = Field(..., description="ID del año al que pertenece")


class DivisionUpdate(BaseModel):
    """Schema para actualizar una Division existente."""

    nombre: str | None = Field(None, min_length=1, description="Nombre de la división")
    anio_id: uuid.UUID | None = Field(None, description="ID del año al que pertenece")


class DivisionResponse(BaseModel):
    """Schema para responder con datos de Division."""

    id: uuid.UUID
    nombre: str
    anio_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
