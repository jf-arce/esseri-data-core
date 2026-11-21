"""Resolución de cuentas familiares para avisos internos."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.familias_alumnos.models import Familia
from src.notificaciones.constants import ROL_FAMILIA, ROLES_ADMINISTRATIVOS


def cuentas_de_familia(db: Session, familia_id: uuid.UUID) -> list[uuid.UUID]:
    """Cuentas activas con rol Familia asociadas a la persona de la familia.

    La familia es el responsable persistido (económico o académico). Varias cuentas de la misma
    persona reciben cada una su aviso; la consulta deduplica por cuenta.
    """
    return list(
        db.scalars(
            select(Usuario.id)
            .join(Familia, Familia.persona_id == Usuario.persona_id)
            .join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
            .join(Rol, Rol.id == UsuarioRol.rol_id)
            .where(
                Familia.id == familia_id,
                Usuario.estado == "activo",
                Rol.codigo == ROL_FAMILIA,
            )
            .distinct()
            .order_by(Usuario.id)
        )
    )


def cuentas_de_administracion(db: Session) -> list[uuid.UUID]:
    """Cuentas activas con un rol administrativo que puede operar justificaciones.

    Se exige el permiso académico de actualización: avisar a un rol que no puede abrir la
    bandeja institucional lo llevaría a un 403. Dirección y Secretaría quedan fuera por
    decisión de producto.
    """
    return list(
        db.scalars(
            select(Usuario.id)
            .join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
            .join(Rol, Rol.id == UsuarioRol.rol_id)
            .join(RolPermiso, RolPermiso.rol_id == Rol.id)
            .join(Permiso, Permiso.id == RolPermiso.permiso_id)
            .where(
                Usuario.estado == "activo",
                Rol.codigo.in_(ROLES_ADMINISTRATIVOS),
                Permiso.codigo.in_(
                    ("academico.actualizar", "academico.actualizar:justificaciones")
                ),
            )
            .distinct()
            .order_by(Usuario.id)
        )
    )
