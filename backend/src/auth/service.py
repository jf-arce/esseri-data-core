"""Lógica de negocio de Autenticación (RF-27).

Dos caminos de login —Google y contraseña— que terminan en el mismo lugar: `finalizar_login`,
el único punto del sistema que emite un JWT.
"""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session

from src.auth import config
from src.auth.constants import ACCION_ACTUALIZAR, MODULO_AUTENTICACION
from src.auth.exceptions import (
    CredencialesInvalidas,
    PermisoDuplicado,
    RolDuplicado,
    RolEnUso,
    TokenInvalido,
    UsuarioInactivo,
    UsuarioNoHabilitado,
)
from src.auth.google_client import GoogleIdentity
from src.auth.models import LogAcceso, Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.auth.schemas import PermisoCreate, PermisoUpdate, RolCreate, RolUpdate

# bcrypt solo mira los primeros 72 bytes y falla si le pasás más; truncar en los dos sentidos
# mantiene hash y verificación consistentes.
BCRYPT_MAX_BYTES = 72

# Se compara contra esto cuando el email no existe, para no filtrar por timing qué emails existen.
_DUMMY_PASSWORD_HASH = bcrypt.hashpw(
    b"no existe ningun usuario con este email", bcrypt.gensalt()
).decode("utf-8")

RESULTADO_EXITOSO = "exitoso"
RESULTADO_FALLIDO = "fallido"

ESTADO_ACTIVO = "activo"

PROVIDER_GOOGLE = "google"
PROVIDER_LOCAL = "local"


# --- Contraseñas -------------------------------------------------------------------------


def _a_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:BCRYPT_MAX_BYTES]


def hashear_password(password: str) -> str:
    return bcrypt.hashpw(_a_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(_a_bytes(password), password_hash.encode("utf-8"))


# --- JWT ---------------------------------------------------------------------------------


def crear_access_token(usuario_id: uuid.UUID) -> str:
    ahora = datetime.now(UTC)
    payload = {
        "sub": str(usuario_id),
        "iat": ahora,
        "exp": ahora + timedelta(minutes=config.JWT_EXPIRE_MINUTES),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, config.JWT_SECRET, algorithm=config.JWT_ALGORITHM)


def decodificar_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        return uuid.UUID(payload["sub"])
    except (JWTError, KeyError, ValueError) as exc:
        raise TokenInvalido() from exc


# --- Consultas ---------------------------------------------------------------------------


def buscar_por_email(db: Session, email: str) -> Usuario | None:
    return db.scalar(select(Usuario).where(Usuario.email == email.strip().lower()))


def roles_de(db: Session, usuario_id: uuid.UUID) -> list[str]:
    return list(
        db.scalars(
            select(Rol.nombre)
            .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
            .where(UsuarioRol.usuario_id == usuario_id)
        )
    )


# --- LOG_ACCESO (RF-27 / RNF-10) ---------------------------------------------------------


def registrar_acceso(
    db: Session,
    resultado: str,
    ip_origen: str | None,
    usuario_id: uuid.UUID | None = None,
) -> None:
    """`usuario_id` va en None cuando el email del intento no existe en el sistema."""
    db.add(LogAcceso(resultado=resultado, ip_origen=ip_origen, usuario_id=usuario_id))
    db.commit()


# --- Login ------------------------------------------------------------------------------


def autenticar_local(db: Session, email: str, password: str, ip_origen: str | None) -> Usuario:
    """Fallback con contraseña.

    Los tres motivos de rechazo (email inexistente, usuario sin contraseña, contraseña incorrecta)
    devuelven el mismo error a propósito: distinguirlos permitiría averiguar qué emails existen.
    """
    usuario = buscar_por_email(db, email)

    hash_a_comparar = (
        usuario.password_hash if usuario and usuario.password_hash else _DUMMY_PASSWORD_HASH
    )
    password_correcta = verificar_password(password, hash_a_comparar)

    if usuario is None:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen)
        raise CredencialesInvalidas()

    if usuario.password_hash is None or not password_correcta:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen, usuario.id)
        raise CredencialesInvalidas()

    if usuario.estado != ESTADO_ACTIVO:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen, usuario.id)
        raise UsuarioInactivo()

    return usuario


