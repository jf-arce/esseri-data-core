"""Schemas Pydantic para Académico.

Forma de los datos que entran y salen por la API del módulo.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# --- NivelEducativo ----------------------------------------------------------------------


class NivelEducativoCreate(BaseModel):
    """Schema para crear un nuevo NivelEducativo."""

    nombre: str = Field(..., min_length=1, description="Nombre del nivel educativo")


class NivelEducativoUpdate(BaseModel):
    """Schema para actualizar un NivelEducativo existente."""

    nombre: str | None = Field(None, min_length=1, description="Nombre del nivel educativo")


class NivelEducativoResponse(BaseModel):
    """Schema para responder con datos de NivelEducativo."""

    id: uuid.UUID
    nombre: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Anio --------------------------------------------------------------------------------


class AnioCreate(BaseModel):
    """Schema para crear un nuevo Anio."""

    numero: int = Field(..., ge=1, description="Número del año (1, 2, 3, etc.)")
    nivel_educativo_id: uuid.UUID = Field(
        ..., description="ID del nivel educativo al que pertenece"
    )


class AnioUpdate(BaseModel):
    """Schema para actualizar un Anio existente."""

    numero: int | None = Field(None, ge=1, description="Número del año")
    nivel_educativo_id: uuid.UUID | None = Field(None, description="ID del nivel educativo")


class AnioResponse(BaseModel):
    """Schema para responder con datos de Anio."""

    id: uuid.UUID
    numero: int
    nivel_educativo_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Division ----------------------------------------------------------------------------


class DivisionCreate(BaseModel):
    """Schema para crear una nueva Division."""

    nombre: str = Field(..., min_length=1, description="Nombre de la división (A, B, C, etc.)")
    anio_id: uuid.UUID = Field(..., description="ID del año al que pertenece")


class DivisionUpdate(BaseModel):
    """Schema para actualizar una Division existente."""

    nombre: str | None = Field(None, min_length=1, description="Nombre de la división")
    anio_id: uuid.UUID | None = Field(None, description="ID del año al que pertenece")


class DivisionResponse(BaseModel):
    """Schema para responder con datos de Division."""

    id: uuid.UUID
    nombre: str
    anio_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Docente -----------------------------------------------------------------------------


class DocenteCreate(BaseModel):
    """Schema para crear un nuevo Docente."""

    legajo: str = Field(..., min_length=1, description="Legajo del docente")
    persona_id: uuid.UUID = Field(..., description="ID de la persona asociada")


class DocenteUpdate(BaseModel):
    """Schema para actualizar un Docente existente."""

    legajo: str | None = Field(None, min_length=1, description="Legajo del docente")
    persona_id: uuid.UUID | None = Field(None, description="ID de la persona asociada")


class DocenteResponse(BaseModel):
    """Schema para responder con datos de Docente."""

    id: uuid.UUID
    legajo: str
    persona_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- AsignacionDocente -------------------------------------------------------------------


class AsignacionDocenteCreate(BaseModel):
    """Schema para asignar un docente a materia+división por ciclo lectivo."""

    ciclo_lectivo: str = Field(..., min_length=1, description="Ciclo lectivo (ej: '2025')")
    docente_id: uuid.UUID = Field(..., description="ID del docente")
    materia_id: uuid.UUID = Field(..., description="ID de la materia")
    division_id: uuid.UUID = Field(..., description="ID de la división")


class AsignacionDocenteResponse(BaseModel):
    """Schema para responder con datos de AsignacionDocente."""

    id: uuid.UUID
    ciclo_lectivo: str
    docente_id: uuid.UUID
    materia_id: uuid.UUID
    division_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Asistencia --------------------------------------------------------------------------


TipoAsistenciaDocente = Literal["presente", "tardanza", "ausente"]


class AsistenciaCreate(BaseModel):
    """Schema para registrar asistencia de un alumno.

    El docente solo marca presente/tardanza/ausente.
    Si marca 'ausente', el service lo traduce a 'ausente_pendiente'
    y dispara la notificación automática a los responsables.
    """

    inscripcion_id: uuid.UUID = Field(..., description="ID de la inscripción del alumno")
    fecha: date = Field(..., description="Fecha del registro de asistencia")
    tipo: TipoAsistenciaDocente = Field(..., description="Tipo: 'presente', 'tardanza' o 'ausente'")


class AsistenciaRegistroBulk(BaseModel):
    """Un registro dentro del listado masivo."""

    inscripcion_id: uuid.UUID = Field(..., description="ID de la inscripción del alumno")
    tipo: TipoAsistenciaDocente = Field(..., description="Tipo: 'presente', 'tardanza' o 'ausente'")


class AsistenciaBulkCreate(BaseModel):
    """Schema para registrar asistencia de toda una división en una fecha."""

    fecha: date = Field(..., description="Fecha del registro de asistencia")
    division_id: uuid.UUID = Field(..., description="ID de la división")
    registros: list[AsistenciaRegistroBulk] = Field(
        ..., min_length=1, description="Lista de registros de asistencia"
    )


class AsistenciaUpdate(BaseModel):
    """Schema para actualizar un registro de asistencia existente.

    El docente solo puede cambiar entre presente/tardanza/ausente.
    No puede modificar un registro que ya fue justificado
    (ausente_justificado / ausente_injustificado).
    """

    tipo: TipoAsistenciaDocente = Field(..., description="Tipo: 'presente', 'tardanza' o 'ausente'")


class AsistenciaResponse(BaseModel):
    """Schema para responder con datos de Asistencia."""

    id: uuid.UUID
    fecha: date
    tipo: str
    inscripcion_id: uuid.UUID
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AsistenciaBulkResponse(BaseModel):
    """Schema para responder al registro masivo de asistencia."""

    creadas: int = Field(..., description="Cantidad de registros creados")
    actualizadas: int = Field(..., description="Cantidad de registros actualizados")
    notificaciones_disparadas: int = Field(
        ..., description="Cantidad de notificaciones de ausencia disparadas"
    )


# --- Materia -----------------------------------------------------------------------------


class MateriaCreate(BaseModel):
    """Schema para crear una nueva Materia.

    `division_id` nulo = materia común a todo el año;
    con valor = específica de esa división/orientación.
    """

    nombre: str = Field(..., min_length=1, description="Nombre de la materia")
    tipo: Literal["materia", "taller"] = Field(..., description="Tipo: 'materia' o 'taller'")
    anio_id: uuid.UUID = Field(..., description="ID del año al que pertenece")
    division_id: uuid.UUID | None = Field(
        None, description="ID de la división (nulo = común a todo el año)"
    )


class MateriaUpdate(BaseModel):
    """Schema para actualizar una Materia existente."""

    nombre: str | None = Field(None, min_length=1, description="Nombre de la materia")
    tipo: Literal["materia", "taller"] | None = Field(
        None, description="Tipo: 'materia' o 'taller'"
    )
    anio_id: uuid.UUID | None = Field(None, description="ID del año")
    division_id: uuid.UUID | None = Field(
        None, description="ID de la división (nulo = común a todo el año)"
    )


class MateriaResponse(BaseModel):
    """Schema para responder con datos de Materia."""

    id: uuid.UUID
    nombre: str
    tipo: str
    anio_id: uuid.UUID
    division_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
