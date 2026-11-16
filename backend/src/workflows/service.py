"""Catálogos del motor de Workflows y validación de condiciones y acciones contra la allowlist.

El ABM de reglas vive en `reglas_service.py`, el árbol de nodos en `arbol_service.py`, la emisión de
eventos en `eventos_service.py` (ver el motivo ahí) y el despacho en `despacho_service.py`."""

import uuid
from collections import defaultdict
from typing import get_args

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import NivelEducativo
from src.facturacion.models import ConceptoCobro, MetodoPago, ReglaPenalidad
from src.workflows import plantillas_service
from src.workflows.constants import (
    ACCIONES_CON_APROBACION_POR_DEFECTO,
    ACCIONES_CON_PLANTILLA,
    ACCIONES_NO_IMPLEMENTADAS,
    CAMBIOS_ESTADO_PERMITIDOS,
    CAMPOS_CON_OPCIONES_DE_TABLA,
    DESTINATARIOS_FAMILIARES,
    ENTIDAD_POR_EVENTO,
    ENTIDADES_CON_ALUMNO,
    ENTIDADES_CON_SOLICITANTE,
    EVENTOS_POR_ACCION,
    OPCIONES_POR_CAMPO,
    OPERADORES_CON_OPCIONES,
    OPERADORES_POR_TIPO_DATO,
    TipoAccion,
)
from src.workflows.eventos_service import coaccionar_valor
from src.workflows.exceptions import (
    AccionConfigInvalida,
    CondicionInvalida,
    PlantillaNoEncontrada,
)
from src.workflows.models import (
    CampoEvento,
    NotificacionTemplate,
    TipoEvento,
)
from src.workflows.schemas import (
    CONFIG_POR_ACCION,
    CampoEventoRead,
    Condicion,
    ConfigActualizarCuentaCorriente,
    ConfigAplicarPenalidad,
    ConfigCambiarEstado,
    ConfigCrearTarea,
    ConfigEscalarCaso,
    ConfigGenerarCargo,
    ConfigNotificar,
    GrupoCondicion,
    OpcionCampoRead,
    TipoAccionRead,
    TipoEventoRead,
)


def opciones_de_campos(db: Session, tipo_evento_nombre: str) -> dict[str, list[OpcionCampoRead]]:
    """Valores cerrados de los campos del evento (`nombre_interno -> opciones`). Los campos libres
    no aparecen."""
    opciones: dict[str, list[OpcionCampoRead]] = {
        campo: [OpcionCampoRead(valor=v, etiqueta=e) for v, e in valores]
        for (evento, campo), valores in OPCIONES_POR_CAMPO.items()
        if evento == tipo_evento_nombre
    }
    for (evento, campo), tabla in CAMPOS_CON_OPCIONES_DE_TABLA.items():
        if evento != tipo_evento_nombre:
            continue
        nombres = (
            db.scalars(
                select(MetodoPago.nombre).where(MetodoPago.activo).order_by(MetodoPago.nombre)
            )
            if tabla == "metodo_pago"
            else db.scalars(select(NivelEducativo.nombre).order_by(NivelEducativo.nombre))
        )
        opciones[campo] = [OpcionCampoRead(valor=n, etiqueta=n) for n in nombres]
    return opciones


def listar_tipos_evento(db: Session) -> list[TipoEventoRead]:
    campos_por_tipo: dict[uuid.UUID, list[CampoEvento]] = defaultdict(list)
    for campo in db.scalars(select(CampoEvento).order_by(CampoEvento.nombre_interno)):
        campos_por_tipo[campo.tipo_evento_id].append(campo)
    tipos = db.scalars(select(TipoEvento).order_by(TipoEvento.nombre))
    resultado: list[TipoEventoRead] = []
    for tipo in tipos:
        opciones = opciones_de_campos(db, tipo.nombre)
        campos = [
            CampoEventoRead(
                id=c.id,
                nombre_interno=c.nombre_interno,
                etiqueta=c.etiqueta,
                tipo_dato=c.tipo_dato,
                opciones=opciones.get(c.nombre_interno),
            )
            for c in campos_por_tipo[tipo.id]
        ]
        resultado.append(
            TipoEventoRead(
                id=tipo.id, nombre=tipo.nombre, descripcion=tipo.descripcion, campos=campos
            )
        )
    return resultado


def listar_tipos_accion() -> list[TipoAccionRead]:
    return [
        TipoAccionRead(
            tipo_accion=tipo,
            requiere_aprobacion_por_defecto=aprobacion_por_defecto(tipo),
            eventos_permitidos=(
                None if EVENTOS_POR_ACCION[tipo] is None else sorted(EVENTOS_POR_ACCION[tipo])
            ),
            admite_plantilla=tipo in ACCIONES_CON_PLANTILLA,
            implementada=tipo not in ACCIONES_NO_IMPLEMENTADAS,
            config_schema=CONFIG_POR_ACCION[tipo].model_json_schema(),
        )
        for tipo in get_args(TipoAccion)
    ]


