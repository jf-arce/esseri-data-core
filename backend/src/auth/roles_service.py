"""ABM de Rol y Permiso, y la tabla intermedia ROL_PERMISO (RF-28)."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from src.auditoria.service import log_audit
from src.auth.constants import codigo_de, slug_ascii
from src.auth.exceptions import PermisoDuplicado, RolDuplicado, RolEnUso
from src.auth.models import Permiso, Rol, RolPermiso, UsuarioRol
from src.auth.schemas import PermisoCreate, PermisoUpdate, RolCreate, RolUpdate


def _existe(db: Session, stmt) -> bool:
    return bool(db.scalar(select(stmt.exists())))


# --- ABM de Rol -----------------------------------------------------------------------------


def listar_roles(db: Session) -> list[Rol]:
    return list(db.scalars(select(Rol)))


def obtener_rol(db: Session, rol_id: uuid.UUID) -> Rol | None:
    return db.get(Rol, rol_id)


def crear_rol(db: Session, datos: RolCreate, usuario_id: uuid.UUID | None = None) -> Rol:
    if _existe(db, select(Rol.id).where(Rol.nombre == datos.nombre)):
        raise RolDuplicado()
    if _existe(db, select(Rol.id).where(Rol.codigo == slug_ascii(datos.nombre))):
        raise RolDuplicado("Ya existe un rol cuyo nombre deriva el mismo código")
    rol = Rol(**datos.model_dump())
    db.add(rol)
    db.flush()
    log_audit(
        db,
        entidad="ROL",
        entidad_id=rol.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=rol.nombre,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(rol)
    return rol


def actualizar_rol(
    db: Session, rol: Rol, datos: RolUpdate, usuario_id: uuid.UUID | None = None
) -> Rol:
    cambios = datos.model_dump(exclude_unset=True)
    nuevo_nombre = cambios.get("nombre")
    if nuevo_nombre and nuevo_nombre != rol.nombre:
        if _existe(db, select(Rol.id).where(Rol.nombre == nuevo_nombre)):
            raise RolDuplicado()
    valores_anteriores = {campo: getattr(rol, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(rol, campo, valor)
    for campo, valor_nuevo in cambios.items():
        log_audit(
            db,
            entidad="ROL",
            entidad_id=rol.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )
    db.commit()
    db.refresh(rol)
    return rol


def eliminar_rol(db: Session, rol: Rol, usuario_id: uuid.UUID | None = None) -> None:
    if _existe(db, select(UsuarioRol.id).where(UsuarioRol.rol_id == rol.id)):
        raise RolEnUso()
    rol_id = rol.id
    nombre = rol.nombre
    db.execute(delete(RolPermiso).where(RolPermiso.rol_id == rol.id))
    db.delete(rol)
    log_audit(
        db,
        entidad="ROL",
        entidad_id=rol_id,
        campo="__eliminacion__",
        valor_anterior=nombre,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- ABM de Permiso --------------------------------------------------------------------------


def listar_permisos(db: Session, modulo: str | None = None) -> list[Permiso]:
    stmt = select(Permiso)
    if modulo is not None:
        stmt = stmt.where(Permiso.modulo == modulo)
    return list(db.scalars(stmt))


def obtener_permiso(db: Session, permiso_id: uuid.UUID) -> Permiso | None:
    return db.get(Permiso, permiso_id)


def _permiso_duplicado(db: Session, codigo: str) -> bool:
    return _existe(db, select(Permiso.id).where(Permiso.codigo == codigo))


def crear_permiso(
    db: Session, datos: PermisoCreate, usuario_id: uuid.UUID | None = None
) -> Permiso:
    codigo = codigo_de(datos.modulo, datos.accion, datos.tipo_informacion)
    if _permiso_duplicado(db, codigo):
        raise PermisoDuplicado()
    permiso = Permiso(**datos.model_dump())
    db.add(permiso)
    db.flush()
    log_audit(
        db,
        entidad="PERMISO",
        entidad_id=permiso.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=permiso.codigo,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(permiso)
    return permiso


def actualizar_permiso(
    db: Session, permiso: Permiso, datos: PermisoUpdate, usuario_id: uuid.UUID | None = None
) -> Permiso:
    cambios = datos.model_dump(exclude_unset=True)
    modulo = cambios.get("modulo", permiso.modulo)
    accion = cambios.get("accion", permiso.accion)
    tipo_informacion = cambios.get("tipo_informacion", permiso.tipo_informacion)
    nuevo_codigo = codigo_de(modulo, accion, tipo_informacion)
    if nuevo_codigo != permiso.codigo:
        if _permiso_duplicado(db, nuevo_codigo):
            raise PermisoDuplicado()
        cambios["codigo"] = nuevo_codigo
    valores_anteriores = {campo: getattr(permiso, campo) for campo in cambios}
    for campo, valor in cambios.items():
        setattr(permiso, campo, valor)
    for campo, valor_nuevo in cambios.items():
        log_audit(
            db,
            entidad="PERMISO",
            entidad_id=permiso.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )
    db.commit()
    db.refresh(permiso)
    return permiso


def eliminar_permiso(db: Session, permiso: Permiso, usuario_id: uuid.UUID | None = None) -> None:
    permiso_id = permiso.id
    codigo = permiso.codigo
    db.execute(delete(RolPermiso).where(RolPermiso.permiso_id == permiso.id))
    db.delete(permiso)
    log_audit(
        db,
        entidad="PERMISO",
        entidad_id=permiso_id,
        campo="__eliminacion__",
        valor_anterior=codigo,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- ROL_PERMISO (RF-28) ---------------------------------------------------------------------


def permisos_de_rol(db: Session, rol_id: uuid.UUID) -> list[Permiso]:
    return list(
        db.scalars(
            select(Permiso)
            .join(RolPermiso, RolPermiso.permiso_id == Permiso.id)
            .where(RolPermiso.rol_id == rol_id)
        )
    )


def asignar_permiso_a_rol(
    db: Session, rol_id: uuid.UUID, permiso_id: uuid.UUID, usuario_id: uuid.UUID | None = None
) -> RolPermiso:
    existente = db.scalar(
        select(RolPermiso).where(RolPermiso.rol_id == rol_id, RolPermiso.permiso_id == permiso_id)
    )
    if existente is not None:
        return existente
    vinculo = RolPermiso(rol_id=rol_id, permiso_id=permiso_id)
    db.add(vinculo)
    db.flush()
    log_audit(
        db,
        entidad="ROL_PERMISO",
        entidad_id=vinculo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"rol={rol_id} permiso={permiso_id}",
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(vinculo)
    return vinculo


def quitar_permiso_a_rol(
    db: Session, rol_id: uuid.UUID, permiso_id: uuid.UUID, usuario_id: uuid.UUID | None = None
) -> None:
    vinculo = db.scalar(
        select(RolPermiso).where(RolPermiso.rol_id == rol_id, RolPermiso.permiso_id == permiso_id)
    )
    if vinculo is None:
        return
    vinculo_id = vinculo.id
    db.delete(vinculo)
    log_audit(
        db,
        entidad="ROL_PERMISO",
        entidad_id=vinculo_id,
        campo="__eliminacion__",
        valor_anterior=f"rol={rol_id} permiso={permiso_id}",
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()
