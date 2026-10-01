"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import datetime
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

from src.workflows.constants import Criticidad, Destinatario, Operador, PrioridadTarea, TipoAccion


class CampoEventoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre_interno: str
    etiqueta: str
    tipo_dato: str


class TipoEventoRead(BaseModel):
    """Evento del catálogo con las variables que expone para condiciones y plantillas."""

    id: uuid.UUID
    nombre: str
    descripcion: str | None
    campos: list[CampoEventoRead]


class Condicion(BaseModel):
    """Estructura fija `{campo, operador, valor}`. `campo` y el tipo de `valor` se validan contra
    el `CAMPO_EVENTO` del evento de la regla."""

    model_config = ConfigDict(extra="forbid")

    campo: str = Field(min_length=1)
    operador: Operador
    valor: StrictInt | StrictFloat | StrictStr


class _ConfigAccion(BaseModel):
    """Base de las `accion_config` permitidas: lo que no esté declarado se rechaza."""

    model_config = ConfigDict(extra="forbid")


class ConfigSinParametros(_ConfigAccion):
    """Acciones que operan solo sobre el evento y no admiten configuración."""


class ConfigNotificar(_ConfigAccion):
    destinatario: Destinatario = "responsables_habilitados"


class ConfigRecordatorio(ConfigNotificar):
    dias_despues: int = Field(default=1, ge=1, le=90)


class ConfigAlertaInterna(_ConfigAccion):
    mensaje: str | None = Field(default=None, min_length=1, max_length=500)


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
    "generar_comunicacion": ConfigNotificar,
}


class TipoAccionRead(BaseModel):
    """Qué admite cada tipo de acción, para que el frontend arme el formulario sin duplicar la
    allowlist."""

    tipo_accion: TipoAccion
    requiere_aprobacion_por_defecto: bool
    eventos_permitidos: list[str] | None
    admite_plantilla: bool
    config_schema: dict[str, object]


class WorkflowRuleCreate(BaseModel):
    """`condicion` y `accion_config` son datos que el backend interpreta contra una allowlist,
    nunca código ejecutable. `crear_regla` los valida (ver `CONFIG_POR_ACCION` y `Condicion`)."""

    nombre: str = Field(min_length=1, max_length=150)
    tipo_evento_id: uuid.UUID
    condicion: dict[str, object] = Field(default_factory=dict)
    tipo_accion: TipoAccion
    accion_config: dict[str, object] | None = None
    criticidad: Criticidad
    # Sin valor, toma el default del `tipo_accion` (ver `ACCIONES_CON_APROBACION_POR_DEFECTO`).
    requiere_aprobacion_humana: bool | None = None
    notificacion_template_id: uuid.UUID | None = None
    activo: bool = True

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkflowRuleUpdate(BaseModel):
    """Edición parcial. La baja es `activo = false`: las ejecuciones históricas referencian la
    regla, así que no se borra."""

    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    tipo_evento_id: uuid.UUID | None = None
    condicion: dict[str, object] | None = None
    tipo_accion: TipoAccion | None = None
    accion_config: dict[str, object] | None = None
    criticidad: Criticidad | None = None
    requiere_aprobacion_humana: bool | None = None
    notificacion_template_id: uuid.UUID | None = None
    activo: bool | None = None

    @field_validator("nombre", mode="before")
    @classmethod
    def normalizar_nombre(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class WorkflowRuleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    tipo_evento_id: uuid.UUID
    condicion: dict[str, object]
    tipo_accion: TipoAccion
    accion_config: dict[str, object] | None
    criticidad: Criticidad
    requiere_aprobacion_humana: bool
    notificacion_template_id: uuid.UUID | None
    activo: bool
    created_at: datetime
    updated_at: datetime


EstadoWorkflowExecution = Literal["exitoso", "fallido", "pendiente"]


class WorkflowExecutionRead(BaseModel):
    """Ejecución con el contexto necesario para explicar qué regla y evento la originaron."""

    id: uuid.UUID
    intento: int
    started_at: datetime
    finished_at: datetime | None
    estado: EstadoWorkflowExecution
    detalle: str | None
    error_detail: str | None
    workflow_rule_id: uuid.UUID
    workflow_rule_nombre: str
    tipo_accion: TipoAccion
    event_log_id: uuid.UUID
    tipo_evento: str
    evento_timestamp: datetime
    entidad: str
    entidad_id: uuid.UUID
    reintentable: bool


class WorkflowExecutionListadoRead(BaseModel):
    items: list[WorkflowExecutionRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class ResumenDespacho(BaseModel):
    """Resultado de una pasada del despachador sobre los eventos pendientes."""

    eventos_procesados: int = 0
    eventos_fallidos: int = 0
    ejecuciones_creadas: int = 0
