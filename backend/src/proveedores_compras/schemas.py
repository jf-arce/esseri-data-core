"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Espeja el CheckConstraint `ck_proveedor_estado` de `Proveedor`: si acá entrara otro valor,
# el error saldría recién en la base como un 500 en vez de un 422 con el detalle del campo.
EstadoProveedor = Literal["activo", "inactivo"]


class ProveedorBase(BaseModel):
    """Campos comunes de Proveedor (RF-19).

    `categoria` es texto libre a propósito: el cliente todavía no cerró el listado de
    categorías y fijarlo acá lo volvería un cambio de código en vez de un dato.
    """

    nombre: str = Field(..., min_length=1, description="Razón social o nombre del proveedor")
    categoria: str | None = Field(None, description="Rubro del proveedor")
    telefono: str | None = Field(None, description="Teléfono de contacto")
    email: str | None = Field(None, description="Email de contacto")


class ProveedorCreate(ProveedorBase):
    """Datos para dar de alta un proveedor."""

    estado: EstadoProveedor = Field("activo", description="Estado inicial del proveedor")


class ProveedorUpdate(BaseModel):
    """Datos para modificar un proveedor. Todos los campos son opcionales: se aplica
    solo lo que venga informado (`exclude_unset`)."""

    nombre: str | None = Field(None, min_length=1)
    categoria: str | None = None
    telefono: str | None = None
    email: str | None = None
    estado: EstadoProveedor | None = None


class ProveedorResponse(ProveedorBase):
    """Proveedor tal como sale por la API."""

    id: uuid.UUID
    estado: EstadoProveedor
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
