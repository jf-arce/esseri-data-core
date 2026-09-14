"""Autorización (RF-30): qué puede hacer un usuario, por la suma de sus roles o por un rol
puntual (el rol activo de la sesión)."""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from src.auth.models import Permiso, Rol, RolPermiso, UsuarioRol
from src.auth.roles_service import permisos_de_rol


def roles_de(db: Session, usuario_id: uuid.UUID) -> list[str]:
    """Códigos de rol (no nombres): es lo que se embebe en el JWT y lo que autoriza (RF-30)."""
    # order_by a propósito: sin orden fijo, `roles[0]` (el "rol actual" que muestra el
    # frontend) podía cambiar de una consulta a otra para el mismo usuario.
    return list(
        db.scalars(
            select(Rol.codigo)
            .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
            .where(UsuarioRol.usuario_id == usuario_id)
            .order_by(Rol.codigo)
        )
    )


def perfiles_de(db: Session, usuario_id: uuid.UUID) -> list[tuple[Rol, list[Permiso]]]:
    """Los roles de la cuenta, cada uno con sus propios permisos (no la suma).

    Alimenta la pantalla "¿Cómo querés entrar?" y "Cambiar vista" del frontend: a diferencia
    de `permisos_de` (la suma, lo que efectivamente autoriza el backend), acá cada rol trae
    solo lo suyo. Sin `relationship()` en los modelos (igual que `listar_usuarios`): una query
    para los roles del usuario y una para sus permisos, resueltas en memoria.
    """
    roles = list(
        db.scalars(
            select(Rol)
            .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
            .where(UsuarioRol.usuario_id == usuario_id)
            .order_by(Rol.nombre)
        )
    )
    return [(rol, permisos_de_rol(db, rol.id)) for rol in roles]


def _existe(db: Session, stmt) -> bool:
    return bool(db.scalar(select(stmt.exists())))


def _condicion_codigo(codigo: str):
    base, separador, _tipo = codigo.partition(":")
    if separador:
        return Permiso.codigo.in_([codigo, base])
    return or_(Permiso.codigo == base, Permiso.codigo.like(f"{base}:%"))


def tiene_permiso(db: Session, usuario_id: uuid.UUID, codigo: str) -> bool:
    """True si alguno de los roles del usuario habilita `codigo`.

    Si dos roles del mismo usuario chocan, gana el más permisivo (decisión de equipo): alcanza
    con que uno solo de sus roles habilite la acción, así que un solo EXISTS sobre todos sus
    roles ya resuelve esa regla.

    `codigo` es siempre ASCII por construcción (ver `codigo_de`), así que a diferencia del
    viejo par (modulo, accion) no hay ambigüedad de normalización Unicode (NFC/NFD) posible acá
    — ese era justo el problema que `codigo` vino a resolver.

    Dos formas de `codigo`, mismo comportamiento que el viejo `tipo_informacion=None` opcional:
    - `"<modulo>.<accion>"` (pedido genérico, sin tipo): lo satisface cualquier permiso de ese
      módulo+acción, tenga o no `tipo_informacion` — típicamente lo que pide `requiere_permiso`
      en un router, que nunca pasa un tipo puntual hoy.
    - `"<modulo>.<accion>:<tipo>"` (pedido puntual): lo satisface el código exacto o el permiso
      amplio sin tipo (`"<modulo>.<accion>"`), nunca uno de un tipo distinto.
    """
    condicion_codigo = _condicion_codigo(codigo)

    stmt = (
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(UsuarioRol.usuario_id == usuario_id, condicion_codigo)
    )
    return _existe(db, stmt)


def tiene_permiso_en_rol(db: Session, usuario_id: uuid.UUID, rol_codigo: str, codigo: str) -> bool:
    """Como `tiene_permiso`, pero acotado a un único rol de la cuenta (el rol activo).

    Si `rol_codigo` fue revocado después de emitido el token, el join a `Rol` no matchea nada y
    esto da `False` sin necesitar invalidar tokens. Comparar por `codigo` (no `nombre`) es lo que
    hace que renombrar el rol no rompa esto.
    """
    condicion_codigo = _condicion_codigo(codigo)

    stmt = (
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .join(Rol, Rol.id == UsuarioRol.rol_id)
        .where(UsuarioRol.usuario_id == usuario_id, Rol.codigo == rol_codigo, condicion_codigo)
    )
    return _existe(db, stmt)


def permisos_de(db: Session, usuario_id: uuid.UUID) -> list[Permiso]:
    return list(
        db.scalars(
            select(Permiso)
            .join(RolPermiso, RolPermiso.permiso_id == Permiso.id)
            .join(UsuarioRol, UsuarioRol.rol_id == RolPermiso.rol_id)
            .where(UsuarioRol.usuario_id == usuario_id)
            .distinct()
        )
    )
