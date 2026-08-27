"""Schemas Pydantic para Familias y Alumnos.

Forma de los datos que entran y salen por la API del módulo.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class FamiliaBase(BaseModel):
    """Base schema con campos comunes de Familia."""

    # TODO: Integración con Persona - validar que persona_id exista
    # cuando el módulo auth/persona esté implementado
    persona_id: uuid.UUID = Field(..., description="ID de la persona asociada (1:1)")


class FamiliaCreate(FamiliaBase):
    """Schema para crear una nueva Familia.

    nota: estado_deuda no se incluye porque no se escribe (deja de ser fuente de verdad,
    se deriva de CUENTA_CORRIENTE/MOVIMIENTO del módulo Facturación).
    """

    pass


class FamiliaUpdate(BaseModel):
    """Schema para actualizar una Familia existente.

    nota: estado_deuda no se incluye porque no se escribe (deja de ser fuente de verdad,
    se deriva de CUENTA_CORRIENTE/MOVIMIENTO del módulo Facturación).
    """

    # TODO: Integración con Persona - validar que persona_id exista
    # cuando el módulo auth/persona esté implementado
    persona_id: uuid.UUID | None = Field(None, description="ID de la persona asociada (1:1)")


class FamiliaResponse(FamiliaBase):
    """Schema para responder con datos de Familia."""

    id: uuid.UUID
    estado_deuda: str | None = Field(
        None,
        description="Estado de deuda (derivado de Facturación, no se escribe aquí)",
    )
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)