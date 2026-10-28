"""Modelos Pydantic: forma de los datos que entran y salen por la API de este módulo."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Espeja el CheckConstraint `ck_ia_sugerencia_tipo`.
TipoSugerencia = Literal["patron_detectado", "comunicacion"]

# Ídem para `ck_ia_sugerencia_estado`.
EstadoSugerencia = Literal[
    "pendiente_revision", "aprobada", "rechazada", "ejecutada_automaticamente"
]


class BorradorComunicacionCreate(BaseModel):
    """Pedido de un borrador de comunicación (issue #50).

    `nombre` es cómo se va a llamar la plantilla si el borrador se aprueba. `instrucciones` es lo
    único que viaja al proveedor de IA escrito por una persona: no hay que poner datos de
    familias ni de alumnos, para eso están los marcadores del evento.
    """

    model_config = ConfigDict(extra="forbid")

    tipo_evento_id: uuid.UUID = Field(..., description="Evento para el que se redacta")
    nombre: str = Field(..., min_length=1, max_length=150, description="Nombre de la plantilla")
    instrucciones: str = Field(
        ..., min_length=10, max_length=1000, description="Qué tiene que decir la comunicación"
    )

    @field_validator("nombre", "instrucciones", mode="before")
    @classmethod
    def sin_espacios_sobrantes(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class BorradorComunicacion(BaseModel):
    """El borrador tal como se guarda, en JSON, dentro de `IA_SUGERENCIA.contenido_generado`."""

    nombre: str
    asunto: str
    cuerpo: str
    instrucciones: str


class SugerenciaResponse(BaseModel):
    """Sugerencia tal como sale por la API.

    `revisor_email` no es columna: se resuelve con un join para que el historial pueda mostrar
    quién decidió sin que el frontend necesite permiso sobre el ABM de usuarios.
    """

    id: uuid.UUID
    tipo: TipoSugerencia
    entidad: str | None
    entidad_id: uuid.UUID | None
    contenido_generado: str
    requiere_control_humano: bool
    estado: EstadoSugerencia
    fecha_generacion: datetime
    fecha_revision: datetime | None
    usuario_id: uuid.UUID | None
    revisor_email: str | None = None
    # Solo en las de tipo `comunicacion`: el borrador ya separado en sus partes.
    comunicacion: BorradorComunicacion | None = None
    notificacion_template_id: uuid.UUID | None

    model_config = ConfigDict(from_attributes=True)


class DeteccionResponse(BaseModel):
    """Resultado de una corrida de detección de patrones.

    `ya_pendientes` cuenta los casos que siguen cumpliendo la regla pero ya tenían una sugerencia
    sin revisar: no se duplican, y el número deja a la vista que no es que no se haya encontrado
    nada.
    """

    creadas: list[SugerenciaResponse]
    ya_pendientes: int
