"""Durable review and atomic confirmation of demo collection response files."""

import csv
import hashlib
import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from io import StringIO

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.auditoria.service import log_audit
from src.facturacion import facturas_service
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.cobranzas_schemas import (
    ArchivoRead,
    ImportacionRead,
    ImportDetalleRead,
    ImportResumenRead,
)
from src.facturacion.cobranzas_service import _bloquear_escritura_sqlite
from src.facturacion.exceptions import (
    CobranzaInvalida,
    ImportacionCobranzaNoEncontrada,
)
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    FacturaCobranzaDemo,
    ImportacionCobranza,
    ImportacionCobranzaDetalle,
    LoteCobranza,
    MetodoPago,
    Pago,
)
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda

METODO_ID = uuid.UUID("e55e2100-0000-4000-8000-000000000001")
TAMANIO_DETALLE = 25


def _mensaje_rechazo(codigo: str, descripcion: str) -> str:
    motivo = (descripcion or "").strip() or "sin descripción informada"
    codigo_txt = (codigo or "").strip()
    sufijo = f" (código {codigo_txt})" if codigo_txt else ""
    return f"Motivo informado: {motivo}{sufijo}. No se registra pago."


def _huella(fila: formato.RespuestaDetalle) -> str:
    valores = [
        str(fila.referencia),
        fila.resultado,
        str(fila.importe),
        fila.fecha.isoformat(),
        fila.codigo,
        fila.descripcion,
    ]
    return hashlib.sha256(json.dumps(valores, ensure_ascii=False).encode()).hexdigest()


def _hash_archivo(contenido: str) -> str:
    return hashlib.sha256(contenido.encode("utf-8")).hexdigest()


def _detalles(db: Session, importacion_id: uuid.UUID) -> list[ImportacionCobranzaDetalle]:
    return list(
        db.scalars(
            select(ImportacionCobranzaDetalle)
            .where(ImportacionCobranzaDetalle.importacion_id == importacion_id)
            .order_by(ImportacionCobranzaDetalle.linea)
            .execution_options(populate_existing=True)
        ).all()
    )


def _resumen(detalles: list[ImportacionCobranzaDetalle]) -> ImportResumenRead:
    resumen = ImportResumenRead()
    for detalle in detalles:
        importe = detalle.importe or Decimal("0.00")
        resumen.procesados.cantidad += 1
        resumen.procesados.importe += importe
        if detalle.estado in ("error", "duplicado"):
            resumen.errores.cantidad += 1
            resumen.errores.importe += importe
        elif detalle.resultado == formato.COBRADO:
            resumen.cobrados.cantidad += 1
            resumen.cobrados.importe += importe
        else:
            resumen.rechazados.cantidad += 1
            resumen.rechazados.importe += importe
    return resumen


def _filtro_detalle(resultado: str):
    if resultado == "revision":
        return or_(
            ImportacionCobranzaDetalle.estado.in_(("error", "duplicado")),
            ImportacionCobranzaDetalle.resultado == formato.RECHAZADO,
        )
    if resultado == "cobrados":
        return ImportacionCobranzaDetalle.resultado == formato.COBRADO
    if resultado == "rechazados":
        return ImportacionCobranzaDetalle.resultado == formato.RECHAZADO
    if resultado == "errores":
        return ImportacionCobranzaDetalle.estado.in_(("error", "duplicado"))
    return None


