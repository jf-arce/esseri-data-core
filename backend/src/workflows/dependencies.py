"""Dependencias HTTP propias de Workflows y Notificaciones."""

import uuid
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.workflows import plantillas_service, service
from src.workflows.exceptions import PlantillaNoEncontrada, ReglaNoEncontrada
from src.workflows.models import NotificacionTemplate, WorkflowRule

DbSession = Annotated[Session, Depends(get_db)]


def obtener_regla_o_404(regla_id: uuid.UUID, db: DbSession) -> WorkflowRule:
    regla = service.obtener_regla(db, regla_id)
    if regla is None:
        raise ReglaNoEncontrada()
    return regla


def obtener_plantilla_o_404(plantilla_id: uuid.UUID, db: DbSession) -> NotificacionTemplate:
    plantilla = plantillas_service.obtener_plantilla(db, plantilla_id)
    if plantilla is None:
        raise PlantillaNoEncontrada()
    return plantilla
