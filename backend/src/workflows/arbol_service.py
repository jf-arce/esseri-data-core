"""Árbol de nodos de una regla: validación, sincronización con la base, lectura y recorrido.

Un nodo `condicion` tiene salidas Sí/No y un nodo `accion` es una hoja. Las acciones que cuelgan
de una misma salida son hermanas independientes: ninguna espera a otra. Cada nodo tiene un solo
padre, así que no hay ramas que se vuelvan a juntar ni ciclos."""

import operator
import uuid
from collections import defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import delete, func, select, update
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.models import Rol, Usuario
from src.fechas import ahora_utc
from src.models import EventLog
from src.workflows import destinatarios_service
from src.workflows.constants import (
    ENTIDAD_POR_EVENTO,
    MAX_NODOS_POR_REGLA,
    MAX_PROFUNDIDAD_ARBOL,
)
from src.workflows.eventos_service import coaccionar_valor
from src.workflows.exceptions import ArbolInvalido, EntidadDeEventoInvalida
from src.workflows.models import (
    ReglaDestinatario,
    TipoEvento,
    WorkflowExecution,
    WorkflowNodo,
    WorkflowNodoPosicion,
    WorkflowRule,
)
from src.workflows.schemas import (
    DestinatarioRolRead,
    DestinatariosNodoRead,
    DestinatarioUsuarioRead,
    NodoRead,
    NodoWrite,
    PosicionNodo,
)
from src.workflows.service import aprobacion_por_defecto, validar_accion, validar_condicion

DETALLE_NODO_ELIMINADO = "La acción se eliminó de la regla."

_CAMPOS_FUNCIONALES = (
    "padre_id",
    "rama",
    "condicion",
    "tipo_accion",
    "accion_config",
    "notificacion_template_id",
    "requiere_aprobacion_humana",
)


# --- Lectura -------------------------------------------------------------------------------


def cargar_nodos(db: Session, regla_id: uuid.UUID) -> list[WorkflowNodo]:
    """Nodos vigentes (sin baja lógica) de la regla, en el orden en que se dibujan."""
    return list(
        db.scalars(
            select(WorkflowNodo)
            .where(WorkflowNodo.workflow_rule_id == regla_id, WorkflowNodo.eliminado_at.is_(None))
            .order_by(WorkflowNodo.orden, WorkflowNodo.created_at, WorkflowNodo.id)
        )
    )


def nodos_de_reglas(db: Session, regla_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, list[NodoRead]]:
    """`NodoRead` de varias reglas con una consulta por tabla (sin N+1)."""
    ids = list(regla_ids)
    por_regla: dict[uuid.UUID, list[WorkflowNodo]] = defaultdict(list)
    if ids:
        for nodo in db.scalars(
            select(WorkflowNodo)
            .where(WorkflowNodo.workflow_rule_id.in_(ids), WorkflowNodo.eliminado_at.is_(None))
            .order_by(WorkflowNodo.orden, WorkflowNodo.created_at, WorkflowNodo.id)
        ):
            por_regla[nodo.workflow_rule_id].append(nodo)
    todos = [nodo for lista in por_regla.values() for nodo in lista]
    posiciones = _posiciones(db, [nodo.id for nodo in todos])
    destinatarios = _destinatarios(db, [nodo.id for nodo in todos])
    return {
        regla_id: [
            leer_nodo(nodo, posiciones.get(nodo.id), destinatarios.get(nodo.id))
            for nodo in por_regla.get(regla_id, [])
        ]
        for regla_id in ids
    }


def leer_nodo(
    nodo: WorkflowNodo,
    posicion: WorkflowNodoPosicion | None,
    destinatarios: DestinatariosNodoRead | None,
) -> NodoRead:
    return NodoRead(
        id=nodo.id,
        tipo=nodo.tipo,
        padre_id=nodo.padre_id,
        rama=nodo.rama,
        orden=nodo.orden,
        condicion=nodo.condicion,
        tipo_accion=nodo.tipo_accion,
        accion_config=nodo.accion_config,
        notificacion_template_id=nodo.notificacion_template_id,
        requiere_aprobacion_humana=nodo.requiere_aprobacion_humana,
        destinatarios=destinatarios or DestinatariosNodoRead(),
        posicion=None if posicion is None else PosicionNodo(x=posicion.x, y=posicion.y),
        updated_at=nodo.updated_at,
    )


