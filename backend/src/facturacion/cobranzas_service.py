"""Selection, batch lifecycle, reservations and release for the demo collection workflow."""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import String, cast, func, or_, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from src.academico.models import Anio, Division
from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.cobranzas_schemas import (
    ArchivoRead,
    BatchSummaryRead,
    DebitoRead,
    FacturaElegibleRead,
    FacturasElegiblesRead,
    FiltrosSeleccion,
    HistorialLotesRead,
    LiberacionesRead,
    LiberacionItemRead,
    LiberacionRead,
    LoteCreate,
    LoteDetailRead,
    ResumenMedioRead,
    ResumenSeleccionRead,
    Seleccion,
)
from src.facturacion.exceptions import (
    CobranzaEnConflicto,
    CobranzaInvalida,
    LoteCobranzaNoEncontrado,
    SolicitudCobranzaInvalida,
)
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    FacturaCobranzaDemo,
    ImportacionCobranza,
    LoteCobranza,
    Pago,
)
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda

MAX_FACTURAS_LOTE = 500


@dataclass(frozen=True)
class FilaElegible:
    id: uuid.UUID
    numero: str
    alumno_nombre: str
    curso: str
    periodo: str
    medio: str
    fecha_vencimiento: date
    importe: Decimal
    estado: str
    en_lote: bool


def _periodo_expr():
    return func.coalesce(
        FacturaCobranzaDemo.periodo,
        func.substr(cast(Factura.fecha_emision, String), 1, 7),
    )


def _medio_expr():
    return func.coalesce(FacturaCobranzaDemo.medio, "cbu")


def _pagado_expr():
    return (
        select(func.coalesce(func.sum(Pago.monto), Decimal("0.00")))
        .where(Pago.factura_id == Factura.id, Pago.estado == "aprobado")
        .correlate(Factura)
        .scalar_subquery()
    )


def _reserva_expr():
    return (
        select(DebitoCobranza.id)
        .where(
            DebitoCobranza.factura_id == Factura.id,
            DebitoCobranza.reserva_activa.is_(True),
        )
        .exists()
    )


def _consulta_elegibles(
    filtros: FiltrosSeleccion,
    *,
    forzar_reservadas: bool = False,
    bloquear: bool = False,
    ids: list[uuid.UUID] | None = None,
    excluir: list[uuid.UUID] | None = None,
):
    consulta = (
        select(
            Factura.id,
            FacturaCobranzaDemo.numero,
            Persona.nombre,
            Persona.apellido,
            Anio.numero,
            Division.nombre,
            _periodo_expr(),
            _medio_expr(),
            Factura.fecha_vencimiento,
            Factura.monto_total,
            Factura.estado,
            _reserva_expr(),
            _pagado_expr(),
        )
        .select_from(Factura)
        .join(Inscripcion, Factura.inscripcion_id == Inscripcion.id)
        .join(Alumno, Inscripcion.alumno_id == Alumno.id)
        .join(Persona, Alumno.persona_id == Persona.id)
        .join(Division, Inscripcion.division_id == Division.id)
        .join(Anio, Division.anio_id == Anio.id)
        .outerjoin(FacturaCobranzaDemo, FacturaCobranzaDemo.factura_id == Factura.id)
        .where(Factura.estado != "pagada")
        .where(Factura.monto_total > _pagado_expr())
    )
    estado = (
        "pendientes_sin_lote"
        if forzar_reservadas
        else (filtros.estado or "pendientes_sin_lote")
    )
    if forzar_reservadas:
        consulta = consulta.where(_reserva_expr())
    elif estado == "pendientes_sin_lote":
        consulta = consulta.where(~_reserva_expr())
    elif estado == "en_lote":
        consulta = consulta.where(_reserva_expr())
    if filtros.periodo:
        consulta = consulta.where(_periodo_expr() == filtros.periodo)
    if filtros.medio:
        consulta = consulta.where(_medio_expr() == filtros.medio)
    if filtros.buscar:
        for termino in filtros.buscar.split():
            patron = f"%{normalizar_texto_busqueda(termino.strip())}%"
            consulta = consulta.where(
                or_(
                    normalizar_columna_busqueda(Persona.nombre).like(patron),
                    normalizar_columna_busqueda(Persona.apellido).like(patron),
                    normalizar_columna_busqueda(FacturaCobranzaDemo.numero).like(patron),
                    cast(Factura.id, String).ilike(patron),
                )
            )
    if ids is not None:
        consulta = consulta.where(Factura.id.in_(ids))
    if excluir:
        consulta = consulta.where(Factura.id.not_in(excluir))
    consulta = consulta.order_by(
        func.coalesce(FacturaCobranzaDemo.numero, cast(Factura.id, String)),
        Factura.fecha_vencimiento,
        Factura.id,
    )
    if bloquear:
        consulta = consulta.with_for_update(of=Factura)
    return consulta


