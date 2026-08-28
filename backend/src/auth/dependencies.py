"""Dependencias de FastAPI para validar sesión/rol en rutas protegidas de otros módulos."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.auth import config, service
from src.auth.exceptions import PermisoDenegado, TokenInvalido, UsuarioInactivo
from src.auth.models import Permiso, Rol, Usuario
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


def requiere_permiso(codigo: str) -> Callable[[Usuario, DbSession], Usuario]:
    """Factory de dependency (RF-30): 401 sin sesión, 403 si la sesión no alcanza.

    `codigo` es la clave estable de `Permiso.codigo` (ver `src.auth.constants.codigo_de`), no
    el par (modulo, accion) que se usaba antes.
    """

    def _verificar(usuario: UsuarioAutenticado, db: DbSession) -> Usuario:
        if not service.tiene_permiso(db, usuario.id, codigo):
            raise PermisoDenegado()
        return usuario

    return _verificar


def obtener_rol_o_404(rol_id: uuid.UUID, db: DbSession) -> Rol:
    rol = service.obtener_rol(db, rol_id)
    if rol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Rol {rol_id} no encontrado")
    return rol


def obtener_permiso_o_404(permiso_id: uuid.UUID, db: DbSession) -> Permiso:
    permiso = service.obtener_permiso(db, permiso_id)
    if permiso is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Permiso {permiso_id} no encontrado")
    return permiso


def obtener_usuario_o_404(usuario_id: uuid.UUID, db: DbSession) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Usuario {usuario_id} no encontrado")
    return usuario