def _leer_importacion(
    db: Session,
    importacion: ImportacionCobranza,
    *,
    resultado: str = "revision",
    buscar: str | None = None,
    pagina: int = 1,
    tamanio: int = TAMANIO_DETALLE,
    errores: list[str] | None = None,
) -> ImportacionRead:
    detalles = _detalles(db, importacion.id)
    lote = importacion.lote
    consulta = select(ImportacionCobranzaDetalle).where(
        ImportacionCobranzaDetalle.importacion_id == importacion.id
    )
    filtro = _filtro_detalle(resultado)
    if filtro is not None:
        consulta = consulta.where(filtro)
    if buscar:
        patron = f"%{normalizar_texto_busqueda(buscar.strip())}%"
        consulta = consulta.where(
            or_(
                normalizar_columna_busqueda(ImportacionCobranzaDetalle.referencia).like(patron),
                normalizar_columna_busqueda(ImportacionCobranzaDetalle.numero_factura).like(
                    patron
                ),
                normalizar_columna_busqueda(ImportacionCobranzaDetalle.alumno_nombre).like(
                    patron
                ),
                normalizar_columna_busqueda(ImportacionCobranzaDetalle.mensaje).like(patron),
            )
        )
    total = int(db.scalar(select(func.count()).select_from(consulta.subquery())) or 0)
    filas = list(
        db.scalars(
            consulta.order_by(ImportacionCobranzaDetalle.linea)
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        ).all()
    )
    errores_globales = list(errores or [])
    puede = (
        not errores_globales
        and importacion.estado == "en_revision"
        and lote is not None
        and lote.estado in ("exportado", "en_revision")
        and bool(detalles)
        and all(detalle.estado not in ("error", "duplicado") for detalle in detalles)
    )
    return ImportacionRead(
        id=importacion.id,
        lote_id=importacion.lote_id,
        lote_codigo=lote.codigo if lote is not None else None,
        estado=importacion.estado,
        archivo_hash=importacion.archivo_hash,
        errores=errores_globales,
        puede_confirmar=puede,
        resumen=_resumen(detalles),
        items=[_detalle_read(fila) for fila in filas],
        total=total,
        pagina=pagina,
        tamanio=tamanio,
    )


def _detalle_read(fila: ImportacionCobranzaDetalle) -> ImportDetalleRead:
    return ImportDetalleRead(
        linea=fila.linea,
        referencia=fila.referencia,
        factura_id=fila.factura_id,
        numero_factura=fila.numero_factura,
        alumno_nombre=fila.alumno_nombre,
        resultado=fila.resultado,
        importe=fila.importe,
        estado=fila.estado,
        mensaje=fila.mensaje,
        pago_id=fila.pago_id,
    )


def _info_facturas(db: Session, ids: set[uuid.UUID]):
    if not ids:
        return {}, {}
    filas = db.execute(
        select(
            Factura.id,
            Factura.estado,
            Factura.monto_total,
            FacturaCobranzaDemo.numero,
            Persona.nombre,
            Persona.apellido,
        )
        .select_from(Factura)
        .join(Inscripcion, Factura.inscripcion_id == Inscripcion.id)
        .join(Alumno, Inscripcion.alumno_id == Alumno.id)
        .join(Persona, Alumno.persona_id == Persona.id)
        .outerjoin(FacturaCobranzaDemo, FacturaCobranzaDemo.factura_id == Factura.id)
        .where(Factura.id.in_(ids))
    ).all()
    info = {
        fila[0]: {
            "estado": fila[1],
            "monto_total": Decimal(fila[2]),
            "numero": fila[3],
            "alumno_nombre": f"{fila[5]}, {fila[4]}",
        }
        for fila in filas
    }
    pagados = dict(
        db.execute(
            select(Pago.factura_id, func.coalesce(func.sum(Pago.monto), Decimal("0.00")))
            .where(Pago.factura_id.in_(ids), Pago.estado == "aprobado")
            .group_by(Pago.factura_id)
        ).all()
    )
    return info, {factura_id: Decimal(monto) for factura_id, monto in pagados.items()}


