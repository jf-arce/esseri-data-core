import uuid
from datetime import date
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator

from src.academico.schemas import AsistenciaResponse

EstadoAsistencia = Literal[
    "presente", "tardanza", "ausente_pendiente", "ausente_justificado", "ausente_injustificado"
]


class FiltrosHistorial(BaseModel):
    ciclo_lectivo: str = Field(pattern=r"^\d{4}$")
    nivel_educativo_id: uuid.UUID | None = None
    anio_id: uuid.UUID | None = None
    division_id: uuid.UUID | None = None
    inscripcion_id: uuid.UUID | None = None
    fecha_desde: date | None = None
    fecha_hasta: date | None = None
    estado: EstadoAsistencia | None = None
    orden: Literal["fecha_desc", "fecha_asc", "alumno_asc", "alumno_desc"] = "fecha_desc"
    pagina: int = Field(default=1, ge=1)
    tamanio_pagina: int = Field(default=20, ge=1, le=100)
    formato: Literal["csv", "xlsx", "pdf"] = "csv"

    @model_validator(mode="after")
    def validar_periodo(self) -> Self:
        if self.fecha_desde and self.fecha_hasta and self.fecha_desde > self.fecha_hasta:
            raise ValueError("La fecha desde no puede ser posterior a la fecha hasta.")
        return self


class ResumenHistorial(BaseModel):
    total_registros: int
    presentes: int
    ausentes_justificadas: int
    ausentes_injustificadas: int
    porcentaje_presencia: float


class FilaHistorial(AsistenciaResponse):
    alumno: str
    division: str


class PaginaHistorial(BaseModel):
    items: list[FilaHistorial]
    resumen: ResumenHistorial
    total: int
    pagina: int
    tamanio_pagina: int
    total_paginas: int


class OpcionHistorial(BaseModel):
    inscripcion_id: uuid.UUID
    alumno: str
    division_id: uuid.UUID
    division: str
    anio_id: uuid.UUID
    anio: int
    nivel_educativo_id: uuid.UUID
    nivel: str
