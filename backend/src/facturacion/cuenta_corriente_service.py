"""Libro inmutable de cargos y pagos por alumno."""

import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

from src.facturacion.models import (
    ConceptoCobro,
    CuentaCorriente,
    Factura,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Inscripcion
from src.models import Persona

ZONA_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")


def _instante_operativo(fecha: date | datetime) -> datetime:
    if isinstance(fecha, datetime):
        return fecha if fecha.tzinfo is not None else fecha.replace(tzinfo=UTC)
    return datetime.combine(fecha, time.min, tzinfo=ZONA_ARGENTINA).astimezone(UTC)


def _alumno_id_de_factura(db: Session, factura_id: uuid.UUID) -> uuid.UUID:
    alumno_id = db.scalar(
        select(Inscripcion.alumno_id)
        .join(Factura, Factura.inscripcion_id == Inscripcion.id)
        .where(Factura.id == factura_id)
    )
    if alumno_id is None:
        raise ValueError("La factura no tiene una inscripción y un alumno asociados.")
    return alumno_id


def obtener_o_crear_cuenta_en_transaccion(db: Session, alumno_id: uuid.UUID) -> CuentaCorriente:
    """Obtiene la cuenta del alumno o la prepara sin confirmar la transacción."""

    cuenta = db.scalar(select(CuentaCorriente).where(CuentaCorriente.alumno_id == alumno_id))
    if cuenta is None:
        cuenta = CuentaCorriente(alumno_id=alumno_id)
        db.add(cuenta)
        db.flush()
    return cuenta


def registrar_cargos_factura_en_transaccion(db: Session, factura: Factura) -> None:
    """Registra una sola vez cada detalle emitido como un movimiento de debe."""

    alumno_id = _alumno_id_de_factura(db, factura.id)
    cuenta = obtener_o_crear_cuenta_en_transaccion(db, alumno_id)
    detalle_ids = [detalle.id for detalle in factura.detalles]
    registrados = set(
        db.scalars(
            select(Movimiento.detalle_factura_id).where(
                Movimiento.detalle_factura_id.in_(detalle_ids)
            )
        ).all()
    )
    fecha = _instante_operativo(factura.fecha_emision)
    db.add_all(
        [
            Movimiento(
                fecha=fecha,
                tipo="debe",
                monto=detalle.monto,
                observacion=detalle.descripcion,
                cuenta_corriente_id=cuenta.id,
                concepto_cobro_id=detalle.concepto_cobro_id,
                factura_id=factura.id,
                detalle_factura_id=detalle.id,
            )
            for detalle in factura.detalles
            if detalle.id not in registrados
        ]
    )
    db.flush()


def registrar_pago_en_transaccion(db: Session, pago: Pago) -> None:
    """Imputa una sola vez un pago aprobado como movimiento de haber."""

    if pago.estado != "aprobado":
        return
    existente = db.scalar(select(Movimiento.id).where(Movimiento.pago_id == pago.id).limit(1))
    if existente is not None:
        return
    alumno_id = _alumno_id_de_factura(db, pago.factura_id)
    cuenta = obtener_o_crear_cuenta_en_transaccion(db, alumno_id)
    fecha = pago.fecha_operacion or _instante_operativo(pago.fecha)
    db.add(
        Movimiento(
            fecha=fecha,
            tipo="haber",
            monto=pago.monto,
            observacion="Pago aprobado",
            cuenta_corriente_id=cuenta.id,
            factura_id=pago.factura_id,
            pago_id=pago.id,
        )
    )
    db.flush()


def obtener_resumen_cuenta(
    db: Session, alumno_id: uuid.UUID
) -> tuple[CuentaCorriente | None, Decimal, Decimal, Decimal]:
    cuenta = db.scalar(select(CuentaCorriente).where(CuentaCorriente.alumno_id == alumno_id))
    if cuenta is None:
        cero = Decimal("0.00")
        return None, cero, cero, cero

    total_debe, total_haber = db.execute(
        select(
            func.coalesce(func.sum(Movimiento.monto).filter(Movimiento.tipo == "debe"), 0),
            func.coalesce(func.sum(Movimiento.monto).filter(Movimiento.tipo == "haber"), 0),
        ).where(Movimiento.cuenta_corriente_id == cuenta.id)
    ).one()
    debe = Decimal(total_debe)
    haber = Decimal(total_haber)
    return cuenta, debe, haber, debe - haber


def listar_movimientos(
    db: Session,
    cuenta_id: uuid.UUID,
    *,
    pagina: int,
    tamanio: int,
) -> tuple[list[Movimiento], int]:
    total = (
        db.scalar(
            select(func.count(Movimiento.id)).where(Movimiento.cuenta_corriente_id == cuenta_id)
        )
        or 0
    )
    movimientos = list(
        db.scalars(
            select(Movimiento)
            .where(Movimiento.cuenta_corriente_id == cuenta_id)
            .order_by(Movimiento.fecha.desc(), Movimiento.id.desc())
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        ).all()
    )
    conceptos = {
        concepto.id: concepto.nombre
        for concepto in db.scalars(
            select(ConceptoCobro).where(
                ConceptoCobro.id.in_(
                    {
                        movimiento.concepto_cobro_id
                        for movimiento in movimientos
                        if movimiento.concepto_cobro_id is not None
                    }
                )
            )
        ).all()
    }
    for movimiento in movimientos:
        movimiento.concepto_nombre = conceptos.get(movimiento.concepto_cobro_id)
    return movimientos, total


def listar_deuda_por_familia(
    db: Session,
    *,
    fecha_referencia: date,
    pagina: int,
    tamanio: int,
    estado: str | None = None,
    buscar: str | None = None,
) -> tuple[list[dict[str, object]], int]:
    """Agrupa saldos por responsable económico usando solo movimientos contables."""

    debe = func.coalesce(
        func.sum(Movimiento.monto).filter(Movimiento.tipo == "debe"), Decimal("0.00")
    )
    haber = func.coalesce(
        func.sum(Movimiento.monto).filter(Movimiento.tipo == "haber"), Decimal("0.00")
    )
    por_factura = (
        select(
            Factura.id.label("factura_id"),
            Factura.fecha_vencimiento.label("fecha_vencimiento"),
            ResponsableEconomico.familia_id.label("familia_id"),
            Familia.persona_id.label("persona_id"),
            debe.label("total_debe"),
            haber.label("total_haber"),
        )
        .select_from(Factura)
        .join(
            ResponsableEconomico,
            ResponsableEconomico.id == Factura.responsable_economico_id,
        )
        .join(Familia, Familia.id == ResponsableEconomico.familia_id)
        .outerjoin(Movimiento, Movimiento.factura_id == Factura.id)
        .group_by(
            Factura.id,
            Factura.fecha_vencimiento,
            ResponsableEconomico.familia_id,
            Familia.persona_id,
        )
        .subquery()
    )
    saldo_factura = por_factura.c.total_debe - por_factura.c.total_haber
    monto_pendiente = func.coalesce(
        func.sum(
            case(
                (
                    and_(saldo_factura > 0, por_factura.c.fecha_vencimiento >= fecha_referencia),
                    saldo_factura,
                ),
                else_=Decimal("0.00"),
            )
        ),
        Decimal("0.00"),
    )
    monto_vencido = func.coalesce(
        func.sum(
            case(
                (
                    and_(saldo_factura > 0, por_factura.c.fecha_vencimiento < fecha_referencia),
                    saldo_factura,
                ),
                else_=Decimal("0.00"),
            )
        ),
        Decimal("0.00"),
    )
    monto_pagado = func.coalesce(func.sum(por_factura.c.total_haber), Decimal("0.00"))
    deuda_total = monto_pendiente + monto_vencido
    facturas_pendientes = func.coalesce(func.sum(case((saldo_factura > 0, 1), else_=0)), 0)
    facturas_pagadas = func.coalesce(func.sum(case((saldo_factura <= 0, 1), else_=0)), 0)
    resumen = (
        select(
            por_factura.c.familia_id,
            Persona.nombre.label("familia_nombre"),
            Persona.apellido.label("familia_apellido"),
            Persona.dni.label("familia_dni"),
            monto_pendiente.label("monto_pendiente"),
            monto_vencido.label("monto_vencido"),
            monto_pagado.label("monto_pagado"),
            deuda_total.label("deuda_total"),
            facturas_pendientes.label("facturas_pendientes"),
            facturas_pagadas.label("facturas_pagadas"),
        )
        .join(Persona, Persona.id == por_factura.c.persona_id)
        .group_by(
            por_factura.c.familia_id,
            Persona.nombre,
            Persona.apellido,
            Persona.dni,
        )
        .subquery()
    )
    estado_calculado = case(
        (resumen.c.monto_vencido > 0, "vencida"),
        (resumen.c.deuda_total > 0, "pendiente"),
        else_="pagada",
    )
    consulta = select(resumen, estado_calculado.label("estado"))
    filtros = []
    if estado is not None:
        filtros.append(estado_calculado == estado)
    if buscar:
        termino = f"%{buscar.strip()}%"
        filtros.append(
            or_(
                resumen.c.familia_nombre.ilike(termino),
                resumen.c.familia_apellido.ilike(termino),
                resumen.c.familia_dni.ilike(termino),
            )
        )
    if filtros:
        consulta = consulta.where(*filtros)
    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
    filas = db.execute(
        consulta.order_by(resumen.c.monto_vencido.desc(), resumen.c.deuda_total.desc())
        .offset((pagina - 1) * tamanio)
        .limit(tamanio)
    ).mappings()
    return [dict(fila) for fila in filas], total
