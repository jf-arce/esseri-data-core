"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StrictFloat,
    StrictInt,
    StrictStr,
    field_validator,
)

from src.fechas import InstanteUtc
from src.workflows.constants import (
    MAX_BLOQUES_SUELTOS,
    MAX_BYTES_BLOQUES_SUELTOS,
    MAX_COMPARACIONES,
    MAX_NODOS_POR_REGLA,
    Destinatario,
    EnlaceMail,
    EstadoTarea,
    Operador,
    PrioridadTarea,
    TipoAccion,
)


class _EntradaEstricta(BaseModel):
    model_config = ConfigDict(extra="forbid")


def _normalizar_asunto(value: object) -> object:
    if not isinstance(value, str):
        return value
    normalizado = value.strip()
    if any(ord(caracter) < 32 or ord(caracter) == 127 for caracter in normalizado):
        raise ValueError("El asunto no puede contener caracteres de control.")
    return normalizado


class OpcionCampoRead(BaseModel):
    valor: str
    etiqueta: str


class CampoEventoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre_interno: str
    etiqueta: str
    tipo_dato: str
    # `None` = campo libre; con lista, la condición solo acepta `==`/`!=` y uno de estos valores.
    opciones: list[OpcionCampoRead] | None = None
    # Muchos valores posibles: se buscan por texto en `/campos-evento/{id}/opciones`.
    busqueda: bool = False
    # Además de buscar, se admite escribir un valor libre ("otro").
    permite_otro: bool = False


class TipoEventoRead(BaseModel):
    """Evento del catálogo con las variables que expone para condiciones y plantillas."""

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    campos: list[CampoEventoRead]


class Condicion(_EntradaEstricta):
    """Estructura fija `{campo, operador, valor}`. `campo` y el tipo de `valor` se validan contra
    el `CAMPO_EVENTO` del evento de la regla."""

    campo: str = Field(min_length=1)
    operador: Operador
    valor: StrictInt | StrictFloat | StrictStr


class GrupoCondicion(_EntradaEstricta):
    """Condición de un nodo: 1..N comparaciones que se cumplen todas o alguna."""

    logica: Literal["todas", "alguna"] = "todas"
    comparaciones: list[Condicion] = Field(min_length=1, max_length=MAX_COMPARACIONES)


class _ConfigAccion(BaseModel):
    """Base de las `accion_config` permitidas: lo que no esté declarado se rechaza."""

    model_config = ConfigDict(extra="forbid")


class ConfigSinParametros(_ConfigAccion):
    """Acciones que operan solo sobre el evento y no admiten configuración."""


class _ConfigDestinatario(_ConfigAccion):
    destinatario: Destinatario = "responsables_habilitados"


class ConfigNotificar(_ConfigDestinatario):
    # Botón del mail hacia una pantalla de la app (allowlist en `ENLACES_MAIL`).
    enlace: EnlaceMail | None = None


class ConfigRecordatorio(ConfigNotificar):
    dias_despues: int = Field(default=1, ge=1, le=90)


class ConfigGenerarComunicacion(_ConfigDestinatario):
    """Stub de Canu: sin `enlace`, para no heredar el botón de `notificar`."""


class ConfigAlertaInterna(_ConfigAccion):
    mensaje: str | None = Field(default=None, min_length=1, max_length=500)
    enlace: EnlaceMail | None = None


class ConfigCrearTarea(_ConfigAccion):
    titulo: str = Field(min_length=1, max_length=150)
    descripcion: str | None = None
    prioridad: PrioridadTarea = "media"
    dias_para_vencer: int | None = Field(default=None, ge=1, le=60)


class ConfigEscalarCaso(_ConfigAccion):
    motivo: str | None = None
    prioridad: PrioridadTarea = "alta"


class ConfigCambiarEstado(_ConfigAccion):
    estado_nuevo: str = Field(min_length=1)


class ConfigGenerarCargo(_ConfigAccion):
    concepto_cobro_id: uuid.UUID
    monto: Decimal | None = Field(default=None, gt=0)


class ConfigAplicarPenalidad(_ConfigAccion):
    """Sin `regla_penalidad_id` el motor elige el tramo según los días de vencimiento."""

    regla_penalidad_id: uuid.UUID | None = None


class ConfigActualizarCuentaCorriente(_ConfigAccion):
    tipo: Literal["debe", "haber"]
    concepto_cobro_id: uuid.UUID
    campo_monto: str = Field(min_length=1)


class ConfigCrearRegistroRelacionado(_ConfigAccion):
    registro: Literal["alumno_y_familia_desde_solicitud"]