def _fila(fila) -> FilaElegible:
    (
        factura_id,
        numero,
        nombre,
        apellido,
        anio,
        division,
        periodo,
        medio,
        vencimiento,
        monto_total,
        estado,
        en_lote,
        pagado,
    ) = fila
    return FilaElegible(
        id=factura_id,
        numero=numero or f"F-{factura_id.hex[:8].upper()}",
        alumno_nombre=f"{apellido}, {nombre}",
        curso=f"{anio}° {division}",
        periodo=str(periodo),
        medio=str(medio),
        fecha_vencimiento=vencimiento,
        importe=Decimal(monto_total) - Decimal(pagado),
        estado=estado,
        en_lote=bool(en_lote),
    )


def _contar_ocultas(db: Session, filtros: FiltrosSeleccion) -> int:
    consulta = _consulta_elegibles(filtros, forzar_reservadas=True)
    subconsulta = consulta.order_by(None).subquery()
    return int(db.scalar(select(func.count()).select_from(subconsulta)) or 0)


def opciones(db: Session) -> dict[str, list[str]]:
    periodos_facturas = (
        select(_periodo_expr().label("periodo"))
        .select_from(Factura)
        .join(Inscripcion, Factura.inscripcion_id == Inscripcion.id)
        .outerjoin(FacturaCobranzaDemo, FacturaCobranzaDemo.factura_id == Factura.id)
        .where(Factura.estado != "pagada")
        .where(Factura.monto_total > _pagado_expr())
        .distinct()
    )
    periodos_lotes = (
        select(LoteCobranza.periodo.label("periodo"))
        .where(LoteCobranza.periodo.is_not(None))
        .distinct()
    )
    periodos_union = periodos_facturas.union(periodos_lotes).subquery()
    periodos = [
        str(periodo)
        for periodo in db.scalars(
            select(periodos_union.c.periodo).order_by(periodos_union.c.periodo.desc())
        ).all()
    ]
    medios = [
        str(medio)
        for medio in db.scalars(
            select(_medio_expr())
            .select_from(Factura)
            .join(Inscripcion, Factura.inscripcion_id == Inscripcion.id)
            .outerjoin(FacturaCobranzaDemo, FacturaCobranzaDemo.factura_id == Factura.id)
            .where(Factura.estado != "pagada")
            .where(Factura.monto_total > _pagado_expr())
            .distinct()
            .order_by(_medio_expr())
        ).all()
    ]
    return {"periodos": periodos, "medios": medios}


def listar_elegibles(
    db: Session,
    *,
    filtros: FiltrosSeleccion,
    pagina: int,
    tamanio: int,
) -> FacturasElegiblesRead:
    consulta = _consulta_elegibles(filtros)
    total = int(
        db.scalar(select(func.count()).select_from(consulta.order_by(None).subquery())) or 0
    )
    filas = db.execute(consulta.offset((pagina - 1) * tamanio).limit(tamanio)).all()
    items = [FacturaElegibleRead(**_fila(fila).__dict__) for fila in filas]
    ocultas = (
        _contar_ocultas(db, filtros)
        if (filtros.estado or "pendientes_sin_lote") == "pendientes_sin_lote"
        else 0
    )
    return FacturasElegiblesRead(
        items=items,
        total=total,
        pagina=pagina,
        tamanio=tamanio,
        total_pagina=len(items),
        ocultas_en_lote=ocultas,
    )