def _posiciones(db: Session, nodo_ids: list[uuid.UUID]) -> dict[uuid.UUID, WorkflowNodoPosicion]:
    if not nodo_ids:
        return {}
    return {
        p.workflow_nodo_id: p
        for p in db.scalars(
            select(WorkflowNodoPosicion).where(WorkflowNodoPosicion.workflow_nodo_id.in_(nodo_ids))
        )
    }


def _destinatarios(
    db: Session, nodo_ids: list[uuid.UUID]
) -> dict[uuid.UUID, DestinatariosNodoRead]:
    if not nodo_ids:
        return {}
    resultado: dict[uuid.UUID, DestinatariosNodoRead] = {}
    roles = db.execute(
        select(ReglaDestinatario.workflow_nodo_id, Rol)
        .join(Rol, Rol.id == ReglaDestinatario.rol_id)
        .where(ReglaDestinatario.workflow_nodo_id.in_(nodo_ids))
        .order_by(Rol.nombre)
    )
    for nodo_id, rol in roles:
        resultado.setdefault(nodo_id, DestinatariosNodoRead()).roles.append(
            DestinatarioRolRead.model_validate(rol)
        )
    usuarios = db.execute(
        select(ReglaDestinatario.workflow_nodo_id, Usuario)
        .join(Usuario, Usuario.id == ReglaDestinatario.usuario_id)
        .where(ReglaDestinatario.workflow_nodo_id.in_(nodo_ids))
        .order_by(Usuario.email)
    )
    for nodo_id, usuario in usuarios:
        resultado.setdefault(nodo_id, DestinatariosNodoRead()).usuarios.append(
            DestinatarioUsuarioRead.model_validate(usuario)
        )
    return resultado


# --- Validación ----------------------------------------------------------------------------


@dataclass(frozen=True)
class NodoValidado:
    entrada: NodoWrite
    condicion: dict[str, object] | None
    accion_config: dict[str, object] | None
    requiere_aprobacion_humana: bool
    orden: int


def validar_arbol(
    db: Session,
    regla_id: uuid.UUID | None,
    tipo_evento: TipoEvento,
    campos: dict[str, str],
    nodos: Sequence[NodoWrite],
    existentes: dict[uuid.UUID, WorkflowNodo],
) -> list[NodoValidado]:
    """Valida forma y contenido del árbol completo. `existentes` son los nodos vigentes de la
    regla (vacío al crearla). Devuelve los nodos con su config normalizada, en el orden dado."""
    if len(nodos) > MAX_NODOS_POR_REGLA:
        raise ArbolInvalido(f"Una regla admite hasta {MAX_NODOS_POR_REGLA} nodos.")
    por_id: dict[uuid.UUID, NodoWrite] = {}
    for nodo in nodos:
        if nodo.id in por_id:
            raise ArbolInvalido("Hay nodos con el mismo identificador.", nodo.id)
        por_id[nodo.id] = nodo
    _validar_pertenencia(db, regla_id, por_id)
    if not any(n.tipo == "accion" for n in nodos):
        raise ArbolInvalido("La regla necesita al menos una acción.")

    for nodo in nodos:
        _validar_enlace(nodo, por_id)
    _validar_profundidad(por_id)

    ordenes: dict[tuple[uuid.UUID | None, str | None], int] = defaultdict(int)
    validados: list[NodoValidado] = []
    for nodo in nodos:
        clave = (nodo.padre_id, nodo.rama)
        orden = ordenes[clave]
        ordenes[clave] += 1
        validados.append(_validar_contenido(db, tipo_evento, campos, nodo, orden))
    return validados


