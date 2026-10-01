"""Lógica de negocio del motor de Workflows: reglas y despacho de eventos pendientes.

La emisión de eventos vive en `eventos_service.py` (ver el motivo ahí)."""

import logging
import operator
import uuid
from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime
from decimal import Decimal
from typing import get_args

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.facturacion.models import ConceptoCobro, ReglaPenalidad
from src.models import EventLog
from src.workflows.constants import (
    ACCIONES_CON_APROBACION_POR_DEFECTO,
    ACCIONES_CON_PLANTILLA,
    CAMBIOS_ESTADO_PERMITIDOS,
    ENTIDAD_POR_EVENTO,
    EVENTOS_POR_ACCION,
    OPERADORES_POR_TIPO_DATO,
    TipoAccion,
)
from src.workflows.eventos_service import coaccionar_valor
from src.workflows.exceptions import (
    AccionConfigInvalida,
    CondicionInvalida,
    EntidadDeEventoInvalida,
    PlantillaNoEncontrada,
    TipoEventoNoEncontrado,
)
from src.workflows.models import (
    CampoEvento,
    NotificacionTemplate,
    TipoEvento,
    WorkflowExecution,
    WorkflowRule,
)
from src.workflows.schemas import (
    CONFIG_POR_ACCION,
    CampoEventoRead,
    Condicion,
    ConfigActualizarCuentaCorriente,
    ConfigAplicarPenalidad,
    ConfigCambiarEstado,
    ConfigGenerarCargo,
    ResumenDespacho,
    TipoAccionRead,
    TipoEventoRead,
    WorkflowRuleCreate,
    WorkflowRuleUpdate,
)

logger = logging.getLogger(__name__)


# --- Reglas de workflow (RF-22) -----------------------------------------------------------

# Campos de `WorkflowRule` que admiten NULL: en una edición, `None` explícito los limpia. Para el
# resto, `None` significa "no cambiar".
_CAMPOS_NULLABLES_REGLA = frozenset({"accion_config", "notificacion_template_id"})
# Campos cuyo cambio obliga a revalidar la regla completa contra la allowlist.
_CAMPOS_QUE_REVALIDAN_REGLA = frozenset(
    {"tipo_evento_id", "tipo_accion", "condicion", "accion_config", "notificacion_template_id"}
)


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