def _resolver(db: Session, seleccion: Seleccion, *, bloquear: bool = False) -> list[FilaElegible]:
    filtros = seleccion.filtros
    if seleccion.modo == "filtrados":
        consulta = _consulta_elegibles(
            filtros,
            bloquear=bloquear,
            excluir=seleccion.excluir_ids,
        )
        return [_fila(fila) for fila in db.execute(consulta).all()]

    ids = list(dict.fromkeys(seleccion.factura_ids))
    if not ids:
        raise SolicitudCobranzaInvalida("La selección no contiene facturas.")
    consulta = _consulta_elegibles(
        FiltrosSeleccion(
            periodo=filtros.periodo,
            medio=filtros.medio,
            buscar=filtros.buscar,
            estado="todas",
        ),
        bloquear=bloquear,
        ids=ids,
    )
    filas = [_fila(fila) for fila in db.execute(consulta).all()]
    if any(fila.en_lote for fila in filas):
        raise CobranzaEnConflicto(
            "Una o más facturas seleccionadas ya están reservadas por otro lote."
        )
    if len(filas) != len(ids):
        raise SolicitudCobranzaInvalida(
            "Una o más facturas seleccionadas ya no están disponibles: fueron pagadas o no existen."
        )
    return filas


def _ocultas_en_lote(db: Session, filtros: FiltrosSeleccion) -> int:
    if (filtros.estado or "pendientes_sin_lote") != "pendientes_sin_lote":
        return 0
    return _contar_ocultas(db, filtros)


def resumen_seleccion(db: Session, seleccion: Seleccion) -> ResumenSeleccionRead:
    if seleccion.modo == "pagina" and not seleccion.factura_ids:
        return ResumenSeleccionRead(
            cantidad=0,
            importe_total=Decimal("0.00"),
            por_medio={
                "cbu": ResumenMedioRead(cantidad=0, importe=Decimal("0.00")),
                "tarjeta": ResumenMedioRead(cantidad=0, importe=Decimal("0.00")),
            },
            alcance="pagina",
            ocultas_en_lote=_ocultas_en_lote(db, seleccion.filtros),
        )
    filas = _resolver(db, seleccion)
    por_medio = {"cbu": ResumenMedioRead(cantidad=0, importe=Decimal("0.00")),
                 "tarjeta": ResumenMedioRead(cantidad=0, importe=Decimal("0.00"))}
    for fila in filas:
        actual = por_medio.get(fila.medio)
        if actual is not None:
            actual.cantidad += 1
            actual.importe += fila.importe
    return ResumenSeleccionRead(
        cantidad=len(filas),
        importe_total=sum((fila.importe for fila in filas), Decimal("0.00")),
        por_medio=por_medio,
        alcance=seleccion.modo,
        ocultas_en_lote=_ocultas_en_lote(db, seleccion.filtros),
    )


def _periodo_comun(filas: list[FilaElegible]) -> str:
    periodos = {fila.periodo for fila in filas}
    if len(periodos) != 1:
        raise SolicitudCobranzaInvalida(
            "Las facturas seleccionadas pertenecen a más de un período; elegí uno."
        )
    return next(iter(periodos))


def _siguiente_codigo(db: Session, periodo: str) -> str:
    prefijo = f"LD-{periodo}-"
    codigos = db.scalars(
        select(LoteCobranza.codigo).where(LoteCobranza.codigo.like(f"{prefijo}%"))
    ).all()
    numeros = []
    for codigo in codigos:
        try:
            numeros.append(int(codigo.rsplit("-", 1)[-1]))
        except (TypeError, ValueError):
            continue
    return f"{prefijo}{max(numeros, default=0) + 1:03d}"


def _bloquear_escritura_sqlite(db: Session) -> None:
    """SQLite has no row locks; serialize demo writes so concurrent HTTP requests stay sane."""
    if db.get_bind().dialect.name == "sqlite":
        db.commit()
        db.execute(text("BEGIN IMMEDIATE"))


