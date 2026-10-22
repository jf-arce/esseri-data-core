"""Motor de penalidades por tramos de mora (`REGLA_PENALIDAD`)."""

import uuid
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.facturacion.models import Factura, Movimiento, ReglaPenalidad

CENTAVO = Decimal("0.01")


def resolver_tramo(db: Session, dias_vencido: int) -> ReglaPenalidad | None:
    """Tramo activo de mayor `desde_dia_vencido` que alcanzó el atraso.

    Pasado el último tramo la deuda conserva su penalidad ("continúa como deuda vencida con las
    penalidades correspondientes", respuesta 5 del cliente), igual que en `vencimientos_service`.
    """
    return db.scalar(
        select(ReglaPenalidad)
        .where(ReglaPenalidad.activo.is_(True), ReglaPenalidad.desde_dia_vencido <= dias_vencido)
        .order_by(ReglaPenalidad.desde_dia_vencido.desc())
        .limit(1)
    )


def penalidades_registradas(db: Session, factura_id: uuid.UUID) -> Decimal:
    """Penalidades ya imputadas a la factura: debe sin detalle, con un concepto de penalidad."""
    return db.scalar(
        select(func.coalesce(func.sum(Movimiento.monto), Decimal("0.00"))).where(
            Movimiento.factura_id == factura_id,
            Movimiento.tipo == "debe",
            Movimiento.detalle_factura_id.is_(None),
            Movimiento.concepto_cobro_id.in_(select(ReglaPenalidad.concepto_cobro_id)),
        )
    ) or Decimal("0.00")


def calcular_penalidad(db: Session, factura: Factura, regla: ReglaPenalidad) -> Decimal:
    """Lo que falta cobrar para que la penalidad de la factura sea el porcentaje del tramo.

    Los tramos no se suman: con 16–30 días la penalidad total es el 30 % del monto de la factura,
    no 20 % + 30 %. Restar lo ya registrado vuelve idempotente el cálculo.
    """
    objetivo = (Decimal(factura.monto_total) * Decimal(regla.porcentaje) / 100).quantize(
        CENTAVO, ROUND_HALF_UP
    )
    return max(objetivo - penalidades_registradas(db, factura.id), Decimal("0.00"))