CONFIG_POR_ACCION: dict[str, type[_ConfigAccion]] = {
    "notificar": ConfigNotificar,
    "alerta_interna": ConfigAlertaInterna,
    "cambiar_estado": ConfigCambiarEstado,
    "crear_tarea": ConfigCrearTarea,
    "generar_cargo": ConfigGenerarCargo,
    "aplicar_vencimiento": ConfigSinParametros,
    "aplicar_penalidad": ConfigAplicarPenalidad,
    "registrar_pago": ConfigSinParametros,
    "registrar_rechazo": ConfigSinParametros,
    "actualizar_cuenta_corriente": ConfigActualizarCuentaCorriente,
    "generar_recordatorio": ConfigRecordatorio,
    "escalar_caso": ConfigEscalarCaso,
    "crear_registro_relacionado": ConfigCrearRegistroRelacionado,
    "generar_orden_compra": ConfigSinParametros,
    "generar_comunicacion": ConfigGenerarComunicacion,
}


class TipoAccionRead(BaseModel):
    """Qué admite cada tipo de acción, para que el frontend arme el formulario sin duplicar la
    allowlist."""

    tipo_accion: TipoAccion
    requiere_aprobacion_por_defecto: bool
    eventos_permitidos: list[str] | None
    admite_plantilla: bool
    implementada: bool = True
    config_schema: dict[str, object]


TipoNodo = Literal["condicion", "accion"]
RamaNodo = Literal["si", "no"]


class PosicionNodo(_EntradaEstricta):
    x: float
    y: float


class DestinatariosNodoWrite(_EntradaEstricta):
    rol_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)
    usuario_ids: list[uuid.UUID] = Field(default_factory=list, max_length=100)

    @field_validator("rol_ids", "usuario_ids")
    @classmethod
    def quitar_repetidos(cls, values: list[uuid.UUID]) -> list[uuid.UUID]:
        return list(dict.fromkeys(values))


class NodoWrite(_EntradaEstricta):
    """Nodo del árbol tal como lo arma el editor. El `id` lo genera el cliente: así el guardado
    sincroniza por UUID (inserta, actualiza o da de baja) en una sola llamada."""

    id: uuid.UUID
    tipo: TipoNodo
    padre_id: uuid.UUID | None = None
    rama: RamaNodo | None = None
    condicion: GrupoCondicion | None = None
    tipo_accion: TipoAccion | None = None
    accion_config: dict[str, object] | None = None
    notificacion_template_id: uuid.UUID | None = None
    # Sin valor, toma el default del `tipo_accion` (ver `ACCIONES_CON_APROBACION_POR_DEFECTO`).
    requiere_aprobacion_humana: bool | None = None
    destinatarios: DestinatariosNodoWrite = Field(default_factory=DestinatariosNodoWrite)
    posicion: PosicionNodo | None = None


class DestinatarioRolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str


class DestinatarioUsuarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    estado: str


class DestinatariosNodoRead(BaseModel):
    roles: list[DestinatarioRolRead] = []
    usuarios: list[DestinatarioUsuarioRead] = []


class NodoRead(BaseModel):
    id: uuid.UUID
    tipo: TipoNodo
    padre_id: uuid.UUID | None
    rama: RamaNodo | None
    orden: int
    condicion: dict[str, object] | None
    tipo_accion: TipoAccion | None
    accion_config: dict[str, object] | None
    notificacion_template_id: uuid.UUID | None
    requiere_aprobacion_humana: bool
    destinatarios: DestinatariosNodoRead
    posicion: PosicionNodo | None
    updated_at: InstanteUtc


def _validar_bloques_sueltos(value: list[dict[str, object]]) -> list[dict[str, object]]:
    """Solo la forma mínima: son borradores que nunca se ejecutan, no se valida su contenido."""
    for bloque in value:
        if not isinstance(bloque.get("id"), str) or bloque.get("tipo") not in (
            "condicion",
            "accion",
        ):
            raise ValueError(
                "Cada bloque sin conectar necesita 'id' y 'tipo' (condicion o accion)."
            )
    if len(json.dumps(value)) > MAX_BYTES_BLOQUES_SUELTOS:
        raise ValueError("Los bloques sin conectar ocupan demasiado.")
    return value


class WorkflowRuleCreate(_EntradaEstricta):
    """El árbol de `nodos` es datos que el backend interpreta contra una allowlist, nunca código
    ejecutable. `crear_regla` los valida (ver `CONFIG_POR_ACCION` y `GrupoCondicion`)."""

    nombre: str = Field(min_length=1, max_length=150)
    tipo_evento_id: uuid.UUID
    activo: bool = True
    nodos: list[NodoWrite] = Field(min_length=1, max_length=MAX_NODOS_POR_REGLA)
    bloques_sueltos: list[dict[str, object]] = Field(
        default_factory=list, max_length=MAX_BLOQUES_SUELTOS
    )

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    _validar_sueltos = field_validator("bloques_sueltos")(_validar_bloques_sueltos)


