"""Detección de facturas vencidas y emisión de `factura.vencida` (una vez por tramo de mora)."""

import uuid
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.facturas_service import total_pagado_factura
from src.facturacion.models import (
    ExcepcionVencimiento,
    Factura,
    ReglaPenalidad,
    ResponsableEconomico,
)
from src.facturacion.schemas import ResumenVencimientos
from src.familias_alumnos.models import Familia
from src.models import EventLog
from src.workflows.eventos_service import emit_event
from src.workflows.models import TipoEvento

EVENTO_FACTURA_VENCIDA = "factura.vencida"


def _fecha_efectiva(factura: Factura, excepciones: list[ExcepcionVencimiento]) -> date:
    """Vencimiento corrido por la excepción más tardía del mismo mes, si la hay."""

    original = factura.fecha_vencimiento
    del_mes = [
        e.fecha_vencimiento_excepcional
        for e in excepciones
        if e.fecha_vencimiento_excepcional >= original
        and (e.fecha_vencimiento_excepcional.year, e.fecha_vencimiento_excepcional.month)
        == (original.year, original.month)
    ]
    return max(del_mes, default=original)


def _tramo_aplicable(tramos_desde: list[int], dias_vencido: int) -> int | None:
    candidatos = [desde for desde in tramos_desde if desde <= dias_vencido]
    return max(candidatos, default=None)


def _tramos_ya_emitidos(db: Session, factura_ids: list[uuid.UUID]) -> dict[uuid.UUID, set[int]]:
    eventos = db.execute(
        select(EventLog.entidad_id, EventLog.payload)
        .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
        .where(TipoEvento.nombre == EVENTO_FACTURA_VENCIDA, EventLog.entidad_id.in_(factura_ids))
    ).all()
    emitidos: dict[uuid.UUID, set[int]] = defaultdict(set)
    for entidad_id, payload in eventos:
        tramo = (payload or {}).get("tramo_desde_dia")
        if isinstance(tramo, int):
            emitidos[entidad_id].add(tramo)
    return emitidos


def detectar_facturas_vencidas(
    db: Session, fecha_actual: date | None = None
) -> ResumenVencimientos:
    """Emite `factura.vencida` por cada factura impaga que entró en un tramo de mora nuevo."""

    hoy = fecha_actual or fecha_operativa_argentina()
    facturas = list(
        db.scalars(
            select(Factura).where(Factura.estado != "pagada", Factura.fecha_vencimiento < hoy)
        ).all()
    )
    if not facturas:
        return ResumenVencimientos()

    familia_por_factura = dict(
        db.execute(
            select(Factura.id, ResponsableEconomico.familia_id)
            .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
            .where(Factura.id.in_([factura.id for factura in facturas]))
        ).all()
    )
    familia_ids = set(familia_por_factura.values())
    excepciones_por_familia: dict[uuid.UUID, list[ExcepcionVencimiento]] = defaultdict(list)
    for excepcion in db.scalars(
        select(ExcepcionVencimiento).where(ExcepcionVencimiento.familia_id.in_(familia_ids))
    ).all():
        excepciones_por_familia[excepcion.familia_id].append(excepcion)
    familias = {
        familia.id: familia
        for familia in db.scalars(select(Familia).where(Familia.id.in_(familia_ids))).all()
    }

    tramos = sorted(
        {
            desde
            for desde in db.scalars(
                select(ReglaPenalidad.desde_dia_vencido).where(ReglaPenalidad.activo.is_(True))
            ).all()
        }
    )
    emitidos = _tramos_ya_emitidos(db, [factura.id for factura in facturas])

    eventos_emitidos = 0
    for factura in facturas:
        familia_id = familia_por_factura.get(factura.id)
        fecha_efectiva = _fecha_efectiva(factura, excepciones_por_familia.get(familia_id, []))
        dias_vencido = (hoy - fecha_efectiva).days
        if dias_vencido <= 0:
            continue
        tramo = _tramo_aplicable(tramos, dias_vencido) if tramos else 0
        if tramo is None or tramo in emitidos[factura.id]:
            continue
        monto_deuda = factura.monto_total - total_pagado_factura(db, factura.id)
        if monto_deuda <= Decimal("0.00"):
            continue
        familia = familias.get(familia_id)
        emit_event(
            db,
            tipo=EVENTO_FACTURA_VENCIDA,
            entidad="factura",
            entidad_id=factura.id,
            payload={
                "dias_vencido": dias_vencido,
                "monto_deuda": monto_deuda,
                "nombre_familia": (
                    f"{familia.persona.apellido}, {familia.persona.nombre}" if familia else ""
                ),
                "tramo_desde_dia": tramo,
                "fecha_vencimiento_efectiva": fecha_efectiva,
            },
        )
        eventos_emitidos += 1

    db.commit()
    return ResumenVencimientos(facturas_revisadas=len(facturas), eventos_emitidos=eventos_emitidos)
