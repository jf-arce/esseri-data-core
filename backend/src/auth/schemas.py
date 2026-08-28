"""Modelos Pydantic de Autenticación y Roles."""

import uuid

from pydantic import BaseModel, ConfigDict, field_validator


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


class UsuarioActual(BaseModel):
    """Lo que devuelve GET /auth/me: quién es y qué roles tiene."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    auth_provider: str
    estado: str
    roles: list[str]
