"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

La deuda es transitoria: se obtiene de facturas menos pagos aprobados. Cuando se implemente
#83, este cálculo debe migrar al saldo derivado de ``CuentaCorriente``/``Movimiento``.
"""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.facturacion.models import Factura, Pago
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia
from src.proveedores_compras.models import SolicitudCompra


def obtener_indicadores_direccion(
    db: Session, *, fecha_hoy: date | None = None
) -> dict[str, int | Decimal]:
    """Obtiene los cuatro indicadores del Panel de Dirección.

    La subconsulta de pagos evita multiplicar el total de una factura cuando tiene pagos
    parciales. Solo los pagos aprobados disminuyen la deuda provisoria.
    """
    pagos_aprobados = (
        select(func.coalesce(func.sum(Pago.monto), Decimal("0.00")))
        .where(Pago.estado == "aprobado")
        .scalar_subquery()
    )
    total_facturado = select(
        func.coalesce(func.sum(Factura.monto_total), Decimal("0.00"))
    ).scalar_subquery()

    deuda_pendiente_total = db.scalar(select(total_facturado - pagos_aprobados)) or Decimal("0.00")
    alumnos_activos = db.scalar(select(func.count(Alumno.id)).where(Alumno.estado == "activo")) or 0
    inasistencias_hoy = (
        db.scalar(
            select(func.count(Asistencia.id)).where(
                Asistencia.fecha == (fecha_hoy or date.today()),
                Asistencia.tipo.like("ausente%"),
            )
        )
        or 0
    )
    solicitudes_compra_pendientes = (
        db.scalar(
            select(func.count(SolicitudCompra.id)).where(SolicitudCompra.estado == "pendiente")
        )
        or 0
    )

    return {
        "alumnos_activos": alumnos_activos,
        "deuda_pendiente_total": deuda_pendiente_total,
        "inasistencias_hoy": inasistencias_hoy,
        "solicitudes_compra_pendientes": solicitudes_compra_pendientes,
    }
