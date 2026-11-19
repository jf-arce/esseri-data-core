"""Autorización de la bandeja propia: rol Familia vigente y familia persistida.

La sesión (401) la resuelve `get_current_user`. Acá se revalida que el rol activo sea Familia,
que la cuenta siga teniendo ese rol y que exista su `Familia`; el vínculo con cada alumno y la
identidad congelada se revalidan en la consulta de la bandeja.
"""

from typing import Annotated

from fastapi import Depends

from src.auth import autorizacion_service
from src.auth.dependencies import DbSession, RolActivo, UsuarioAutenticado
from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.models import Familia
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.notificaciones.constants import ROL_FAMILIA


def exigir_familia_vigente(
    usuario: UsuarioAutenticado, db: DbSession, rol_activo: RolActivo
) -> Familia:
    if rol_activo != ROL_FAMILIA or ROL_FAMILIA not in autorizacion_service.roles_de(
        db, usuario.id
    ):
        raise PermisoDenegado("Esta operación requiere el rol Familia")
    familia = obtener_familia_de_usuario(db, usuario)
    if familia is None:
        raise PermisoDenegado("Tu cuenta no tiene una familia asociada")
    return familia


FamiliaVigente = Annotated[Familia, Depends(exigir_familia_vigente)]
