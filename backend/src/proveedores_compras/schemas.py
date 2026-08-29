"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Espeja el CheckConstraint `ck_proveedor_estado` de `Proveedor`: si acá entrara otro valor,
# el error saldría recién en la base como un 500 en vez de un 422 con el detalle del campo.
EstadoProveedor = Literal["activo", "inactivo"]

# Ídem para `ck_solicitud_compra_estado`.
EstadoSolicitud = Literal["pendiente", "aprobada", "rechazada"]


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


class SolicitudCompraBase(BaseModel):
    """Campos comunes de una solicitud interna de compra (RF-20).

    El pedido se identifica de una de dos formas, nunca de ninguna: por referencia al
    catálogo (`producto_servicio_id`) o por texto libre (`articulo`). Es la regla que
    documenta el modelo `SolicitudCompra`. Hoy el camino real es el texto libre: el
    catálogo normalizado todavía no lo entregó ESSERI (pregunta 14 de las aclaraciones).
    """

    articulo: str | None = Field(
        None, min_length=1, description="Descripción libre, para pedidos fuera de catálogo"
    )
    producto_servicio_id: uuid.UUID | None = Field(
        None, description="Referencia al catálogo, cuando el ítem ya existe ahí"
    )
    cantidad: int = Field(..., gt=0, description="Cantidad pedida, siempre mayor a cero")
    area_solicitante: str | None = Field(None, description="Área que origina el pedido")

    @model_validator(mode="after")
    def validar_articulo_o_producto(self) -> "SolicitudCompraBase":
        if self.articulo is None and self.producto_servicio_id is None:
            raise ValueError(
                "La solicitud tiene que indicar un artículo o un producto del catálogo."
            )
        return self


class SolicitudCompraCreate(SolicitudCompraBase):
    """Datos para registrar una solicitud.

    `fecha` es opcional para poder cargar un pedido en diferido; si no viene, el service
    usa la de hoy. `usuario_id` no se acepta del cliente: sale de la sesión, porque el
    solicitante es quien está logueado y no algo que el request pueda elegir.
    """

    fecha: date | None = Field(None, description="Fecha del pedido; por defecto, hoy")


class SolicitudCompraUpdate(BaseModel):
    """Datos para corregir una solicitud.

    El estado no se toca acá: tiene su propio endpoint (`PATCH .../estado`), porque
    cambiarlo es una decisión de negocio (aprobar/rechazar) y no una corrección de datos.
    """

    articulo: str | None = Field(None, min_length=1)
    producto_servicio_id: uuid.UUID | None = None
    cantidad: int | None = Field(None, gt=0)
    area_solicitante: str | None = None
    fecha: date | None = None


class SolicitudCompraCambioEstado(BaseModel):
    """Aprobar o rechazar una solicitud (RF-20: "con estado actualizable")."""

    estado: EstadoSolicitud


class SolicitudCompraResponse(BaseModel):
    """Solicitud tal como sale por la API."""

    id: uuid.UUID
    articulo: str | None
    producto_servicio_id: uuid.UUID | None
    cantidad: int
    area_solicitante: str | None
    estado: EstadoSolicitud
    fecha: date
    usuario_id: uuid.UUID
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