def _validar_pertenencia(
    db: Session, regla_id: uuid.UUID | None, por_id: dict[uuid.UUID, NodoWrite]
) -> None:
    ajenos = db.scalars(
        select(WorkflowNodo.id).where(
            WorkflowNodo.id.in_(por_id),
            WorkflowNodo.workflow_rule_id != regla_id if regla_id else True,
        )
    ).all()
    if ajenos:
        raise ArbolInvalido("Un nodo pertenece a otra regla.", ajenos[0])
    if regla_id is not None:
        eliminados = db.scalars(
            select(WorkflowNodo.id).where(
                WorkflowNodo.id.in_(por_id),
                WorkflowNodo.workflow_rule_id == regla_id,
                WorkflowNodo.eliminado_at.is_not(None),
            )
        ).all()
        if eliminados:
            raise ArbolInvalido("Un nodo dado de baja no se puede reutilizar.", eliminados[0])


def _validar_enlace(nodo: NodoWrite, por_id: dict[uuid.UUID, NodoWrite]) -> None:
    if nodo.padre_id is None:
        if nodo.rama is not None:
            raise ArbolInvalido("Un nodo que cuelga del disparador no tiene rama.", nodo.id)
        return
    padre = por_id.get(nodo.padre_id)
    if padre is None:
        raise ArbolInvalido("Un nodo apunta a un padre que no está en la regla.", nodo.id)
    if padre.tipo != "condicion":
        raise ArbolInvalido("Una acción no puede tener nodos debajo.", nodo.id)
    if nodo.rama is None:
        raise ArbolInvalido("Los nodos de una condición necesitan la rama Sí o No.", nodo.id)


def _validar_profundidad(por_id: dict[uuid.UUID, NodoWrite]) -> None:
    for inicial in por_id.values():
        profundidad = 1
        actual = inicial
        while actual.padre_id is not None:
            profundidad += 1
            if profundidad > len(por_id):
                raise ArbolInvalido("El árbol tiene un ciclo.", inicial.id)
            actual = por_id[actual.padre_id]
        if profundidad > MAX_PROFUNDIDAD_ARBOL:
            raise ArbolInvalido(
                f"El flujo admite hasta {MAX_PROFUNDIDAD_ARBOL} niveles de profundidad.",
                inicial.id,
            )


def _validar_contenido(
    db: Session, tipo_evento: TipoEvento, campos: dict[str, str], nodo: NodoWrite, orden: int
) -> NodoValidado:
    try:
        if nodo.tipo == "condicion":
            if nodo.condicion is None or nodo.tipo_accion is not None:
                raise ArbolInvalido("Una condición necesita comparaciones y no tiene acción.")
            if nodo.destinatarios.rol_ids or nodo.destinatarios.usuario_ids:
                raise ArbolInvalido("Una condición no admite destinatarios.")
            grupo = validar_condicion(nodo.condicion.model_dump(mode="json"), campos)
            return NodoValidado(nodo, grupo.model_dump(mode="json"), None, False, orden)

        if nodo.tipo_accion is None or nodo.condicion is not None:
            raise ArbolInvalido("Una acción necesita un tipo y no tiene condición.")
        config = validar_accion(
            db,
            nodo.tipo_accion,
            nodo.accion_config,
            tipo_evento.nombre,
            campos,
            nodo.notificacion_template_id,
        )
        quiere_destinatarios = bool(nodo.destinatarios.rol_ids or nodo.destinatarios.usuario_ids)
        if quiere_destinatarios and not destinatarios_service.config_admite_destinatarios(
            nodo.tipo_accion, config
        ):
            raise ArbolInvalido(
                "Esta acción no admite destinatarios: usá el destinatario 'destinatarios_regla'."
            )
        aprobacion = (
            aprobacion_por_defecto(nodo.tipo_accion)
            if nodo.requiere_aprobacion_humana is None
            else nodo.requiere_aprobacion_humana
        )
        return NodoValidado(nodo, None, config, aprobacion, orden)
    except ArbolInvalido as error:
        error.nodo_id = nodo.id
        raise


# --- Sincronización ------------------------------------------------------------------------


