"""Schemas Pydantic para Académico.

Forma de los datos que entran y salen por la API del módulo.
"""

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.auth.schemas import AccesoCreate, PersonaCreate

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
    cantidad_anios: int = 0
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
    cantidad_divisiones: int = 0
    cantidad_materias: int = 0
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
    cantidad_materias: int = 0
    cantidad_inscripciones: int = 0
    cantidad_asignaciones: int = 0
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
    nombre: str | None = None
    apellido: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AltaDocenteCreate(BaseModel):
    """Alta de un docente nuevo: crea Persona + Usuario (rol docente) + Docente juntos."""

    persona: PersonaCreate
    acceso: AccesoCreate
    legajo: str = Field(..., min_length=1, description="Legajo del docente")


class DocenteDesdeUsuarioCreate(BaseModel):
    """Suma el rol docente (y su ficha) a una cuenta que ya existe. La cuenta necesita tener
    `persona_id` (la usuario-roles-dialog del frontend deshabilita esta opción si no lo tiene)."""

    usuario_id: uuid.UUID
    legajo: str = Field(..., min_length=1, description="Legajo del docente")


class MiDivisionResponse(BaseModel):
    """Una división asignada al docente autenticado (GET /academico/docentes/me/divisiones).

    `etiqueta` ya viene armada ("4°B") para que la pantalla "¿Cómo querés entrar?" no tenga
    que resolver Año + División por separado.
    """

    division_id: uuid.UUID
    etiqueta: str
    anio_numero: int
    nivel_educativo_nombre: str
    cantidad_materias: int = 0


class DocentePerfilResponse(BaseModel):
    """Nombre real del docente autenticado, sin información adicional de la persona."""

    nombre: str
    apellido: str


class SeguimientoDivisionItem(BaseModel):
    inscripcion_id: uuid.UUID
    total_ausencias: int
    ausencias_consecutivas: int
    inasistencia_reiterada: bool


# --- AsignacionDocente -------------------------------------------------------------------


class AsignacionDocenteCreate(BaseModel):
    """Schema para asignar un docente a materia+división por ciclo lectivo."""

    ciclo_lectivo: str = Field(..., min_length=1, description="Ciclo lectivo (ej: '2025')")
    docente_id: uuid.UUID = Field(..., description="ID del docente")
    materia_id: uuid.UUID = Field(..., description="ID de la materia")
    division_id: uuid.UUID = Field(..., description="ID de la división")


class AsignacionDocenteUpdate(BaseModel):
    """Schema para actualizar una asignación docente existente."""

    ciclo_lectivo: str | None = Field(None, min_length=1, description="Ciclo lectivo (ej: '2025')")
    docente_id: uuid.UUID | None = Field(None, description="ID del docente")
    materia_id: uuid.UUID | None = Field(None, description="ID de la materia")
    division_id: uuid.UUID | None = Field(None, description="ID de la división")


class AsignacionDocenteBulkItem(BaseModel):
    """Una combinación materia + división para asignar en bloque."""

    materia_id: uuid.UUID = Field(..., description="ID de la materia")
    division_id: uuid.UUID = Field(..., description="ID de la división")


class AsignacionDocenteBulkCreate(BaseModel):
    """Asignar un docente a varias combinaciones materia + división en un solo alta."""

    ciclo_lectivo: str = Field(..., min_length=1, description="Ciclo lectivo (ej: '2025')")
    docente_id: uuid.UUID = Field(..., description="ID del docente")
    items: list[AsignacionDocenteBulkItem] = Field(
        ..., min_length=1, description="Combinaciones materia + división a asignar"
    )


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


class AsignacionDocenteBulkResponse(BaseModel):
    """Resultado de un alta masiva de asignaciones."""

    creadas: list[AsignacionDocenteResponse] = Field(default_factory=list)
    omitidas: list[AsignacionDocenteBulkItem] = Field(
        default_factory=list, description="Combinaciones que ya existían y no se duplicaron"
    )


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
    ciclo_lectivo: str | None = Field(
        default=None, min_length=1, max_length=20, description="Ciclo lectivo del listado"
    )
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
    justificacion_estado: Literal["pendiente", "aprobada", "rechazada"] | None = None

    model_config = ConfigDict(from_attributes=True)


class AsistenciaFamiliaResponse(AsistenciaResponse):
    """Asistencia visible para una familia junto al estado de su justificación."""

    justificacion_id: uuid.UUID | None = None
    justificacion_estado: str | None = None
    justificacion_motivo: str | None = None
    justificacion_observacion: str | None = None
    justificacion_archivo_nombre: str | None = None


class JustificacionFamiliaCreate(BaseModel):
    motivo: str = Field(..., min_length=1, max_length=120)
    observacion: str | None = Field(None, max_length=500)


