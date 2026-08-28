"""Modelos Pydantic de Autenticación y Roles."""

import uuid

from pydantic import BaseModel, ConfigDict, field_validator

from src.auth.constants import AccionLiteral, ModuloLiteral


class LoginLocalIn(BaseModel):
    """Fallback con contraseña, para cuando Google no está disponible."""

    email: str
    password: str

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        # Google devuelve el email en minúsculas: si acá no normalizamos, el mismo usuario no
        # matchearía por un camino y sí por el otro.
        return valor.strip().lower()


class RolCreate(BaseModel):
    nombre: str
    descripcion: str | None = None


class RolUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None


class RolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre: str
    descripcion: str | None


class PermisoCreate(BaseModel):
    modulo: ModuloLiteral
    accion: AccionLiteral
    tipo_informacion: str | None = None


class PermisoUpdate(BaseModel):
    modulo: ModuloLiteral | None = None
    accion: AccionLiteral | None = None
    tipo_informacion: str | None = None


class PermisoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    modulo: str
    accion: str
    tipo_informacion: str | None


class RolConPermisos(RolRead):
    permisos: list[PermisoRead]


class UsuarioConRoles(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    roles: list[RolRead]


class UsuarioActual(BaseModel):
    """Lo que devuelve GET /auth/me: quién es, qué roles y qué permisos tiene."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    auth_provider: str
    estado: str
    roles: list[str]
    permisos: list[PermisoRead]
