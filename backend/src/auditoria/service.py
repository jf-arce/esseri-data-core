"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

RF-13/RF-14: historial de cambios de campo de una entidad, contra `AUDIT_LOG` (no confundir
con `EVENT_LOG`, hechos de negocio append-only que consume el motor de Workflows).

`log_audit()` es el helper de escritura que consume cada módulo dueño de una entidad auditada
(hoy: `familias_alumnos`) — vive acá y no en `src/models.py` junto al modelo porque, a
diferencia de una entidad compartida, esto es lógica de negocio (une AUDIT_LOG con el `Usuario`
autenticado), y este módulo ya es el dueño conceptual de AUDIT_LOG del lado de lectura.
"""

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import AuditLog


def log_audit(
    db: Session,
    *,
    entidad: str,
    entidad_id: uuid.UUID,
    campo: str,
    valor_anterior: str | None,
    valor_nuevo: str | None,
    usuario_id: uuid.UUID | None,
) -> None:
    """Registra un cambio de campo en AUDIT_LOG.

    No hace `commit`: queda a cargo de la transacción del llamador (varios módulos, como el
    alta integrada de Admisiones, hacen un único `commit` al final de una operación con varios
    pasos). Sin `usuario_id` no hay quién auditar (columna NOT NULL) — se omite en vez de
    fallar, para no romper llamadores que todavía no tienen un usuario autenticado real (tests,
    scripts de carga).
    """
    if usuario_id is None:
        return
    db.add(
        AuditLog(
            entidad=entidad,
            entidad_id=entidad_id,
            campo=campo,
            valor_anterior=valor_anterior,
            valor_nuevo=valor_nuevo,
            fecha=datetime.now(),
            usuario_id=usuario_id,
        )
    )


def listar_historial_entidad(db: Session, entidad: str, entidad_id: uuid.UUID) -> list[dict]:
    """Cambios de campo de una entidad, del más antiguo al más reciente."""
    filas = db.execute(
        select(AuditLog, Usuario.email)
        .join(Usuario, Usuario.id == AuditLog.usuario_id)
        .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
        .order_by(AuditLog.fecha)
    ).all()
    return [
        {
            "id": registro.id,
            "campo": registro.campo,
            "valor_anterior": registro.valor_anterior,
            "valor_nuevo": registro.valor_nuevo,
            "fecha": registro.fecha,
            "usuario_id": registro.usuario_id,
            "usuario_email": email,
        }
        for registro, email in filas
    ]
