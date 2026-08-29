"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import decimal
import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Espeja el CheckConstraint `ck_proveedor_estado` de `Proveedor`: si acá entrara otro valor,
# el error saldría recién en la base como un 500 en vez de un 422 con el detalle del campo.
EstadoProveedor = Literal["activo", "inactivo"]

# Ídem para `ck_solicitud_compra_estado`.
EstadoSolicitud = Literal["pendiente", "aprobada", "rechazada"]

# Ídem para `ck_producto_servicio_tipo`.
TipoProductoServicio = Literal["producto", "servicio"]

# Ídem para `ck_orden_compra_estado`.
EstadoOrdenCompra = Literal["emitida", "recibida", "cancelada"]

# Ídem para `ck_recepcion_compra_tipo`.
TipoRecepcion = Literal["total", "parcial"]


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


class ProductoServicioBase(BaseModel):
    """Campos comunes de un ítem del catálogo de compras.

    `categoria` y `unidad` son texto libre: el cliente todavía no entregó la tabla maestra
    normalizada (pregunta 14 de las aclaraciones), así que fijar un vocabulario acá sería
    inventarle un estándar que después no coincide con el suyo.
    """

    nombre: str = Field(..., min_length=1, description="Nombre del producto o servicio")
    categoria: str | None = Field(None, description="Rubro al que pertenece")
    unidad: str | None = Field(None, description="Unidad de medida, ej. unidad, caja, hora")
    tipo: TipoProductoServicio = Field(..., description="Si es un producto o un servicio")


class ProductoServicioCreate(ProductoServicioBase):
    """Datos para dar de alta un ítem del catálogo."""

    activo: bool = Field(True, description="Si está disponible para nuevas compras")


class ProductoServicioUpdate(BaseModel):
    """Datos para modificar un ítem del catálogo."""

    nombre: str | None = Field(None, min_length=1)
    categoria: str | None = None
    unidad: str | None = None
    tipo: TipoProductoServicio | None = None
    activo: bool | None = None


class ProductoServicioResponse(ProductoServicioBase):
    """Ítem del catálogo tal como sale por la API."""

    id: uuid.UUID
    activo: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrdenCompraDetalleCreate(BaseModel):
    """Una línea de lo que se le pide al proveedor.

    Es el ítem de la **orden**, no de la solicitud: varias solicitudes del mismo producto se
    consolidan en una sola línea, que es lo que el cliente llamó "resulte compatible
    agruparlas" (respuesta 12 de las aclaraciones).
    """

    producto_servicio_id: uuid.UUID = Field(..., description="Ítem del catálogo que se pide")
    cantidad_pedida: decimal.Decimal = Field(..., gt=0, description="Cantidad, mayor a cero")


class OrdenCompraDetalleResponse(BaseModel):
    """Línea de la orden tal como sale por la API."""

    id: uuid.UUID
    producto_servicio_id: uuid.UUID
    cantidad_pedida: decimal.Decimal

    model_config = ConfigDict(from_attributes=True)


class OrdenCompraCreate(BaseModel):
    """Datos para emitir una orden de compra (RF-21).

    Las solicitudes dan la **trazabilidad** (por qué se compra) y el detalle dice **qué** se le
    pide al proveedor. Van separados a propósito: una solicitud puede venir con el artículo en
    texto libre, y la orden necesita sí o sí un ítem del catálogo.
    """

    proveedor_id: uuid.UUID = Field(..., description="Proveedor al que se le emite la orden")
    fecha: date | None = Field(None, description="Fecha de emisión; por defecto, hoy")
    solicitud_ids: list[uuid.UUID] = Field(
        ...,
        min_length=1,
        description="Solicitudes aprobadas que origina esta orden; cada una conserva su ID",
    )
    detalles: list[OrdenCompraDetalleCreate] = Field(
        ..., min_length=1, description="Ítems y cantidades que se le piden al proveedor"
    )

    @model_validator(mode="after")
    def validar_sin_repetidos(self) -> "OrdenCompraCreate":
        if len(set(self.solicitud_ids)) != len(self.solicitud_ids):
            raise ValueError("Hay solicitudes repetidas en la orden.")
        productos = [detalle.producto_servicio_id for detalle in self.detalles]
        if len(set(productos)) != len(productos):
            raise ValueError(
                "Hay ítems repetidos en el detalle: sumá las cantidades en una sola línea."
            )
        return self


