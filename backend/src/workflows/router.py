import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_WORKFLOWS_ACTUALIZAR,
    PERMISO_WORKFLOWS_CREAR,
    PERMISO_WORKFLOWS_ELIMINAR,
    PERMISO_WORKFLOWS_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.workflows import (
    despacho_service,
    destinatarios_service,
    ejecuciones_service,
    notificaciones_service,
    plantillas_service,
    service,
    tareas_service,
)
from src.workflows.constants import EstadoTarea, PrioridadTarea
from src.workflows.dependencies import (
    AlcanceTareas,
    obtener_alcance_tareas,
    obtener_plantilla_o_404,
    obtener_regla_o_404,
)
from src.workflows.exceptions import TareaNoEncontrada
from src.workflows.models import NotificacionTemplate, WorkflowRule
from src.workflows.schemas import (
    DestinatarioTipo,
    EjecucionRechazo,
    EstadoEnvioNotificacion,
    EstadoWorkflowExecution,
    NotificacionDetalleRead,
    NotificacionListadoRead,
    NotificacionTemplateCreate,
    NotificacionTemplateRead,
    NotificacionTemplateUpdate,
    ReglaDestinatariosRead,
    ReglaDestinatariosUpdate,
    ResumenDespacho,
    TareaAsignadoUpdate,
    TareaDetalleRead,
    TareaEstadoUpdate,
    TareaListadoRead,
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
PuedeEliminar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_WORKFLOWS_ELIMINAR))]
AlcanceActual = Annotated[AlcanceTareas, Depends(obtener_alcance_tareas)]
ReglaActual = Annotated[WorkflowRule, Depends(obtener_regla_o_404)]
PlantillaActual = Annotated[NotificacionTemplate, Depends(obtener_plantilla_o_404)]


@router.get("/tipos-evento", response_model=list[TipoEventoRead])
def listar_tipos_evento(db: DbSession, _: PuedeLeer):
    return service.listar_tipos_evento(db)


@router.get("/tipos-accion", response_model=list[TipoAccionRead])
def listar_tipos_accion(_: PuedeLeer):
    return service.listar_tipos_accion()


@router.get("/plantillas", response_model=list[NotificacionTemplateRead])
def listar_plantillas(
    db: DbSession,
    _: PuedeLeer,
    tipo_evento_id: uuid.UUID | None = None,
) -> list[NotificacionTemplate]:
    return plantillas_service.listar_plantillas(db, tipo_evento_id)


@router.post("/plantillas", response_model=NotificacionTemplateRead, status_code=201)
def crear_plantilla(
    datos: NotificacionTemplateCreate, db: DbSession, usuario: PuedeCrear
) -> NotificacionTemplate:
    return plantillas_service.crear_plantilla(db, datos, usuario.id)


@router.get("/plantillas/{plantilla_id}", response_model=NotificacionTemplateRead)
def obtener_plantilla(_: PuedeLeer, plantilla: PlantillaActual) -> NotificacionTemplate:
    return plantilla


@router.patch("/plantillas/{plantilla_id}", response_model=NotificacionTemplateRead)
def actualizar_plantilla(
    datos: NotificacionTemplateUpdate,
    db: DbSession,
    usuario: PuedeActualizar,
    plantilla: PlantillaActual,
) -> NotificacionTemplate:
    return plantillas_service.actualizar_plantilla(db, plantilla, datos, usuario.id)


@router.delete("/plantillas/{plantilla_id}", status_code=204)
def eliminar_plantilla(db: DbSession, usuario: PuedeEliminar, plantilla: PlantillaActual) -> None:
    plantillas_service.eliminar_plantilla(db, plantilla, usuario.id)


