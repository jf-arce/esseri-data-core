"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


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


FacturaEstado = Literal["pendiente", "vencida", "pagada"]


class DetalleFacturaCreate(BaseModel):
    descripcion: str = Field(min_length=1, max_length=250)
    monto: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    concepto_cobro_id: uuid.UUID

    @field_validator("descripcion")
    @classmethod
    def normalizar_descripcion(cls, value: str) -> str:
        return value.strip()


class FacturaCreate(BaseModel):
    fecha_emision: date
    fecha_vencimiento: date
    inscripcion_id: uuid.UUID
    detalles: list[DetalleFacturaCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validar_fechas(self) -> "FacturaCreate":
        if self.fecha_vencimiento < self.fecha_emision:
            raise ValueError("La fecha de vencimiento no puede ser anterior a la emisión.")
        return self


class FacturaUpdate(BaseModel):
    fecha_vencimiento: date | None = None
    detalles: list[DetalleFacturaCreate] | None = Field(default=None, min_length=1)


class DetalleFacturaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    descripcion: str
    monto: Decimal
    concepto_cobro_id: uuid.UUID


class FacturaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fecha_emision: date
    fecha_vencimiento: date
    monto_total: Decimal
    estado: FacturaEstado
    updated_at: datetime
    inscripcion_id: uuid.UUID
    responsable_economico_id: uuid.UUID
    detalles: list[DetalleFacturaRead]


class FacturaListadoRead(BaseModel):
    items: list[FacturaRead]
    total: int
    pagina: int
    tamanio: int