class WorkflowRuleUpdate(_EntradaEstricta):
    """Edición parcial. Si llega `nodos`, reemplaza el árbol completo (se sincroniza por UUID). La
    baja es `activo = false`: las ejecuciones históricas referencian la regla, así que no se
    borra. `updated_at_base` es el `updated_at` que tenía la regla al abrirla: si cambió, el
    guardado se rechaza para no pisar una edición ajena."""

    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    tipo_evento_id: uuid.UUID | None = None
    activo: bool | None = None
    nodos: list[NodoWrite] | None = Field(
        default=None, min_length=1, max_length=MAX_NODOS_POR_REGLA
    )
    # `None` deja los bloques sin conectar como están; una lista (incluso vacía) los reemplaza.
    bloques_sueltos: list[dict[str, object]] | None = Field(
        default=None, max_length=MAX_BLOQUES_SUELTOS
    )
    updated_at_base: InstanteUtc | None = None

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("bloques_sueltos")
    @classmethod
    def validar_sueltos(
        cls, value: list[dict[str, object]] | None
    ) -> list[dict[str, object]] | None:
        return None if value is None else _validar_bloques_sueltos(value)


class WorkflowRuleRead(BaseModel):
    id: uuid.UUID
    nombre: str
    tipo_evento_id: uuid.UUID
    activo: bool
    created_at: InstanteUtc
    updated_at: InstanteUtc
    nodos: list[NodoRead]
    bloques_sueltos: list[dict[str, object]] = []


