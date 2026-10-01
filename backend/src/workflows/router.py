import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_WORKFLOWS_ACTUALIZAR,
    PERMISO_WORKFLOWS_CREAR,
    PERMISO_WORKFLOWS_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.workflows import despacho_service, service
from src.workflows.dependencies import obtener_regla_o_404
from src.workflows.models import WorkflowRule
from src.workflows.schemas import (
    EstadoWorkflowExecution,
    ResumenDespacho,
    TipoAccionRead,
    TipoEventoRead,
    WorkflowExecutionListadoRead,
    WorkflowExecutionRead,
    WorkflowRuleCreate,
    WorkflowRuleRead,
    WorkflowRuleUpdate,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_WORKFLOWS_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_WORKFLOWS_LEER))]
PuedeActualizar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_WORKFLOWS_ACTUALIZAR))]
ReglaActual = Annotated[WorkflowRule, Depends(obtener_regla_o_404)]


@router.get("/tipos-evento", response_model=list[TipoEventoRead])
def listar_tipos_evento(db: DbSession, _: PuedeLeer):
    return service.listar_tipos_evento(db)


@router.get("/tipos-accion", response_model=list[TipoAccionRead])
def listar_tipos_accion(_: PuedeLeer):
    return service.listar_tipos_accion()


@router.get("/ejecuciones", response_model=WorkflowExecutionListadoRead)
def listar_ejecuciones(
    db: DbSession,
    _: PuedeLeer,
    estado: Annotated[EstadoWorkflowExecution | None, Query()] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> WorkflowExecutionListadoRead:
    return despacho_service.listar_ejecuciones(
        db,
        estado=estado,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.get("/ejecuciones/{ejecucion_id}", response_model=WorkflowExecutionRead)
def obtener_ejecucion(
    ejecucion_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> WorkflowExecutionRead:
    return despacho_service.obtener_ejecucion_read(db, ejecucion_id)


@router.post(
    "/ejecuciones/{ejecucion_id}/reintentar",
    response_model=WorkflowExecutionRead,
    status_code=201,
)
def reintentar_ejecucion(
    ejecucion_id: uuid.UUID,
    db: DbSession,
    usuario: PuedeActualizar,
) -> WorkflowExecutionRead:
    return despacho_service.reintentar_ejecucion(db, ejecucion_id, usuario.id)


@router.get("/reglas", response_model=list[WorkflowRuleRead])
def listar_reglas(
    db: DbSession,
    _: PuedeLeer,
    tipo_evento_id: uuid.UUID | None = None,
    activo: bool | None = None,
):
    return service.listar_reglas(db, tipo_evento_id, activo)


@router.get("/reglas/{regla_id}", response_model=WorkflowRuleRead)
def obtener_regla(_: PuedeLeer, regla: ReglaActual):
    return regla


@router.post("/reglas", response_model=WorkflowRuleRead, status_code=201)
def crear_regla(datos: WorkflowRuleCreate, db: DbSession, usuario: PuedeCrear):
    return service.crear_regla(db, datos, usuario.id)


@router.patch("/reglas/{regla_id}", response_model=WorkflowRuleRead)
def actualizar_regla(
    usuario: PuedeActualizar, regla: ReglaActual, datos: WorkflowRuleUpdate, db: DbSession
):
    return service.actualizar_regla(db, regla, datos, usuario.id)


@router.post("/procesar", response_model=ResumenDespacho)
def procesar_eventos_pendientes(db: DbSession, _: PuedeActualizar):
    """Corre una pasada del despachador sin esperar al job periódico (útil para probar)."""
    return despacho_service.procesar_eventos_pendientes(db)
