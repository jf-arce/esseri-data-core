"""Modelos Pydantic de Autenticación y Roles."""

import uuid
from datetime import datetime

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
    codigo: str
    modulo: str
    accion: str
    tipo_informacion: str | None


class RolConPermisos(RolRead):
    permisos: list[PermisoRead]


class UsuarioConRoles(BaseModel):
    """Respuesta de GET /auth/usuarios: el listado que hoy no existe, necesario para el
    selector de rol(es) por usuario (RF-29)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    estado: str
    auth_provider: str
    ultimo_acceso: datetime | None
    roles: list[RolRead]


class UsuarioActual(BaseModel):
    """Lo que devuelve GET /auth/me: quién es, qué roles y qué permisos tiene.

    `roles`/`permisos` son la suma de todos los roles de la cuenta — lo que efectivamente
    autoriza el backend (RF-30), sin cambios. `perfiles` desglosa esa suma por rol: el frontend
    lo usa para la pantalla "¿Cómo querés entrar?" y el selector "Cambiar vista" (rol activo),
    que solo filtra qué se *muestra*, nunca lo que el backend permite.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    auth_provider: str
    estado: str
    roles: list[str]
    permisos: list[PermisoRead]
    perfiles: list[RolConPermisos]
