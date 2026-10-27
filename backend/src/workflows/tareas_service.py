"""Tareas del motor de workflows (#89): ejecutores de `crear_tarea` y `escalar_caso`, y la
bandeja que consulta y avanza esas tareas.

Las dos acciones asignan trabajo a las personas que cargó la regla (`REGLA_DESTINATARIO`, usuarios
directos o por rol), igual que `alerta_interna` las usa para avisar. Como una `TAREA` tiene un único
responsable, se crea una fila por usuario activo. Los ejecutores no hacen `commit`: corren dentro
del savepoint del despachador. El historial de escalamiento se encadena con `Tarea.tarea_id`."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Usuario
from src.fechas import ahora_utc
from src.models import EventLog
from src.workflows import destinatarios_service
from src.workflows.constants import (
    ESTADOS_TAREA_ABIERTA,
    MAX_DESTINATARIOS_POR_EJECUCION,
    TRANSICIONES_TAREA,
)
from src.workflows.exceptions import (
    AsignadoTareaInvalido,
    TareaNoEncontrada,
    TareaNoReasignable,
    TransicionTareaInvalida,
)
from src.workflows.models import Tarea, WorkflowExecution, WorkflowRule
from src.workflows.schemas import (
    ConfigCrearTarea,
    ConfigEscalarCaso,
    ResultadoAccion,
    TareaCadenaRead,
    TareaDetalleRead,
    TareaListadoRead,
    TareaRead,
)

ERROR_SIN_ASIGNADOS = "No se encontró ningún usuario activo al que asignar la tarea."
ERROR_TOPE = "La regla supera el máximo de usuarios a los que asignar la tarea."
ERRORES_CONTROLADOS = frozenset({ERROR_SIN_ASIGNADOS, ERROR_TOPE})

MOTIVO_ESCALAMIENTO_POR_DEFECTO = "Caso escalado por la regla '{regla}'."
PREFIJO_TITULO_ESCALADA = "Escalada: "
LARGO_MAXIMO_TITULO = 150


# --- Ejecutores ----------------------------------------------------------------------------


def ejecutar_crear_tarea(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Crea una tarea `pendiente` por cada usuario activo de la regla."""
    config = ConfigCrearTarea.model_validate(regla.accion_config or {})
    asignados = usuarios_asignables(db, regla)
    if isinstance(asignados, str):
        return ResultadoAccion(error=asignados)

    vencimiento = (
        None
        if config.dias_para_vencer is None
        else ahora_utc() + timedelta(days=config.dias_para_vencer)
    )
    creadas = _crear_tareas(
        db,
        regla,
        evento,
        ejecucion,
        asignados,
        titulo=config.titulo,
        descripcion=config.descripcion,
        prioridad=config.prioridad,
        vencimiento=vencimiento,
        tarea_origen_id=None,
    )
    if creadas == 0:
        return ResultadoAccion(detalle="Las tareas ya habían sido creadas.")
    return ResultadoAccion(detalle=f"Se creó la tarea para {creadas} usuario(s).")


