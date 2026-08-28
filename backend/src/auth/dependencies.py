"""Dependencias de FastAPI para validar sesión/rol en rutas protegidas de otros módulos."""

from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from src.auth import config, service
from src.auth.exceptions import TokenInvalido, UsuarioInactivo
from src.auth.models import Usuario
from src.database import get_db

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, db: DbSession) -> Usuario:
    """Resuelve el usuario de la cookie de sesión. Autentica; no mira roles (eso es RF-30)."""
    token = request.cookies.get(config.COOKIE_SESION)
    if not token:
        raise TokenInvalido("No hay sesión activa")

    usuario_id = service.decodificar_access_token(token)
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise TokenInvalido()

    # Una baja tiene que cortar la sesión ya, sin esperar a que expire el token.
    if usuario.estado != service.ESTADO_ACTIVO:
        raise UsuarioInactivo()

    return usuario


UsuarioAutenticado = Annotated[Usuario, Depends(get_current_user)]