def _filas_lote(db: Session, lote_id: uuid.UUID):
    return db.execute(
        select(
            DebitoCobranza.id,
            DebitoCobranza.factura_id,
            FacturaCobranzaDemo.numero,
            FacturaCobranzaDemo.periodo,
            FacturaCobranzaDemo.medio,
            Persona.nombre,
            Persona.apellido,
            DebitoCobranza.vencimiento,
            DebitoCobranza.concepto,
            DebitoCobranza.importe,
            DebitoCobranza.resultado,
            DebitoCobranza.pago_id,
        )
        .select_from(DebitoCobranza)
        .join(Factura, DebitoCobranza.factura_id == Factura.id)
        .join(Inscripcion, Factura.inscripcion_id == Inscripcion.id)
        .join(Alumno, Inscripcion.alumno_id == Alumno.id)
        .join(Persona, Alumno.persona_id == Persona.id)
        .outerjoin(FacturaCobranzaDemo, FacturaCobranzaDemo.factura_id == DebitoCobranza.factura_id)
        .where(DebitoCobranza.lote_id == lote_id)
        .order_by(DebitoCobranza.id)
    ).all()


def _solicitudes(db: Session, lote: LoteCobranza, codigo: str) -> list[ArchivoRead]:
    filas = _filas_lote(db, lote.id)

    def _fila(fila) -> formato.SolicitudFila:
        (
            referencia,
            factura_id,
            numero,
            periodo,
            medio,
            nombre,
            apellido,
            vencimiento,
            concepto,
            importe,
            _resultado,
            _pago_id,
        ) = fila
        alumno = f"{apellido}, {nombre}".strip(", ")
        return formato.SolicitudFila(
            referencia=referencia,
            factura=numero or str(factura_id),
            alumno=alumno,
            periodo=periodo or "",
            concepto=concepto,
            importe=importe,
            vencimiento=vencimiento,
            medio_dato=(
                formato.token_tarjeta_sintetico(factura_id)
                if medio == "tarjeta"
                else formato.cbu_sintetico(factura_id)
            ),
        )

    archivos = []
    por_medio: dict[str, list[formato.SolicitudFila]] = {}
    for fila in filas:
        medio = "tarjeta" if isinstance(fila.medio, str) and fila.medio == "tarjeta" else "cbu"
        por_medio.setdefault(medio, []).append(_fila(fila))
    if por_medio.get("cbu"):
        archivos.append(
            ArchivoRead(
                nombre=f"ESSERI_DEBITOS_{codigo}.csv",
                contenido=formato.generar_solicitud(por_medio["cbu"], "cbu"),
            )
        )
    if por_medio.get("tarjeta"):
        archivos.append(
            ArchivoRead(
                nombre=f"ESSERI_CREDITOS_{codigo}.csv",
                contenido=formato.generar_solicitud(por_medio["tarjeta"], "tarjeta"),
            )
        )
    if not archivos:
        raise SolicitudCobranzaInvalida("El lote no contiene facturas exportables.")
    return archivos


def obtener_lote(db: Session, lote_id: uuid.UUID) -> LoteCobranza:
    lote = db.scalar(
        select(LoteCobranza)
        .where(LoteCobranza.id == lote_id)
        .options(selectinload(LoteCobranza.items))
        .execution_options(populate_existing=True)
    )
    if lote is None:
        raise LoteCobranzaNoEncontrado()
    return lote


def _nombre_usuario(db: Session, usuario_id: uuid.UUID | None) -> str:
    if usuario_id is None:
        return "Sistema"
    fila = db.execute(
        select(Usuario.email, Persona.nombre, Persona.apellido)
        .outerjoin(Persona, Usuario.persona_id == Persona.id)
        .where(Usuario.id == usuario_id)
    ).first()
    if fila is None:
        return "Sistema"
    email, nombre, apellido = fila
    return f"{nombre or ''} {apellido or ''}".strip() or email


def _codigo(lote: LoteCobranza) -> str:
    return lote.codigo or f"LD-{lote.fecha:%Y-%m}-{lote.id.hex[:8].upper()}"


def _periodo(lote: LoteCobranza) -> str:
    return lote.periodo or f"{lote.fecha:%Y-%m}"


