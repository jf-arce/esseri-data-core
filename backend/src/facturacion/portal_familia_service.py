"""Read-only billing views scoped to the family captured as each invoice's economic responsible."""

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.facturacion.models import (
    ArchivoComprobantePago,
    DebitoCobranza,
    ExcepcionVencimiento,
    Factura,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.schemas import (
    AvisoDebitoFamiliaRead,
    DetalleFacturaFamiliaRead,
    FacturacionFamiliaRead,
    FacturaFamiliaRead,
    MovimientoFamiliaRead,
    PagoFamiliaRead,
    ResultadoDebitoFamiliaRead,
)
from src.facturacion.vencimientos_service import fecha_vencimiento_efectiva
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Inscripcion
from src.models import EventLog, Persona
from src.workflows.models import Notificacion, TipoEvento, WorkflowExecution


def _avisos_debito(db: Session, familia_id: uuid.UUID) -> list[AvisoDebitoFamiliaRead]:
    """Project durable workflow snapshots, not email delivery, into the billing view.

    Multiple addresses and send attempts share a single notice per result and family.
    The persisted invoice responsible is rechecked; payload IDs never authorize a read.
    """
    filas = db.execute(
        select(Notificacion, WorkflowExecution, EventLog, DebitoCobranza)
        .join(WorkflowExecution, WorkflowExecution.id == Notificacion.workflow_execution_id)
        .join(EventLog, EventLog.id == WorkflowExecution.event_log_id)
        .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
        .join(DebitoCobranza, DebitoCobranza.id == EventLog.entidad_id)
        .join(Factura, Factura.id == DebitoCobranza.factura_id)
        .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
        .where(
            TipoEvento.nombre == "debito.resultado_registrado",
            EventLog.entidad == "debito_cobranza",
            ResponsableEconomico.familia_id == familia_id,
            Notificacion.familia_id == familia_id,
        )
        .order_by(EventLog.timestamp.desc(), Notificacion.started_at, Notificacion.id)
    ).all()
    avisos: dict[uuid.UUID, AvisoDebitoFamiliaRead] = {}
    for notificacion, ejecucion, evento, debito in filas:
        if evento.id in avisos:
            continue
        datos = evento.payload or {}
        resultado = datos.get("resultado")
        if resultado not in ("exitoso", "rechazado"):
            resultado = "exitoso" if debito.pago_id is not None else "rechazado"
        avisos[evento.id] = AvisoDebitoFamiliaRead(
            evento_id=evento.id,
            ejecucion_id=ejecucion.id,
            regla_id=ejecucion.workflow_rule_id,
            debito_id=debito.id,
            factura_id=debito.factura_id,
            numero_factura=str(datos.get("numero_factura") or debito.factura_id),
            lote_id=debito.lote_id,
            fecha=evento.timestamp,
            resultado=resultado,
            importe=debito.importe,
            codigo_resultado=str(datos.get("codigo_resultado") or ""),
            motivo_rechazo=str(datos.get("motivo_rechazo") or ""),
            asunto=notificacion.asunto_snapshot,
            cuerpo=notificacion.cuerpo_snapshot,
        )
    return list(avisos.values())


def _ultimos_resultados_debito(
    db: Session, factura_ids: list[uuid.UUID]
) -> dict[uuid.UUID, ResultadoDebitoFamiliaRead]:
    """Project confirmed results only for invoices already scoped to the calling family."""
    filas = db.execute(
        select(
            DebitoCobranza.factura_id, DebitoCobranza.importe, EventLog.timestamp, EventLog.payload
        )
        .select_from(DebitoCobranza)
        .join(EventLog, EventLog.entidad_id == DebitoCobranza.id)
        .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
        .where(
            DebitoCobranza.factura_id.in_(factura_ids),
            EventLog.entidad == "debito_cobranza",
            TipoEvento.nombre == "debito.resultado_registrado",
        )
        .order_by(EventLog.timestamp.desc(), EventLog.id.desc())
    )
    resultados = {}
    for factura_id, importe, fecha, payload in filas:
        datos = payload or {}
        resultado = datos.get("resultado")
        if factura_id in resultados or resultado not in ("exitoso", "rechazado"):
            continue
        resultados[factura_id] = ResultadoDebitoFamiliaRead(
            resultado=resultado,
            fecha=fecha,
            importe=importe,
            numero_factura=str(datos.get("numero_factura") or f"#{str(factura_id)[:8]}"),
            motivo_rechazo=str(datos.get("motivo_rechazo") or "")
            if resultado == "rechazado"
            else "",
        )
    return resultados


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
        select(Factura, Alumno.id, Persona.nombre, Persona.apellido)
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

    factura_ids = [factura.id for factura, _, _, _ in filas]
    if not factura_ids:
        return _cuenta_vacia()
    resultados = _ultimos_resultados_debito(db, factura_ids)

    excepciones = list(
        db.scalars(
            select(ExcepcionVencimiento).where(
                ExcepcionVencimiento.familia_id == familia_id,
                ExcepcionVencimiento.anulada_at.is_(None),
            )
        ).all()
    )

    facturas = [
        FacturaFamiliaRead(
            id=factura.id,
            alumno_id=alumno_id,
            fecha_emision=factura.fecha_emision,
            fecha_vencimiento=factura.fecha_vencimiento,
            fecha_vencimiento_efectiva=fecha_vencimiento_efectiva(factura, excepciones),
            monto_total=factura.monto_total,
            estado=factura.estado,
            alumno_nombre=f"{nombre} {apellido}",
            ultimo_resultado_debito=resultados.get(factura.id),
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
        for factura, alumno_id, nombre, apellido in filas
    ]
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
        avisos_debito=_avisos_debito(db, familia_id),
    )


def obtener_factura_familia(
    db: Session, persona_id: uuid.UUID | None, factura_id: uuid.UUID
) -> Factura | None:
    """Return only invoices assigned to the authenticated economic-responsible family."""
    if persona_id is None:
        return None
    return db.scalar(
        select(Factura)
        .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
        .join(Familia, Familia.id == ResponsableEconomico.familia_id)
        .where(Factura.id == factura_id, Familia.persona_id == persona_id)
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