class NotificacionTemplateCreate(_EntradaEstricta):
    nombre: str = Field(min_length=1, max_length=150)
    asunto: str = Field(min_length=1, max_length=200)
    cuerpo: str = Field(min_length=1, max_length=10_000)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("asunto", mode="before")
    @classmethod
    def normalizar_asunto(cls, value: object) -> object:
        return _normalizar_asunto(value)

    @field_validator("cuerpo")
    @classmethod
    def rechazar_cuerpo_vacio(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("El cuerpo no puede estar vacío.")
        return value


class NotificacionTemplateUpdate(_EntradaEstricta):
    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    asunto: str | None = Field(default=None, min_length=1, max_length=200)
    cuerpo: str | None = Field(default=None, min_length=1, max_length=10_000)

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("asunto", mode="before")
    @classmethod
    def normalizar_asunto(cls, value: object) -> object:
        return _normalizar_asunto(value)

    @field_validator("cuerpo")
    @classmethod
    def rechazar_cuerpo_vacio(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("El cuerpo no puede estar vacío.")
        return value


class NotificacionTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    asunto: str
    cuerpo: str
    created_at: InstanteUtc
    updated_at: InstanteUtc


EstadoWorkflowExecution = Literal["exitoso", "fallido", "pendiente", "rechazado"]


class CampoResumen(BaseModel):
    nombre_interno: str
    etiqueta: str
    valor: str


class WorkflowExecutionRead(BaseModel):
    """Ejecución con el contexto necesario para explicar qué regla y evento la originaron."""

    id: uuid.UUID
    intento: int
    started_at: InstanteUtc
    finished_at: InstanteUtc | None
    estado: EstadoWorkflowExecution
    detalle: str | None
    error_detail: str | None
    workflow_rule_id: uuid.UUID
    workflow_rule_nombre: str
    workflow_nodo_id: uuid.UUID
    # Nulo cuando la ejecución es de una condición que no se pudo evaluar.
    tipo_accion: TipoAccion | None
    event_log_id: uuid.UUID
    tipo_evento: str
    evento_timestamp: InstanteUtc
    entidad: str
    entidad_id: uuid.UUID
    reintentable: bool
    aprobable: bool
    resumen_evento: list[CampoResumen] = []
    # Solo en el detalle de `aplicar_penalidad` pendiente: lo que se cobraría al aprobar hoy.
    recargo_estimado: Decimal | None = None


class EjecucionRechazo(_EntradaEstricta):
    motivo: str = Field(min_length=1, max_length=500)

    @field_validator("motivo", mode="before")
    @classmethod
    def normalizar_motivo(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkflowExecutionListadoRead(BaseModel):
    items: list[WorkflowExecutionRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


EstadoEnvioNotificacion = Literal["enviado", "fallido", "incierto", "pendiente"]
DestinatarioTipo = Literal["familia", "usuario"]


class NotificacionRead(BaseModel):
    """Fila del log de notificaciones. El cuerpo solo viaja en el detalle."""

    id: uuid.UUID
    destinatario_tipo: DestinatarioTipo
    canal: str
    destinatario_snapshot: str
    asunto_snapshot: str
    estado_envio: EstadoEnvioNotificacion
    sent_at: InstanteUtc | None
    familia_id: uuid.UUID | None
    usuario_id: uuid.UUID | None
    workflow_execution_id: uuid.UUID
    intento: int
    ejecucion_started_at: InstanteUtc
    workflow_rule_id: uuid.UUID
    workflow_rule_nombre: str


class NotificacionDetalleRead(NotificacionRead):
    cuerpo_snapshot: str


class NotificacionListadoRead(BaseModel):
    items: list[NotificacionRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class ResumenDespacho(BaseModel):
    """Resultado de una pasada del despachador sobre los eventos pendientes."""

    eventos_procesados: int = 0
    eventos_fallidos: int = 0
    ejecuciones_creadas: int = 0
    recordatorios_ejecutados: int = 0


class ResultadoAccion(BaseModel):
    """Lo que devuelve un handler de acción. Con `error` cargado la ejecución queda `fallido`,
    pero las escrituras del handler se conservan (p. ej. notificaciones en `fallido`)."""

    detalle: str | None = None
    error: str | None = None


class TareaRead(BaseModel):
    """Fila de la bandeja de tareas. `tarea_id` es la tarea de la que se escaló esta (si la hay)."""

    id: uuid.UUID
    titulo: str
    descripcion: str | None
    estado: EstadoTarea
    prioridad: PrioridadTarea
    fecha_vencimiento: InstanteUtc | None
    vencida: bool
    entidad: str | None
    entidad_id: uuid.UUID | None
    usuario_id: uuid.UUID
    usuario_email: str
    workflow_execution_id: uuid.UUID | None
    workflow_rule_nombre: str | None
    tarea_id: uuid.UUID | None
    created_at: InstanteUtc
    updated_at: InstanteUtc


class TareaCadenaRead(BaseModel):
    """Un eslabón del historial de escalamiento."""

    id: uuid.UUID
    titulo: str
    estado: EstadoTarea
    prioridad: PrioridadTarea
    usuario_email: str
    tarea_id: uuid.UUID | None
    created_at: InstanteUtc


class TareaDetalleRead(TareaRead):
    """La cadena va de la tarea original a la última escalada, e incluye a la tarea consultada."""

    cadena: list[TareaCadenaRead]


class TareaListadoRead(BaseModel):
    items: list[TareaRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class TareaAsignadoUpdate(_EntradaEstricta):
    """Nuevo responsable de la tarea: un usuario activo."""

    usuario_id: uuid.UUID


class TareaEstadoUpdate(_EntradaEstricta):
    """Una persona solo puede avanzar la tarea: `escalada` la pone el motor."""

    estado: Literal["en_progreso", "completada"]


# --- Simulación, estadísticas y resumen ------------------------------------------------------

EstadoCondicionSimulada = Literal["cumple", "no_cumple", "error"]
EstadoAccionSimulada = Literal[
    "alcanzada", "requiere_aprobacion", "diferida", "no_implementada", "config_invalida"
]


class SimulacionEntrada(_EntradaEstricta):
    """Borrador de regla (sin guardar) y el evento real contra el que se prueba."""

    tipo_evento_id: uuid.UUID
    event_log_id: uuid.UUID
    nodos: list[NodoWrite] = Field(min_length=1, max_length=MAX_NODOS_POR_REGLA)


class NodoSimulado(BaseModel):
    """`no_alcanzado` es un nodo al que el recorrido no llegó con los datos de ese evento."""

    id: uuid.UUID
    estado: EstadoCondicionSimulada | EstadoAccionSimulada | Literal["no_alcanzado"]
    detalle: str | None = None


class EventoResumenRead(BaseModel):
    id: uuid.UUID
    timestamp: InstanteUtc
    entidad: str
    estado: str
    campos: list[CampoResumen]


class SimulacionRead(BaseModel):
    evento: EventoResumenRead
    nodos: list[NodoSimulado]


class EstadisticasNodoRead(BaseModel):
    workflow_nodo_id: uuid.UUID
    exitoso: int = 0
    fallido: int = 0
    pendiente: int = 0
    rechazado: int = 0


class EstadisticasReglaRead(BaseModel):
    dias: int
    nodos: list[EstadisticasNodoRead]


class ConteoEstadosRead(BaseModel):
    exitoso: int = 0
    fallido: int = 0
    pendiente: int = 0
    rechazado: int = 0
    total: int = 0


class PuntoSerieRead(ConteoEstadosRead):
    fecha: date


class ResumenReglaRead(BaseModel):
    workflow_rule_id: uuid.UUID
    ejecuciones: ConteoEstadosRead
    serie: list[int]
    ultima_ejecucion: InstanteUtc | None
    fallas_7_dias: int
    sin_disparos: bool


class ResumenWorkflowsRead(BaseModel):
    dias: int
    actual: ConteoEstadosRead
    anterior: ConteoEstadosRead
    serie_diaria: list[PuntoSerieRead]
    reglas: list[ResumenReglaRead]
    activas: int
    inactivas: int
    con_errores: int