def _importacion_vigente(db: Session, lote_id: uuid.UUID) -> ImportacionCobranza | None:
    confirmada = db.scalar(
        select(ImportacionCobranza)
        .where(
            ImportacionCobranza.lote_id == lote_id,
            ImportacionCobranza.estado == "confirmada",
        )
        .order_by(ImportacionCobranza.created_at.desc(), ImportacionCobranza.id.desc())
    )
    if confirmada is not None:
        return confirmada
    return db.scalar(
        select(ImportacionCobranza)
        .where(ImportacionCobranza.lote_id == lote_id)
        .order_by(ImportacionCobranza.created_at.desc(), ImportacionCobranza.id.desc())
    )


def resumen_lote(db: Session, lote: LoteCobranza) -> BatchSummaryRead:
    importacion = _importacion_vigente(db, lote.id)
    liberacion = None
    if lote.liberado_por_id is not None and lote.liberado_at is not None:
        liberacion = LiberacionRead(
            usuario_id=lote.liberado_por_id,
            usuario_nombre=_nombre_usuario(db, lote.liberado_por_id),
            fecha=lote.liberado_at,
            motivo=lote.motivo_liberacion or "",
        )
    return BatchSummaryRead(
        id=lote.id,
        codigo=_codigo(lote),
        fecha_exportacion=lote.fecha,
        periodo=_periodo(lote),
        cantidad_facturas=len(lote.items),
        importe_total=sum((item.importe for item in lote.items), Decimal("0.00")),
        estado=lote.estado,
        resultados_importados=importacion is not None,
        importacion_id=importacion.id if importacion is not None else None,
        liberacion=liberacion,
    )


def leer_lote(db: Session, lote: LoteCobranza) -> LoteDetailRead:
    resumen = resumen_lote(db, lote)
    items = []
    for fila in _filas_lote(db, lote.id):
        (
            referencia,
            factura_id,
            numero,
            _periodo_fila,
            _medio,
            nombre,
            apellido,
            vencimiento,
            concepto,
            importe,
            resultado,
            pago_id,
        ) = fila
        items.append(
            DebitoRead(
                referencia=referencia,
                factura_id=factura_id,
                numero=numero,
                alumno_nombre=f"{apellido}, {nombre}".strip(", ") or None,
                importe=importe,
                vencimiento=vencimiento,
                concepto=concepto,
                resultado=resultado,
                pago_id=pago_id,
            )
        )
    return LoteDetailRead(
        **resumen.model_dump(),
        items=items,
        solicitudes=_solicitudes(db, lote, resumen.codigo),
    )


