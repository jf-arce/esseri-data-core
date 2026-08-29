"""Modelos Pydantic para las inscripciones."""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

EtapaSolicitud = Literal[
    "consulta_lead",
    "entrevista",
    "postulacion",
    "evaluacion_aprobacion",
    "reserva_matricula",
    "documentacion_contrato",
    "inscripcion_confirmada",
]
EstadoSolicitud = Literal["en_proceso", "aprobada", "rechazada", "desistida"]


class InscripcionCreateBase(BaseModel):
    ciclo_lectivo: str = Field(min_length=4, max_length=20)
    fecha_inscripcion: date
    alumno_id: uuid.UUID
    division_id: uuid.UUID

    @field_validator("ciclo_lectivo", mode="before")
    @classmethod
    def normalizar_ciclo_lectivo(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class InscripcionNuevaCreate(InscripcionCreateBase):
    """Datos necesarios para confirmar una inscripción proveniente de admisiones."""

    solicitud_inscripcion_id: uuid.UUID


class ReinscripcionCreate(InscripcionCreateBase):
    """Datos para reinscribir a un alumno en el ciclo inmediatamente siguiente."""

    ciclo_lectivo: str = Field(min_length=4, max_length=4, pattern=r"^[1-9]\d{3}$")


class CambioMatriculaCreate(BaseModel):
    """Datos para trasladar una inscripción activa a otra división."""

    division_id: uuid.UUID
    fecha_cambio: date


class BajaInscripcionCreate(BaseModel):
    """Datos para registrar la baja de una inscripción activa."""

    fecha_baja: date


class PersonaSolicitudCreate(BaseModel):
    """Identidad del aspirante o contacto de una solicitud de admisión."""

    nombre: str = Field(min_length=1, max_length=100)
    apellido: str = Field(min_length=1, max_length=100)
    dni: str = Field(min_length=6, max_length=20)
    telefono: str | None = Field(default=None, max_length=50)
    sexo: str | None = Field(default=None, max_length=50)

    @field_validator("nombre", "apellido", "dni", mode="before")
    @classmethod
    def normalizar_texto(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class PersonaSolicitudRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    apellido: str
    dni: str
    telefono: str | None
    sexo: str | None


class SolicitudInscripcionCreate(BaseModel):
    ciclo_lectivo: str = Field(min_length=4, max_length=20)
    fecha_solicitud: date
    nivel_educativo_id: uuid.UUID
    aspirante: PersonaSolicitudCreate
    contacto: PersonaSolicitudCreate | None = None
    observaciones: str | None = Field(default=None, max_length=2000)

    @field_validator("ciclo_lectivo", mode="before")
    @classmethod
    def normalizar_ciclo_lectivo(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class EtapaSolicitudCreate(BaseModel):
    observaciones: str | None = Field(default=None, max_length=2000)


class DocumentoSolicitudCreate(BaseModel):
    tipo_documento: str = Field(min_length=1, max_length=100)
    archivo: str = Field(min_length=1, max_length=500)


class DocumentoSolicitudUpdate(BaseModel):
    estado: Literal["validado", "rechazado"]


class EtapaSolicitudRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    etapa: EtapaSolicitud
    estado: Literal["en_proceso", "completada", "rechazada"]
    fecha: datetime
    observaciones: str | None
    usuario_id: uuid.UUID


class DocumentoSolicitudRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tipo_documento: str
    archivo: str
    estado: Literal["pendiente", "validado", "rechazado"]
    fecha_carga: datetime
    updated_at: datetime
    usuario_id: uuid.UUID


class SolicitudInscripcionRead(BaseModel):
    id: uuid.UUID
    ciclo_lectivo: str
    etapa: EtapaSolicitud
    estado: EstadoSolicitud
    fecha_solicitud: date
    fecha_resolucion: date | None
    observaciones: str | None
    updated_at: datetime
    nivel_educativo_id: uuid.UUID
    aspirante: PersonaSolicitudRead
    contacto: PersonaSolicitudRead | None
    usuario_id: uuid.UUID
    etapas: list[EtapaSolicitudRead]
    documentos: list[DocumentoSolicitudRead]


class SolicitudInscripcionListadoItemRead(BaseModel):
    id: uuid.UUID
    ciclo_lectivo: str
    etapa: EtapaSolicitud
    estado: EstadoSolicitud
    fecha_solicitud: date
    aspirante_nombre: str
    aspirante_apellido: str
    aspirante_dni: str
    nivel_educativo_nombre: str


class SolicitudInscripcionListadoRead(BaseModel):
    items: list[SolicitudInscripcionListadoItemRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class InscripcionRead(BaseModel):
    """Representación pública de una inscripción."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_inscripcion: date
    tipo: Literal["nueva", "reinscripcion", "cambio_matricula", "baja"]
    estado: Literal["activa", "finalizada", "baja"]
    updated_at: datetime
    alumno_id: uuid.UUID
    division_id: uuid.UUID
    solicitud_inscripcion_id: uuid.UUID | None


class InscripcionListadoItemRead(BaseModel):
    """Inscripción con el contexto necesario para mostrarla en el listado."""

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_inscripcion: date
    tipo: Literal["nueva", "reinscripcion", "cambio_matricula", "baja"]
    estado: Literal["activa", "finalizada", "baja"]
    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    division_id: uuid.UUID
    division_nombre: str
    anio_numero: int
    nivel_educativo_nombre: str


class InscripcionListadoRead(BaseModel):
    """Página de inscripciones junto con sus datos de paginación."""

    items: list[InscripcionListadoItemRead]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class SolicitudInscripcionOpcionRead(BaseModel):
    """Solicitud confirmada que todavía puede originar una inscripción nueva."""

    id: uuid.UUID
    ciclo_lectivo: str
    fecha_solicitud: date
    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    nivel_educativo_id: uuid.UUID
    nivel_educativo_nombre: str


class DivisionOpcionRead(BaseModel):
    """División con el contexto académico necesario para mostrarla en un selector."""

    id: uuid.UUID
    nombre: str
    anio_numero: int
    nivel_educativo_id: uuid.UUID
    nivel_educativo_nombre: str


class AlumnoReinscripcionOpcionRead(BaseModel):
    """Alumno que cumple las condiciones para reinscribirse en un ciclo determinado."""

    alumno_id: uuid.UUID
    alumno_nombre: str
    alumno_apellido: str
    numero_legajo: str
    ciclo_anterior: str