class JustificacionFamiliaResponse(BaseModel):
    id: uuid.UUID
    asistencia_id: uuid.UUID
    fecha_asistencia: date
    alumno_nombre: str
    estado: str
    motivo: str
    observacion: str | None
    archivo_nombre: str | None
    fecha_carga: datetime
    # Contexto adicional para la bandeja institucional (la familia no lo necesita).
    alumno_id: uuid.UUID | None = None
    nivel_educativo_id: uuid.UUID | None = None
    nivel_educativo_nombre: str | None = None
    anio_id: uuid.UUID | None = None
    anio_numero: int | None = None
    division_id: uuid.UUID | None = None
    division_nombre: str | None = None
    fecha_resolucion: datetime | None = None


class JustificacionResolucion(BaseModel):
    aprobar: bool
    observacion: str | None = Field(None, max_length=500)

    @model_validator(mode="after")
    def validar_observacion_rechazo(self):
        if not self.aprobar and (not self.observacion or not self.observacion.strip()):
            raise ValueError("La observación es obligatoria al rechazar una justificación")
        return self


class FiltrosJustificaciones(BaseModel):
    """Filtros para listar justificaciones."""

    nivel_id: uuid.UUID | None = Field(None, description="ID del nivel educativo")
    anio_id: uuid.UUID | None = Field(None, description="ID del año")
    division_id: uuid.UUID | None = Field(None, description="ID de la división")
    alumno_id: uuid.UUID | None = Field(None, description="ID del alumno")
    estado: Literal["pendiente", "aprobada", "rechazada"] | None = Field(
        None, description="Estado de la justificación"
    )
    busqueda: str | None = Field(
        None, max_length=120, description="Texto libre para buscar por alumno"
    )
    fecha_desde: date | None = Field(None, description="Fecha desde (inclusive)")
    fecha_hasta: date | None = Field(None, description="Fecha hasta (inclusive)")
    pagina: int = Field(1, ge=1, description="Número de página")
    tamanio_pagina: int = Field(50, ge=1, le=200, description="Tamaño de página")


class JustificacionesResumen(BaseModel):
    """Conteos globales de la bandeja, independientes de la página pedida."""

    pendientes: int = 0
    aprobadas: int = 0
    rechazadas: int = 0
    total: int = 0


class JustificacionesPaginadasResponse(BaseModel):
    """Respuesta paginada de justificaciones."""

    items: list[JustificacionFamiliaResponse]
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int
    resumen: JustificacionesResumen = Field(default_factory=JustificacionesResumen)


class OpcionJustificacion(BaseModel):
    """Combinación nivel/año/división/alumno presente en las justificaciones."""

    nivel_educativo_id: uuid.UUID
    nivel_educativo_nombre: str
    anio_id: uuid.UUID
    anio_numero: int
    division_id: uuid.UUID
    division_nombre: str
    alumno_id: uuid.UUID
    alumno_nombre: str


class AsistenciaBulkResponse(BaseModel):
    """Schema para responder al registro masivo de asistencia."""

    creadas: int = Field(..., description="Cantidad de registros creados")
    actualizadas: int = Field(..., description="Cantidad de registros actualizados")
    notificaciones_disparadas: int = Field(
        ..., description="Cantidad de notificaciones de ausencia disparadas"
    )


class UltimaFechaAsistenciaResponse(BaseModel):
    """Última fecha con asistencias registradas en una división (o `null` si no hay)."""

    fecha: date | None = None


class AsistenciaResumen(BaseModel):
    """Resumen de asistencia de un alumno en un período (RF-06).

    Incluye conteos por tipo y porcentajes de presencia,
    ausencias justificadas e injustificadas.
    """

    inscripcion_id: uuid.UUID = Field(..., description="ID de la inscripción")
    alumno_id: uuid.UUID = Field(..., description="ID del alumno")
    fecha_desde: date = Field(..., description="Inicio del período")
    fecha_hasta: date = Field(..., description="Fin del período")
    total_registros: int = Field(..., description="Total de registros en el período")
    presentes: int = Field(..., description="Cantidad de presentes")
    tardanzas: int = Field(..., description="Cantidad de tardanzas")
    ausentes_pendientes: int = Field(..., description="Cantidad de ausentes pendientes")
    ausentes_justificadas: int = Field(..., description="Cantidad de ausentes justificadas")
    ausentes_injustificadas: int = Field(..., description="Cantidad de ausentes injustificadas")
    porcentaje_presencia: float = Field(
        ..., description="Porcentaje de presencia (presente + tardanza) sobre el total"
    )
    porcentaje_justificadas: float = Field(
        ..., description="Porcentaje de ausencias justificadas sobre el total de ausencias"
    )
    porcentaje_injustificadas: float = Field(
        ...,
        description="Porcentaje de ausencias injustificadas sobre el total de ausencias",
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
    anio_numero: int | None = None
    division_id: uuid.UUID | None
    cantidad_asignaciones: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