def crear_lote(db: Session, datos: LoteCreate, usuario_id: uuid.UUID) -> LoteDetailRead:
    if datos.seleccion is not None and datos.factura_ids is not None:
        raise SolicitudCobranzaInvalida("Enviá una selección o factura_ids, no ambos.")
    if datos.seleccion is not None:
        seleccion = datos.seleccion
    elif datos.factura_ids is not None:
        seleccion = Seleccion(modo="pagina", factura_ids=datos.factura_ids)
    else:
        raise SolicitudCobranzaInvalida("La solicitud no contiene facturas.")
    if len(seleccion.factura_ids) != len(set(seleccion.factura_ids)):
        raise SolicitudCobranzaInvalida("La selección contiene facturas repetidas.")

    _bloquear_escritura_sqlite(db)
    for intento in range(3):
        filas = _resolver(db, seleccion, bloquear=True)
        if not filas:
            raise SolicitudCobranzaInvalida("La selección no contiene facturas disponibles.")
        if len(filas) > MAX_FACTURAS_LOTE:
            raise SolicitudCobranzaInvalida(
                f"Un lote admite hasta {MAX_FACTURAS_LOTE} facturas."
            )
        periodo = datos.periodo or seleccion.filtros.periodo or _periodo_comun(filas)
        if seleccion.filtros.periodo and periodo != seleccion.filtros.periodo:
            raise SolicitudCobranzaInvalida(
                "El período del lote no coincide con el filtro de la selección."
            )
        distintas = sorted({fila.periodo for fila in filas} - {periodo})
        if distintas:
            raise SolicitudCobranzaInvalida(
                "Todas las facturas del lote deben pertenecer al período indicado "
                f"({', '.join(distintas)} no coincide)."
            )
        reservadas = set(
            db.scalars(
                select(DebitoCobranza.factura_id).where(
                    DebitoCobranza.factura_id.in_([fila.id for fila in filas]),
                    DebitoCobranza.reserva_activa.is_(True),
                )
            ).all()
        )
        if reservadas:
            raise CobranzaEnConflicto(
                "Una o más facturas ya están reservadas por otro lote. Actualizá la lista."
            )
        lote = LoteCobranza(
            codigo=_siguiente_codigo(db, periodo),
            periodo=periodo,
            fecha=fecha_operativa_argentina(),
            estado="exportado",
            usuario_id=usuario_id,
        )
        facturas = {
            factura.id: factura
            for factura in db.scalars(
                select(Factura)
                .where(Factura.id.in_([fila.id for fila in filas]))
                .options(selectinload(Factura.detalles))
            ).all()
        }
        for fila in filas:
            factura = facturas[fila.id]
            concepto = "; ".join(detalle.descripcion for detalle in factura.detalles)[:250]
            lote.items.append(
                DebitoCobranza(
                    factura_id=fila.id,
                    importe=fila.importe,
                    vencimiento=factura.fecha_vencimiento,
                    concepto=concepto,
                    reserva_activa=True,
                )
            )
        try:
            db.add(lote)
            db.flush()
            log_audit(
                db,
                entidad="LOTE_COBRANZA",
                entidad_id=lote.id,
                campo="__alta__",
                valor_anterior=None,
                valor_nuevo=f"codigo={lote.codigo}; registros={len(lote.items)}",
                usuario_id=usuario_id,
            )
            db.commit()
            return leer_lote(db, obtener_lote(db, lote.id))
        except IntegrityError as exc:
            db.rollback()
            if intento == 2:
                raise CobranzaEnConflicto(
                    "No se pudo reservar la selección porque otro lote tomó las facturas."
                ) from exc
            _bloquear_escritura_sqlite(db)
    raise CobranzaEnConflicto("No se pudo crear el lote; reintentá la operación.")


def listar_lotes(
    db: Session,
    *,
    periodo: str | None,
    estado: str | None,
    buscar: str | None,
    pagina: int,
    tamanio: int,
) -> HistorialLotesRead:
    consulta = select(LoteCobranza).options(selectinload(LoteCobranza.items))
    filtros = []
    if periodo:
        filtros.append(LoteCobranza.periodo == periodo)
    if estado:
        filtros.append(LoteCobranza.estado == estado)
    if buscar:
        patron = f"%{normalizar_texto_busqueda(buscar.strip())}%"
        filtros.append(
            or_(
                normalizar_columna_busqueda(LoteCobranza.codigo).like(patron),
                cast(LoteCobranza.id, String).ilike(patron),
            )
        )
    if filtros:
        consulta = consulta.where(*filtros)
    total = int(db.scalar(select(func.count()).select_from(consulta.subquery())) or 0)
    lotes = list(
        db.scalars(
            consulta.order_by(LoteCobranza.fecha.desc(), LoteCobranza.codigo.desc())
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        ).all()
    )
    return HistorialLotesRead(
        items=[resumen_lote(db, lote) for lote in lotes],
        total=total,
        pagina=pagina,
        tamanio=tamanio,
    )


