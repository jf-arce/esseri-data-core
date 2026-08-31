"""Schemas Pydantic para Familias y Alumnos.

Forma de los datos que entran y salen por la API del módulo.
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    persona_nombre: str = Field(..., description="Nombre de la persona asociada")
    persona_apellido: str = Field(..., description="Apellido de la persona asociada")
    persona_dni: str = Field(..., description="DNI de la persona asociada")
    persona_telefono: str | None = Field(None, description="Teléfono de la persona asociada")
    persona_sexo: str | None = Field(None, description="Sexo de la persona asociada")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PersonaFamiliaCreate(BaseModel):
    nombre: str = Field(..., min_length=1)
    apellido: str = Field(..., min_length=1)
    dni: str = Field(..., min_length=1)
    telefono: str | None = None
    sexo: str | None = None


class PersonaResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    apellido: str
    dni: str
    telefono: str | None
    sexo: str | None

    model_config = ConfigDict(from_attributes=True)


class UsuarioFamiliaCreate(BaseModel):
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=12)

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, value: str) -> str:
        return value.strip().lower()


class AltaFamiliaCreate(BaseModel):
    persona: PersonaFamiliaCreate
    usuario: UsuarioFamiliaCreate


class PersonaAlumnoCreate(BaseModel):
    """Datos de la persona que será el alumno."""

    nombre: str = Field(..., min_length=1)
    apellido: str = Field(..., min_length=1)
    dni: str = Field(..., min_length=1)
    telefono: str | None = None
    sexo: str | None = None


class AlumnoCreate(BaseModel):
    """Schema para crear un nuevo Alumno."""

    numero_legajo: str = Field(..., min_length=1, description="Número de legajo del alumno")
    estado: str = Field("activo", description="Estado del alumno: activo / inactivo / egresado")
    persona_id: uuid.UUID = Field(..., description="ID de la persona asociada (1:1)")

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: str) -> str:
        valores_validos = {"activo", "inactivo", "egresado"}
        if value not in valores_validos:
            raise ValueError(f"Estado inválido: debe ser uno de {valores_validos}")
        return value


class AltaAlumnoCreate(BaseModel):
    """Schema para crear Persona + Alumno en una única transacción."""

    persona: PersonaAlumnoCreate
    numero_legajo: str = Field(..., min_length=1, description="Número de legajo del alumno")
    estado: str = Field("activo", description="Estado del alumno: activo / inactivo / egresado")

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: str) -> str:
        valores_validos = {"activo", "inactivo", "egresado"}
        if value not in valores_validos:
            raise ValueError(f"Estado inválido: debe ser uno de {valores_validos}")
        return value


class AlumnoUpdate(BaseModel):
    """Schema para actualizar un Alumno existente."""

    numero_legajo: str | None = Field(None, min_length=1, description="Número de legajo")
    estado: str | None = Field(None, description="Estado: activo / inactivo / egresado")
    persona_id: uuid.UUID | None = Field(None, description="ID de la persona asociada")

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: str | None) -> str | None:
        if value is None:
            return value
        valores_validos = {"activo", "inactivo", "egresado"}
        if value not in valores_validos:
            raise ValueError(f"Estado inválido: debe ser uno de {valores_validos}")
        return value


class AlumnoResponse(BaseModel):
    """Schema para responder con datos de Alumno."""

    id: uuid.UUID
    numero_legajo: str
    estado: str
    persona_id: uuid.UUID
    persona_nombre: str = Field(..., description="Nombre de la persona asociada")
    persona_apellido: str = Field(..., description="Apellido de la persona asociada")
    persona_dni: str = Field(..., description="DNI de la persona asociada")
    persona_telefono: str | None = Field(None, description="Teléfono de la persona asociada")
    persona_sexo: str | None = Field(None, description="Sexo de la persona asociada")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class VinculoCreate(BaseModel):
    """Schema para vincular un alumno con una familia."""

    parentesco: str | None = Field(None, description="Parentesco del responsable con el alumno")
    responsable_principal: bool = Field(False, description="Responsable parental principal")
    recibe_comunicaciones: bool = Field(True, description="Si recibe avisos y comunicaciones")
    familia_id: uuid.UUID = Field(..., description="ID de la familia a vincular")
    alumno_id: uuid.UUID = Field(..., description="ID del alumno a vincular")


class VinculoUpdate(BaseModel):
    """Schema para actualizar un vínculo existente."""

    parentesco: str | None = None
    responsable_principal: bool | None = None
    recibe_comunicaciones: bool | None = None


class VinculoResponse(BaseModel):
    """Schema para responder con datos de un vínculo familia-alumno."""

    id: uuid.UUID
    parentesco: str | None
    responsable_principal: bool
    recibe_comunicaciones: bool
    familia_id: uuid.UUID
    alumno_id: uuid.UUID
    alumno_nombre: str = Field(..., description="Nombre completo del alumno")
    alumno_legajo: str = Field(..., description="Número de legajo del alumno")
    familia_nombre: str = Field(..., description="Nombre completo del responsable de la familia")

    model_config = ConfigDict(from_attributes=True)


class AltaFamiliaResponse(BaseModel):
    persona: PersonaResponse
    familia: FamiliaResponse


class AltaAlumnoResponse(BaseModel):
    persona: PersonaResponse
    alumno: AlumnoResponse