def sincronizar_arbol(
    db: Session,
    regla: WorkflowRule,
    validados: list[NodoValidado],
    usuario_id: uuid.UUID | None,
    *,
    forzar_actualizacion: bool = False,
) -> bool:
    """Deja el árbol de la regla igual al recibido: inserta los nodos nuevos, actualiza los
    existentes y da de baja los que ya no están (físicamente si nunca se ejecutaron, con baja
    lógica si tienen ejecuciones). Devuelve `True` si cambió algo que afecta a la regla.

    Las posiciones van aparte y nunca cuentan como cambio: mover un nodo no invalida pendientes
    ni reintentos. Con `forzar_actualizacion` (cambió el disparador) todos los nodos pasan a
    figurar como modificados."""
    existentes = {n.id: n for n in cargar_nodos(db, regla.id)}
    recibidos = {v.entrada.id: v for v in validados}
    cambio = False

    for nodo_id in _en_orden_de_profundidad(recibidos):
        validado = recibidos[nodo_id]
        entrada = validado.entrada
        nodo = existentes.get(nodo_id)
        valores = {
            "padre_id": entrada.padre_id,
            "rama": entrada.rama,
            "condicion": validado.condicion,
            "tipo_accion": entrada.tipo_accion,
            "accion_config": validado.accion_config,
            "notificacion_template_id": entrada.notificacion_template_id,
            "requiere_aprobacion_humana": validado.requiere_aprobacion_humana,
        }
        if nodo is None:
            nodo = WorkflowNodo(
                id=nodo_id,
                workflow_rule_id=regla.id,
                tipo=entrada.tipo,
                orden=validado.orden,
                **valores,
            )
            db.add(nodo)
            db.flush()
            _auditar(db, nodo, "__alta__", None, entrada.tipo_accion or "condicion", usuario_id)
            cambio = True
        else:
            if nodo.tipo != entrada.tipo:
                raise ArbolInvalido("Un nodo no puede cambiar de condición a acción.", nodo_id)
            modificados = [c for c in _CAMPOS_FUNCIONALES if getattr(nodo, c) != valores[c]]
            for campo in modificados:
                _auditar(db, nodo, campo, getattr(nodo, campo), valores[campo], usuario_id)
                setattr(nodo, campo, valores[campo])
            if forzar_actualizacion and not modificados:
                nodo.updated_at = func.now()
                modificados = ["disparador"]
            if modificados:
                cambio = True
            if nodo.orden != validado.orden:
                # El orden visual no invalida nada: se escribe sin tocar `updated_at`.
                db.execute(
                    update(WorkflowNodo)
                    .where(WorkflowNodo.id == nodo.id)
                    .values(orden=validado.orden, updated_at=WorkflowNodo.updated_at)
                )
        if nodo.tipo == "accion" and _sincronizar_destinatarios(db, nodo, entrada, usuario_id):
            cambio = True
            nodo.updated_at = func.now()
        _sincronizar_posicion(db, nodo_id, entrada.posicion)

    quitados = [n for nodo_id, n in existentes.items() if nodo_id not in recibidos]
    if quitados:
        cambio = True
        _dar_de_baja(db, quitados, usuario_id)
    db.flush()
    return cambio


def _en_orden_de_profundidad(recibidos: dict[uuid.UUID, NodoValidado]) -> list[uuid.UUID]:
    """Padres antes que hijos: la FK de `padre_id` exige que el padre exista primero."""

    def profundidad(nodo_id: uuid.UUID) -> int:
        nivel = 0
        padre = recibidos[nodo_id].entrada.padre_id
        while padre is not None:
            nivel += 1
            padre = recibidos[padre].entrada.padre_id
        return nivel

    return sorted(recibidos, key=profundidad)


def _auditar(
    db: Session,
    nodo: WorkflowNodo,
    campo: str,
    anterior: object,
    nuevo: object,
    usuario_id: uuid.UUID | None,
) -> None:
    log_audit(
        db,
        entidad="WORKFLOW_NODO",
        entidad_id=nodo.id,
        campo=campo,
        valor_anterior=None if anterior is None else str(anterior),
        valor_nuevo=None if nuevo is None else str(nuevo),
        usuario_id=usuario_id,
    )


