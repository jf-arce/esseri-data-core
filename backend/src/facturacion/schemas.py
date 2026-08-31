"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ConceptoCobroBase(BaseModel):
    """Datos configurables de un concepto facturable."""

    nombre: str = Field(min_length=1, max_length=150)
    categoria: str | None = Field(default=None, max_length=100)

    @field_validator("nombre", "categoria", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ConceptoCobroCreate(ConceptoCobroBase):
    """Datos para incorporar un concepto al catálogo."""

    activo: bool = True


class ConceptoCobroUpdate(BaseModel):
    """Campos editables de un concepto; permite darlo de baja con `activo = false`."""

    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    categoria: str | None = Field(default=None, max_length=100)
    activo: bool | None = None

    @field_validator("nombre", "categoria", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class ConceptoCobroRead(ConceptoCobroBase):
    """Concepto de cobro expuesto por la API."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    activo: bool
    created_at: datetime
    updated_at: datetime


class ResponsableEconomicoCreate(BaseModel):
    """Solicitud para designar o cambiar el responsable económico de un alumno."""

    familia_id: uuid.UUID
    fecha_solicitud_cambio: date


class ResponsableEconomicoRead(BaseModel):
    """Responsable económico de un alumno durante un período determinado."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    vigencia_desde: date
    vigencia_hasta: date | None
    fecha_solicitud_cambio: date | None
    alumno_id: uuid.UUID
    familia_id: uuid.UUID
    updated_at: datetime