class OrdenCompraCambioEstado(BaseModel):
    """Cambio de estado de una orden. Hoy solo se usa para cancelarla: `recibida` lo pone la
    recepción de compras (issue #111), no una edición manual."""

    estado: EstadoOrdenCompra


class OrdenCompraResponse(BaseModel):
    """Orden tal como sale por la API, con su detalle y las solicitudes que la originaron."""

    id: uuid.UUID
    fecha: date
    estado: EstadoOrdenCompra
    proveedor_id: uuid.UUID
    updated_at: datetime
    detalles: list[OrdenCompraDetalleResponse] = []
    solicitud_ids: list[uuid.UUID] = []

    model_config = ConfigDict(from_attributes=True)


class RecepcionCompraDetalleCreate(BaseModel):
    """Lo que efectivamente llegó de una línea de la orden."""

    orden_compra_detalle_id: uuid.UUID = Field(..., description="Línea de la orden que se recibe")
    cantidad_recibida: decimal.Decimal = Field(
        ..., gt=0, description="Cantidad recibida en esta entrega, mayor a cero"
    )


class RecepcionCompraCreate(BaseModel):
    """Registrar una recepción contra una orden (respuesta 13 del cliente).

    `tipo` no se acepta del cliente: se deriva de las cantidades. Si alguien pudiera declararlo
    a mano, nada impediría marcar "total" habiendo recibido la mitad, y el pendiente quedaría
    mintiendo.

    `usuario_id` tampoco: el responsable que recibe sale de la sesión.
    """

    fecha: date | None = Field(None, description="Fecha de recepción; por defecto, hoy")
    remito: str | None = Field(None, description="Número de remito o documentación de respaldo")
    observaciones: str | None = Field(None, description="Diferencias, faltantes o comentarios")
    detalles: list[RecepcionCompraDetalleCreate] = Field(
        ..., min_length=1, description="Qué llegó y en qué cantidad"
    )

    @model_validator(mode="after")
    def validar_sin_lineas_repetidas(self) -> "RecepcionCompraCreate":
        lineas = [detalle.orden_compra_detalle_id for detalle in self.detalles]
        if len(set(lineas)) != len(lineas):
            raise ValueError(
                "Hay líneas repetidas en la recepción: sumá las cantidades en una sola."
            )
        return self


class RecepcionCompraDetalleResponse(BaseModel):
    """Línea de una recepción tal como sale por la API."""

    id: uuid.UUID
    orden_compra_detalle_id: uuid.UUID
    cantidad_recibida: decimal.Decimal

    model_config = ConfigDict(from_attributes=True)


class RecepcionCompraResponse(BaseModel):
    """Recepción tal como sale por la API."""

    id: uuid.UUID
    fecha: date
    tipo: TipoRecepcion
    remito: str | None
    observaciones: str | None
    orden_compra_id: uuid.UUID
    usuario_id: uuid.UUID
    updated_at: datetime
    detalles: list[RecepcionCompraDetalleResponse] = []

    model_config = ConfigDict(from_attributes=True)


class LineaPendienteResponse(BaseModel):
    """Estado de una línea de la orden: cuánto se pidió, cuánto llegó y cuánto falta.

    `cantidad_pendiente` **no es columna**: se calcula como
    `cantidad_pedida - SUM(cantidad_recibida)`, mismo criterio de derivado sin cache que usa
    `CUENTA_CORRIENTE` (ver el diccionario de datos).
    """

    orden_compra_detalle_id: uuid.UUID
    producto_servicio_id: uuid.UUID
    cantidad_pedida: decimal.Decimal
    cantidad_recibida: decimal.Decimal
    cantidad_pendiente: decimal.Decimal