def _sincronizar_destinatarios(
    db: Session, nodo: WorkflowNodo, entrada: NodoWrite, usuario_id: uuid.UUID | None
) -> bool:
    if not destinatarios_service.config_admite_destinatarios(
        nodo.tipo_accion or "", nodo.accion_config
    ):
        return destinatarios_service.vaciar_destinatarios_nodo(db, nodo.id, usuario_id)
    return destinatarios_service.reemplazar_destinatarios_nodo(
        db, nodo.id, entrada.destinatarios.rol_ids, entrada.destinatarios.usuario_ids, usuario_id
    )


def _sincronizar_posicion(db: Session, nodo_id: uuid.UUID, posicion: PosicionNodo | None) -> None:
    if posicion is None:
        return
    actual = db.get(WorkflowNodoPosicion, nodo_id)
    if actual is None:
        db.add(WorkflowNodoPosicion(workflow_nodo_id=nodo_id, x=posicion.x, y=posicion.y))
    elif (actual.x, actual.y) != (posicion.x, posicion.y):
        actual.x, actual.y = posicion.x, posicion.y


def _dar_de_baja(db: Session, nodos: list[WorkflowNodo], usuario_id: uuid.UUID | None) -> None:
    ids = [n.id for n in nodos]
    con_ejecuciones = set(
        db.scalars(
            select(WorkflowExecution.workflow_nodo_id)
            .where(WorkflowExecution.workflow_nodo_id.in_(ids))
            .distinct()
        )
    )
    # Las pendientes de aprobación de un nodo que desaparece ya no se pueden decidir.
    ahora = ahora_utc()
    for ejecucion in db.scalars(
        select(WorkflowExecution).where(
            WorkflowExecution.workflow_nodo_id.in_(ids), WorkflowExecution.estado == "pendiente"
        )
    ):
        ejecucion.estado = "rechazado"
        ejecucion.detalle = DETALLE_NODO_ELIMINADO
        ejecucion.finished_at = ahora

    nivel: dict[uuid.UUID, int] = {}
    por_id = {n.id: n for n in nodos}

    def profundidad(nodo: WorkflowNodo) -> int:
        if nodo.id not in nivel:
            padre = por_id.get(nodo.padre_id) if nodo.padre_id else None
            nivel[nodo.id] = 0 if padre is None else profundidad(padre) + 1
        return nivel[nodo.id]

    # Hojas primero: la FK de `padre_id` no deja borrar un padre con hijos.
    for nodo in sorted(nodos, key=profundidad, reverse=True):
        _auditar(db, nodo, "__baja__", nodo.tipo_accion or "condicion", None, usuario_id)
        if nodo.id in con_ejecuciones:
            nodo.eliminado_at = ahora
            continue
        destinatarios_service.vaciar_destinatarios_nodo(db, nodo.id, usuario_id)
        db.execute(
            delete(WorkflowNodoPosicion).where(WorkflowNodoPosicion.workflow_nodo_id == nodo.id)
        )
        db.delete(nodo)
        db.flush()


# --- Recorrido y evaluación ----------------------------------------------------------------

_Comparable = Decimal | date | str
_COMPARADORES: dict[str, Callable[[_Comparable, _Comparable], bool]] = {
    "==": operator.eq,
    "!=": operator.ne,
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
}


@dataclass
class Recorrido:
    """Resultado de recorrer el árbol con los datos de un evento."""

    acciones: list[WorkflowNodo] = field(default_factory=list)
    # nodo condición -> "cumple" | "no_cumple" | "error"
    condiciones: dict[uuid.UUID, str] = field(default_factory=dict)
    errores: dict[uuid.UUID, str] = field(default_factory=dict)


def hijos_por_salida(
    nodos: Iterable[WorkflowNodo],
) -> dict[tuple[uuid.UUID | None, str | None], list[WorkflowNodo]]:
    salidas: dict[tuple[uuid.UUID | None, str | None], list[WorkflowNodo]] = defaultdict(list)
    for nodo in nodos:
        salidas[(nodo.padre_id, nodo.rama)].append(nodo)
    return salidas


