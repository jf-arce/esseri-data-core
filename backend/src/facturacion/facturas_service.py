"""Lógica de generación y administración de facturas por alumno."""

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.facturacion.exceptions import (
    ConceptoCobroInvalido,
    FacturaEnUso,
    FacturaNoEditable,
    FacturaNoEncontrada,
    FechaVencimientoInvalida,
    InscripcionNoFacturable,
    MontoFacturaInvalido,
    ResponsableEconomicoNoVigente,
)
from src.facturacion.models import (
    ConceptoCobro,
    DetalleFactura,
    Factura,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate, FacturaUpdate
from src.inscripciones.models import Inscripcion


def _validar_conceptos_activos(db: Session, detalles: list[DetalleFacturaCreate]) -> None:
    concepto_ids = {detalle.concepto_cobro_id for detalle in detalles}
    encontrados = set(
        db.scalars(
            select(ConceptoCobro.id).where(
                ConceptoCobro.id.in_(concepto_ids), ConceptoCobro.activo.is_(True)
            )
        ).all()
    )
    if encontrados != concepto_ids:
        raise ConceptoCobroInvalido()


def _obtener_responsable_en_fecha(
    db: Session, alumno_id: uuid.UUID, fecha_emision: date
) -> ResponsableEconomico:
    responsable = db.scalar(
        select(ResponsableEconomico)
        .where(
            ResponsableEconomico.alumno_id == alumno_id,
            ResponsableEconomico.vigencia_desde <= fecha_emision,
            or_(
                ResponsableEconomico.vigencia_hasta.is_(None),
                ResponsableEconomico.vigencia_hasta >= fecha_emision,
            ),
        )
        .order_by(ResponsableEconomico.vigencia_desde.desc())
    )
    if responsable is None:
        raise ResponsableEconomicoNoVigente()
    return responsable


def _armar_detalles(detalles: list[DetalleFacturaCreate]) -> list[DetalleFactura]:
    return [DetalleFactura(**detalle.model_dump()) for detalle in detalles]


def _calcular_total(detalles: list[DetalleFacturaCreate]) -> Decimal:
    total = sum((detalle.monto for detalle in detalles), start=Decimal("0.00"))
    if total > Decimal("9999999999.99"):
        raise MontoFacturaInvalido()
    return total


def crear_factura(db: Session, datos: FacturaCreate) -> Factura:
    inscripcion = db.get(Inscripcion, datos.inscripcion_id)
    if inscripcion is None or inscripcion.estado != "activa":
        raise InscripcionNoFacturable()

    _validar_conceptos_activos(db, datos.detalles)
    responsable = _obtener_responsable_en_fecha(db, inscripcion.alumno_id, datos.fecha_emision)
    factura = Factura(
        fecha_emision=datos.fecha_emision,
        fecha_vencimiento=datos.fecha_vencimiento,
        monto_total=_calcular_total(datos.detalles),
        estado="pendiente",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
        detalles=_armar_detalles(datos.detalles),
    )
    db.add(factura)
    db.commit()
    creada = obtener_factura(db, factura.id)
    if creada is None:
        raise FacturaNoEncontrada()
    return creada


def obtener_factura(db: Session, factura_id: uuid.UUID) -> Factura | None:
    return db.scalar(
        select(Factura).options(selectinload(Factura.detalles)).where(Factura.id == factura_id)
    )


def listar_facturas(
    db: Session,
    *,
    pagina: int,
    tamanio: int,
    alumno_id: uuid.UUID | None = None,
    estado: str | None = None,
) -> tuple[list[Factura], int]:
    filtros = []
    consulta = select(Factura)
    consulta_total = select(func.count(Factura.id))
    if alumno_id is not None:
        consulta = consulta.join(Inscripcion)
        consulta_total = consulta_total.join(Inscripcion)
        filtros.append(Inscripcion.alumno_id == alumno_id)
    if estado is not None:
        filtros.append(Factura.estado == estado)
    if filtros:
        consulta = consulta.where(*filtros)
        consulta_total = consulta_total.where(*filtros)

    total = db.scalar(consulta_total) or 0
    facturas = list(
        db.scalars(
            consulta.options(selectinload(Factura.detalles))
            .order_by(Factura.fecha_emision.desc(), Factura.id)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        ).all()
    )
    return facturas, total


def actualizar_factura(db: Session, factura: Factura, datos: FacturaUpdate) -> Factura:
    tiene_pagos = db.scalar(select(Pago.id).where(Pago.factura_id == factura.id).limit(1))
    if factura.estado != "pendiente" or tiene_pagos is not None:
        raise FacturaNoEditable()

    if datos.fecha_vencimiento is not None:
        if datos.fecha_vencimiento < factura.fecha_emision:
            raise FechaVencimientoInvalida()
        factura.fecha_vencimiento = datos.fecha_vencimiento
    if datos.detalles is not None:
        _validar_conceptos_activos(db, datos.detalles)
        factura.detalles = _armar_detalles(datos.detalles)
        factura.monto_total = _calcular_total(datos.detalles)

    db.commit()
    actualizada = obtener_factura(db, factura.id)
    if actualizada is None:
        raise FacturaNoEncontrada()
    return actualizada


def eliminar_factura(db: Session, factura: Factura) -> None:
    tiene_referencias = any(
        db.scalar(select(modelo.id).where(columna == factura.id).limit(1)) is not None
        for modelo, columna in (
            (Pago, Pago.factura_id),
            (Movimiento, Movimiento.factura_id),
        )
    )
    if factura.estado != "pendiente" or tiene_referencias:
        raise FacturaEnUso()
    db.delete(factura)
    db.commit()
