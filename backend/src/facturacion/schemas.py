"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import datetime

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
