"""Capa de consulta sobre tablas de otros módulos. Sin modelo propio.

RF-13/RF-14: historial de cambios de campo de una entidad, contra `AUDIT_LOG` (no confundir
con `EVENT_LOG`, hechos de negocio append-only que consume el motor de Workflows).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import AuditLog


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
