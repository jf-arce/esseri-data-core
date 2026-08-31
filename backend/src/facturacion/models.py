"""Modelos SQLAlchemy propios de Facturación y Cobranza. Heredan de `src.models.Base`."""

import decimal
import uuid
from datetime import date, datetime

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.models import Base


class Factura(Base):
    """Por alumno (vía `Inscripcion`), no por familia."""

    __tablename__ = "factura"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('pendiente', 'vencida', 'pagada')", name="ck_factura_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha_emision: Mapped[date] = mapped_column(sa.Date)
    fecha_vencimiento: Mapped[date] = mapped_column(sa.Date)
    monto_total: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    inscripcion_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("inscripcion.id"))
    responsable_economico_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("responsable_economico.id", name="fk_factura_responsable_economico")
    )
    detalles: Mapped[list["DetalleFactura"]] = relationship(
        back_populates="factura", cascade="all, delete-orphan"
    )


class ReglaFacturacion(Base):
    """Configuración reutilizable para cargos masivos, sin alterar facturas ya emitidas."""

    __tablename__ = "regla_facturacion"
    __table_args__ = (
        sa.CheckConstraint(
            "periodicidad IN ('mensual', 'anual')", name="ck_regla_facturacion_periodicidad"
        ),
        sa.CheckConstraint(
            "criterio_aplicacion IN ('todas_inscripciones', 'nivel', 'anio', 'division')",
            name="ck_regla_facturacion_criterio",
        ),
        sa.CheckConstraint(
            "estado IN ('borrador', 'activa', 'pausada', 'finalizada')",
            name="ck_regla_facturacion_estado",
        ),
        sa.Index("ix_regla_facturacion_ciclo_estado", "ciclo_lectivo", "estado"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    descripcion: Mapped[str | None] = mapped_column(sa.String)
    ciclo_lectivo: Mapped[str] = mapped_column(sa.String)
    importe: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    periodicidad: Mapped[str] = mapped_column(sa.String)
    vigencia_desde: Mapped[date] = mapped_column(sa.Date)
    vigencia_hasta: Mapped[date] = mapped_column(sa.Date)
    mes_aplicacion: Mapped[int | None] = mapped_column(sa.Integer)
    dia_vencimiento: Mapped[int] = mapped_column(sa.Integer)
    criterio_aplicacion: Mapped[str] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="borrador")
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    concepto_cobro_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("concepto_cobro.id"))
    nivel_educativo_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("nivel_educativo.id")
    )
    anio_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("anio.id"))
    division_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("division.id"))


class EjecucionFacturacion(Base):
    """Resultado de una generación para un período, incluso cuando se reintenta."""

    __tablename__ = "ejecucion_facturacion"
    __table_args__ = (sa.Index("ix_ejecucion_facturacion_periodo", "periodo"),)

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    periodo: Mapped[date] = mapped_column(sa.Date)
    fecha_ejecucion: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    facturas_generadas: Mapped[int] = mapped_column(sa.Integer, default=0)
    cargos_generados: Mapped[int] = mapped_column(sa.Integer, default=0)
    cargos_omitidos: Mapped[int] = mapped_column(sa.Integer, default=0)
    cargos_bloqueados: Mapped[int] = mapped_column(sa.Integer, default=0)
    monto_total: Mapped[decimal.Decimal] = mapped_column(
        sa.Numeric(12, 2), default=decimal.Decimal("0.00")
    )
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("usuario.id"))


class CargoFacturacionGenerado(Base):
    """Marca inmutable de un concepto generado; materializa la idempotencia por período."""

    __tablename__ = "cargo_facturacion_generado"
    __table_args__ = (
        sa.UniqueConstraint(
            "inscripcion_id",
            "concepto_cobro_id",
            "periodo",
            name="uq_cargo_facturacion_generado_inscripcion_concepto_periodo",
        ),
        sa.Index("ix_cargo_facturacion_generado_periodo", "periodo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    periodo: Mapped[date] = mapped_column(sa.Date)
    fecha_vencimiento: Mapped[date] = mapped_column(sa.Date)
    importe: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    regla_facturacion_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("regla_facturacion.id"))
    ejecucion_facturacion_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("ejecucion_facturacion.id")
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("factura.id"))
    inscripcion_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("inscripcion.id"))
    concepto_cobro_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("concepto_cobro.id"))


