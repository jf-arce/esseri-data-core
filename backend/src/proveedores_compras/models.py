"""Modelos SQLAlchemy propios de Proveedores y Compras. Heredan de `src.models.Base`."""

import decimal
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.auth.models import Usuario
from src.models import Base


class Proveedor(Base):
    __tablename__ = "proveedor"
    __table_args__ = (
        sa.CheckConstraint("estado IN ('activo', 'inactivo')", name="ck_proveedor_estado"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    categoria: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="activo")
    telefono: Mapped[str | None] = mapped_column(sa.String)
    email: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class ProductoServicio(Base):
    __tablename__ = "producto_servicio"
    __table_args__ = (
        sa.CheckConstraint("tipo IN ('producto', 'servicio')", name="ck_producto_servicio_tipo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    categoria: Mapped[str | None] = mapped_column(sa.String)
    unidad: Mapped[str | None] = mapped_column(sa.String)
    tipo: Mapped[str] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class ProductoProveedor(Base):
    __tablename__ = "producto_proveedor"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    producto_servicio_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("producto_servicio.id"))
    proveedor_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("proveedor.id"))


class PrecioProducto(Base):
    __tablename__ = "precio_producto"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    precio: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    vigencia_desde: Mapped[date] = mapped_column(sa.Date)
    vigencia_hasta: Mapped[date | None] = mapped_column(sa.Date)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    producto_servicio_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("producto_servicio.id"))
    proveedor_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("proveedor.id"))


class AreaSolicitante(Base):
    """Catálogo de áreas que pueden originar una solicitud de compra.

    No tiene ABM en esta entrega: se carga por seed y, si hace falta sumar o renombrar
    un área, se toca esa lista. `activo` permite darla de baja sin romper el historial.
    """

    __tablename__ = "area_solicitante"
    __table_args__ = (sa.UniqueConstraint("nombre", name="uq_area_solicitante_nombre"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class SolicitudCompra(Base):
    """Regla de backend: debe existir `producto_servicio_id` o `articulo`, nunca ninguno."""

    __tablename__ = "solicitud_compra"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('pendiente', 'aprobada', 'rechazada')", name="ck_solicitud_compra_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    articulo: Mapped[str | None] = mapped_column(sa.String)
    cantidad: Mapped[int] = mapped_column(sa.Integer)
    # Nullable por las filas migradas desde el texto libre que no matchearon ninguna área:
    # las altas y ediciones nuevas la exigen, el historial queda como estaba.
    area_solicitante_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("area_solicitante.id")
    )
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    fecha: Mapped[date] = mapped_column(sa.Date)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))
    producto_servicio_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("producto_servicio.id")
    )

    area: Mapped[AreaSolicitante | None] = relationship()
    solicitante: Mapped[Usuario] = relationship()

    @property
    def area_solicitante(self) -> str | None:
        """Nombre del área, que es lo que expone la API (el id va por separado)."""
        return self.area.nombre if self.area is not None else None

    @property
    def solicitante_nombre(self) -> str:
        """Nombre visible de quien creó la solicitud, con el email como respaldo."""
        persona = self.solicitante.persona if self.solicitante is not None else None
        if persona is not None:
            return f"{persona.nombre} {persona.apellido}"
        return self.solicitante.email if self.solicitante is not None else ""


class OrdenCompra(Base):
    __tablename__ = "orden_compra"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('emitida', 'recibida', 'cancelada')", name="ck_orden_compra_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[date] = mapped_column(sa.Date)
    estado: Mapped[str] = mapped_column(sa.String)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    proveedor_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("proveedor.id"))


class OrdenCompraSolicitud(Base):
    __tablename__ = "orden_compra_solicitud"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    orden_compra_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("orden_compra.id"))
    solicitud_compra_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("solicitud_compra.id"))


class OrdenCompraDetalle(Base):
    __tablename__ = "orden_compra_detalle"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    cantidad_pedida: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(10, 2))
    orden_compra_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("orden_compra.id"))
    producto_servicio_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("producto_servicio.id"))


class RecepcionCompra(Base):
    __tablename__ = "recepcion_compra"
    __table_args__ = (
        sa.CheckConstraint("tipo IN ('total', 'parcial')", name="ck_recepcion_compra_tipo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[date] = mapped_column(sa.Date)
    tipo: Mapped[str] = mapped_column(sa.String)
    observaciones: Mapped[str | None] = mapped_column(sa.String)
    remito: Mapped[str | None] = mapped_column(sa.String)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    orden_compra_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("orden_compra.id"))
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class RecepcionCompraDetalle(Base):
    """`cantidad_pendiente` no es columna: se calcula como
    `OrdenCompraDetalle.cantidad_pedida - SUM(cantidad_recibida)`."""

    __tablename__ = "recepcion_compra_detalle"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    cantidad_recibida: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(10, 2))
    recepcion_compra_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("recepcion_compra.id"))
    orden_compra_detalle_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("orden_compra_detalle.id")
    )
