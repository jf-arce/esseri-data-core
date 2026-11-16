"""ABM de reglas de workflow (RF-22). La regla es la cabecera (disparador, nombre, criticidad,
estado) y su contenido es el árbol de nodos que valida y sincroniza `arbol_service.py`."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.workflows import arbol_service
from src.workflows.exceptions import (
    ReglaDesactualizada,
    ReglaNoEncontrada,
    TipoEventoNoEncontrado,
)
from src.workflows.models import TipoEvento, WorkflowRule, WorkflowRuleBorrador
from src.workflows.schemas import (
    NodoWrite,
    WorkflowRuleCreate,
    WorkflowRuleRead,
    WorkflowRuleUpdate,
)
from src.workflows.service import tipos_de_campos


def listar_reglas(
    db: Session, tipo_evento_id: uuid.UUID | None = None, activo: bool | None = None
) -> list[WorkflowRuleRead]:
    consulta = select(WorkflowRule).order_by(WorkflowRule.nombre)
    if tipo_evento_id is not None:
        consulta = consulta.where(WorkflowRule.tipo_evento_id == tipo_evento_id)
    if activo is not None:
        consulta = consulta.where(WorkflowRule.activo.is_(activo))
    reglas = list(db.scalars(consulta))
    nodos = arbol_service.nodos_de_reglas(db, [r.id for r in reglas])
    borradores = {
        b.workflow_rule_id: b.bloques_sueltos
        for b in db.scalars(
            select(WorkflowRuleBorrador).where(
                WorkflowRuleBorrador.workflow_rule_id.in_([r.id for r in reglas])
            )
        )
    }
    return [leer_regla(regla, nodos[regla.id], borradores.get(regla.id)) for regla in reglas]


def obtener_regla(db: Session, regla_id: uuid.UUID) -> WorkflowRule | None:
    return db.get(WorkflowRule, regla_id)


def obtener_regla_read(db: Session, regla: WorkflowRule) -> WorkflowRuleRead:
    borrador = db.get(WorkflowRuleBorrador, regla.id)
    return leer_regla(
        regla,
        arbol_service.nodos_de_reglas(db, [regla.id])[regla.id],
        [] if borrador is None else borrador.bloques_sueltos,
    )


def _guardar_bloques_sueltos(
    db: Session, regla_id: uuid.UUID, bloques: list[dict[str, object]]
) -> None:
    """Los bloques sin conectar no se validan ni se ejecutan; solo se conservan."""
    borrador = db.get(WorkflowRuleBorrador, regla_id)
    if not bloques:
        if borrador is not None:
            db.delete(borrador)
    elif borrador is None:
        db.add(WorkflowRuleBorrador(workflow_rule_id=regla_id, bloques_sueltos=bloques))
    else:
        borrador.bloques_sueltos = bloques


def leer_regla(
    regla: WorkflowRule, nodos, bloques_sueltos: list[dict[str, object]] | None = None
) -> WorkflowRuleRead:
    return WorkflowRuleRead(
        id=regla.id,
        nombre=regla.nombre,
        tipo_evento_id=regla.tipo_evento_id,
        criticidad=regla.criticidad,
        activo=regla.activo,
        created_at=regla.created_at,
        updated_at=regla.updated_at,
        nodos=nodos,
        bloques_sueltos=bloques_sueltos or [],
    )


def _tipo_evento(db: Session, tipo_evento_id: uuid.UUID) -> TipoEvento:
    tipo_evento = db.get(TipoEvento, tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    return tipo_evento


def crear_regla(
    db: Session, datos: WorkflowRuleCreate, usuario_id: uuid.UUID | None = None
) -> WorkflowRuleRead:
    tipo_evento = _tipo_evento(db, datos.tipo_evento_id)
    campos = tipos_de_campos(db, tipo_evento.id)
    validados = arbol_service.validar_arbol(db, None, tipo_evento, campos, datos.nodos, {})

    regla = WorkflowRule(
        nombre=datos.nombre,
        tipo_evento_id=datos.tipo_evento_id,
        criticidad=datos.criticidad,
        activo=datos.activo,
    )
    db.add(regla)
    db.flush()
    arbol_service.sincronizar_arbol(db, regla, validados, usuario_id)
    _guardar_bloques_sueltos(db, regla.id, datos.bloques_sueltos)
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
    return obtener_regla_read(db, regla)


def actualizar_regla(
    db: Session,
    regla: WorkflowRule,
    datos: WorkflowRuleUpdate,
    usuario_id: uuid.UUID | None = None,
) -> WorkflowRuleRead:
    bloqueada = db.scalar(select(WorkflowRule).where(WorkflowRule.id == regla.id).with_for_update())
    if bloqueada is None:
        raise ReglaNoEncontrada()
    regla = bloqueada
    if datos.updated_at_base is not None and _naive(datos.updated_at_base) != _naive(
        regla.updated_at
    ):
        raise ReglaDesactualizada()

    cambios = {
        campo: valor
        for campo, valor in datos.model_dump(
            exclude_unset=True, exclude={"nodos", "bloques_sueltos", "updated_at_base"}
        ).items()
        if valor is not None
    }
    cambia_disparador = (
        "tipo_evento_id" in cambios and cambios["tipo_evento_id"] != regla.tipo_evento_id
    )
    tipo_evento_id = cambios.get("tipo_evento_id", regla.tipo_evento_id)

    # Si cambia el disparador o llegan nodos, se valida el árbol final completo.
    nodos: list[NodoWrite] | None = datos.nodos
    if nodos is None and cambia_disparador:
        nodos = _nodos_actuales_como_entrada(db, regla)
    validados = None
    if nodos is not None:
        tipo_evento = _tipo_evento(db, tipo_evento_id)
        existentes = {n.id: n for n in arbol_service.cargar_nodos(db, regla.id)}
        validados = arbol_service.validar_arbol(
            db,
            regla.id,
            tipo_evento,
            tipos_de_campos(db, tipo_evento.id),
            nodos,
            existentes,
        )
    elif "tipo_evento_id" in cambios:
        _tipo_evento(db, tipo_evento_id)

    anteriores = {campo: getattr(regla, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(regla, campo, valor)
    for campo, valor in cambios.items():
        if anteriores[campo] != valor:
            log_audit(
                db,
                entidad="WORKFLOW_RULE",
                entidad_id=regla.id,
                campo=campo,
                valor_anterior=str(anteriores[campo]),
                valor_nuevo=str(valor),
                usuario_id=usuario_id,
            )
    if validados is not None:
        cambio_arbol = arbol_service.sincronizar_arbol(
            db, regla, validados, usuario_id, forzar_actualizacion=cambia_disparador
        )
        if cambio_arbol:
            # El árbol cambió de verdad (no solo posiciones): la regla figura modificada.
            regla.updated_at = func.now()
    if datos.bloques_sueltos is not None:
        _guardar_bloques_sueltos(db, regla.id, datos.bloques_sueltos)
    db.commit()
    db.refresh(regla)
    return obtener_regla_read(db, regla)


def _naive(valor):
    return valor.replace(tzinfo=None)


def _nodos_actuales_como_entrada(db: Session, regla: WorkflowRule) -> list[NodoWrite]:
    """El árbol vigente en forma de entrada, para revalidarlo contra un disparador nuevo."""
    leidos = arbol_service.nodos_de_reglas(db, [regla.id])[regla.id]
    return [
        NodoWrite.model_validate(
            {
                **nodo.model_dump(exclude={"orden", "updated_at", "destinatarios", "posicion"}),
                "destinatarios": {
                    "rol_ids": [r.id for r in nodo.destinatarios.roles],
                    "usuario_ids": [u.id for u in nodo.destinatarios.usuarios],
                },
            }
        )
        for nodo in leidos
    ]


def nodos_de_regla_simple(
    *,
    condicion: dict[str, object] | None = None,
    tipo_accion: str,
    accion_config: dict[str, object] | None = None,
    notificacion_template_id: uuid.UUID | None = None,
    requiere_aprobacion_humana: bool | None = None,
    rol_ids: list[uuid.UUID] | None = None,
    usuario_ids: list[uuid.UUID] | None = None,
) -> list[NodoWrite]:
    """Árbol de la regla más común: una acción, con una condición simple `{campo, operador,
    valor}` antes si se la da (acción por la rama Sí). Lo usan los seeds."""
    accion_id = uuid.uuid4()
    padre_id = None
    nodos: list[dict[str, object]] = []
    if condicion:
        padre_id = uuid.uuid4()
        nodos.append(
            {
                "id": padre_id,
                "tipo": "condicion",
                "condicion": {"logica": "todas", "comparaciones": [condicion]},
            }
        )
    nodos.append(
        {
            "id": accion_id,
            "tipo": "accion",
            "padre_id": padre_id,
            "rama": "si" if padre_id else None,
            "tipo_accion": tipo_accion,
            "accion_config": accion_config,
            "notificacion_template_id": notificacion_template_id,
            "requiere_aprobacion_humana": requiere_aprobacion_humana,
            "destinatarios": {"rol_ids": rol_ids or [], "usuario_ids": usuario_ids or []},
        }
    )
    return [NodoWrite.model_validate(n) for n in nodos]
