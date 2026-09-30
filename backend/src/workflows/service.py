"""Lógica de negocio del motor de Workflows: emisión de eventos, reglas y despacho."""

import logging
import uuid
from collections import defaultdict

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.models import EventLog
from src.workflows.constants import ACCIONES_CON_APROBACION_POR_DEFECTO, TipoEventoNombre
from src.workflows.exceptions import (
    PlantillaNoEncontrada,
    TipoEventoNoEncontrado,
    TipoEventoNoRegistrado,
)
from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento, WorkflowRule
from src.workflows.schemas import (
    CampoEventoRead,
    TipoEventoRead,
    WorkflowRuleCreate,
    WorkflowRuleUpdate,
)

logger = logging.getLogger(__name__)


def emit_event(
    db: Session,
    *,
    tipo: TipoEventoNombre,
    entidad: str,
    entidad_id: uuid.UUID,
    payload: dict[str, object] | None = None,
    usuario_id: uuid.UUID | None = None,
) -> EventLog:
    """Registra un hecho de negocio en `EVENT_LOG` para que lo consuma el motor.

    No hace `commit`: el evento queda en la transacción del llamador, así que solo existe si la
    operación de negocio que lo originó también se confirma. `payload` debería traer los campos
    declarados en `CAMPO_EVENTO` para ese tipo (si falta alguno se loggea un warning, no se
    rechaza el evento) y nunca datos sensibles innecesarios (RNF-15).
    """
    tipo_evento = db.scalar(select(TipoEvento).where(TipoEvento.nombre == tipo))
    if tipo_evento is None:
        raise TipoEventoNoRegistrado(tipo)

    datos: dict[str, object] | None = None
    if payload is not None:
        datos = jsonable_encoder(payload)
    _advertir_campos_faltantes(db, tipo_evento, datos or {})

    evento = EventLog(
        actor_tipo="usuario" if usuario_id is not None else "sistema",
        payload=datos,
        estado="pendiente",
        entidad=entidad,
        entidad_id=entidad_id,
        tipo_evento_id=tipo_evento.id,
        usuario_id=usuario_id,
    )
    db.add(evento)
    db.flush()
    return evento


def _advertir_campos_faltantes(
    db: Session, tipo_evento: TipoEvento, payload: dict[str, object]
) -> None:
    declarados = set(
        db.scalars(
            select(CampoEvento.nombre_interno).where(CampoEvento.tipo_evento_id == tipo_evento.id)
        )
    )
    faltantes = sorted(declarados - payload.keys())
    if faltantes:
        logger.warning(
            "El evento %s se emitió sin los campos declarados: %s",
            tipo_evento.nombre,
            ", ".join(faltantes),
        )


# --- Reglas de workflow (RF-22) -----------------------------------------------------------

# Campos de `WorkflowRule` que admiten NULL: en una edición, `None` explícito los limpia. Para el
# resto, `None` significa "no cambiar".
_CAMPOS_NULLABLES_REGLA = frozenset({"accion_config", "notificacion_template_id"})


def listar_tipos_evento(db: Session) -> list[TipoEventoRead]:
    campos_por_tipo: dict[uuid.UUID, list[CampoEvento]] = defaultdict(list)
    for campo in db.scalars(select(CampoEvento).order_by(CampoEvento.nombre_interno)):
        campos_por_tipo[campo.tipo_evento_id].append(campo)
    tipos = db.scalars(select(TipoEvento).order_by(TipoEvento.nombre))
    return [
        TipoEventoRead(
            id=tipo.id,
            nombre=tipo.nombre,
            descripcion=tipo.descripcion,
            campos=[CampoEventoRead.model_validate(c) for c in campos_por_tipo[tipo.id]],
        )
        for tipo in tipos
    ]


def listar_reglas(
    db: Session, tipo_evento_id: uuid.UUID | None = None, activo: bool | None = None
) -> list[WorkflowRule]:
    consulta = select(WorkflowRule).order_by(WorkflowRule.nombre)
    if tipo_evento_id is not None:
        consulta = consulta.where(WorkflowRule.tipo_evento_id == tipo_evento_id)
    if activo is not None:
        consulta = consulta.where(WorkflowRule.activo.is_(activo))
    return list(db.scalars(consulta))


def obtener_regla(db: Session, regla_id: uuid.UUID) -> WorkflowRule | None:
    return db.get(WorkflowRule, regla_id)


def crear_regla(
    db: Session, datos: WorkflowRuleCreate, usuario_id: uuid.UUID | None = None
) -> WorkflowRule:
    _validar_referencias(db, datos.tipo_evento_id, datos.notificacion_template_id)

    valores = datos.model_dump()
    if valores["requiere_aprobacion_humana"] is None:
        valores["requiere_aprobacion_humana"] = _aprobacion_por_defecto(datos.tipo_accion)
    regla = WorkflowRule(**valores)
    db.add(regla)
    db.flush()
    log_audit(
        db,
        entidad="WORKFLOW_RULE",
        entidad_id=regla.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=regla.nombre,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(regla)
    return regla


def actualizar_regla(
    db: Session,
    regla: WorkflowRule,
    datos: WorkflowRuleUpdate,
    usuario_id: uuid.UUID | None = None,
) -> WorkflowRule:
    cambios = {
        campo: valor
        for campo, valor in datos.model_dump(exclude_unset=True).items()
        if valor is not None or campo in _CAMPOS_NULLABLES_REGLA
    }
    _validar_referencias(
        db,
        cambios.get("tipo_evento_id"),
        cambios.get("notificacion_template_id"),
    )
    # Al cambiar de acción sin decidir la aprobación, la regla adopta el default de la nueva.
    if "tipo_accion" in cambios and "requiere_aprobacion_humana" not in cambios:
        cambios["requiere_aprobacion_humana"] = _aprobacion_por_defecto(cambios["tipo_accion"])

    anteriores = {campo: getattr(regla, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(regla, campo, valor)
    for campo, valor in cambios.items():
        if anteriores[campo] == valor:
            continue
        log_audit(
            db,
            entidad="WORKFLOW_RULE",
            entidad_id=regla.id,
            campo=campo,
            valor_anterior=_como_texto(anteriores[campo]),
            valor_nuevo=_como_texto(valor),
            usuario_id=usuario_id,
        )
    db.commit()
    db.refresh(regla)
    return regla


def _aprobacion_por_defecto(tipo_accion: str) -> bool:
    return tipo_accion in ACCIONES_CON_APROBACION_POR_DEFECTO


def _como_texto(valor: object) -> str | None:
    return None if valor is None else str(valor)


def _validar_referencias(
    db: Session, tipo_evento_id: uuid.UUID | None, notificacion_template_id: uuid.UUID | None
) -> None:
    if tipo_evento_id is not None and db.get(TipoEvento, tipo_evento_id) is None:
        raise TipoEventoNoEncontrado()
    if (
        notificacion_template_id is not None
        and db.get(NotificacionTemplate, notificacion_template_id) is None
    ):
        raise PlantillaNoEncontrada()