@router.get("/ejecuciones", response_model=WorkflowExecutionListadoRead)
def listar_ejecuciones(
    db: DbSession,
    _: PuedeLeer,
    estado: Annotated[EstadoWorkflowExecution | None, Query()] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> WorkflowExecutionListadoRead:
    return ejecuciones_service.listar_ejecuciones(
        db,
        estado=estado,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.get("/ejecuciones/{ejecucion_id}", response_model=WorkflowExecutionRead)
def obtener_ejecucion(
    ejecucion_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> WorkflowExecutionRead:
    return ejecuciones_service.obtener_ejecucion_read(db, ejecucion_id)


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
    return ejecuciones_service.reintentar_ejecucion(db, ejecucion_id, usuario.id)


@router.post("/ejecuciones/{ejecucion_id}/aprobar", response_model=WorkflowExecutionRead)
def aprobar_ejecucion(
    ejecucion_id: uuid.UUID,
    db: DbSession,
    usuario: PuedeActualizar,
) -> WorkflowExecutionRead:
    return ejecuciones_service.aprobar_ejecucion(db, ejecucion_id, usuario.id)


@router.post("/ejecuciones/{ejecucion_id}/rechazar", response_model=WorkflowExecutionRead)
def rechazar_ejecucion(
    ejecucion_id: uuid.UUID,
    datos: EjecucionRechazo,
    db: DbSession,
    usuario: PuedeActualizar,
) -> WorkflowExecutionRead:
    return ejecuciones_service.rechazar_ejecucion(db, ejecucion_id, datos.motivo, usuario.id)


@router.get("/notificaciones", response_model=NotificacionListadoRead)
def listar_notificaciones(
    db: DbSession,
    _: PuedeLeer,
    estado_envio: Annotated[EstadoEnvioNotificacion | None, Query()] = None,
    destinatario_tipo: Annotated[DestinatarioTipo | None, Query()] = None,
    workflow_execution_id: Annotated[uuid.UUID | None, Query()] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> NotificacionListadoRead:
    return notificaciones_service.listar_notificaciones(
        db,
        estado_envio=estado_envio,
        destinatario_tipo=destinatario_tipo,
        workflow_execution_id=workflow_execution_id,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.get("/notificaciones/{notificacion_id}", response_model=NotificacionDetalleRead)
def obtener_notificacion(
    notificacion_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> NotificacionDetalleRead:
    return notificaciones_service.obtener_notificacion_read(db, notificacion_id)


@router.get("/tareas", response_model=TareaListadoRead)
def listar_tareas(
    db: DbSession,
    alcance: AlcanceActual,
    estado: Annotated[EstadoTarea | None, Query()] = None,
    prioridad: Annotated[PrioridadTarea | None, Query()] = None,
    usuario_id: Annotated[uuid.UUID | None, Query()] = None,
    solo_mias: Annotated[bool, Query()] = False,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> TareaListadoRead:
    """Sin `workflows.leer` solo devuelve las tareas del usuario, aunque no pida `solo_mias` ni
    filtre por otro `usuario_id` (el responsable). Con `solo_mias` se ignora `usuario_id`."""
    propias = solo_mias or not alcance.ve_todas
    filtros = tareas_service.FiltrosTareas(
        estado=estado,
        prioridad=prioridad,
        usuario_id=alcance.usuario.id if propias else usuario_id,
    )
    return tareas_service.listar_tareas(db, filtros, pagina=pagina, tamanio_pagina=tamanio_pagina)


@router.get("/tareas/{tarea_id}", response_model=TareaDetalleRead)
def obtener_tarea(tarea_id: uuid.UUID, db: DbSession, alcance: AlcanceActual) -> TareaDetalleRead:
    tarea = tareas_service.obtener_tarea(db, tarea_id)
    if not alcance.ve_todas and tarea.usuario_id != alcance.usuario.id:
        raise TareaNoEncontrada()
    return tareas_service.obtener_tarea_detalle(db, tarea_id)


@router.patch("/tareas/{tarea_id}/estado", response_model=TareaDetalleRead)
def cambiar_estado_tarea(
    tarea_id: uuid.UUID,
    datos: TareaEstadoUpdate,
    db: DbSession,
    alcance: AlcanceActual,
) -> TareaDetalleRead:
    """La avanza su responsable o quien tenga `workflows.actualizar`."""
    tarea = tareas_service.obtener_tarea(db, tarea_id)
    es_suya = tarea.usuario_id == alcance.usuario.id
    if not (es_suya or (alcance.ve_todas and alcance.gestiona_todas)):
        raise TareaNoEncontrada()
    return tareas_service.cambiar_estado_tarea(db, tarea_id, datos.estado, alcance.usuario.id)


@router.patch("/tareas/{tarea_id}/asignado", response_model=TareaDetalleRead)
def reasignar_tarea(
    tarea_id: uuid.UUID,
    datos: TareaAsignadoUpdate,
    db: DbSession,
    usuario: PuedeActualizar,
) -> TareaDetalleRead:
    """Solo con `workflows.actualizar`: reasignar es una decisión de gestión, no de quien
    recibió la tarea."""
    return tareas_service.reasignar_tarea(db, tarea_id, datos.usuario_id, usuario.id)


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


@router.get(
    "/reglas/{regla_id}/destinatarios",
    response_model=ReglaDestinatariosRead,
)
def listar_destinatarios_regla(
    _: PuedeLeer, regla: ReglaActual, db: DbSession
) -> ReglaDestinatariosRead:
    return destinatarios_service.listar_destinatarios_regla(db, regla.id)


@router.put(
    "/reglas/{regla_id}/destinatarios",
    response_model=ReglaDestinatariosRead,
)
def reemplazar_destinatarios_regla(
    datos: ReglaDestinatariosUpdate,
    usuario: PuedeActualizar,
    regla: ReglaActual,
    db: DbSession,
) -> ReglaDestinatariosRead:
    return destinatarios_service.reemplazar_destinatarios_regla(db, regla, datos, usuario.id)


@router.post("/procesar", response_model=ResumenDespacho)
def procesar_eventos_pendientes(db: DbSession, _: PuedeActualizar):
    """Corre una pasada del despachador sin esperar al job periódico (útil para probar). Incluye
    los recordatorios que ya cumplieron sus `dias_despues`."""
    resumen = despacho_service.procesar_eventos_pendientes(db)
    resumen.recordatorios_ejecutados = despacho_service.procesar_recordatorios_vencidos(db)
    return resumen
