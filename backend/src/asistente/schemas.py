"""Contratos HTTP del Asistente."""

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class MencionCreate(BaseModel):
    """Persona elegida con `@`: `texto` es lo que se vio en el mensaje y se cambia por su alias."""

    tipo: Literal["ALUMNO", "FAMILIA", "DOCENTE"]
    entidad_id: uuid.UUID
    texto: str = Field(min_length=1, max_length=120)


class MensajeCreate(BaseModel):
    contenido: str = Field(min_length=1)
    menciones: list[MencionCreate] = Field(default_factory=list, max_length=10)
    ruta: str | None = Field(default=None, max_length=200)
    ciclo_lectivo: str | None = Field(default=None, max_length=10)


class ConversacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    titulo: str | None
    creada_en: datetime
    actualizada_en: datetime


class ConversacionListadoRead(BaseModel):
    items: list[ConversacionRead]
    total: int
    pagina: int
    tamanio: int


class MensajeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    orden: int
    autor: str
    contenido: str
    tarjetas: list[dict[str, Any]] | None
    estado: str
    creado_en: datetime


class MensajeListadoRead(BaseModel):
    items: list[MensajeRead]
    total: int
    pagina: int
    tamanio: int


class ResolverCreate(BaseModel):
    conversacion_id: uuid.UUID
    aliases: list[str] = Field(min_length=1, max_length=100)


class AliasResueltoRead(BaseModel):
    alias: str
    tipo: Literal["ALUMNO", "FAMILIA", "DOCENTE"]
    entidad_id: uuid.UUID
    nombre: str


class ResolverRead(BaseModel):
    items: list[AliasResueltoRead]