class DetalleFactura(Base):
    __tablename__ = "detalle_factura"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    descripcion: Mapped[str] = mapped_column(sa.String)
    monto: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    factura_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("factura.id"))
    concepto_cobro_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("concepto_cobro.id"))
    factura: Mapped[Factura] = relationship(back_populates="detalles")


class Pago(Base):
    """Una factura puede tener varios pagos (parciales)."""

    __tablename__ = "pago"
    __table_args__ = (
        sa.CheckConstraint(
            "estado IN ('aprobado', 'rechazado', 'pendiente')", name="ck_pago_estado"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[date] = mapped_column(sa.Date)
    monto: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    comprobante: Mapped[str | None] = mapped_column(sa.String)
    estado: Mapped[str] = mapped_column(sa.String, default="pendiente")
    referencia_transaccion: Mapped[str | None] = mapped_column(sa.String)
    fecha_operacion: Mapped[datetime | None] = mapped_column(sa.DateTime)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    factura_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("factura.id"))
    metodo_pago_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("metodo_pago.id"))


class MetodoPago(Base):
    __tablename__ = "metodo_pago"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    requiere_comprobante: Mapped[bool] = mapped_column(sa.Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class ConceptoCobro(Base):
    __tablename__ = "concepto_cobro"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(sa.String)
    categoria: Mapped[str | None] = mapped_column(sa.String)
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )


class ResponsableEconomico(Base):
    """Fila vigente = `vigencia_hasta IS NULL`; el resto es historial cerrado."""

    __tablename__ = "responsable_economico"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    vigencia_desde: Mapped[date] = mapped_column(sa.Date)
    vigencia_hasta: Mapped[date | None] = mapped_column(sa.Date)
    fecha_solicitud_cambio: Mapped[date | None] = mapped_column(sa.Date)
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    alumno_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("alumno.id"))
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"))


class ReglaPenalidad(Base):
    __tablename__ = "regla_penalidad"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    desde_dia_vencido: Mapped[int] = mapped_column(sa.Integer)
    hasta_dia_vencido: Mapped[int | None] = mapped_column(sa.Integer)
    porcentaje: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(5, 2))
    activo: Mapped[bool] = mapped_column(sa.Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()
    )
    concepto_cobro_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("concepto_cobro.id"))


class ExcepcionVencimiento(Base):
    __tablename__ = "excepcion_vencimiento"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha_vencimiento_excepcional: Mapped[date] = mapped_column(sa.Date)
    motivo: Mapped[str | None] = mapped_column(sa.String)
    created_at: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    familia_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("familia.id"))
    usuario_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("usuario.id"))


class CuentaCorriente(Base):
    __tablename__ = "cuenta_corriente"

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    alumno_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("alumno.id"), unique=True)


class Movimiento(Base):
    """Inmutable — errores se corrigen con un movimiento de ajuste nuevo, no editando."""

    __tablename__ = "movimiento"
    __table_args__ = (
        sa.CheckConstraint("tipo IN ('debe', 'haber')", name="ck_movimiento_tipo"),
        sa.Index("ix_movimiento_cuenta_corriente_fecha", "cuenta_corriente_id", "fecha"),
    )

    id: Mapped[uuid.UUID] = mapped_column(sa.Uuid, primary_key=True, default=uuid.uuid4)
    fecha: Mapped[datetime] = mapped_column(sa.DateTime, server_default=sa.func.now())
    tipo: Mapped[str] = mapped_column(sa.String)
    monto: Mapped[decimal.Decimal] = mapped_column(sa.Numeric(12, 2))
    observacion: Mapped[str | None] = mapped_column(sa.String)
    cuenta_corriente_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("cuenta_corriente.id"))
    concepto_cobro_id: Mapped[uuid.UUID] = mapped_column(sa.ForeignKey("concepto_cobro.id"))
    factura_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("factura.id"))
    pago_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("pago.id"))
    event_log_id: Mapped[uuid.UUID | None] = mapped_column(sa.ForeignKey("event_log.id"))