def resolver_usuario_google(
    db: Session, identidad: GoogleIdentity, ip_origen: str | None
) -> Usuario:
    """Google ya confirmó quién es; acá se decide si esa persona puede entrar.

    No se crean usuarios al vuelo: un USUARIO es la punta de una estructura (persona, roles,
    vínculo con FAMILIA) que este flujo no puede completar. La carga la hacen los ABM.
    """
    usuario = buscar_por_email(db, identidad.email)

    if usuario is None:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen)
        raise UsuarioNoHabilitado()

    if usuario.estado != ESTADO_ACTIVO:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen, usuario.id)
        raise UsuarioInactivo()

    if usuario.provider_subject is None:
        if not identidad.email_verified:
            registrar_acceso(db, RESULTADO_FALLIDO, ip_origen, usuario.id)
            raise CredencialesInvalidas("Google no tiene verificado ese email")
        # Primer login por Google de una cuenta creada como local: se vincula conservando el
        # password_hash, que es justamente el fallback si Google deja de estar disponible.
        usuario.provider_subject = identidad.subject
        usuario.auth_provider = PROVIDER_GOOGLE
    elif usuario.provider_subject != identidad.subject:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen, usuario.id)
        raise CredencialesInvalidas()

    return usuario


def finalizar_login(db: Session, usuario: Usuario, ip_origen: str | None) -> str:
    """Único punto por el que se emite un token, lo use Google o el login local."""
    usuario.ultimo_acceso = datetime.now(UTC).replace(tzinfo=None)
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    registrar_acceso(db, RESULTADO_EXITOSO, ip_origen, usuario.id)
    return crear_access_token(usuario.id)


# --- Autorización (RF-30) -----------------------------------------------------------------


def _existe(db: Session, stmt) -> bool:
    return bool(db.scalar(select(stmt.exists())))


