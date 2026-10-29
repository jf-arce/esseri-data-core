"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

La deuda es transitoria: se obtiene de facturas menos pagos aprobados. Cuando se implemente
#83, este cálculo debe migrar al saldo derivado de ``CuentaCorriente``/``Movimiento``.
"""

from collections.abc import Set
from datetime import UTC, date, datetime
from decimal import Decimal

from sqlalchemy import and_, extract, func, or_, select
from sqlalchemy.orm import Session

from src.facturacion.models import Factura, Pago, ResponsableEconomico
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import AuditLog, EventLog, Persona
from src.proveedores_compras.models import ProductoServicio, SolicitudCompra
from src.workflows.models import TipoEvento


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


def obtener_evolucion_financiera(db: Session, *, fecha_hoy: date | None = None) -> list[dict]:
    """Aggregate issued invoices and approved receipts separately, never expenses."""
    hoy = fecha_hoy or date.today()
    inicio = date(hoy.year, 1, 1)

    def totales_por_mes(fecha, monto, *condiciones):
        mes = extract("month", fecha)
        return dict(
            db.execute(
                select(mes, func.sum(monto))
                .where(fecha >= inicio, fecha <= hoy, *condiciones)
                .group_by(mes)
            ).all()
        )

    facturado = totales_por_mes(Factura.fecha_emision, Factura.monto_total)
    cobrado = totales_por_mes(Pago.fecha, Pago.monto, Pago.estado == "aprobado")
    return [
        {
            "mes": f"{hoy.year}-{mes:02d}",
            "facturado": facturado.get(mes, Decimal("0")),
            "cobrado": cobrado.get(mes, Decimal("0")),
        }
        for mes in range(1, hoy.month + 1)
    ]


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

    Solo consulta las categorías que el rol activo puede ver. No completa categorías vacías ni
    deriva hechos que el sistema no registró: si no hay filas, la lista queda vacía.
    """
    filas = _filas_eventos(db, categorias, limite)
    if "compras" in categorias:
        filas.extend(_filas_solicitudes(db, limite))
    if "alumnos" in categorias:
        filas.extend(_filas_matriculas(db, limite))
    filas.sort(key=lambda fila: fila["ocurrido_en"], reverse=True)
    return filas[:limite]
