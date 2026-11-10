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
    return [
        {
            "id": registro.id,
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
        for registro, email in filas
    ]