def tiene_permiso(
    db: Session,
    usuario_id: uuid.UUID,
    modulo: str,
    accion: str,
    tipo_informacion: str | None = None,
) -> bool:
    """True si alguno de los roles del usuario habilita (modulo, accion).

    Si dos roles del mismo usuario chocan, gana el más permisivo (decisión de equipo): alcanza
    con que uno solo de sus roles habilite la acción, así que un solo EXISTS sobre todos sus
    roles ya resuelve esa regla.

    `tipo_informacion=None` no filtra: cualquier permiso de ese módulo+acción sirve. Si se pide
    un `tipo_informacion` puntual, lo satisface un permiso con ese tipo exacto o uno amplio
    (tipo_informacion NULL en la base).
    """
    condiciones = [
        UsuarioRol.usuario_id == usuario_id,
        Permiso.modulo == modulo,
        Permiso.accion == accion,
    ]
    if tipo_informacion is not None:
        condiciones.append(
            or_(Permiso.tipo_informacion.is_(None), Permiso.tipo_informacion == tipo_informacion)
        )
    stmt = (
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(*condiciones)
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


# --- ABM de Rol -----------------------------------------------------------------------------


def listar_roles(db: Session) -> list[Rol]:
    return list(db.scalars(select(Rol)))


def obtener_rol(db: Session, rol_id: uuid.UUID) -> Rol | None:
    return db.get(Rol, rol_id)


def crear_rol(db: Session, datos: RolCreate) -> Rol:
    if _existe(db, select(Rol.id).where(Rol.nombre == datos.nombre)):
        raise RolDuplicado()
    rol = Rol(**datos.model_dump())
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


def actualizar_rol(db: Session, rol: Rol, datos: RolUpdate) -> Rol:
    cambios = datos.model_dump(exclude_unset=True)
    nuevo_nombre = cambios.get("nombre")
    if nuevo_nombre and nuevo_nombre != rol.nombre:
        if _existe(db, select(Rol.id).where(Rol.nombre == nuevo_nombre)):
            raise RolDuplicado()
    for campo, valor in cambios.items():
        setattr(rol, campo, valor)
    db.commit()
    db.refresh(rol)
    return rol


def eliminar_rol(db: Session, rol: Rol) -> None:
    if _existe(db, select(UsuarioRol.id).where(UsuarioRol.rol_id == rol.id)):
        raise RolEnUso()
    db.execute(delete(RolPermiso).where(RolPermiso.rol_id == rol.id))
    db.delete(rol)
    db.commit()


# --- ABM de Permiso --------------------------------------------------------------------------


def listar_permisos(db: Session, modulo: str | None = None) -> list[Permiso]:
    stmt = select(Permiso)
    if modulo is not None:
        stmt = stmt.where(Permiso.modulo == modulo)
    return list(db.scalars(stmt))


def obtener_permiso(db: Session, permiso_id: uuid.UUID) -> Permiso | None:
    return db.get(Permiso, permiso_id)


def _permiso_duplicado(db: Session, modulo: str, accion: str, tipo_informacion: str | None) -> bool:
    condiciones = [Permiso.modulo == modulo, Permiso.accion == accion]
    condiciones.append(
        Permiso.tipo_informacion.is_(None)
        if tipo_informacion is None
        else Permiso.tipo_informacion == tipo_informacion
    )
    return _existe(db, select(Permiso.id).where(*condiciones))


def crear_permiso(db: Session, datos: PermisoCreate) -> Permiso:
    if _permiso_duplicado(db, datos.modulo, datos.accion, datos.tipo_informacion):
        raise PermisoDuplicado()
    permiso = Permiso(**datos.model_dump())
    db.add(permiso)
    db.commit()
    db.refresh(permiso)
    return permiso


def actualizar_permiso(db: Session, permiso: Permiso, datos: PermisoUpdate) -> Permiso:
    cambios = datos.model_dump(exclude_unset=True)
    modulo = cambios.get("modulo", permiso.modulo)
    accion = cambios.get("accion", permiso.accion)
    tipo_informacion = cambios.get("tipo_informacion", permiso.tipo_informacion)
    if (modulo, accion, tipo_informacion) != (
        permiso.modulo,
        permiso.accion,
        permiso.tipo_informacion,
    ):
        if _permiso_duplicado(db, modulo, accion, tipo_informacion):
            raise PermisoDuplicado()
    for campo, valor in cambios.items():
        setattr(permiso, campo, valor)
    db.commit()
    db.refresh(permiso)
    return permiso


def eliminar_permiso(db: Session, permiso: Permiso) -> None:
    db.execute(delete(RolPermiso).where(RolPermiso.permiso_id == permiso.id))
    db.delete(permiso)
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


def asignar_permiso_a_rol(db: Session, rol_id: uuid.UUID, permiso_id: uuid.UUID) -> RolPermiso:
    existente = db.scalar(
        select(RolPermiso).where(RolPermiso.rol_id == rol_id, RolPermiso.permiso_id == permiso_id)
    )
    if existente is not None:
        return existente
    vinculo = RolPermiso(rol_id=rol_id, permiso_id=permiso_id)
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    return vinculo


def quitar_permiso_a_rol(db: Session, rol_id: uuid.UUID, permiso_id: uuid.UUID) -> None:
    vinculo = db.scalar(
        select(RolPermiso).where(RolPermiso.rol_id == rol_id, RolPermiso.permiso_id == permiso_id)
    )
    if vinculo is None:
        return
    db.delete(vinculo)
    db.commit()


# --- USUARIO_ROL (RF-29) ----------------------------------------------------------------------


def roles_de_usuario(db: Session, usuario_id: uuid.UUID) -> list[Rol]:
    return list(
        db.scalars(
            select(Rol)
            .join(UsuarioRol, UsuarioRol.rol_id == Rol.id)
            .where(UsuarioRol.usuario_id == usuario_id)
        )
    )


def _quedaria_sin_administrador(
    db: Session, usuario_id: uuid.UUID, rol_a_quitar_id: uuid.UUID
) -> bool:
    """Anti-lockout: sin esto, un admin puede quitarse su propio rol y dejar la instalación sin
    nadie que pueda reasignar permisos — irrecuperable sin entrar a la base a mano."""
    conserva_via_otro_rol = _existe(
        db,
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(
            UsuarioRol.usuario_id == usuario_id,
            UsuarioRol.rol_id != rol_a_quitar_id,
            Permiso.modulo == MODULO_AUTENTICACION,
            Permiso.accion == ACCION_ACTUALIZAR,
        ),
    )
    if conserva_via_otro_rol:
        return False

    hay_otro_administrador = _existe(
        db,
        select(UsuarioRol.id)
        .join(RolPermiso, RolPermiso.rol_id == UsuarioRol.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(
            UsuarioRol.usuario_id != usuario_id,
            Permiso.modulo == MODULO_AUTENTICACION,
            Permiso.accion == ACCION_ACTUALIZAR,
        ),
    )
    return not hay_otro_administrador


def asignar_rol_a_usuario(db: Session, usuario_id: uuid.UUID, rol_id: uuid.UUID) -> UsuarioRol:
    existente = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id, UsuarioRol.rol_id == rol_id)
    )
    if existente is not None:
        return existente
    vinculo = UsuarioRol(usuario_id=usuario_id, rol_id=rol_id)
    db.add(vinculo)
    db.commit()
    db.refresh(vinculo)
    return vinculo


def quitar_rol_a_usuario(db: Session, usuario_id: uuid.UUID, rol_id: uuid.UUID) -> None:
    vinculo = db.scalar(
        select(UsuarioRol).where(UsuarioRol.usuario_id == usuario_id, UsuarioRol.rol_id == rol_id)
    )
    if vinculo is None:
        return
    if _quedaria_sin_administrador(db, usuario_id, rol_id):
        raise RolEnUso(
            "No se puede quitar: dejaría al sistema sin nadie que administre roles y permisos"
        )
    db.delete(vinculo)
    db.commit()
