"""Fábrica de reglas para los tests: arma el árbol más común (una acción, con una condición
simple antes si se la da) escribiendo directo en la base, sin pasar por la validación."""

import uuid
from datetime import datetime

from sqlalchemy import select

from src.workflows.models import ReglaDestinatario, WorkflowNodo, WorkflowRule


class ReglaSimple:
    """La regla creada más su acción, con los campos de la acción accesibles como atributos (como
    cuando eran de la regla). Sirve también como contexto de acción para los ejecutores."""

    _DEL_NODO = frozenset(
        {
            "accion_config",
            "tipo_accion",
            "requiere_aprobacion_humana",
            "notificacion_template_id",
            "updated_at",
        }
    )

    def __init__(self, regla: WorkflowRule, nodo: WorkflowNodo, condicion: WorkflowNodo | None):
        object.__setattr__(self, "regla", regla)
        object.__setattr__(self, "nodo", nodo)
        object.__setattr__(self, "nodo_condicion", condicion)

    @classmethod
    def desde_base(cls, db, regla: WorkflowRule) -> "ReglaSimple":
        """Envuelve una regla ya guardada que tiene una acción y, a lo sumo, una condición."""
        nodos = db.scalars(select(WorkflowNodo).where(WorkflowNodo.workflow_rule_id == regla.id))
        por_tipo = {n.tipo: n for n in nodos}
        return cls(regla, por_tipo["accion"], por_tipo.get("condicion"))

    @property
    def nodo_id(self) -> uuid.UUID:
        return self.nodo.id

    def __getattr__(self, nombre):
        if nombre == "condicion":
            # La comparación simple que antes guardaba la regla (`{}` si no tenía).
            grupo = self.nodo_condicion.condicion if self.nodo_condicion else None
            return grupo["comparaciones"][0] if grupo else {}
        if nombre in self._DEL_NODO:
            return getattr(self.nodo, nombre)
        return getattr(self.regla, nombre)

    def __setattr__(self, nombre, valor):
        destino = self.nodo if nombre in self._DEL_NODO else self.regla
        setattr(destino, nombre, valor)


def crear_regla_simple(
    db,
    *,
    tipo_evento_id,
    nombre="Avisar mora",
    condicion=None,
    tipo_accion="notificar",
    accion_config=None,
    requiere_aprobacion_humana=False,
    activo=True,
    notificacion_template_id=None,
    created_at: datetime | None = None,
    destinatarios_rol_ids=(),
    destinatarios_usuario_ids=(),
) -> ReglaSimple:
    """Crea la regla con su árbol (una acción y, si hay, su condición) y confirma."""
    fechas = {} if created_at is None else {"created_at": created_at, "updated_at": created_at}
    regla = WorkflowRule(
        nombre=nombre,
        activo=activo,
        tipo_evento_id=tipo_evento_id,
        **fechas,
    )
    db.add(regla)
    db.flush()
    padre = None
    if condicion:
        padre = WorkflowNodo(
            id=uuid.uuid4(),
            workflow_rule_id=regla.id,
            tipo="condicion",
            condicion={"logica": "todas", "comparaciones": [condicion]},
            **fechas,
        )
        db.add(padre)
        db.flush()
    nodo = WorkflowNodo(
        id=uuid.uuid4(),
        workflow_rule_id=regla.id,
        tipo="accion",
        padre_id=None if padre is None else padre.id,
        rama=None if padre is None else "si",
        tipo_accion=tipo_accion,
        accion_config=accion_config,
        notificacion_template_id=notificacion_template_id,
        requiere_aprobacion_humana=requiere_aprobacion_humana,
        **fechas,
    )
    db.add(nodo)
    db.flush()
    for rol_id in destinatarios_rol_ids:
        db.add(ReglaDestinatario(destinatario_tipo="rol", workflow_nodo_id=nodo.id, rol_id=rol_id))
    for usuario_id in destinatarios_usuario_ids:
        db.add(
            ReglaDestinatario(
                destinatario_tipo="usuario", workflow_nodo_id=nodo.id, usuario_id=usuario_id
            )
        )
    db.commit()
    return ReglaSimple(regla, nodo, padre)


def cuerpo_regla(
    tipo_evento_id,
    *,
    nombre="Avisar mora",
    tipo_accion="notificar",
    activo=True,
    condicion=None,
    accion_config=None,
    notificacion_template_id=None,
    requiere_aprobacion_humana=None,
    rol_ids=(),
    usuario_ids=(),
) -> dict:
    """Cuerpo de `POST /workflows/reglas` para la regla más común: una acción y, si se da
    `condicion` (`{campo, operador, valor}`), una condición antes de ella (rama Sí)."""
    accion_id = str(uuid.uuid4())
    nodos = []
    padre_id = None
    if condicion is not None and condicion != {}:
        padre_id = str(uuid.uuid4())
        nodos.append(
            {
                "id": padre_id,
                "tipo": "condicion",
                "condicion": {"logica": "todas", "comparaciones": [condicion]},
            }
        )
    accion = {
        "id": accion_id,
        "tipo": "accion",
        "padre_id": padre_id,
        "rama": "si" if padre_id else None,
        "tipo_accion": tipo_accion,
        "accion_config": accion_config,
        "notificacion_template_id": (
            None if notificacion_template_id is None else str(notificacion_template_id)
        ),
        "destinatarios": {
            "rol_ids": [str(r) for r in rol_ids],
            "usuario_ids": [str(u) for u in usuario_ids],
        },
    }
    if requiere_aprobacion_humana is not None:
        accion["requiere_aprobacion_humana"] = requiere_aprobacion_humana
    nodos.append(accion)
    return {
        "nombre": nombre,
        "tipo_evento_id": str(tipo_evento_id),
        "activo": activo,
        "nodos": nodos,
    }


def accion_de(regla_json: dict) -> dict:
    """La primera acción del árbol de una regla devuelta por la API."""
    return next(n for n in regla_json["nodos"] if n["tipo"] == "accion")


def condicion_de(regla_json: dict) -> dict | None:
    return next((n for n in regla_json["nodos"] if n["tipo"] == "condicion"), None)


def nodos_como_entrada(regla_json: dict) -> list[dict]:
    """Los nodos de una regla leída, en la forma que acepta `PATCH /workflows/reglas/{id}`."""
    return [
        {
            **{k: v for k, v in nodo.items() if k not in {"orden", "updated_at", "posicion"}},
            "destinatarios": {
                "rol_ids": [r["id"] for r in nodo["destinatarios"]["roles"]],
                "usuario_ids": [u["id"] for u in nodo["destinatarios"]["usuarios"]],
            },
        }
        for nodo in regla_json["nodos"]
    ]


def con_destinatarios(regla_json: dict, rol_ids=(), usuario_ids=()) -> list[dict]:
    """Igual que `nodos_como_entrada`, con los destinatarios de la acción reemplazados."""
    nodos = nodos_como_entrada(regla_json)
    for nodo in nodos:
        if nodo["tipo"] == "accion":
            nodo["destinatarios"] = {
                "rol_ids": [str(r) for r in rol_ids],
                "usuario_ids": [str(u) for u in usuario_ids],
            }
    return nodos
