"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from src.workflows.constants import Criticidad, TipoAccion


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


class WorkflowRuleCreate(BaseModel):
    """`condicion` y `accion_config` son datos que el backend interpreta contra una allowlist,
    nunca código ejecutable. Su estructura se valida al implementar cada acción."""

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


class ResumenDespacho(BaseModel):
    """Resultado de una pasada del despachador sobre los eventos pendientes."""

    eventos_procesados: int = 0
    eventos_fallidos: int = 0
    ejecuciones_creadas: int = 0