def aprobacion_por_defecto(tipo_accion: str) -> bool:
    return tipo_accion in ACCIONES_CON_APROBACION_POR_DEFECTO


def tipos_de_campos(db: Session, tipo_evento_id: uuid.UUID) -> dict[str, str]:
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


def validar_condicion(
    condicion: dict[str, object],
    campos: dict[str, str],
    opciones: dict[str, list[OpcionCampoRead]] | None = None,
) -> GrupoCondicion:
    """Valida el grupo de comparaciones contra los campos del evento. Con `opciones` (al guardar
    una regla) también exige que los campos enumerados usen un valor de su lista; al evaluar un
    evento no se pasa, para que una opción dada de baja después no rompa reglas ya guardadas."""
    try:
        grupo = GrupoCondicion.model_validate(condicion)
    except ValidationError as error:
        raise CondicionInvalida(f"Condición inválida: {_resumen_errores(error)}") from error
    for comparacion in grupo.comparaciones:
        _validar_comparacion(comparacion, campos, opciones or {})
    return grupo


def _validar_comparacion(
    comparacion: Condicion, campos: dict[str, str], opciones: dict[str, list[OpcionCampoRead]]
) -> None:
    tipo_dato = campos.get(comparacion.campo)
    if tipo_dato is None:
        disponibles = ", ".join(sorted(campos)) or "ninguno"
        raise CondicionInvalida(
            f"El campo '{comparacion.campo}' no existe en este evento. Disponibles: {disponibles}."
        )
    if comparacion.operador not in OPERADORES_POR_TIPO_DATO[tipo_dato]:
        raise CondicionInvalida(
            f"El operador '{comparacion.operador}' no aplica a '{comparacion.campo}' ({tipo_dato})."
        )
    validas = opciones.get(comparacion.campo)
    if validas is not None:
        if comparacion.operador not in OPERADORES_CON_OPCIONES:
            raise CondicionInvalida(
                f"'{comparacion.campo}' tiene valores fijos: solo admite 'es' o 'no es'."
            )
        if comparacion.valor not in {o.valor for o in validas}:
            raise CondicionInvalida(
                f"'{comparacion.valor}' no es un valor válido para '{comparacion.campo}'. "
                f"Opciones: {', '.join(o.valor for o in validas) or 'ninguna'}."
            )
    try:
        coaccionar_valor(tipo_dato, comparacion.valor)
    except ValueError as error:
        raise CondicionInvalida(f"Valor inválido para '{comparacion.campo}': {error}") from error


def validar_accion(
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
    if notificacion_template_id is not None:
        plantilla = db.get(NotificacionTemplate, notificacion_template_id)
        if plantilla is None:
            raise PlantillaNoEncontrada()
        plantillas_service.validar_contenido_para_campos(
            asunto=plantilla.asunto,
            cuerpo=plantilla.cuerpo,
            campos=set(campos),
        )
    # `null` equivale a `{}`: las reglas sin config siguen siendo válidas si no tienen
    # parámetros obligatorios.
    try:
        config = CONFIG_POR_ACCION[tipo_accion].model_validate(accion_config or {})
    except ValidationError as error:
        raise AccionConfigInvalida(
            f"Configuración inválida para '{tipo_accion}': {_resumen_errores(error)}"
        ) from error

    if isinstance(config, ConfigNotificar) and tipo_accion == "notificar":
        entidad_evento = ENTIDAD_POR_EVENTO.get(tipo_evento_nombre, "")
        if (
            config.destinatario in DESTINATARIOS_FAMILIARES
            and entidad_evento not in ENTIDADES_CON_ALUMNO
        ):
            raise AccionConfigInvalida(
                f"El evento '{tipo_evento_nombre}' no tiene alumno asociado: "
                "usá el destinatario 'destinatarios_regla'."
            )
    if (
        getattr(config, "destinatario", None) == "solicitante"
        and ENTIDAD_POR_EVENTO.get(tipo_evento_nombre, "") not in ENTIDADES_CON_SOLICITANTE
    ):
        raise AccionConfigInvalida(
            f"El evento '{tipo_evento_nombre}' no viene de una compra: no tiene solicitante."
        )
    if isinstance(config, ConfigCrearTarea | ConfigEscalarCaso):
        textos = (
            (config.titulo, config.descripcion)
            if isinstance(config, ConfigCrearTarea)
            else ("-", config.motivo)
        )
        plantillas_service.validar_contenido_para_campos(
            asunto=textos[0],
            cuerpo=textos[1] or "",
            campos=set(campos),
            contexto="la tarea",
        )
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