def _resolver_filas(
    db: Session,
    lote: LoteCobranza,
    filas: list[formato.RespuestaDetalle],
    *,
    bloquear: bool = False,
) -> list[ImportacionCobranzaDetalle]:
    consulta = select(DebitoCobranza).where(DebitoCobranza.lote_id == lote.id)
    if bloquear:
        consulta = consulta.with_for_update()
    debitos = {
        debito.id: debito
        for debito in db.scalars(consulta.execution_options(populate_existing=True)).all()
    }
    ids = {debito.factura_id for debito in debitos.values()}
    info, pagados = _info_facturas(db, ids)
    metodo = db.get(MetodoPago, METODO_ID, populate_existing=True)
    metodo_valido = (
        metodo is not None and metodo.activo and not metodo.requiere_comprobante
    )
    resultado: list[ImportacionCobranzaDetalle] = []
    for linea, fila in enumerate(filas, start=2):
        huella = _huella(fila)
        detalle = ImportacionCobranzaDetalle(
            linea=linea,
            referencia=str(fila.referencia),
            resultado=fila.resultado,
            importe=fila.importe,
            fecha_procesamiento=fila.fecha,
            codigo=fila.codigo or None,
            descripcion=fila.descripcion or None,
            resultado_hash=huella,
            estado="error",
            mensaje="",
        )
        debito = debitos.get(fila.referencia)
        if debito is None:
            detalle.mensaje = "La referencia no pertenece a esta solicitud."
            resultado.append(detalle)
            continue
        detalle.debito_id = debito.id
        detalle.factura_id = debito.factura_id
        detalle.pago_id = debito.pago_id
        factura = info.get(debito.factura_id)
        if factura is not None:
            detalle.numero_factura = factura["numero"]
            detalle.alumno_nombre = factura["alumno_nombre"]
        if not debito.reserva_activa:
            detalle.mensaje = "La factura ya no está reservada por este lote."
            resultado.append(detalle)
            continue
        if debito.resultado_hash is not None:
            if debito.resultado_hash == huella:
                detalle.estado = "duplicado"
                detalle.mensaje = "Resultado ya registrado; no se aplicó otra vez."
            else:
                detalle.mensaje = "La referencia ya tiene un resultado distinto registrado."
            resultado.append(detalle)
            continue
        if factura is None:
            detalle.mensaje = "La factura ya no existe."
            resultado.append(detalle)
            continue
        if factura["estado"] == "pagada":
            detalle.mensaje = "La factura ya está pagada."
            resultado.append(detalle)
            continue
        saldo = factura["monto_total"] - pagados.get(debito.factura_id, Decimal("0.00"))
        if fila.importe != debito.importe or fila.importe > saldo:
            detalle.mensaje = "El importe no coincide con la solicitud o supera el saldo actual."
            resultado.append(detalle)
            continue
        if fila.resultado == formato.COBRADO and not metodo_valido:
            detalle.mensaje = (
                "El método de pago del formato no está disponible; revisar la instalación."
            )
            resultado.append(detalle)
            continue
        detalle.estado = (
            "listo" if fila.resultado == formato.COBRADO else "rechazado"
        )
        detalle.mensaje = (
            "Cobro listo para registrar al confirmar."
            if fila.resultado == formato.COBRADO
            else _mensaje_rechazo(fila.codigo, fila.descripcion)
        )
        resultado.append(detalle)
    return resultado