def listar_tipos_accion() -> list[TipoAccionRead]:
    return [
        TipoAccionRead(
            tipo_accion=tipo,
            requiere_aprobacion_por_defecto=_aprobacion_por_defecto(tipo),
            eventos_permitidos=(
                None if EVENTOS_POR_ACCION[tipo] is None else sorted(EVENTOS_POR_ACCION[tipo])
            ),
            admite_plantilla=tipo in ACCIONES_CON_PLANTILLA,
            config_schema=CONFIG_POR_ACCION[tipo].model_json_schema(),
        )
        for tipo in get_args(TipoAccion)
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
    valores["accion_config"] = _validar_regla(
        db,
        datos.tipo_evento_id,
        datos.tipo_accion,
        datos.condicion,
        datos.accion_config,
        datos.notificacion_template_id,
    )
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
    if cambios.keys() & _CAMPOS_QUE_REVALIDAN_REGLA:
        # Se valida el estado final (regla actual + cambios), no solo lo que llegó en el PATCH.
        # Los campos nullables solo están en `cambios` si llegaron explícitos (incluso en null).
        cambios["accion_config"] = _validar_regla(
            db,
            cambios.get("tipo_evento_id", regla.tipo_evento_id),
            cambios.get("tipo_accion", regla.tipo_accion),
            cambios.get("condicion", regla.condicion),
            cambios["accion_config"] if "accion_config" in cambios else regla.accion_config,
            cambios["notificacion_template_id"]
            if "notificacion_template_id" in cambios
            else regla.notificacion_template_id,
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


def _validar_regla(
    db: Session,
    tipo_evento_id: uuid.UUID,
    tipo_accion: str,
    condicion: dict[str, object],
    accion_config: dict[str, object] | None,
    notificacion_template_id: uuid.UUID | None,
) -> dict[str, object]:
    """Valida condición y acción contra la allowlist. Devuelve el `accion_config` normalizado
    (con los defaults completos) que se guarda en la regla."""
    tipo_evento = db.get(TipoEvento, tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    campos = _tipos_de_campos(db, tipo_evento.id)
    _validar_condicion(condicion, campos)
    return _validar_accion(
        db, tipo_accion, accion_config, tipo_evento.nombre, campos, notificacion_template_id
    )


def _tipos_de_campos(db: Session, tipo_evento_id: uuid.UUID) -> dict[str, str]:
    """`nombre_interno -> tipo_dato` de los campos que declara el evento."""
    return {
        nombre: tipo_dato
        for nombre, tipo_dato in db.execute(
            select(CampoEvento.nombre_interno, CampoEvento.tipo_dato).where(
                CampoEvento.tipo_evento_id == tipo_evento_id
            )
        )
    }


def _resumen_errores(error: ValidationError) -> str:
    return "; ".join(
        f"{'.'.join(str(parte) for parte in e['loc']) or 'valor'}: {e['msg']}"
        for e in error.errors()
    )


def _validar_condicion(condicion: dict[str, object], campos: dict[str, str]) -> None:
    if not condicion:
        return
    try:
        parseada = Condicion.model_validate(condicion)
    except ValidationError as error:
        raise CondicionInvalida(f"Condición inválida: {_resumen_errores(error)}") from error
    tipo_dato = campos.get(parseada.campo)
    if tipo_dato is None:
        disponibles = ", ".join(sorted(campos)) or "ninguno"
        raise CondicionInvalida(
            f"El campo '{parseada.campo}' no existe en este evento. Disponibles: {disponibles}."
        )
    if parseada.operador not in OPERADORES_POR_TIPO_DATO[tipo_dato]:
        raise CondicionInvalida(
            f"El operador '{parseada.operador}' no aplica a '{parseada.campo}' ({tipo_dato})."
        )
    try:
        coaccionar_valor(tipo_dato, parseada.valor)
    except ValueError as error:
        raise CondicionInvalida(f"Valor inválido para '{parseada.campo}': {error}") from error


def _validar_accion(
    db: Session,
    tipo_accion: str,
    accion_config: dict[str, object] | None,
    tipo_evento_nombre: str,
    campos: dict[str, str],
    notificacion_template_id: uuid.UUID | None,
) -> dict[str, object]:
    permitidos = EVENTOS_POR_ACCION[tipo_accion]
    if permitidos is not None and tipo_evento_nombre not in permitidos:
        if not permitidos:
            raise AccionConfigInvalida(
                f"La acción '{tipo_accion}' todavía no se puede configurar: "
                "ningún evento la dispara."
            )
        raise AccionConfigInvalida(
            f"La acción '{tipo_accion}' no admite el evento '{tipo_evento_nombre}'. "
            f"Eventos permitidos: {', '.join(sorted(permitidos))}."
        )
    if notificacion_template_id is not None and tipo_accion not in ACCIONES_CON_PLANTILLA:
        raise AccionConfigInvalida(
            f"La acción '{tipo_accion}' no admite plantilla de notificación."
        )
    # `null` equivale a `{}`: las reglas sin config siguen siendo válidas si no tienen
    # parámetros obligatorios.
    try:
        config = CONFIG_POR_ACCION[tipo_accion].model_validate(accion_config or {})
    except ValidationError as error:
        raise AccionConfigInvalida(
            f"Configuración inválida para '{tipo_accion}': {_resumen_errores(error)}"
        ) from error

    if isinstance(config, ConfigCambiarEstado):
        entidad = ENTIDAD_POR_EVENTO.get(tipo_evento_nombre, "")
        estados = CAMBIOS_ESTADO_PERMITIDOS.get(entidad, frozenset())
        if config.estado_nuevo not in estados:
            raise AccionConfigInvalida(
                f"'{config.estado_nuevo}' no es un estado permitido para '{entidad}'. "
                f"Permitidos: {', '.join(sorted(estados)) or 'ninguno'}."
            )
    if isinstance(config, ConfigGenerarCargo | ConfigActualizarCuentaCorriente):
        concepto = db.get(ConceptoCobro, config.concepto_cobro_id)
        if concepto is None or not concepto.activo:
            raise AccionConfigInvalida("El concepto de cobro indicado no existe o está inactivo.")
    if isinstance(config, ConfigActualizarCuentaCorriente) and (
        campos.get(config.campo_monto) != "numero"
    ):
        raise AccionConfigInvalida(
            f"'{config.campo_monto}' no es un campo numérico de este evento."
        )
    if isinstance(config, ConfigAplicarPenalidad) and config.regla_penalidad_id is not None:
        regla = db.get(ReglaPenalidad, config.regla_penalidad_id)
        if regla is None or not regla.activo:
            raise AccionConfigInvalida("La regla de penalidad indicada no existe o está inactiva.")
    return config.model_dump(mode="json")


# --- Despacho de eventos pendientes ------------------------------------------------------

# Una acción recibe la sesión (dentro de un savepoint), la regla y el evento, y devuelve un
# detalle para `WorkflowExecution.detalle`. Vacío a propósito en el scaffolding: cada tipo de
# acción se registra acá al implementarse (ver #64 y #68).
AccionHandler = Callable[[Session, WorkflowRule, EventLog], str | None]
ACCIONES: dict[str, AccionHandler] = {}


def procesar_eventos_pendientes(db: Session, limite: int = 100) -> ResumenDespacho:
    """Toma los eventos `pendiente` más antiguos y ejecuta las reglas activas de su tipo.

    Cada evento se toma con `FOR UPDATE SKIP LOCKED` y se confirma por separado: dos
    despachadores a la vez (el job y el endpoint manual) no pisan el mismo evento, y una falla
    en uno no revierte los ya procesados.
    """
    resumen = ResumenDespacho()
    for _ in range(limite):
        evento = db.scalars(
            select(EventLog)
            .where(EventLog.estado == "pendiente")
            .order_by(EventLog.timestamp)
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if evento is None:
            break

        evento_id = evento.id
        try:
            resumen.ejecuciones_creadas += _despachar_evento(db, evento)
            evento.estado = "procesado"
            db.commit()
            resumen.eventos_procesados += 1
        except Exception:
            db.rollback()
            logger.exception("Falló el despacho del evento %s", evento_id)
            _marcar_evento_fallido(db, evento_id)
            resumen.eventos_fallidos += 1
    return resumen


def _despachar_evento(db: Session, evento: EventLog) -> int:
    tipo_evento = db.get(TipoEvento, evento.tipo_evento_id)
    if tipo_evento is None:
        raise TipoEventoNoEncontrado()
    campos = _tipos_de_campos(db, tipo_evento.id)
    reglas = db.scalars(
        select(WorkflowRule)
        .where(WorkflowRule.tipo_evento_id == evento.tipo_evento_id, WorkflowRule.activo.is_(True))
        .order_by(WorkflowRule.nombre)
    ).all()

    creadas = 0
    for regla in reglas:
        ejecucion = WorkflowExecution(workflow_rule_id=regla.id, event_log_id=evento.id, intento=1)
        # Cada regla se evalúa aislada: una que no se puede evaluar queda como ejecución fallida
        # y no impide que se procesen las demás del mismo evento.
        try:
            if not _regla_aplica(regla, evento, tipo_evento.nombre, campos):
                continue
            _validar_accion(
                db,
                regla.tipo_accion,
                regla.accion_config,
                tipo_evento.nombre,
                campos,
                regla.notificacion_template_id,
            )
        except Exception as error:
            logger.warning("No se pudo evaluar la regla %s", regla.id, exc_info=True)
            db.add(ejecucion)
            _marcar_fallida(ejecucion, str(error))
            creadas += 1
            continue

        db.add(ejecucion)
        creadas += 1
        if regla.requiere_aprobacion_humana:
            ejecucion.estado = "pendiente"
            ejecucion.detalle = "Esperando aprobación humana."
        else:
            _ejecutar_accion(db, regla, evento, ejecucion)
    return creadas


def _regla_aplica(
    regla: WorkflowRule, evento: EventLog, tipo_evento_nombre: str, campos: dict[str, str]
) -> bool:
    esperada = ENTIDAD_POR_EVENTO.get(tipo_evento_nombre)
    if esperada != evento.entidad:
        raise EntidadDeEventoInvalida(tipo_evento_nombre, evento.entidad, esperada or "ninguna")
    return _cumple_condicion(regla.condicion, campos, evento.payload or {})


_Comparable = Decimal | date | str
_COMPARADORES: dict[str, Callable[[_Comparable, _Comparable], bool]] = {
    "==": operator.eq,
    "!=": operator.ne,
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
}


def _cumple_condicion(
    condicion: dict[str, object], campos: dict[str, str], payload: dict[str, object]
) -> bool:
    """Evalúa `{campo, operador, valor}` contra el payload del evento. Sin condición, siempre
    se cumple. Un campo ausente o de tipo equivocado no se compara: se informa como error."""
    if not condicion:
        return True
    _validar_condicion(condicion, campos)
    parseada = Condicion.model_validate(condicion)
    tipo_dato = campos[parseada.campo]
    if parseada.campo not in payload:
        raise ValueError(f"El evento no trae el campo '{parseada.campo}'.")
    try:
        actual = coaccionar_valor(tipo_dato, payload[parseada.campo])
    except ValueError as error:
        raise ValueError(f"Campo '{parseada.campo}' del evento: {error}") from error
    esperado = coaccionar_valor(tipo_dato, parseada.valor)
    if parseada.operador == "contiene":
        return str(esperado).lower() in str(actual).lower()
    return _COMPARADORES[parseada.operador](actual, esperado)


def _marcar_fallida(ejecucion: WorkflowExecution, motivo: str) -> None:
    ejecucion.estado = "fallido"
    ejecucion.error_detail = motivo
    ejecucion.finished_at = datetime.now()


def _ejecutar_accion(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> None:
    handler = ACCIONES.get(regla.tipo_accion)
    if handler is None:
        ejecucion.estado = "fallido"
        ejecucion.error_detail = f"La acción '{regla.tipo_accion}' todavía no está implementada."
    else:
        try:
            # Savepoint: si la acción falla a mitad de camino, sus escrituras se revierten sin
            # perder la ejecución ni las de otras reglas del mismo evento.
            with db.begin_nested():
                ejecucion.detalle = handler(db, regla, evento)
            ejecucion.estado = "exitoso"
        except Exception as error:
            logger.exception("Falló la acción '%s' de la regla %s", regla.tipo_accion, regla.id)
            ejecucion.estado = "fallido"
            ejecucion.error_detail = str(error)
    ejecucion.finished_at = datetime.now()


def _marcar_evento_fallido(db: Session, evento_id: uuid.UUID) -> None:
    evento = db.get(EventLog, evento_id)
    if evento is not None:
        evento.estado = "fallido"
        db.commit()
