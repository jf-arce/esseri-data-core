import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class Audiencia(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["todos", "nivel", "division", "alumnos", "responsables"]
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    ciclo_lectivo: str | None = Field(default=None, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def coherencia(self):
        if self.tipo == "todos" and self.ids:
            raise ValueError("La audiencia general no admite identificadores")
        if self.tipo != "todos" and not self.ids:
            raise ValueError("Seleccioná al menos un destinatario")
        if self.tipo in ("nivel", "division") and not self.ciclo_lectivo:
            raise ValueError("Seleccioná el ciclo lectivo")
        return self


class BorradorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    clave: uuid.UUID
    asunto: Texto = Field(max_length=200)
    cuerpo: Texto = Field(max_length=20000)
    audiencia: Audiencia


class ComunicacionRead(BaseModel):
    id: uuid.UUID
    asunto: str
    cuerpo: str
    estado: str
    autor_id: uuid.UUID
    created_at: datetime
    publicada_at: datetime | None
    destinatarios: int
    audiencia: Audiencia | None = None
    clave: uuid.UUID | None = None
    leida_at: datetime | None = None


class Listado(BaseModel):
    items: list[ComunicacionRead]
    total: int
    pagina: int
    total_paginas: int
