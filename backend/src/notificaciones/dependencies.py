"""Autorización de la bandeja propia: rol activo vigente y su alcance.

La sesión (401) la resuelve `get_current_user`. Acá se revalida que el rol activo siga asignado
a la cuenta. Para Familia se exige además su `Familia` persistida; para Administración, el rol
alcanza porque la bandeja solo expone hechos institucionales. El vínculo con cada alumno y la
identidad congelada se revalidan en la consulta de la bandeja.
"""

from typing import Annotated

from fastapi import Depends

from src.auth import autorizacion_service
from src.auth.dependencies import DbSession, RolActivo, UsuarioAutenticado
from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.service import obtener_familia_de_usuario
from src.notificaciones.constants import ROL_FAMILIA, ROLES_ADMINISTRATIVOS
from src.notificaciones.service import AlcanceBandeja


def exigir_bandeja_vigente(
    usuario: UsuarioAutenticado, db: DbSession, rol_activo: RolActivo
) -> AlcanceBandeja:
    roles = autorizacion_service.roles_de(db, usuario.id)
    if rol_activo == ROL_FAMILIA:
        if ROL_FAMILIA not in roles:
            raise PermisoDenegado("Esta operación requiere el rol Familia")
        familia = obtener_familia_de_usuario(db, usuario)
        if familia is None:
            raise PermisoDenegado("Tu cuenta no tiene una familia asociada")
        return AlcanceBandeja(rol=ROL_FAMILIA, familia_id=familia.id)
    if rol_activo in ROLES_ADMINISTRATIVOS:
        if rol_activo not in roles:
            raise PermisoDenegado("Esta operación requiere el rol Administración")
        return AlcanceBandeja(rol=rol_activo)
    raise PermisoDenegado("Esta operación requiere un rol con bandeja interna")


BandejaVigente = Annotated[AlcanceBandeja, Depends(exigir_bandeja_vigente)]
