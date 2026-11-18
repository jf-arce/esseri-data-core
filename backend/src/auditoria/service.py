"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

RF-13/RF-14: historial de cambios de campo de una entidad, contra `AUDIT_LOG` (no confundir
con `EVENT_LOG`, hechos de negocio append-only que consume el motor de Workflows).

`log_audit()` es el helper de escritura que consume cada módulo dueño de una entidad auditada
(hoy: `familias_alumnos`) — vive acá y no en `src/models.py` junto al modelo porque, a
diferencia de una entidad compartida, esto es lógica de negocio (une AUDIT_LOG con el `Usuario`
autenticado), y este módulo ya es el dueño conceptual de AUDIT_LOG del lado de lectura.
"""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import AuditLog

# El filtro de fechas del listado llega como día local (es el que ve el administrador en pantalla,
# ya convertido a hora argentina). AUDIT_LOG guarda UTC sin zona, así que cada extremo se convierte
# acá en vez de comparar días UTC: si no, se pierden los registros de las últimas 3 h del día
# "hasta" y se cuelan los de las 21-23 h del día anterior al "desde".
ZONA_HORARIA_ARGENTINA = ZoneInfo("America/Argentina/Buenos_Aires")


def log_audit(
    db: Session,
    *,
    entidad: str,
    entidad_id: uuid.UUID,
    campo: str,
    valor_anterior: str | None,
    valor_nuevo: str | None,
    usuario_id: uuid.UUID | None,
    actor_tipo: str = "usuario",
    origen: str | None = None,
    motivo: str | None = None,
    referencia_entidad: str | None = None,
    referencia_id: uuid.UUID | None = None,
) -> AuditLog:
    """Registra un cambio de campo en AUDIT_LOG y devuelve la fila creada.

    No hace `commit`: queda a cargo de la transacción del llamador. Las operaciones
    automáticas se registran con `usuario_id=None` y `actor_tipo='sistema'`; su desencadenante
    se conserva en `referencia_entidad`/`referencia_id` (por ejemplo, la auditoría del alta de
    asistencia o la solicitud de período). No se omite ninguna operación por falta de usuario.
    """
    if actor_tipo not in {"usuario", "sistema"}:
        raise ValueError("actor_tipo debe ser 'usuario' o 'sistema'")
    if usuario_id is None:
        actor_tipo = "sistema"
    elif actor_tipo == "sistema":
        raise ValueError("Una auditoría de sistema no puede atribuirse a un usuario")
    registro = AuditLog(
        id=uuid.uuid4(),
        entidad=entidad,
        entidad_id=entidad_id,
        campo=campo,
        valor_anterior=valor_anterior,
        valor_nuevo=valor_nuevo,
        fecha=datetime.now(),
        usuario_id=usuario_id,
        actor_tipo=actor_tipo,
        origen=origen,
        motivo=motivo,
        referencia_entidad=referencia_entidad,
        referencia_id=referencia_id,
    )
    db.add(registro)
    return registro


def listar_historial_entidad(db: Session, entidad: str, entidad_id: uuid.UUID) -> list[dict]:
    """Cambios de campo de una entidad, del más antiguo al más reciente."""
    filas = db.execute(
        select(AuditLog, Usuario.email)
        .outerjoin(Usuario, Usuario.id == AuditLog.usuario_id)
        .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
        .order_by(AuditLog.fecha)
    ).all()
    return [_fila_auditoria(registro, email) for registro, email in filas]


def listar_auditoria(
    db: Session,
    *,
    entidad: str | None = None,
    campo: str | None = None,
    usuario_id: uuid.UUID | None = None,
    actor_tipo: str | None = None,
    origen: str | None = None,
    referencia_entidad: str | None = None,
    referencia_id: uuid.UUID | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    buscar: str | None = None,
    orden: str = "fecha-desc",
    pagina: int = 1,
    tamanio_pagina: int = 20,
) -> dict:
    """Listado global de AUDIT_LOG para el administrador, con filtros y paginación.

    `entidad` y `referencia_entidad` se comparan sin distinguir mayúsculas porque
    AUDIT_LOG guarda valores históricos con capitalización inconsistente (`alumno` y
    `ALUMNO` conviven). `desde`/`hasta` son días inclusivos, interpretados en la zona
    horaria argentina (la misma con la que la UI muestra los registros).
    """
    filtros = _filtros_auditoria(
        entidad=entidad,
        campo=campo,
        usuario_id=usuario_id,
        actor_tipo=actor_tipo,
        origen=origen,
        referencia_entidad=referencia_entidad,
        referencia_id=referencia_id,
        desde=desde,
        hasta=hasta,
        buscar=buscar,
    )
    total = (
        db.scalar(
            select(func.count(AuditLog.id))
            .select_from(AuditLog)
            .outerjoin(Usuario, Usuario.id == AuditLog.usuario_id)
            .where(*filtros)
        )
        or 0
    )
    if orden == "fecha-asc":
        ordenamiento = (AuditLog.fecha.asc(), AuditLog.id.asc())
    else:
        ordenamiento = (AuditLog.fecha.desc(), AuditLog.id.desc())
    filas = db.execute(
        select(AuditLog, Usuario.email)
        .outerjoin(Usuario, Usuario.id == AuditLog.usuario_id)
        .where(*filtros)
        .order_by(*ordenamiento)
        .offset((pagina - 1) * tamanio_pagina)
        .limit(tamanio_pagina)
    ).all()
    return {
        "items": [_fila_auditoria(registro, email) for registro, email in filas],
        "total": total,
        "pagina": pagina,
        "tamanio_pagina": tamanio_pagina,
        "total_paginas": (total + tamanio_pagina - 1) // tamanio_pagina,
    }


def listar_opciones_auditoria(db: Session) -> dict:
    """Valores disponibles para los filtros del listado global.

    `entidades` se devuelve normalizado a minúsculas y sin duplicados: el filtro es
    insensible a mayúsculas, así que `alumno` y `ALUMNO` son una sola opción.
    """
    entidades = db.scalars(select(AuditLog.entidad).distinct()).all()
    campos = db.scalars(select(AuditLog.campo).distinct().order_by(AuditLog.campo)).all()
    origenes = db.scalars(
        select(AuditLog.origen)
        .where(AuditLog.origen.is_not(None))
        .distinct()
        .order_by(AuditLog.origen)
    ).all()
    usuarios = db.execute(
        select(Usuario.id, Usuario.email)
        .where(Usuario.id.in_(select(AuditLog.usuario_id).where(AuditLog.usuario_id.is_not(None))))
        .order_by(Usuario.email)
    ).all()
    return {
        "entidades": sorted({valor.lower() for valor in entidades}),
        "campos": list(campos),
        "origenes": list(origenes),
        "usuarios": [{"id": id_, "email": email} for id_, email in usuarios],
    }


def _filtros_auditoria(
    *,
    entidad: str | None,
    campo: str | None,
    usuario_id: uuid.UUID | None,
    actor_tipo: str | None,
    origen: str | None,
    referencia_entidad: str | None,
    referencia_id: uuid.UUID | None,
    desde: date | None,
    hasta: date | None,
    buscar: str | None,
) -> list:
    filtros = []
    if entidad:
        filtros.append(func.lower(AuditLog.entidad) == entidad.strip().lower())
    if campo:
        filtros.append(AuditLog.campo == campo)
    if usuario_id is not None:
        filtros.append(AuditLog.usuario_id == usuario_id)
    if actor_tipo:
        filtros.append(AuditLog.actor_tipo == actor_tipo)
    if origen:
        filtros.append(AuditLog.origen == origen)
    if referencia_entidad:
        filtros.append(
            func.lower(AuditLog.referencia_entidad) == referencia_entidad.strip().lower()
        )
    if referencia_id is not None:
        filtros.append(AuditLog.referencia_id == referencia_id)
    if desde is not None:
        filtros.append(AuditLog.fecha >= _instante_en_utc(desde))
    if hasta is not None:
        filtros.append(AuditLog.fecha < _instante_en_utc(hasta + timedelta(days=1)))
    termino = (buscar or "").strip()
    if termino:
        patron = f"%{termino}%"
        filtros.append(
            or_(
                AuditLog.entidad.ilike(patron),
                AuditLog.campo.ilike(patron),
                AuditLog.valor_anterior.ilike(patron),
                AuditLog.valor_nuevo.ilike(patron),
                AuditLog.origen.ilike(patron),
                AuditLog.motivo.ilike(patron),
                AuditLog.referencia_entidad.ilike(patron),
                Usuario.email.ilike(patron),
            )
        )
    return filtros


def _instante_en_utc(dia: date) -> datetime:
    """Medianoche de un día argentino, en UTC sin zona (como se guarda `AuditLog.fecha`)."""
    return (
        datetime.combine(dia, time.min, tzinfo=ZONA_HORARIA_ARGENTINA)
        .astimezone(UTC)
        .replace(tzinfo=None)
    )


def _fila_auditoria(registro: AuditLog, email: str | None) -> dict:
    return {
        "id": registro.id,
        "entidad": registro.entidad,
        "entidad_id": registro.entidad_id,
        "campo": registro.campo,
        "valor_anterior": registro.valor_anterior,
        "valor_nuevo": registro.valor_nuevo,
        "fecha": registro.fecha,
        "usuario_id": registro.usuario_id,
        "usuario_email": email,
        "actor_tipo": registro.actor_tipo,
        "origen": registro.origen,
        "motivo": registro.motivo,
        "referencia_entidad": registro.referencia_entidad,
        "referencia_id": registro.referencia_id,
    }
