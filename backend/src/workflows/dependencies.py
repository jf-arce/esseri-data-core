"""Dependencias HTTP propias de Workflows y Notificaciones."""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from src.auth import autorizacion_service
from src.auth.constants import PERMISO_WORKFLOWS_ACTUALIZAR, PERMISO_WORKFLOWS_LEER
from src.auth.dependencies import RolActivo, UsuarioAutenticado
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
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


@dataclass(frozen=True)
class AlcanceTareas:
    """Qué puede hacer con las tareas el usuario de la sesión, según su rol activo.

    La bandeja es de cada persona: cualquiera ve las tareas que se le asignaron, aunque su rol no
    tenga permisos de Workflows. Con `workflows.leer` se ven las de todos y con
    `workflows.actualizar` se pueden avanzar las ajenas."""

    usuario: Usuario
    ve_todas: bool
    gestiona_todas: bool


def obtener_alcance_tareas(
    usuario: UsuarioAutenticado, db: DbSession, rol_activo: RolActivo
) -> AlcanceTareas:
    if rol_activo is None:
        raise PermisoDenegado("Elegí con qué rol entrar antes de continuar")
    return AlcanceTareas(
        usuario=usuario,
        ve_todas=autorizacion_service.tiene_permiso_en_rol(
            db, usuario.id, rol_activo, PERMISO_WORKFLOWS_LEER
        ),
        gestiona_todas=autorizacion_service.tiene_permiso_en_rol(
            db, usuario.id, rol_activo, PERMISO_WORKFLOWS_ACTUALIZAR
        ),
    )