def generar_respuesta(
    db: Session,
    lote_id: uuid.UUID,
    rechazos: list[uuid.UUID],
    rechazos_cantidad: int | None = None,
) -> ArchivoRead:
    lote = obtener_lote(db, lote_id)
    ids = {item.id for item in lote.items}
    if len(rechazos) != len(set(rechazos)) or not set(rechazos) <= ids:
        raise SolicitudCobranzaInvalida(
            "Las referencias de rechazo deben pertenecer a la solicitud sin repetirse."
        )
    if rechazos_cantidad is not None:
        candidatos = [item.id for item in sorted(lote.items, key=lambda item: item.id)]
        rechazos = list(
            dict.fromkeys(rechazos + candidatos[: min(rechazos_cantidad, len(candidatos))])
        )
    if len(rechazos) > len(lote.items):
        raise SolicitudCobranzaInvalida("La cantidad de rechazos supera los registros del lote.")
    rechazos_set = set(rechazos)
    fecha = fecha_operativa_argentina()
    rechazados = [item for item in lote.items if item.id in rechazos_set]
    motivos = {
        item.id: formato.MOTIVOS_RECHAZO_SIMULADOS[indice % len(formato.MOTIVOS_RECHAZO_SIMULADOS)]
        for indice, item in enumerate(rechazados)
    }
    filas = [
        formato.RespuestaDetalle(
            item.id,
            formato.RECHAZADO if item.id in rechazos_set else formato.COBRADO,
            item.importe,
            fecha,
            *(motivos[item.id] if item.id in rechazos_set else ("", "")),
        )
        for item in lote.items
    ]
    codigo = _codigo(lote)
    return ArchivoRead(
        nombre=f"ESSERI_RESPUESTA_{codigo}.csv",
        contenido=formato.generar_respuesta(lote.id, fecha, filas),
    )


def liberar_lote(
    db: Session,
    lote_id: uuid.UUID,
    *,
    motivo: str,
    confirmacion_no_procesado: bool,
    usuario_id: uuid.UUID,
) -> BatchSummaryRead:
    if not confirmacion_no_procesado or not motivo.strip():
        raise CobranzaInvalida(
            "Para liberar el lote tenés que indicar un motivo y confirmar que no se procesó."
        )
    _bloquear_escritura_sqlite(db)
    lote = db.scalar(
        select(LoteCobranza)
        .where(LoteCobranza.id == lote_id)
        .options(selectinload(LoteCobranza.items))
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if lote is None:
        raise LoteCobranzaNoEncontrado()
    if lote.estado == "liberado":
        return resumen_lote(db, lote)
    if lote.estado != "exportado":
        raise CobranzaEnConflicto(
            "El lote ya tiene resultados importados o pagos registrados; no se puede liberar."
        )
    if db.scalar(select(ImportacionCobranza.id).where(ImportacionCobranza.lote_id == lote.id)):
        raise CobranzaEnConflicto(
            "El lote tiene una vista previa persistida; no se puede liberar."
        )
    db.execute(
        update(DebitoCobranza)
        .where(DebitoCobranza.lote_id == lote.id)
        .values(reserva_activa=False)
        .execution_options(synchronize_session=False)
    )
    lote.estado = "liberado"
    lote.liberado_por_id = usuario_id
    lote.liberado_at = datetime.now(UTC)
    lote.motivo_liberacion = motivo.strip()
    log_audit(
        db,
        entidad="LOTE_COBRANZA",
        entidad_id=lote.id,
        campo="__liberacion__",
        valor_anterior="exportado",
        valor_nuevo=f"liberado; motivo={lote.motivo_liberacion}",
        usuario_id=usuario_id,
    )
    db.commit()
    lote = obtener_lote(db, lote.id)
    return resumen_lote(db, lote)


def listar_liberaciones(db: Session, *, pagina: int, tamanio: int) -> LiberacionesRead:
    consulta = select(LoteCobranza).where(LoteCobranza.estado == "liberado")
    total = int(db.scalar(select(func.count()).select_from(consulta.subquery())) or 0)
    lotes = list(
        db.scalars(
            consulta.options(selectinload(LoteCobranza.items))
            .order_by(LoteCobranza.liberado_at.desc(), LoteCobranza.codigo.desc())
            .offset((pagina - 1) * tamanio)
            .limit(tamanio)
        ).all()
    )
    items = [
        LiberacionItemRead(
            lote_id=lote.id,
            codigo=_codigo(lote),
            cantidad_facturas=len(lote.items),
            usuario_id=lote.liberado_por_id,
            usuario_nombre=_nombre_usuario(db, lote.liberado_por_id),
            fecha=lote.liberado_at,
            motivo=lote.motivo_liberacion or "",
        )
        for lote in lotes
    ]
    return LiberacionesRead(
        items=items, total=total, pagina=pagina, tamanio=tamanio
    )
