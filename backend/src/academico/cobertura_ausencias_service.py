"""Regla compartida de cobertura por solicitud de ausencia.

Una solicitud pendiente o aprobada suspende los avisos de ausencia de las fechas que cubre.
Cada llamador conserva su política de entrega: Workflows mantiene sus guardas de destino y el
recordatorio individual, y la bandeja interna solo evita generar avisos nuevos. Rechazar una
solicitud no vuelve a generar avisos retroactivos.
"""

import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import SolicitudAusenciaPeriodo

ESTADOS_QUE_CUBREN = ("pendiente", "aprobada")


def solicitud_periodo_que_cubre(
    db: Session, *, alumno_id: uuid.UUID, fecha: date
) -> uuid.UUID | None:
    """ID de la solicitud pendiente o aprobada que cubre `fecha`, si existe."""
    return db.scalar(
        select(SolicitudAusenciaPeriodo.id)
        .where(
            SolicitudAusenciaPeriodo.alumno_id == alumno_id,
            SolicitudAusenciaPeriodo.estado.in_(ESTADOS_QUE_CUBREN),
            SolicitudAusenciaPeriodo.fecha_inicio <= fecha,
            SolicitudAusenciaPeriodo.fecha_fin >= fecha,
        )
        .limit(1)
    )
