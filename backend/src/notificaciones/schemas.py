"""Schemas de la bandeja interna y validación estricta del contexto por tipo."""

import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from src.fechas import InstanteUtc
from src.notificaciones.constants import (
    DESTINO_ASISTENCIA,
    DESTINO_COMUNICACION,
    DESTINO_CONVERSACION,
    DESTINO_FACTURA,
    DESTINO_JUSTIFICACION_INDIVIDUAL,
    DESTINO_PAGO,
    DESTINO_SOLICITUD_PERIODO,
    TIPO_COMUNICACION_PUBLICADA,
    TIPO_DEBITO_EXITOSO,
    TIPO_DEBITO_RECHAZADO,
    TIPO_FACTURA_EMITIDA,
    TIPO_INASISTENCIA_REGISTRADA,
    TIPO_JUSTIFICACION_APROBADA,
    TIPO_JUSTIFICACION_RECHAZADA,
    TIPO_PAGO_REGISTRADO,
    TIPO_PROXIMO_VENCIMIENTO,
    TIPO_RESPUESTA_CONVERSACION,
)
from src.notificaciones.exceptions import NotificacionInvalida


class DestinoNotificacion(BaseModel):
    """Puntero tipado al recurso exacto; el alumno puede faltar en avisos familiares."""

    tipo: Literal[
        "asistencia",
        "justificacion_individual",
        "solicitud_ausencia_periodo",
        "comunicacion",
        "conversacion",
        "factura",
        "pago",
    ]
    id: uuid.UUID
    alumno_id: uuid.UUID | None


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


class ContextoComunicacion(BaseModel):
    """Comunicación institucional entregada a una familia; el recibo conserva los alumnos."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    familia_id: uuid.UUID
    comunicacion_id: uuid.UUID
    asunto: str


class ContextoFactura(_ContextoBase):
    """Factura emitida a la familia responsable económica."""

    factura_id: uuid.UUID
    fecha_emision: date
    fecha_vencimiento: date
    monto_total: str


class ContextoRespuestaConversacion(_ContextoBase):
    conversacion_id: uuid.UUID
    mensaje_id: uuid.UUID


class ContextoPago(_ContextoBase):
    """Pago aprobado por Administración, sin afirmar acreditación bancaria."""

    pago_id: uuid.UUID
    factura_id: uuid.UUID
    monto: str
    fecha: date


class ContextoProximoVencimiento(_ContextoBase):
    """Recordatorio único de una factura próxima a vencer."""

    factura_id: uuid.UUID
    fecha_vencimiento: date
    monto_pendiente: str


class ContextoDebitoExitoso(_ContextoBase):
    """Débito automático cobrado sobre una factura."""

    debito_id: uuid.UUID
    factura_id: uuid.UUID
    importe: str


class ContextoDebitoRechazado(_ContextoBase):
    """Débito automático rechazado; el motivo es obligatorio y nunca está vacío."""

    debito_id: uuid.UUID
    factura_id: uuid.UUID
    importe: str
    motivo: str


ESQUEMAS_CONTEXTO: dict[tuple[str, str], type[BaseModel]] = {
    (TIPO_INASISTENCIA_REGISTRADA, DESTINO_ASISTENCIA): ContextoAusencia,
    (TIPO_JUSTIFICACION_APROBADA, DESTINO_JUSTIFICACION_INDIVIDUAL): (
        ContextoJustificacionIndividual
    ),
    (TIPO_JUSTIFICACION_RECHAZADA, DESTINO_JUSTIFICACION_INDIVIDUAL): (
        ContextoJustificacionIndividual
    ),
    (TIPO_JUSTIFICACION_APROBADA, DESTINO_SOLICITUD_PERIODO): ContextoResolucionPeriodo,
    (TIPO_JUSTIFICACION_RECHAZADA, DESTINO_SOLICITUD_PERIODO): ContextoResolucionPeriodo,
    (TIPO_COMUNICACION_PUBLICADA, DESTINO_COMUNICACION): ContextoComunicacion,
    (TIPO_RESPUESTA_CONVERSACION, DESTINO_CONVERSACION): ContextoRespuestaConversacion,
    (TIPO_FACTURA_EMITIDA, DESTINO_FACTURA): ContextoFactura,
    (TIPO_PAGO_REGISTRADO, DESTINO_PAGO): ContextoPago,
    (TIPO_PROXIMO_VENCIMIENTO, DESTINO_FACTURA): ContextoProximoVencimiento,
    (TIPO_DEBITO_EXITOSO, DESTINO_FACTURA): ContextoDebitoExitoso,
    (TIPO_DEBITO_RECHAZADO, DESTINO_FACTURA): ContextoDebitoRechazado,
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
