"""Avisos internos de Facturación y Pagos."""

import uuid
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.facturacion.models import ExcepcionVencimiento, Factura, Pago, ResponsableEconomico
from src.inscripciones.models import Inscripcion
from src.notificaciones import service as notificaciones_service
from src.notificaciones.constants import (
    AMBITO_FACTURACION,
    DESTINO_FACTURA,
    DESTINO_PAGO,
    TIPO_FACTURA_EMITIDA,
    TIPO_PAGO_REGISTRADO,
    TIPO_PROXIMO_VENCIMIENTO,
)
from src.notificaciones.destinatarios import cuentas_de_familia

DIAS_AVISO_VENCIMIENTO = 3


def _monto(valor: Decimal) -> str:
    return f"{valor:.2f}"


def _fecha(valor: date) -> str:
    return valor.strftime("%d/%m/%Y")


def _datos_factura(db: Session, factura_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID] | None:
    fila = db.execute(
        select(Inscripcion.alumno_id, ResponsableEconomico.familia_id)
        .select_from(Factura)
        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
        .join(
            ResponsableEconomico,
            ResponsableEconomico.id == Factura.responsable_economico_id,
        )
        .where(Factura.id == factura_id)
    ).first()
    return (fila.alumno_id, fila.familia_id) if fila is not None else None


def _datos_pago(db: Session, pago_id: uuid.UUID) -> tuple[uuid.UUID, uuid.UUID] | None:
    fila = db.execute(
        select(Inscripcion.alumno_id, ResponsableEconomico.familia_id)
        .select_from(Pago)
        .join(Factura, Factura.id == Pago.factura_id)
        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
        .join(
            ResponsableEconomico,
            ResponsableEconomico.id == Factura.responsable_economico_id,
        )
        .where(Pago.id == pago_id)
    ).first()
    return (fila.alumno_id, fila.familia_id) if fila is not None else None


def registrar_factura_emitida(db: Session, factura: Factura) -> int:
    """Avisa la emisión a cada cuenta de la familia responsable económica."""
    datos = _datos_factura(db, factura.id)
    if datos is None:
        return 0
    alumno_id, familia_id = datos
    monto = _monto(factura.monto_total)
    insertadas = 0
    for usuario_id in cuentas_de_familia(db, familia_id):
        insertadas += int(
            notificaciones_service.publicar(
                db,
                usuario_id=usuario_id,
                familia_id=familia_id,
                alumno_id=alumno_id,
                ambito=AMBITO_FACTURACION,
                clave_hecho=f"facturacion:factura_emitida:{factura.id}",
                tipo=TIPO_FACTURA_EMITIDA,
                titulo="Nueva factura emitida",
                mensaje=(
                    f"Se emitió una factura de $ {monto} con vencimiento "
                    f"{_fecha(factura.fecha_vencimiento)}."
                ),
                contexto={
                    "familia_id": str(familia_id),
                    "alumno_id": str(alumno_id),
                    "factura_id": str(factura.id),
                    "fecha_emision": factura.fecha_emision.isoformat(),
                    "fecha_vencimiento": factura.fecha_vencimiento.isoformat(),
                    "monto_total": monto,
                },
                destino_tipo=DESTINO_FACTURA,
                destino_id=factura.id,
            )
        )
    return insertadas


