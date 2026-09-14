"""Dependencias de FastAPI para validar sesión/rol en rutas protegidas de otros módulos."""

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.auth import autorizacion_service, config, sesion_service
from src.auth.constants import ESTADO_ACTIVO
from src.auth.exceptions import PermisoDenegado, TokenInvalido, UsuarioInactivo
from src.auth.models import Permiso, Rol, Usuario
from src.auth.roles_service import obtener_permiso, obtener_rol
from src.database import get_db

DbSession = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, db: DbSession) -> Usuario:
    """Resuelve el usuario de la cookie de sesión. Autentica; no mira roles (eso es RF-30)."""
    token = request.cookies.get(config.COOKIE_SESION)
    if not token:
        raise TokenInvalido("No hay sesión activa")

    usuario_id = sesion_service.decodificar_access_token(token)
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise TokenInvalido()

    # Una baja tiene que cortar la sesión ya, sin esperar a que expire el token.
    if usuario.estado != ESTADO_ACTIVO:
        raise UsuarioInactivo()

    return usuario


UsuarioAutenticado = Annotated[Usuario, Depends(get_current_user)]


def obtener_rol_activo(request: Request) -> str | None:
    """Rol con el que la sesión está actuando, embebido como claim `rol` en el JWT.

    `None` significa "todavía no eligió": cuenta recién logueada con 0 o 2+ roles.
    """
    token = request.cookies.get(config.COOKIE_SESION)
    if not token:
        raise TokenInvalido("No hay sesión activa")
    return sesion_service.decodificar_rol_activo(token)


RolActivo = Annotated[str | None, Depends(obtener_rol_activo)]


def requiere_permiso(codigo: str) -> Callable[[Usuario, DbSession, str | None], Usuario]:
    """Factory de dependency (RF-30): 401 sin sesión, 403 si el rol activo no alcanza.

    `codigo` es la clave estable de `Permiso.codigo` (ver `src.auth.constants.codigo_de`), no
    el par (modulo, accion) que se usaba antes. Autoriza contra el ROL ACTIVO de la sesión, no
    contra la suma de roles de la cuenta — dos roles en la misma cuenta ya no se combinan a
    nivel API, aunque `autorizacion_service.tiene_permiso` (la suma) siga existiendo para uso
    informativo.
    """

    def _verificar(usuario: UsuarioAutenticado, db: DbSession, rol_activo: RolActivo) -> Usuario:
        if rol_activo is None:
            raise PermisoDenegado("Elegí con qué rol entrar antes de continuar")
        if not autorizacion_service.tiene_permiso_en_rol(db, usuario.id, rol_activo, codigo):
            raise PermisoDenegado()
        return usuario

    return _verificar


def obtener_rol_o_404(rol_id: uuid.UUID, db: DbSession) -> Rol:
    rol = obtener_rol(db, rol_id)
    if rol is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Rol {rol_id} no encontrado")
    return rol


def obtener_permiso_o_404(permiso_id: uuid.UUID, db: DbSession) -> Permiso:
    permiso = obtener_permiso(db, permiso_id)
    if permiso is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Permiso {permiso_id} no encontrado")
    return permiso


def obtener_usuario_o_404(usuario_id: uuid.UUID, db: DbSession) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Usuario {usuario_id} no encontrado")
    return usuario
