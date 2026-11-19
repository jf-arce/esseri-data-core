"""Resolución de cuentas familiares para avisos internos."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.models import Familia
from src.notificaciones.constants import ROL_FAMILIA


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