def verificar_entidad(tipo_evento_nombre: str, evento: EventLog) -> None:
    esperada = ENTIDAD_POR_EVENTO.get(tipo_evento_nombre)
    if esperada != evento.entidad:
        raise EntidadDeEventoInvalida(tipo_evento_nombre, evento.entidad, esperada or "ninguna")


def evaluar_condicion(
    condicion: dict[str, object] | None, campos: dict[str, str], payload: dict[str, object]
) -> bool:
    """Evalúa el grupo contra el payload del evento. Un campo ausente o de tipo equivocado no se
    compara: se informa como error (se evalúan todas las comparaciones para detectarlo aunque
    "alguna" ya se cumpla)."""
    grupo = validar_condicion(condicion or {}, campos)
    resultados = [
        _comparar(c.campo, c.operador, c.valor, campos, payload) for c in grupo.comparaciones
    ]
    return all(resultados) if grupo.logica == "todas" else any(resultados)


def _comparar(
    campo: str,
    operador: str,
    valor: object,
    campos: dict[str, str],
    payload: dict[str, object],
) -> bool:
    tipo_dato = campos[campo]
    if campo not in payload:
        raise ValueError(f"El evento no trae el campo '{campo}'.")
    try:
        actual = coaccionar_valor(tipo_dato, payload[campo])
    except ValueError as error:
        raise ValueError(f"Campo '{campo}' del evento: {error}") from error
    esperado = coaccionar_valor(tipo_dato, valor)
    if operador == "contiene":
        return str(esperado).lower() in str(actual).lower()
    return _COMPARADORES[operador](actual, esperado)


def recorrer_arbol(
    nodos: Sequence[WorkflowNodo], campos: dict[str, str], payload: dict[str, object]
) -> Recorrido:
    """Evalúa las condiciones desde el disparador y junta las acciones alcanzadas. Una condición
    que no se puede evaluar queda como `error` y no se desciende por ella."""
    salidas = hijos_por_salida(nodos)
    recorrido = Recorrido()

    def visitar(padre_id: uuid.UUID | None, rama: str | None) -> None:
        for nodo in salidas.get((padre_id, rama), []):
            if nodo.tipo == "accion":
                recorrido.acciones.append(nodo)
                continue
            try:
                cumple = evaluar_condicion(nodo.condicion, campos, payload)
            except Exception as error:
                recorrido.condiciones[nodo.id] = "error"
                recorrido.errores[nodo.id] = str(error)
                continue
            recorrido.condiciones[nodo.id] = "cumple" if cumple else "no_cumple"
            visitar(nodo.id, "si" if cumple else "no")

    visitar(None, None)
    return recorrido


def camino_hasta(nodo: WorkflowNodo, por_id: dict[uuid.UUID, WorkflowNodo]) -> list[WorkflowNodo]:
    """Ancestros del nodo, de la raíz hacia él (sin incluirlo)."""
    camino: list[WorkflowNodo] = []
    actual = nodo
    while actual.padre_id is not None and actual.padre_id in por_id:
        actual = por_id[actual.padre_id]
        camino.append(actual)
    camino.reverse()
    return camino


def alcanza_nodo(
    nodo: WorkflowNodo,
    nodos: Sequence[WorkflowNodo],
    campos: dict[str, str],
    payload: dict[str, object],
) -> bool:
    """Si, con estos datos, el recorrido llega a `nodo` (para reintentos y recordatorios)."""
    recorrido = recorrer_arbol(nodos, campos, payload)
    return nodo in recorrido.acciones or nodo.id in recorrido.condiciones


def ultima_modificacion_camino(db: Session, nodo: WorkflowNodo):
    """El cambio más reciente en el nodo o en las condiciones que llevan a él: si ocurrió después
    de una ejecución, esa ejecución ya no refleja la regla actual."""
    por_id = {n.id: n for n in cargar_nodos(db, nodo.workflow_rule_id)}
    return max(n.updated_at for n in [*camino_hasta(nodo, por_id), nodo])
