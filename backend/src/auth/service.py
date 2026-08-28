"""Lógica de negocio de Autenticación (RF-27).

Dos caminos de login —Google y contraseña— que terminan en el mismo lugar: `finalizar_login`,
el único punto del sistema que emite un JWT.
"""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth import config
from src.auth.exceptions import (
    CredencialesInvalidas,
    TokenInvalido,
    UsuarioInactivo,
    UsuarioNoHabilitado,
)
from src.auth.google_client import GoogleIdentity
from src.auth.models import LogAcceso, Rol, Usuario, UsuarioRol

# bcrypt solo mira los primeros 72 bytes y falla si le pasás más; truncar en los dos sentidos
# mantiene hash y verificación consistentes.
BCRYPT_MAX_BYTES = 72

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

    if usuario is None:
        registrar_acceso(db, RESULTADO_FALLIDO, ip_origen)
        raise CredencialesInvalidas()

    if usuario.password_hash is None or not verificar_password(password, usuario.password_hash):
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
