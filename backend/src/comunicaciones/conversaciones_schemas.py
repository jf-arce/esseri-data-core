from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, StringConstraints

TipoContexto = Literal[
    "debito_cobranza", "justificacion_inasistencia", "solicitud_ausencia_periodo"
]
EstadoConversacion = Literal["pendiente_administracion", "pendiente_familia", "resuelta"]


class ContextoConversacion(BaseModel):
    tipo: TipoContexto
    id: UUID
    alumno_nombre: str
    alumno_id: UUID
    fecha_inicio: date
    fecha_fin: date | None = None
    estado_tramite: str | None = None
    factura_id: UUID | None = None


class ConversacionRead(BaseModel):
    id: UUID
    contexto: ContextoConversacion
    estado: EstadoConversacion
    updated_at: datetime
    puede_responder: bool
    puede_gestionar: bool
    adjuntos_habilitados: bool


class EstadoContextoRead(BaseModel):
    contexto: ContextoConversacion
    conversacion: ConversacionRead | None
    puede_iniciar: bool
    adjuntos_habilitados: bool


class MensajeCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    texto: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]
    clave: UUID


class AdjuntoConversacionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    nombre: str
    tipo_contenido: str
    tamanio: int


class MensajeRead(BaseModel):
    id: UUID
    lado: Literal["familia", "administracion"]
    autor: str
    texto: str
    created_at: datetime
    adjuntos: list[AdjuntoConversacionRead]


class HistorialRead(BaseModel):
    items: list[MensajeRead]
    siguiente: UUID | None


class BandejaRead(BaseModel):
    items: list[ConversacionRead]
    siguiente_offset: int | None
