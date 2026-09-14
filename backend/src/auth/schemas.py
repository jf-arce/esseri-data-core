"""Modelos Pydantic de Autenticación y Roles."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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
    codigo: str
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


class RolActivoIn(BaseModel):
    rol: str


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
    # Necesario para el alta de docente "desde una cuenta existente" (usuario-roles-dialog):
    # sin persona la ficha Docente no tiene a qué engancharse.
    persona_id: uuid.UUID | None
    # Nombre real de la persona (nulo si la cuenta no tiene persona asociada todavía): el
    # frontend lo prefiere sobre el nombre inventado a partir del email.
    persona_nombre: str | None
    persona_apellido: str | None


class UsuarioDetalle(UsuarioConRoles):
    """Respuesta de GET /auth/usuarios/{id} y de las operaciones de edición: suma el DNI y el
    teléfono de la persona para precargar el formulario de edición."""

    persona_dni: str | None
    persona_telefono: str | None


class PersonaCreate(BaseModel):
    """Datos de la persona detrás de una cuenta nueva (alta de usuario/docente)."""

    nombre: str = Field(..., min_length=1)
    apellido: str = Field(..., min_length=1)
    dni: str = Field(..., min_length=1)
    telefono: str | None = None
    sexo: str | None = None


class AccesoUpdate(BaseModel):
    """Cómo entra la cuenta: por Google (sin contraseña, se vincula sola en el próximo login)
    o con contraseña, que se resetea cada vez que se manda `password`."""

    metodo: Literal["google", "local"]
    password: str | None = Field(None, min_length=12)

    @model_validator(mode="after")
    def validar_password(self) -> "AccesoUpdate":
        if self.metodo == "local" and self.password is None:
            raise ValueError("Falta la contraseña")
        if self.metodo == "google" and self.password is not None:
            raise ValueError("El acceso por Google no lleva contraseña")
        return self


class AccesoCreate(AccesoUpdate):
    """Alta: además del método, necesita el email por el que va a entrar la cuenta nueva."""

    email: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str) -> str:
        return valor.strip().lower()


class UsuarioCreate(BaseModel):
    """Alta de una cuenta de personal (no familia, no docente: esos tienen su propio flujo)."""

    persona: PersonaCreate
    acceso: AccesoCreate
    rol_ids: list[uuid.UUID] = Field(..., min_length=1)


class PersonaUpdate(BaseModel):
    """Edición de la persona detrás de una cuenta existente. Todo opcional: se manda solo lo
    que cambió."""

    nombre: str | None = Field(None, min_length=1)
    apellido: str | None = Field(None, min_length=1)
    dni: str | None = Field(None, min_length=1)
    telefono: str | None = None
    sexo: str | None = None


class UsuarioUpdate(BaseModel):
    """PATCH /auth/usuarios/{id}: datos de persona y/o email. La contraseña y el método de
    acceso van por separado, en `AccesoUpdate` (PUT /auth/usuarios/{id}/acceso)."""

    persona: PersonaUpdate | None = None
    email: str | None = Field(None, min_length=1)

    @field_validator("email")
    @classmethod
    def normalizar_email(cls, valor: str | None) -> str | None:
        return valor.strip().lower() if valor is not None else None


class EstadoUsuarioIn(BaseModel):
    estado: Literal["activo", "inactivo"]


class UsuarioActual(BaseModel):
    """Lo que devuelve GET /auth/me: quién es, qué roles y qué permisos tiene.

    `roles`/`permisos` son la suma de todos los roles de la cuenta — informativo, ya no es lo
    que autoriza el backend. `perfiles` desglosa esa suma por rol: alimenta la pantalla
    "¿Cómo querés entrar?" y el selector "Cambiar vista". `rol_activo` es el rol con el que la
    sesión está autorizando de verdad (RF-30) — `None` si todavía no se eligió uno.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    auth_provider: str
    estado: str
    roles: list[str]
    permisos: list[PermisoRead]
    perfiles: list[RolConPermisos]
    rol_activo: str | None
