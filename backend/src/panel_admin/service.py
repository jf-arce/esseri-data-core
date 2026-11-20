"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

La deuda se lee del libro de `CuentaCorriente`/`Movimiento` a través de `cuenta_corriente_service`;
este módulo no reimplementa saldos.
"""

from collections.abc import Set
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.orm import Session

from src.facturacion.calendario_facturacion import fecha_operativa_argentina
from src.facturacion.cuenta_corriente_service import total_deuda
from src.facturacion.models import Factura, Pago, ResponsableEconomico
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import AuditLog, EventLog, Persona
from src.proveedores_compras.models import ProductoServicio, SolicitudCompra
from src.workflows.models import Tarea, TipoEvento


def obtener_indicadores_direccion(
    db: Session, *, fecha_hoy: date | None = None, ciclo_lectivo: str | None = None
) -> dict[str, int | Decimal | date | None]:
    """Indicadores de RF-31 con contexto.

    `ciclo_lectivo` acota deuda, inasistencias y altas/bajas, que sí tienen ciclo. `alumnos_activos`
    y los contadores de trabajo no dependen del ciclo y se devuelven globales.
    """
    hoy = fecha_hoy or fecha_operativa_argentina()
    inicio_mes = hoy.replace(day=1)
    deuda = total_deuda(db, fecha_referencia=hoy, ciclo_lectivo=ciclo_lectivo)

    def inscripciones_del_mes(tipo: str) -> int:
        filtros = [
            Inscripcion.tipo == tipo,
            Inscripcion.fecha_inscripcion >= inicio_mes,
            Inscripcion.fecha_inscripcion <= hoy,
        ]
        if ciclo_lectivo is not None:
            filtros.append(Inscripcion.ciclo_lectivo == ciclo_lectivo)
        return db.scalar(select(func.count(Inscripcion.id)).where(*filtros)) or 0

    filtros_asistencia = [Asistencia.fecha == hoy]
    if ciclo_lectivo is not None:
        filtros_asistencia.append(
            Asistencia.inscripcion_id.in_(
                select(Inscripcion.id).where(Inscripcion.ciclo_lectivo == ciclo_lectivo)
            )
        )
    alumnos_activos = db.scalar(select(func.count(Alumno.id)).where(Alumno.estado == "activo")) or 0
    inasistencias_hoy = (
        db.scalar(
            select(func.count(Asistencia.id)).where(
                *filtros_asistencia, Asistencia.tipo.like("ausente%")
            )
        )
        or 0
    )
    asistencias_registradas_hoy = (
        db.scalar(select(func.count(Asistencia.id)).where(*filtros_asistencia)) or 0
    )
    solicitudes_compra_pendientes = (
        db.scalar(
            select(func.count(SolicitudCompra.id)).where(SolicitudCompra.estado == "pendiente")
        )
        or 0
    )
    tareas_por_estado = dict(
        db.execute(
            select(Tarea.estado, func.count(Tarea.id))
            .where(Tarea.estado.in_(("pendiente", "escalada")))
            .group_by(Tarea.estado)
        ).all()
    )

    return {
        "alumnos_activos": alumnos_activos,
        "deuda_pendiente_total": deuda["total"],
        "inasistencias_hoy": inasistencias_hoy,
        "solicitudes_compra_pendientes": solicitudes_compra_pendientes,
        "deuda_vencida_total": deuda["vencida"],
        "familias_en_mora": deuda["familias_en_mora"],
        "altas_mes": inscripciones_del_mes("nueva"),
        "bajas_mes": inscripciones_del_mes("baja"),
        "asistencias_registradas_hoy": asistencias_registradas_hoy,
        "solicitud_pendiente_mas_antigua": db.scalar(
            select(func.min(SolicitudCompra.fecha)).where(SolicitudCompra.estado == "pendiente")
        ),
        "tareas_pendientes": int(tareas_por_estado.get("pendiente", 0)),
        "tareas_escaladas": int(tareas_por_estado.get("escalada", 0)),
    }


def obtener_indicadores_administracion(
    db: Session,
    *,
    fecha_hoy: date | None = None,
    incluir_facturacion: bool = True,
    incluir_compras: bool = True,
) -> dict[str, Decimal | int | None]:
    """Tres indicadores operativos del panel de Administración.

    Cada bloque se omite (`None`) cuando el rol activo no tiene el permiso del módulo dueño, igual
    que el feed de Dirección: el panel no muestra datos de un módulo que el rol no puede abrir.
    """
    hoy = fecha_hoy or fecha_operativa_argentina()
    facturacion: dict[str, Decimal | int | None] = {
        "facturas_vencidas": None,
        "cobrado_mes": None,
    }
    if incluir_facturacion:
        deuda = total_deuda(db, fecha_referencia=hoy)
        meses = obtener_evolucion_financiera(db, fecha_hoy=hoy)
        facturacion = {
            "facturas_vencidas": deuda["facturas_vencidas"],
            "cobrado_mes": meses[-1]["cobrado"] if meses else Decimal("0.00"),
        }
    compras = (
        db.scalar(
            select(func.count(SolicitudCompra.id)).where(SolicitudCompra.estado == "pendiente")
        )
        or 0
        if incluir_compras
        else None
    )
    return {**facturacion, "solicitudes_compra_pendientes": compras}


def obtener_evolucion_financiera(
    db: Session,
    *,
    fecha_hoy: date | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[dict]:
    """Aggregate issued invoices and approved receipts separately, never expenses.

    Sin fechas, devuelve el año en curso hasta hoy; con `desde` y `hasta`, mes a mes en ese rango.
    """
    hoy = fecha_hoy or date.today()
    fin = hasta or hoy
    inicio = desde or date(fin.year, 1, 1)

    def totales_por_mes(fecha, monto, *condiciones):
        anio = extract("year", fecha)
        mes = extract("month", fecha)
        filas = db.execute(
            select(anio, mes, func.sum(monto))
            .where(fecha >= inicio, fecha <= fin, *condiciones)
            .group_by(anio, mes)
        ).all()
        return {(int(a), int(m)): total for a, m, total in filas}

    facturado = totales_por_mes(Factura.fecha_emision, Factura.monto_total)
    cobrado = totales_por_mes(Pago.fecha, Pago.monto, Pago.estado == "aprobado")
    meses = []
    anio, mes = inicio.year, inicio.month
    while (anio, mes) <= (fin.year, fin.month):
        meses.append(
            {
                "mes": f"{anio}-{mes:02d}",
                "facturado": facturado.get((anio, mes), Decimal("0")),
                "cobrado": cobrado.get((anio, mes), Decimal("0")),
            }
        )
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return meses


# Hechos de negocio que sí quedan en `EVENT_LOG`. La asistencia se registra por clase, pero no
# existe una regla de "alerta relevante" definida por el negocio: mostrarla acá afirmaría un
# criterio que el sistema no tiene. Por eso no se incluye.
EVENTOS_POR_CATEGORIA: dict[str, tuple[str, ...]] = {
    "finanzas": ("pago.registrado", "factura.vencida"),
    "compras": ("orden_compra.emitida", "recepcion_compra.registrada"),
    "alumnos": ("inscripcion.cambio_matricula",),
}

_TITULOS_MATRICULA = {
    "nueva": "Alta de matrícula",
    "reinscripcion": "Reinscripción registrada",
    "baja": "Baja de matrícula",
}


def _instante_utc(valor: datetime) -> datetime:
    """Las columnas auditadas son `DateTime` sin zona: el proyecto las escribe y las lee en UTC."""
    return valor.replace(tzinfo=UTC) if valor.tzinfo is None else valor.astimezone(UTC)


def _texto(payload: dict | None, clave: str) -> str | None:
    valor = (payload or {}).get(clave)
    return str(valor) if valor not in (None, "") else None


def _datos_de_pagos(db: Session, pagos_ids: list) -> dict:
    """Familia y monto real de cada pago; el payload del evento no trae esos datos."""
    if not pagos_ids:
        return {}
    filas = db.execute(
        select(Pago.id, Pago.monto, Persona.nombre, Persona.apellido)
        .join(Factura, Factura.id == Pago.factura_id)
        .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
        .join(Familia, Familia.id == ResponsableEconomico.familia_id)
        .join(Persona, Persona.id == Familia.persona_id)
        .where(Pago.id.in_(pagos_ids))
    ).all()
    return {
        pago_id: (f"{apellido}, {nombre}" if apellido and nombre else None, monto)
        for pago_id, monto, nombre, apellido in filas
    }


def _fila_evento(evento: EventLog, nombre: str, pagos: dict) -> dict:
    payload = evento.payload or {}
    comun = {
        "id": f"evento:{evento.id}",
        "ocurrido_en": _instante_utc(evento.timestamp),
        "monto": None,
        "referencia": None,
        "detalle": None,
    }
    if nombre == "pago.registrado":
        referencia, monto = pagos.get(evento.entidad_id, (None, None))
        return {
            **comun,
            "categoria": "finanzas",
            "tipo": "pago_registrado",
            "titulo": "Pago registrado",
            "referencia": referencia,
            "detalle": _texto(payload, "metodo_pago"),
            "estado": "registrado",
            "monto": monto,
        }
    if nombre == "factura.vencida":
        dias = _texto(payload, "dias_vencido")
        monto = payload.get("monto_deuda")
        return {
            **comun,
            "categoria": "finanzas",
            "tipo": "factura_vencida",
            "titulo": "Factura vencida",
            "referencia": _texto(payload, "nombre_familia"),
            "detalle": f"Vencida hace {dias} días" if dias else None,
            "estado": "vencida",
            "monto": Decimal(str(monto)) if monto is not None else None,
        }
    if nombre == "orden_compra.emitida":
        cantidad = _texto(payload, "cantidad_items")
        return {
            **comun,
            "categoria": "compras",
            "tipo": "orden_compra_emitida",
            "titulo": "Orden de compra emitida",
            "referencia": _texto(payload, "proveedor_nombre"),
            "detalle": f"{cantidad} ítems" if cantidad else None,
            "estado": "emitida",
        }
    if nombre == "recepcion_compra.registrada":
        tipo_recepcion = _texto(payload, "tipo_recepcion")
        return {
            **comun,
            "categoria": "compras",
            "tipo": "recepcion_compra_registrada",
            "titulo": "Recepción de compra registrada",
            "referencia": _texto(payload, "proveedor_nombre"),
            "detalle": f"Recepción {tipo_recepcion}" if tipo_recepcion else None,
            "estado": "recibida",
        }
    tipo_cambio = _texto(payload, "tipo_cambio")
    return {
        **comun,
        "categoria": "alumnos",
        "tipo": "cambio_matricula",
        "titulo": "Cambio de matrícula",
        "referencia": _texto(payload, "alumno_nombre"),
        "detalle": (
            "Cambio de nivel"
            if tipo_cambio == "nivel"
            else "Cambio de división"
            if tipo_cambio == "division"
            else None
        ),
        "estado": "cambio",
    }


def _filas_eventos(db: Session, categorias: Set[str], limite: int) -> list[dict]:
    tipos = [tipo for categoria in categorias for tipo in EVENTOS_POR_CATEGORIA.get(categoria, ())]
    if not tipos:
        return []
    filas = db.execute(
        select(EventLog, TipoEvento.nombre)
        .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
        .where(TipoEvento.nombre.in_(tipos))
        .order_by(EventLog.timestamp.desc())
        .limit(limite)
    ).all()
    pagos = _datos_de_pagos(
        db, [evento.entidad_id for evento, nombre in filas if nombre == "pago.registrado"]
    )
    return [_fila_evento(evento, nombre, pagos) for evento, nombre in filas]


def _filas_solicitudes(db: Session, limite: int) -> list[dict]:
    """Altas y decisiones de solicitud: solo existen como cambios de campo en `AUDIT_LOG`."""
    filas = db.execute(
        select(AuditLog, SolicitudCompra, ProductoServicio.nombre)
        .join(SolicitudCompra, SolicitudCompra.id == AuditLog.entidad_id)
        .outerjoin(ProductoServicio, ProductoServicio.id == SolicitudCompra.producto_servicio_id)
        .where(
            func.lower(AuditLog.entidad) == "solicitud_compra",
            or_(
                AuditLog.campo == "__alta__",
                and_(
                    AuditLog.campo == "estado",
                    AuditLog.valor_nuevo.in_(("aprobada", "rechazada")),
                ),
            ),
        )
        .order_by(AuditLog.fecha.desc())
        .limit(limite)
    ).all()
    resultado = []
    for registro, solicitud, nombre_producto in filas:
        es_alta = registro.campo == "__alta__"
        estado = "pendiente" if es_alta else registro.valor_nuevo
        titulo = (
            "Solicitud de compra creada"
            if es_alta
            else "Solicitud de compra aprobada"
            if estado == "aprobada"
            else "Solicitud de compra rechazada"
        )
        resultado.append(
            {
                "id": f"auditoria:{registro.id}",
                "categoria": "compras",
                "tipo": "solicitud_compra_creada" if es_alta else f"solicitud_compra_{estado}",
                "titulo": titulo,
                "referencia": solicitud.articulo or nombre_producto,
                "detalle": solicitud.area_solicitante,
                "estado": estado,
                "monto": None,
                "ocurrido_en": _instante_utc(registro.fecha),
            }
        )
    return resultado


def _filas_matriculas(db: Session, limite: int) -> list[dict]:
    """Altas y bajas de matrícula: `AUDIT_LOG` guarda el alta y el tipo de inscripción."""
    filas = db.execute(
        select(AuditLog, Inscripcion, Persona.nombre, Persona.apellido)
        .join(Inscripcion, Inscripcion.id == AuditLog.entidad_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .where(
            func.lower(AuditLog.entidad) == "inscripcion",
            AuditLog.campo == "__alta__",
            Inscripcion.tipo.in_(tuple(_TITULOS_MATRICULA)),
        )
        .order_by(AuditLog.fecha.desc())
        .limit(limite)
    ).all()
    return [
        {
            "id": f"auditoria:{registro.id}",
            "categoria": "alumnos",
            "tipo": "matricula_baja" if inscripcion.tipo == "baja" else "matricula_alta",
            "titulo": _TITULOS_MATRICULA[inscripcion.tipo],
            "referencia": f"{apellido}, {nombre}",
            "detalle": f"Ciclo {inscripcion.ciclo_lectivo}",
            "estado": "baja" if inscripcion.tipo == "baja" else "alta",
            "monto": None,
            "ocurrido_en": _instante_utc(registro.fecha),
        }
        for registro, inscripcion, nombre, apellido in filas
    ]


def obtener_actividad_reciente(db: Session, *, categorias: Set[str], limite: int = 8) -> list[dict]:
    """Hechos ya ocurridos, de la más reciente a la más antigua.

    `limite` es por categoría, no global: así una categoría con mucho movimiento no deja afuera
    a las demás. Solo consulta las categorías que el rol activo puede ver. No completa categorías
    vacías ni deriva hechos que el sistema no registró: si no hay filas, la lista queda vacía.
    """

    def recientes(filas: list[dict]) -> list[dict]:
        return sorted(filas, key=lambda fila: fila["ocurrido_en"], reverse=True)[:limite]

    resultado: list[dict] = []
    for categoria in sorted(categorias & set(EVENTOS_POR_CATEGORIA)):
        filas = _filas_eventos(db, {categoria}, limite)
        if categoria == "compras":
            filas.extend(_filas_solicitudes(db, limite))
        elif categoria == "alumnos":
            filas.extend(_filas_matriculas(db, limite))
        resultado.extend(recientes(filas))
    return sorted(resultado, key=lambda fila: fila["ocurrido_en"], reverse=True)
