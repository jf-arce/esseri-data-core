"""Schemas de la bandeja interna y validación estricta del contexto por tipo."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.fechas import InstanteUtc
from src.notificaciones.constants import (
    DESTINO_ASISTENCIA,
    DESTINO_JUSTIFICACION_INDIVIDUAL,
    DESTINO_SOLICITUD_PERIODO,
    TIPO_INASISTENCIA_REGISTRADA,
    TIPO_JUSTIFICACION_APROBADA,
    TIPO_JUSTIFICACION_RECHAZADA,
)
from src.notificaciones.exceptions import NotificacionInvalida


class DestinoNotificacion(BaseModel):
    """Puntero tipado al recurso académico exacto, con el alumno congelado."""

    tipo: Literal["asistencia", "justificacion_individual", "solicitud_ausencia_periodo"]
    id: uuid.UUID
    alumno_id: uuid.UUID


class NotificacionItem(BaseModel):
    id: uuid.UUID
    tipo: str
    titulo: str
    mensaje: str
    created_at: InstanteUtc
    leida_at: InstanteUtc | None
    destino: DestinoNotificacion


class ListadoNotificaciones(BaseModel):
    items: list[NotificacionItem]
    siguiente_cursor: str | None
    total_no_leidas: int


class ResumenNotificaciones(BaseModel):
    total_no_leidas: int


class LecturaNotificacion(BaseModel):
    id: uuid.UUID
    leida_at: InstanteUtc


class LecturasMasivas(BaseModel):
    marcadas: int = Field(ge=0)


class _ContextoBase(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

    familia_id: uuid.UUID
    alumno_id: uuid.UUID


class ContextoAusencia(_ContextoBase):
    """Ausencia diaria: la identidad es la inscripción y la fecha calendario."""

    inscripcion_id: uuid.UUID
    fecha: date


class ContextoJustificacionIndividual(_ContextoBase):
    """Resolución de una justificación individual, con la asistencia que la originó."""

    justificacion_id: uuid.UUID
    asistencia_id: uuid.UUID
    fecha_asistencia: date


class ContextoResolucionPeriodo(_ContextoBase):
    """Resolución de una solicitud por período: congela el rango, no cada día."""

    solicitud_id: uuid.UUID
    fecha_inicio: date
    fecha_fin: date


ESQUEMAS_CONTEXTO: dict[tuple[str, str], type[_ContextoBase]] = {
    (TIPO_INASISTENCIA_REGISTRADA, DESTINO_ASISTENCIA): ContextoAusencia,
    (TIPO_JUSTIFICACION_APROBADA, DESTINO_JUSTIFICACION_INDIVIDUAL): (
        ContextoJustificacionIndividual
    ),
    (TIPO_JUSTIFICACION_RECHAZADA, DESTINO_JUSTIFICACION_INDIVIDUAL): (
        ContextoJustificacionIndividual
    ),
    (TIPO_JUSTIFICACION_APROBADA, DESTINO_SOLICITUD_PERIODO): ContextoResolucionPeriodo,
    (TIPO_JUSTIFICACION_RECHAZADA, DESTINO_SOLICITUD_PERIODO): ContextoResolucionPeriodo,
}


def validar_contexto(
    *, tipo: str, destino_tipo: str, contexto: dict[str, object]
) -> dict[str, object]:
    """Devuelve el contexto normalizado (JSON) o deniega la combinación desconocida."""
    esquema = ESQUEMAS_CONTEXTO.get((tipo, destino_tipo))
    if esquema is None:
        raise NotificacionInvalida()
    try:
        validado = esquema.model_validate(contexto)
    except ValidationError:
        raise NotificacionInvalida() from None
    return validado.model_dump(mode="json")