def registrar_pago_aprobado(db: Session, pago: Pago) -> int:
    """Avisa un pago aprobado por Administración, sin afirmar acreditación bancaria."""
    datos = _datos_pago(db, pago.id)
    if datos is None:
        return 0
    alumno_id, familia_id = datos
    monto = _monto(pago.monto)
    insertadas = 0
    for usuario_id in cuentas_de_familia(db, familia_id):
        insertadas += int(
            notificaciones_service.publicar(
                db,
                usuario_id=usuario_id,
                familia_id=familia_id,
                alumno_id=alumno_id,
                ambito=AMBITO_FACTURACION,
                clave_hecho=f"facturacion:pago_registrado:{pago.id}",
                tipo=TIPO_PAGO_REGISTRADO,
                titulo="Pago registrado",
                mensaje=(
                    f"Se registró un pago de $ {monto} para la factura del "
                    f"{_fecha(pago.fecha)}. Fue aprobado por Administración."
                ),
                contexto={
                    "familia_id": str(familia_id),
                    "alumno_id": str(alumno_id),
                    "pago_id": str(pago.id),
                    "factura_id": str(pago.factura_id),
                    "monto": monto,
                    "fecha": pago.fecha.isoformat(),
                },
                destino_tipo=DESTINO_PAGO,
                destino_id=pago.id,
            )
        )
    return insertadas


def detectar_proximos_vencimientos(db: Session, hoy: date) -> int:
    """Un recordatorio por factura y cuenta dentro de la ventana de tres días.

    No modifica la factura ni emite eventos. Una prórroga posterior no genera otro recordatorio:
    la clave lógica es la factura, y el aviso ya creado conserva la fecha que se informó.
    """
    hasta = hoy + timedelta(days=DIAS_AVISO_VENCIMIENTO)
    facturas = list(
        db.scalars(
            select(Factura).where(
                Factura.estado != "pagada",
                Factura.fecha_vencimiento <= hasta,
            )
        ).all()
    )
    if not facturas:
        return 0

    datos_por_factura = {
        factura_id: (alumno_id, familia_id)
        for factura_id, alumno_id, familia_id in db.execute(
            select(Factura.id, Inscripcion.alumno_id, ResponsableEconomico.familia_id)
            .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
            .join(
                ResponsableEconomico,
                ResponsableEconomico.id == Factura.responsable_economico_id,
            )
            .where(Factura.id.in_([factura.id for factura in facturas]))
        ).all()
    }
    familia_ids = {familia_id for _, familia_id in datos_por_factura.values()}
    excepciones: dict[uuid.UUID, list[ExcepcionVencimiento]] = defaultdict(list)
    for excepcion in db.scalars(
        select(ExcepcionVencimiento).where(
            ExcepcionVencimiento.familia_id.in_(familia_ids),
            ExcepcionVencimiento.anulada_at.is_(None),
        )
    ).all():
        excepciones[excepcion.familia_id].append(excepcion)

    from src.facturacion.facturas_service import total_pagado_factura
    from src.facturacion.vencimientos_service import fecha_vencimiento_efectiva

    insertadas = 0
    for factura in facturas:
        datos = datos_por_factura.get(factura.id)
        if datos is None:
            continue
        alumno_id, familia_id = datos
        efectiva = fecha_vencimiento_efectiva(factura, excepciones.get(familia_id, []))
        if efectiva < hoy or efectiva > hasta:
            continue
        saldo = factura.monto_total - total_pagado_factura(db, factura.id)
        if saldo <= Decimal("0.00"):
            continue
        monto = _monto(saldo)
        for usuario_id in cuentas_de_familia(db, familia_id):
            insertadas += int(
                notificaciones_service.publicar(
                    db,
                    usuario_id=usuario_id,
                    familia_id=familia_id,
                    alumno_id=alumno_id,
                    ambito=AMBITO_FACTURACION,
                    clave_hecho=f"facturacion:proximo_vencimiento:{factura.id}",
                    tipo=TIPO_PROXIMO_VENCIMIENTO,
                    titulo="Factura próxima a vencer",
                    mensaje=(
                        f"La factura vence el {_fecha(efectiva)}. Saldo pendiente: $ {monto}."
                    ),
                    contexto={
                        "familia_id": str(familia_id),
                        "alumno_id": str(alumno_id),
                        "factura_id": str(factura.id),
                        "fecha_vencimiento": efectiva.isoformat(),
                        "monto_pendiente": monto,
                    },
                    destino_tipo=DESTINO_FACTURA,
                    destino_id=factura.id,
                )
            )
    return insertadas
