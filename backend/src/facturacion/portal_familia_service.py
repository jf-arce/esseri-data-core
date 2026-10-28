"""Read-only billing views scoped to the family captured as each invoice's economic responsible."""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.facturacion.models import (
    ArchivoComprobantePago,
    Factura,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.schemas import (
    DetalleFacturaFamiliaRead,
    FacturacionFamiliaRead,
    FacturaFamiliaRead,
    MovimientoFamiliaRead,
    PagoFamiliaRead,
)
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Inscripcion
from src.models import Persona


def _cuenta_vacia() -> FacturacionFamiliaRead:
    cero = Decimal("0.00")
    return FacturacionFamiliaRead(
        total_debe=cero,
        total_haber=cero,
        saldo=cero,
        facturas=[],
        movimientos=[],
    )


def obtener_facturacion_familia(
    db: Session, persona_id: uuid.UUID | None
) -> FacturacionFamiliaRead:
    """Return only invoices whose persisted responsible-family snapshot belongs to the user."""
    if persona_id is None:
        return _cuenta_vacia()

    familia_id = db.scalar(select(Familia.id).where(Familia.persona_id == persona_id).limit(1))
    if familia_id is None:
        return _cuenta_vacia()

    filas = db.execute(
        select(Factura, Persona.nombre, Persona.apellido)
        .join(
            ResponsableEconomico,
            ResponsableEconomico.id == Factura.responsable_economico_id,
        )
        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .where(ResponsableEconomico.familia_id == familia_id)
        .options(
            selectinload(Factura.detalles),
            selectinload(Factura.pagos).selectinload(Pago.metodo_pago),
            selectinload(Factura.pagos).selectinload(Pago.archivo_comprobante),
        )
        .order_by(Factura.fecha_vencimiento, Factura.id)
    ).all()

    facturas = [
        FacturaFamiliaRead(
            id=factura.id,
            fecha_emision=factura.fecha_emision,
            fecha_vencimiento=factura.fecha_vencimiento,
            monto_total=factura.monto_total,
            estado=factura.estado,
            alumno_nombre=f"{nombre} {apellido}",
            detalles=[
                DetalleFacturaFamiliaRead(
                    descripcion=detalle.descripcion,
                    monto=detalle.monto,
                )
                for detalle in factura.detalles
            ],
            pagos=[
                PagoFamiliaRead(
                    id=pago.id,
                    fecha=pago.fecha,
                    monto=pago.monto,
                    estado=pago.estado,
                    metodo_pago=pago.metodo_pago.nombre,
                    comprobante_disponible=pago.archivo_comprobante is not None,
                )
                for pago in sorted(factura.pagos, key=lambda item: (item.fecha, item.id))
            ],
        )
        for factura, nombre, apellido in filas
    ]
    factura_ids = [factura.id for factura, _, _ in filas]
    if not factura_ids:
        return _cuenta_vacia()

    movimientos = list(
        db.scalars(
            select(Movimiento)
            .where(Movimiento.factura_id.in_(factura_ids))
            .order_by(Movimiento.fecha, Movimiento.id)
        ).all()
    )
    debe = sum(
        (movimiento.monto for movimiento in movimientos if movimiento.tipo == "debe"),
        start=Decimal("0.00"),
    )
    haber = sum(
        (movimiento.monto for movimiento in movimientos if movimiento.tipo == "haber"),
        start=Decimal("0.00"),
    )
    movimientos_read = [
        MovimientoFamiliaRead(
            fecha=movimiento.fecha,
            tipo=movimiento.tipo,
            monto=movimiento.monto,
            observacion=movimiento.observacion,
            factura_id=movimiento.factura_id,
        )
        for movimiento in movimientos
        if movimiento.factura_id is not None
    ]
    return FacturacionFamiliaRead(
        total_debe=debe,
        total_haber=haber,
        saldo=debe - haber,
        facturas=facturas,
        movimientos=movimientos_read,
    )


def obtener_comprobante_pago_familia(
    db: Session, persona_id: uuid.UUID | None, pago_id: uuid.UUID
) -> ArchivoComprobantePago | None:
    """Return a receipt only when its invoice snapshot names the caller's family."""
    if persona_id is None:
        return None

    return db.scalar(
        select(ArchivoComprobantePago)
        .join(Pago, Pago.id == ArchivoComprobantePago.pago_id)
        .join(Factura, Factura.id == Pago.factura_id)
        .join(
            ResponsableEconomico,
            ResponsableEconomico.id == Factura.responsable_economico_id,
        )
        .join(Familia, Familia.id == ResponsableEconomico.familia_id)
        .where(
            ArchivoComprobantePago.pago_id == pago_id,
            Familia.persona_id == persona_id,
        )
    )