def ejecutar_escalar_caso(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Escala el caso del evento: sus tareas abiertas pasan a `escalada` y se crea una tarea nueva
    por cada usuario de la regla, encadenada a la más reciente de ellas con `tarea_id`. Si el caso
    no tenía tareas abiertas, se crea la tarea escalada sin antecesora."""
    config = ConfigEscalarCaso.model_validate(regla.accion_config or {})
    asignados = usuarios_asignables(db, regla)
    if isinstance(asignados, str):
        return ResultadoAccion(error=asignados)

    abiertas = _tareas_abiertas_del_caso(db, regla, evento)
    origen = abiertas[0] if abiertas else None  # la más reciente
    motivo = config.motivo or MOTIVO_ESCALAMIENTO_POR_DEFECTO.format(regla=regla.nombre)
    titulo = (
        f"Caso escalado: {regla.nombre}"
        if origen is None
        else f"{PREFIJO_TITULO_ESCALADA}{origen.titulo}"
    )
    creadas = _crear_tareas(
        db,
        regla,
        evento,
        ejecucion,
        asignados,
        titulo=titulo[:LARGO_MAXIMO_TITULO],
        descripcion=motivo,
        prioridad=config.prioridad,
        vencimiento=None,
        tarea_origen_id=None if origen is None else origen.id,
    )
    for tarea in abiertas:
        tarea.estado = "escalada"
    db.flush()
    if creadas == 0 and not abiertas:
        return ResultadoAccion(detalle="El caso ya había sido escalado.")
    if not abiertas:
        return ResultadoAccion(
            detalle=f"El caso no tenía tareas abiertas: se asignó a {creadas} usuario(s)."
        )
    return ResultadoAccion(
        detalle=f"Se escalaron {len(abiertas)} tarea(s) y se asignó a {creadas} usuario(s)."
    )


def usuarios_asignables(db: Session, regla: WorkflowRule) -> list[Usuario] | str:
    """Usuarios activos de la regla, o el mensaje de error si no hay ninguno o son demasiados."""
    usuarios = destinatarios_service.usuarios_activos_de_regla(db, regla.id)
    if not usuarios:
        return ERROR_SIN_ASIGNADOS
    if len(usuarios) > MAX_DESTINATARIOS_POR_EJECUCION:
        return ERROR_TOPE
    return usuarios


def _ejecuciones_del_caso(regla: WorkflowRule, evento: EventLog):
    """Todos los intentos de esta regla sobre este evento (un reintento crea otra ejecución)."""
    return select(WorkflowExecution.id).where(
        WorkflowExecution.workflow_rule_id == regla.id,
        WorkflowExecution.event_log_id == evento.id,
    )


def _crear_tareas(
    db: Session,
    regla: WorkflowRule,
    evento: EventLog,
    ejecucion: WorkflowExecution,
    asignados: list[Usuario],
    *,
    titulo: str,
    descripcion: str | None,
    prioridad: str,
    vencimiento: datetime | None,
    tarea_origen_id: uuid.UUID | None,
) -> int:
    """Crea la tarea de cada usuario que todavía no la tiene por un intento anterior de esta
    regla sobre este evento, para que reintentar una ejecución no duplique el trabajo."""
    con_tarea = set(
        db.scalars(
            select(Tarea.usuario_id).where(
                Tarea.workflow_execution_id.in_(_ejecuciones_del_caso(regla, evento))
            )
        )
    )
    nuevas = [u for u in asignados if u.id not in con_tarea]
    for usuario in nuevas:
        db.add(
            Tarea(
                entidad=evento.entidad,
                entidad_id=evento.entidad_id,
                titulo=titulo,
                descripcion=descripcion,
                estado="pendiente",
                prioridad=prioridad,
                fecha_vencimiento=vencimiento,
                usuario_id=usuario.id,
                workflow_execution_id=ejecucion.id,
                tarea_id=tarea_origen_id,
            )
        )
    db.flush()
    return len(nuevas)


def _tareas_abiertas_del_caso(db: Session, regla: WorkflowRule, evento: EventLog) -> list[Tarea]:
    """Tareas abiertas de la misma entidad, de la más reciente a la más antigua. Excluye las que
    creó esta misma regla para este evento: un reintento no escala lo que ya escaló."""
    return list(
        db.scalars(
            select(Tarea)
            .where(
                Tarea.entidad == evento.entidad,
                Tarea.entidad_id == evento.entidad_id,
                Tarea.estado.in_(ESTADOS_TAREA_ABIERTA),
                Tarea.workflow_execution_id.is_(None)
                | Tarea.workflow_execution_id.not_in(_ejecuciones_del_caso(regla, evento)),
            )
            .order_by(Tarea.created_at.desc(), Tarea.id.desc())
            .with_for_update()
        )
    )


# --- Bandeja -------------------------------------------------------------------------------


@dataclass(frozen=True)
class FiltrosTareas:
    estado: str | None = None
    prioridad: str | None = None
    # `None` = de todos los usuarios.
    usuario_id: uuid.UUID | None = None


def listar_tareas(
    db: Session, filtros: FiltrosTareas, *, pagina: int, tamanio_pagina: int
) -> TareaListadoRead:
    condiciones = []
    if filtros.estado is not None:
        condiciones.append(Tarea.estado == filtros.estado)
    if filtros.prioridad is not None:
        condiciones.append(Tarea.prioridad == filtros.prioridad)
    if filtros.usuario_id is not None:
        condiciones.append(Tarea.usuario_id == filtros.usuario_id)

    total = db.scalar(select(func.count(Tarea.id)).where(*condiciones)) or 0
    filas = db.execute(
        _consulta_tareas()
        .where(*condiciones)
        .order_by(Tarea.created_at.desc(), Tarea.id.desc())
        .offset((pagina - 1) * tamanio_pagina)
        .limit(tamanio_pagina)
    ).all()
    return TareaListadoRead(
        items=[_tarea_read(*fila) for fila in filas],
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=(total + tamanio_pagina - 1) // tamanio_pagina,
    )


def obtener_tarea(db: Session, tarea_id: uuid.UUID) -> Tarea:
    tarea = db.get(Tarea, tarea_id)
    if tarea is None:
        raise TareaNoEncontrada()
    return tarea


def obtener_tarea_detalle(db: Session, tarea_id: uuid.UUID) -> TareaDetalleRead:
    fila = db.execute(_consulta_tareas().where(Tarea.id == tarea_id)).one_or_none()
    if fila is None:
        raise TareaNoEncontrada()
    base = _tarea_read(*fila)
    return TareaDetalleRead(**base.model_dump(), cadena=_cadena(db, fila[0]))


def cambiar_estado_tarea(
    db: Session, tarea_id: uuid.UUID, nuevo_estado: str, usuario_id: uuid.UUID
) -> TareaDetalleRead:
    """Avanza la tarea (`pendiente → en_progreso → completada`). Bloquea la fila para que dos
    cambios simultáneos no se pisen; `escalada` y `completada` ya no admiten cambios."""
    tarea = db.scalar(select(Tarea).where(Tarea.id == tarea_id).with_for_update())
    if tarea is None:
        raise TareaNoEncontrada()
    if nuevo_estado not in TRANSICIONES_TAREA.get(tarea.estado, frozenset()):
        raise TransicionTareaInvalida(
            f"No se puede pasar una tarea '{tarea.estado}' a '{nuevo_estado}'."
        )
    anterior = tarea.estado
    tarea.estado = nuevo_estado
    log_audit(
        db,
        entidad="TAREA",
        entidad_id=tarea.id,
        campo="estado",
        valor_anterior=anterior,
        valor_nuevo=nuevo_estado,
        usuario_id=usuario_id,
    )
    db.commit()
    return obtener_tarea_detalle(db, tarea_id)


def reasignar_tarea(
    db: Session, tarea_id: uuid.UUID, nuevo_usuario_id: uuid.UUID, actor_id: uuid.UUID
) -> TareaDetalleRead:
    """Pasa una tarea abierta a otro usuario activo. No toca el estado ni la cadena de
    escalamiento: es la misma tarea con otro responsable. Bloquea la fila para que dos
    reasignaciones o un cambio de estado simultáneos no se pisen."""
    tarea = db.scalar(select(Tarea).where(Tarea.id == tarea_id).with_for_update())
    if tarea is None:
        raise TareaNoEncontrada()
    if tarea.estado not in ESTADOS_TAREA_ABIERTA:
        raise TareaNoReasignable(f"No se puede reasignar una tarea '{tarea.estado}'.")
    nuevo = db.get(Usuario, nuevo_usuario_id)
    if nuevo is None or nuevo.estado != "activo":
        raise AsignadoTareaInvalido()
    if tarea.usuario_id == nuevo.id:
        raise TareaNoReasignable("La tarea ya está asignada a ese usuario.")
    anterior = tarea.usuario_id
    tarea.usuario_id = nuevo.id
    log_audit(
        db,
        entidad="TAREA",
        entidad_id=tarea.id,
        campo="usuario_id",
        valor_anterior=str(anterior),
        valor_nuevo=str(nuevo.id),
        usuario_id=actor_id,
    )
    db.commit()
    return obtener_tarea_detalle(db, tarea_id)


def _consulta_tareas():
    return (
        select(Tarea, Usuario.email, WorkflowRule.nombre)
        .join(Usuario, Usuario.id == Tarea.usuario_id)
        .outerjoin(WorkflowExecution, WorkflowExecution.id == Tarea.workflow_execution_id)
        .outerjoin(WorkflowRule, WorkflowRule.id == WorkflowExecution.workflow_rule_id)
    )


def _tarea_read(tarea: Tarea, usuario_email: str, regla_nombre: str | None) -> TareaRead:
    vencida = (
        tarea.fecha_vencimiento is not None
        and tarea.fecha_vencimiento < ahora_utc()
        and tarea.estado in ESTADOS_TAREA_ABIERTA
    )
    return TareaRead(
        id=tarea.id,
        titulo=tarea.titulo,
        descripcion=tarea.descripcion,
        estado=tarea.estado,
        prioridad=tarea.prioridad,
        fecha_vencimiento=tarea.fecha_vencimiento,
        vencida=vencida,
        entidad=tarea.entidad,
        entidad_id=tarea.entidad_id,
        usuario_id=tarea.usuario_id,
        usuario_email=usuario_email,
        workflow_execution_id=tarea.workflow_execution_id,
        workflow_rule_nombre=regla_nombre,
        tarea_id=tarea.tarea_id,
        created_at=tarea.created_at,
        updated_at=tarea.updated_at,
    )


def _cadena(db: Session, tarea: Tarea) -> list[TareaCadenaRead]:
    """Historial de escalamiento: de la tarea original a las escaladas a partir de ella."""
    raiz = tarea
    vistos = {tarea.id}
    while raiz.tarea_id is not None and raiz.tarea_id not in vistos:
        padre = db.get(Tarea, raiz.tarea_id)
        if padre is None:
            break
        vistos.add(padre.id)
        raiz = padre

    eslabones = [raiz]
    pendientes = [raiz.id]
    ya_incluidos = {raiz.id}
    while pendientes:
        hijas = db.scalars(
            select(Tarea).where(Tarea.tarea_id.in_(pendientes)).order_by(Tarea.created_at, Tarea.id)
        ).all()
        pendientes = []
        for hija in hijas:
            if hija.id in ya_incluidos:
                continue
            ya_incluidos.add(hija.id)
            eslabones.append(hija)
            pendientes.append(hija.id)

    emails = dict(
        db.execute(
            select(Usuario.id, Usuario.email).where(
                Usuario.id.in_({eslabon.usuario_id for eslabon in eslabones})
            )
        ).all()
    )
    return [
        TareaCadenaRead(
            id=e.id,
            titulo=e.titulo,
            estado=e.estado,
            prioridad=e.prioridad,
            usuario_email=emails[e.usuario_id],
            tarea_id=e.tarea_id,
            created_at=e.created_at,
        )
        for e in eslabones
    ]
