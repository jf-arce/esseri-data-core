import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from src.comunicaciones.mensaje_rico import normalizar_documento, texto_plano

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
HoraLocal = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class EventoBorrador(BaseModel):
    model_config = ConfigDict(extra="forbid")
    titulo: str = Field(default="", max_length=200)
    fecha: date | None = None
    hora_inicio: HoraLocal | None = None
    hora_fin: HoraLocal | None = None
    lugar: str = Field(default="", max_length=200)
    descripcion: str = Field(default="", max_length=2000)


class EventoPublicable(EventoBorrador):
    titulo: Texto = Field(max_length=200)
    fecha: date

    @model_validator(mode="after")
    def horario(self):
        if self.hora_inicio and self.hora_fin and self.hora_fin <= self.hora_inicio:
            raise ValueError("La hora de fin debe ser posterior a la hora de inicio")
        return self


class EventoCalendario(EventoPublicable):
    comunicacion_id: uuid.UUID


class AudienciaBorrador(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tipo: Literal["todos", "nivel", "division", "alumnos", "responsables"]
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=1000)
    ciclo_lectivo: str | None = Field(default=None, pattern=r"^\d{4}$")

    @model_validator(mode="after")
    def coherencia(self):
        if self.tipo == "todos" and self.ids:
            raise ValueError("La audiencia general no admite identificadores")
        if self.ids and self.tipo in ("nivel", "division") and not self.ciclo_lectivo:
            raise ValueError("Seleccioná el ciclo lectivo")
        return self


class Audiencia(AudienciaBorrador):
    @model_validator(mode="after")
    def completa(self):
        if self.tipo != "todos" and not self.ids:
            raise ValueError("Seleccioná al menos un destinatario")
        if self.tipo in ("nivel", "division") and not self.ciclo_lectivo:
            raise ValueError("Seleccioná el ciclo lectivo")
        return self


class BorradorInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    clave: uuid.UUID
    asunto: str = Field(max_length=200)
    cuerpo: str = Field(max_length=20000)
    cuerpo_rico: dict | None = None
    audiencia: AudienciaBorrador
    canal: Literal["portal", "email", "ambos"] = "portal"
    tipo: Literal["institucional", "curso", "administrativa", "otro"] | None = None
    evento: EventoBorrador | None = None

    @model_validator(mode="after")
    def normalizar_mensaje(self):
        if self.cuerpo_rico is not None:
            self.cuerpo_rico = normalizar_documento(self.cuerpo_rico)
            self.cuerpo = texto_plano(self.cuerpo_rico)
            if len(self.cuerpo) > 20000:
                raise ValueError("El mensaje no puede superar 20000 caracteres")
        return self


class PublicableInput(BorradorInput):
    asunto: Texto = Field(max_length=200)
    cuerpo: Texto = Field(max_length=20000)
    audiencia: Audiencia
    evento: EventoPublicable | None = None

    @model_validator(mode="after")
    def validar_mensaje(self):
        if not self.cuerpo.strip():
            raise ValueError("Completá el mensaje")
        return self


class BorradorEdicionInput(BorradorInput):
    # Optional only for pre-version clients; the web client always sends it so two
    # sessions cannot overwrite each other silently.
    version: int | None = Field(default=None, ge=1)


class PublicacionInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    version: int | None = Field(default=None, ge=1)


class ComunicacionRead(BaseModel):
    id: uuid.UUID
    asunto: str
    cuerpo: str
    cuerpo_rico: dict | None = None
    tipo: str
    emisor: str | None = None
    autor_nombre: str | None = None
    estado: str
    version: int
    autor_id: uuid.UUID
    created_at: datetime
    publicada_at: datetime | None
    destinatarios: int
    audiencia: AudienciaBorrador | None = None
    clave: uuid.UUID | None = None
    leida_at: datetime | None = None
    canal: str = "portal"
    adjuntos: list[dict] = Field(default_factory=list)
    evento: EventoBorrador | None = None


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
