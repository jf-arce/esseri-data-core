"""Lógica de generación y administración de facturas por alumno."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from io import BytesIO

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from src.facturacion.exceptions import (
    ComprobantePagoInvalido,
    ConceptoCobroInvalido,
    FacturaEnUso,
    FacturaNoEditable,
    FacturaNoEncontrada,
    FacturaYaPagada,
    FechaVencimientoInvalida,
    InscripcionNoFacturable,
    MetodoPagoInvalido,
    MontoFacturaInvalido,
    PagoExcedeSaldo,
    ResponsableEconomicoNoVigente,
)
from src.facturacion.models import (
    ArchivoComprobantePago,
    ConceptoCobro,
    DetalleFactura,
    Factura,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate, FacturaUpdate
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Inscripcion

MAX_TAMANIO_COMPROBANTE = 5 * 1024 * 1024
TIPOS_COMPROBANTE_PERMITIDOS = {"application/pdf", "image/jpeg", "image/png"}


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


def construir_factura(
    db: Session, datos: FacturaCreate, responsable: ResponsableEconomico | None = None
) -> Factura:
    """Valida y construye una factura sin persistirla; reutilizable en generación masiva."""
    inscripcion = db.get(Inscripcion, datos.inscripcion_id)
    if inscripcion is None or inscripcion.estado != "activa":
        raise InscripcionNoFacturable()

    _validar_conceptos_activos(db, datos.detalles)
    responsable_vigente = responsable or _obtener_responsable_en_fecha(
        db, inscripcion.alumno_id, datos.fecha_emision
    )
    return Factura(
        fecha_emision=datos.fecha_emision,
        fecha_vencimiento=datos.fecha_vencimiento,
        monto_total=_calcular_total(datos.detalles),
        estado="pendiente",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable_vigente.id,
        detalles=_armar_detalles(datos.detalles),
    )


def crear_factura(db: Session, datos: FacturaCreate) -> Factura:
    factura = construir_factura(db, datos)
    db.add(factura)
    db.commit()
    creada = obtener_factura(db, factura.id)
    if creada is None:
        raise FacturaNoEncontrada()
    return creada


def obtener_factura(db: Session, factura_id: uuid.UUID) -> Factura | None:
    return db.scalar(
        select(Factura)
        .options(
            selectinload(Factura.detalles),
            selectinload(Factura.pagos).selectinload(Pago.metodo_pago),
            selectinload(Factura.pagos).selectinload(Pago.usuario_registro),
            selectinload(Factura.pagos).selectinload(Pago.archivo_comprobante),
        )
        .where(Factura.id == factura_id)
    )


def obtener_alumno_factura(db: Session, factura: Factura) -> Alumno | None:
    return db.scalar(
        select(Alumno)
        .join(Inscripcion, Inscripcion.alumno_id == Alumno.id)
        .where(Inscripcion.id == factura.inscripcion_id)
    )


def obtener_responsable_factura(db: Session, factura: Factura) -> Familia | None:
    return db.scalar(
        select(Familia)
        .join(ResponsableEconomico, ResponsableEconomico.familia_id == Familia.id)
        .where(ResponsableEconomico.id == factura.responsable_economico_id)
    )


def listar_metodos_pago(db: Session) -> list[MetodoPago]:
    return list(
        db.scalars(
            select(MetodoPago).where(MetodoPago.activo.is_(True)).order_by(MetodoPago.nombre)
        ).all()
    )


def _validar_comprobante(
    *, nombre: str | None, tipo_contenido: str | None, contenido: bytes | None, requerido: bool
) -> None:
    if contenido is None:
        if requerido:
            raise ComprobantePagoInvalido("El método de pago seleccionado requiere comprobante.")
        return
    contenido_archivo = contenido or b""
    firmas_validas = {
        "application/pdf": contenido_archivo.startswith(b"%PDF-"),
        "image/jpeg": contenido_archivo.startswith(b"\xff\xd8\xff"),
        "image/png": contenido_archivo.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if (
        not nombre
        or tipo_contenido not in TIPOS_COMPROBANTE_PERMITIDOS
        or not contenido
        or len(contenido) > MAX_TAMANIO_COMPROBANTE
        or not firmas_validas.get(tipo_contenido, False)
    ):
        raise ComprobantePagoInvalido()


def registrar_pago(
    db: Session,
    *,
    factura: Factura,
    usuario_registro_id: uuid.UUID,
    fecha: date,
    monto: Decimal,
    metodo_pago_id: uuid.UUID,
    referencia_transaccion: str | None,
    comprobante_nombre: str | None,
    comprobante_tipo_contenido: str | None,
    comprobante_contenido: bytes | None,
) -> Pago:
    factura_bloqueada = db.scalar(select(Factura).where(Factura.id == factura.id).with_for_update())
    if factura_bloqueada is None:
        raise FacturaNoEncontrada()
    factura = factura_bloqueada
    if factura.estado == "pagada":
        raise FacturaYaPagada()

    metodo_pago = db.scalar(
        select(MetodoPago).where(MetodoPago.id == metodo_pago_id, MetodoPago.activo.is_(True))
    )
    if metodo_pago is None:
        raise MetodoPagoInvalido()
    _validar_comprobante(
        nombre=comprobante_nombre,
        tipo_contenido=comprobante_tipo_contenido,
        contenido=comprobante_contenido,
        requerido=metodo_pago.requiere_comprobante,
    )

    total_pagado = db.scalar(
        select(func.coalesce(func.sum(Pago.monto), Decimal("0.00"))).where(
            Pago.factura_id == factura.id, Pago.estado == "aprobado"
        )
    ) or Decimal("0.00")
    if monto > factura.monto_total - total_pagado:
        raise PagoExcedeSaldo()

    pago = Pago(
        fecha=fecha,
        monto=monto,
        comprobante=comprobante_nombre,
        estado="aprobado",
        referencia_transaccion=referencia_transaccion.strip() if referencia_transaccion else None,
        fecha_operacion=datetime.now(),
        factura_id=factura.id,
        metodo_pago_id=metodo_pago.id,
        usuario_registro_id=usuario_registro_id,
    )
    if comprobante_contenido is not None:
        pago.archivo_comprobante = ArchivoComprobantePago(
            nombre=comprobante_nombre or "comprobante",
            tipo_contenido=comprobante_tipo_contenido or "application/octet-stream",
            tamanio=len(comprobante_contenido),
            contenido=comprobante_contenido,
        )
    db.add(pago)
    db.flush()
    if total_pagado + monto == factura.monto_total:
        factura.estado = "pagada"
    db.commit()
    db.refresh(pago)
    return pago


def obtener_comprobante_pago(db: Session, pago_id: uuid.UUID) -> ArchivoComprobantePago | None:
    return db.scalar(
        select(ArchivoComprobantePago).where(ArchivoComprobantePago.pago_id == pago_id)
    )


def generar_pdf_factura(factura: Factura, alumno: Alumno) -> bytes:
    """Genera el comprobante de consulta; la factura fuente no se modifica."""
    from reportlab.lib.colors import HexColor
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen.canvas import Canvas

    buffer = BytesIO()
    pdf = Canvas(buffer, pagesize=A4)
    ancho, alto = A4
    margen = 20 * mm
    violeta = HexColor("#7E22B5")
    texto = HexColor("#1F1A2B")
    secundario = HexColor("#766D83")

    pdf.setFillColor(violeta)
    pdf.rect(0, alto - 30 * mm, ancho, 30 * mm, fill=1, stroke=0)
    pdf.setFillColor(HexColor("#FFFFFF"))
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(margen, alto - 18 * mm, "ESSERI")
    pdf.setFont("Helvetica", 10)
    pdf.drawRightString(ancho - margen, alto - 18 * mm, f"Factura #{str(factura.id)[:8]}")

    y = alto - 48 * mm
    pdf.setFillColor(texto)
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(margen, y, "Detalle de factura")
    y -= 10 * mm
    pdf.setFont("Helvetica", 10)
    datos = (
        ("Alumno", f"{alumno.persona.apellido}, {alumno.persona.nombre}"),
        ("Legajo", alumno.numero_legajo),
        ("Emisión", factura.fecha_emision.strftime("%d/%m/%Y")),
        ("Vencimiento", factura.fecha_vencimiento.strftime("%d/%m/%Y")),
        ("Estado", factura.estado.capitalize()),
    )
    for etiqueta, valor in datos:
        pdf.setFillColor(secundario)
        pdf.drawString(margen, y, etiqueta)
        pdf.setFillColor(texto)
        pdf.drawString(margen + 35 * mm, y, valor)
        y -= 7 * mm

    y -= 3 * mm
    pdf.setStrokeColor(HexColor("#DED8E6"))
    pdf.line(margen, y, ancho - margen, y)
    y -= 9 * mm
    pdf.setFillColor(texto)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(margen, y, "Concepto")
    pdf.drawRightString(ancho - margen, y, "Importe")
    y -= 6 * mm
    pdf.setFont("Helvetica", 10)
    for detalle in factura.detalles:
        pdf.setFillColor(texto)
        pdf.drawString(margen, y, detalle.descripcion[:80])
        importe = f"$ {detalle.monto:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
        pdf.drawRightString(ancho - margen, y, importe)
        y -= 7 * mm

    y -= 2 * mm
    pdf.setStrokeColor(HexColor("#DED8E6"))
    pdf.line(margen, y, ancho - margen, y)
    y -= 9 * mm
    pdf.setFont("Helvetica-Bold", 12)
    total = f"$ {factura.monto_total:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    pdf.drawRightString(ancho - margen, y, f"Total: {total}")

    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(secundario)
    pie = "Documento generado por ESSERI Data Core"
    pdf.drawString(margen, 15 * mm, pie)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def listar_facturas(
    db: Session,
    *,
    pagina: int,
    tamanio: int,
    alumno_id: uuid.UUID | None = None,
    estado: str | None = None,
    buscar: str | None = None,
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
    if buscar:
        filtros.append(cast(Factura.id, String).ilike(f"%{buscar.strip()}%"))
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