def previsualizar(
    db: Session, contenido: str, usuario_id: uuid.UUID | None = None
) -> ImportacionRead:
    archivo_hash = _hash_archivo(contenido)
    try:
        lote_id, filas = formato.leer_respuesta(contenido)
    except formato.FormatoInvalido as exc:
        return ImportacionRead(errores=[str(exc)])
    lote = db.scalar(
        select(LoteCobranza)
        .where(LoteCobranza.id == lote_id)
        .options(selectinload(LoteCobranza.items))
        .execution_options(populate_existing=True)
    )
    if lote is None:
        return ImportacionRead(
            lote_id=lote_id,
            archivo_hash=archivo_hash,
            errores=["La respuesta no corresponde a una solicitud registrada."],
        )
    existente = db.scalar(
        select(ImportacionCobranza).where(
            ImportacionCobranza.lote_id == lote_id,
            ImportacionCobranza.archivo_hash == archivo_hash,
        )
    )
    if existente is not None:
        return _leer_importacion(db, existente, resultado="todos")
    if lote.estado in ("pagos_registrados", "liberado"):
        estado = "liberado" if lote.estado == "liberado" else "con pagos registrados"
        return ImportacionRead(
            lote_id=lote.id,
            lote_codigo=lote.codigo,
            archivo_hash=archivo_hash,
            errores=[
                f"El lote {lote.codigo or lote.id} está {estado}; no admite otra respuesta."
            ],
        )

    _bloquear_escritura_sqlite(db)
    existente = db.scalar(
        select(ImportacionCobranza).where(
            ImportacionCobranza.lote_id == lote_id,
            ImportacionCobranza.archivo_hash == archivo_hash,
        )
    )
    if existente is not None:
        return _leer_importacion(db, existente, resultado="todos")
    lote = db.scalar(
        select(LoteCobranza)
        .where(LoteCobranza.id == lote_id)
        .options(selectinload(LoteCobranza.items))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if lote is None:
        return ImportacionRead(
            lote_id=lote_id,
            archivo_hash=archivo_hash,
            errores=["La respuesta no corresponde a una solicitud registrada."],
        )
    if lote.estado in ("pagos_registrados", "liberado"):
        estado = "liberado" if lote.estado == "liberado" else "con pagos registrados"
        return ImportacionRead(
            lote_id=lote.id,
            lote_codigo=lote.codigo,
            archivo_hash=archivo_hash,
            errores=[
                f"El lote {lote.codigo or lote.id} está {estado}; no admite otra respuesta."
            ],
        )
    importacion = ImportacionCobranza(
        lote_id=lote.id,
        archivo_hash=archivo_hash,
        estado="en_revision",
        usuario_id=usuario_id,
    )
    importacion.detalles = _resolver_filas(db, lote, filas)
    lote.estado = "en_revision"
    db.add(importacion)
    try:
        db.flush()
        log_audit(
            db,
            entidad="IMPORTACION_COBRANZA",
            entidad_id=importacion.id,
            campo="__alta__",
            valor_anterior=None,
            valor_nuevo=f"lote={lote.codigo}; hash={archivo_hash}",
            usuario_id=usuario_id,
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        existente = db.scalar(
            select(ImportacionCobranza).where(
                ImportacionCobranza.lote_id == lote_id,
                ImportacionCobranza.archivo_hash == archivo_hash,
            )
        )
        if existente is not None:
            return _leer_importacion(db, existente, resultado="todos")
        raise
    importacion = db.scalar(
        select(ImportacionCobranza)
        .where(ImportacionCobranza.id == importacion.id)
        .options(
            selectinload(ImportacionCobranza.detalles),
            selectinload(ImportacionCobranza.lote).selectinload(LoteCobranza.items),
        )
        .execution_options(populate_existing=True)
    )
    return _leer_importacion(db, importacion, resultado="todos")


def obtener_importacion(db: Session, importacion_id: uuid.UUID) -> ImportacionCobranza:
    importacion = db.scalar(
        select(ImportacionCobranza)
        .where(ImportacionCobranza.id == importacion_id)
        .options(
            selectinload(ImportacionCobranza.detalles),
            selectinload(ImportacionCobranza.lote).selectinload(LoteCobranza.items),
        )
        .execution_options(populate_existing=True)
    )
    if importacion is None:
        raise ImportacionCobranzaNoEncontrada()
    return importacion


def leer_importacion(
    db: Session,
    importacion_id: uuid.UUID,
    *,
    resultado: str = "revision",
    buscar: str | None = None,
    pagina: int = 1,
    tamanio: int = TAMANIO_DETALLE,
) -> ImportacionRead:
    return _leer_importacion(
        db,
        obtener_importacion(db, importacion_id),
        resultado=resultado,
        buscar=buscar,
        pagina=pagina,
        tamanio=tamanio,
    )


def incidencias(db: Session, importacion_id: uuid.UUID) -> ArchivoRead:
    importacion = obtener_importacion(db, importacion_id)
    filas = [
        detalle
        for detalle in importacion.detalles
        if detalle.estado in ("error", "duplicado")
        or detalle.resultado == formato.RECHAZADO
    ]
    salida = StringIO(newline="")
    escritor = csv.writer(salida, delimiter=";", lineterminator="\n")
    escritor.writerow(
        [
            "linea",
            "referencia",
            "resultado",
            "estado",
            "factura",
            "alumno",
            "importe",
            "motivo",
        ]
    )
    for detalle in filas:
        escritor.writerow(
            [
                detalle.linea,
                detalle.referencia or "",
                detalle.resultado or "",
                detalle.estado,
                detalle.numero_factura or "",
                detalle.alumno_nombre or "",
                f"{detalle.importe:.2f}" if detalle.importe is not None else "",
                detalle.mensaje,
            ]
        )
    return ArchivoRead(
        nombre=(
            f"ESSERI_INCIDENCIAS_"
            f"{importacion.lote.codigo or importacion.lote_id}_{str(importacion.id)[:8]}.csv"
        ),
        contenido=salida.getvalue(),
    )


def _revalidar(
    db: Session, lote: LoteCobranza, detalles: list[ImportacionCobranzaDetalle]
) -> bool:
    """Re-read authoritative invoice state under locks; no financial write happens here."""
    debitos = {
        debito.id: debito
        for debito in db.scalars(
            select(DebitoCobranza)
            .where(DebitoCobranza.lote_id == lote.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        ).all()
    }
    ids = {debito.factura_id for debito in debitos.values()}
    db.scalars(
        select(Factura)
        .where(Factura.id.in_(ids))
        .order_by(Factura.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).all()
    info, pagados = _info_facturas(db, ids)
    metodo = db.get(MetodoPago, METODO_ID, populate_existing=True)
    metodo_valido = metodo is not None and metodo.activo and not metodo.requiere_comprobante
    hay_error = False
    for detalle in detalles:
        debito = debitos.get(detalle.debito_id) if detalle.debito_id else None
        if debito is None:
            detalle.estado = "error"
            detalle.mensaje = "La referencia no pertenece a esta solicitud."
            hay_error = True
            continue
        factura = info.get(debito.factura_id)
        detalle.factura_id = debito.factura_id
        detalle.numero_factura = factura["numero"] if factura else None
        detalle.alumno_nombre = factura["alumno_nombre"] if factura else None
        if debito.resultado_hash is not None:
            detalle.estado = (
                "duplicado"
                if debito.resultado_hash == detalle.resultado_hash
                else "error"
            )
            detalle.mensaje = (
                "Resultado ya registrado; no se aplicó otra vez."
                if detalle.estado == "duplicado"
                else "La referencia ya tiene un resultado distinto registrado."
            )
            hay_error = True
            continue
        if not debito.reserva_activa:
            detalle.estado = "error"
            detalle.mensaje = "La factura ya no está reservada por este lote."
            hay_error = True
            continue
        if factura is None:
            detalle.estado = "error"
            detalle.mensaje = "La factura ya no existe."
            hay_error = True
            continue
        if factura["estado"] == "pagada":
            detalle.estado = "error"
            detalle.mensaje = "La factura ya está pagada."
            hay_error = True
            continue
        saldo = factura["monto_total"] - pagados.get(debito.factura_id, Decimal("0.00"))
        if detalle.importe != debito.importe or detalle.importe > saldo:
            detalle.estado = "error"
            detalle.mensaje = "El importe no coincide con la solicitud o supera el saldo actual."
            hay_error = True
            continue
        if detalle.resultado == formato.COBRADO and not metodo_valido:
            detalle.estado = "error"
            detalle.mensaje = (
                "El método de pago del formato no está disponible; revisar la instalación."
            )
            hay_error = True
            continue
        detalle.estado = (
            "listo" if detalle.resultado == formato.COBRADO else "rechazado"
        )
        detalle.mensaje = (
            "Cobro listo para registrar al confirmar."
            if detalle.resultado == formato.COBRADO
            else _mensaje_rechazo(detalle.codigo, detalle.descripcion)
        )
    return hay_error


def confirmar(
    db: Session,
    importacion_id: uuid.UUID,
    *,
    revision_confirmada: bool,
    usuario_id: uuid.UUID,
) -> ImportacionRead:
    if not revision_confirmada:
        raise CobranzaInvalida("Tenés que revisar el resumen y el detalle antes de confirmar.")
    _bloquear_escritura_sqlite(db)
    importacion = db.scalar(
        select(ImportacionCobranza)
        .where(ImportacionCobranza.id == importacion_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if importacion is None:
        raise ImportacionCobranzaNoEncontrada()
    lote = db.scalar(
        select(LoteCobranza)
        .where(LoteCobranza.id == importacion.lote_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if importacion.estado == "confirmada":
        return _leer_importacion(db, obtener_importacion(db, importacion_id))
    if lote is None:
        return _leer_importacion(
            db,
            importacion,
            errores=["El lote asociado ya no existe; no se registraron pagos."],
        )
    if lote.estado == "liberado":
        return _leer_importacion(
            db,
            importacion,
            errores=[
                "El lote fue liberado; esta respuesta quedó obsoleta y no se registraron pagos."
            ],
        )
    if lote.estado not in ("exportado", "en_revision"):
        return _leer_importacion(
            db,
            importacion,
            errores=[
                "El lote ya tiene pagos registrados; esta respuesta no se puede confirmar."
            ],
        )
    detalles = _detalles(db, importacion.id)
    if not detalles:
        return _leer_importacion(
            db,
            importacion,
            errores=["La importación no tiene registros para confirmar."],
        )
    if any(detalle.estado in ("error", "duplicado") for detalle in detalles):
        return _leer_importacion(db, importacion)
    if _revalidar(db, lote, detalles):
        db.commit()
        return _leer_importacion(db, obtener_importacion(db, importacion_id))

    try:
        reclamado = 0
        for detalle in detalles:
            reclamado += db.execute(
                update(DebitoCobranza)
                .where(
                    DebitoCobranza.id == detalle.debito_id,
                    DebitoCobranza.resultado_hash.is_(None),
                    DebitoCobranza.reserva_activa.is_(True),
                )
                .values(
                    resultado_hash=detalle.resultado_hash,
                    resultado=detalle.resultado,
                )
                .execution_options(synchronize_session=False)
            ).rowcount
        if reclamado != len(detalles):
            raise CobranzaInvalida(
                "Otra confirmación registró estos resultados; actualizá la revisión."
            )
        reclamada = db.execute(
            update(ImportacionCobranza)
            .where(
                ImportacionCobranza.id == importacion.id,
                ImportacionCobranza.estado == "en_revision",
            )
            .values(estado="confirmada", confirmada_at=datetime.now(UTC))
            .execution_options(synchronize_session=False)
        ).rowcount
        if not reclamada:
            raise CobranzaInvalida(
                "Otra confirmación ya procesó esta importación; refrescá el historial."
            )

        debitos = {
            debito.id: debito
            for debito in db.scalars(
                select(DebitoCobranza)
                .where(DebitoCobranza.id.in_([d.debito_id for d in detalles]))
                .with_for_update()
                .execution_options(populate_existing=True)
            ).all()
        }
        for detalle in detalles:
            debito = debitos[detalle.debito_id]
            debito.reserva_activa = False
            debito.resultado_hash = detalle.resultado_hash
            debito.resultado = detalle.resultado
            if detalle.resultado == formato.COBRADO:
                factura = db.scalar(
                    select(Factura)
                    .where(Factura.id == debito.factura_id)
                    .with_for_update()
                    .execution_options(populate_existing=True)
                )
                pago = facturas_service.registrar_pago(
                    db,
                    factura=factura,
                    usuario_registro_id=usuario_id,
                    fecha=detalle.fecha_procesamiento,
                    monto=detalle.importe,
                    metodo_pago_id=METODO_ID,
                    referencia_transaccion=(
                        f"ESSERI_SIMULADO:{lote.id}:{debito.id}"
                    ),
                    comprobante_nombre=None,
                    comprobante_tipo_contenido=None,
                    comprobante_contenido=None,
                    confirmar=False,
                )
                debito.pago_id = pago.id
                detalle.pago_id = pago.id
                detalle.estado = "aplicado"
                detalle.mensaje = "Pago registrado."
            else:
                detalle.estado = "rechazado"
                detalle.mensaje = _mensaje_rechazo(detalle.codigo, detalle.descripcion)
            log_audit(
                db,
                entidad="DEBITO_COBRANZA",
                entidad_id=debito.id,
                campo="resultado",
                valor_anterior=None,
                valor_nuevo=f"{detalle.resultado}; {detalle.resultado_hash}",
                usuario_id=usuario_id,
            )
        lote.estado = "pagos_registrados"
        importacion = db.get(
            ImportacionCobranza, importacion.id, populate_existing=True
        )
        importacion.estado = "confirmada"
        importacion.confirmada_at = datetime.now(UTC)
        log_audit(
            db,
            entidad="IMPORTACION_COBRANZA",
            entidad_id=importacion.id,
            campo="__confirmacion__",
            valor_anterior="en_revision",
            valor_nuevo=f"confirmada; registros={len(detalles)}",
            usuario_id=usuario_id,
        )
        db.commit()
    except CobranzaInvalida as exc:
        db.rollback()
        return _leer_importacion(
            db, obtener_importacion(db, importacion_id), errores=[str(exc)]
        )
    except Exception:
        db.rollback()
        raise
    return _leer_importacion(db, obtener_importacion(db, importacion_id))
