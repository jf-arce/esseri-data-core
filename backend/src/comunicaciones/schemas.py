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
    canal: Literal["portal", "email", "ambos"] = "portal"
    tipo: Literal["institucional", "curso", "administrativa", "otro"] | None = None


class ComunicacionRead(BaseModel):
    id: uuid.UUID
    asunto: str
    cuerpo: str
    tipo: str
    emisor: str | None = None
    autor_nombre: str | None = None
    estado: str
    autor_id: uuid.UUID
    created_at: datetime
    publicada_at: datetime | None
    destinatarios: int
    audiencia: Audiencia | None = None
    clave: uuid.UUID | None = None
    leida_at: datetime | None = None
    canal: str = "portal"
    adjuntos: list[dict] = Field(default_factory=list)


class Listado(BaseModel):
    items: list[ComunicacionRead]
    total: int
    pagina: int
    total_paginas: int


class DestinatarioRead(BaseModel):
    id: uuid.UUID
    nombre: str
    email: str | None = None
    estado: str | None = None


class ListadoDestinatarios(BaseModel):
    items: list[DestinatarioRead]
    total: int
    pagina: int
    total_paginas: int


class IntentoEntregaRead(BaseModel):
    id: uuid.UUID
    estado: str
    error_codigo: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None


class EnvioEntregaRead(BaseModel):
    id: uuid.UUID
    email: str | None = None
    estado: str
    intentos: list[IntentoEntregaRead] = Field(default_factory=list)


class ContactoEntregaRead(BaseModel):
    """Address shown for a responsible when the communication has no email send."""

    id: uuid.UUID
    email: str


class ResponsableEntregaRead(BaseModel):
    id: uuid.UUID
    nombre: str
    emails: list[EnvioEntregaRead] = Field(default_factory=list)
    contactos: list[ContactoEntregaRead] = Field(default_factory=list)
    leida_at: datetime | None = None


class ResumenEntrega(BaseModel):
    """Responsible counts and email counts stay separate on purpose."""

    responsables: int
    responsables_con_email: int
    responsables_sin_email: int
    responsables_leidos: int
    responsables_no_leidos: int
    emails: int
    emails_aceptados: int
    emails_pendientes: int
    emails_fallidos: int
    emails_inciertos: int
    email_aplica: bool
    lectura_aplica: bool


class ListadoEntrega(BaseModel):
    items: list[ResponsableEntregaRead]
    resumen: ResumenEntrega
    total: int
    pagina: int
    total_paginas: int
