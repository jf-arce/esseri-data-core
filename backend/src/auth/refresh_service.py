"""Sesión con refresh token rotativo y revocable. El access token vive poco; este servicio
mantiene la sesión real en la tabla `sesion`."""

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth import config, sesion_service
from src.auth.constants import ESTADO_ACTIVO
from src.auth.exceptions import TokenInvalido
from src.auth.models import Sesion, Usuario
from src.fechas import ahora_utc


@dataclass(frozen=True)
class TokensEmitidos:
    access: str
    # None cuando el navegador ya tiene el refresh vigente (ventana de gracia).
    refresh: str | None


def hashear_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _nueva_fila(
    usuario_id: uuid.UUID,
    familia_id: uuid.UUID,
    rol_activo: str | None,
    ahora: datetime,
    expira_absoluta_en: datetime,
    ip_origen: str | None,
) -> tuple[Sesion, str]:
    token = secrets.token_urlsafe(48)
    fila = Sesion(
        usuario_id=usuario_id,
        familia_id=familia_id,
        token_hash=hashear_token(token),
        rol_activo=rol_activo,
        creada_en=ahora,
        expira_en=min(ahora + config.REFRESH_TOKEN_INACTIVIDAD, expira_absoluta_en),
        expira_absoluta_en=expira_absoluta_en,
        ip_origen=ip_origen,
    )
    return fila, token


def crear_sesion(
    db: Session, usuario_id: uuid.UUID, rol_activo: str | None, ip_origen: str | None
) -> TokensEmitidos:
    ahora = ahora_utc()
    db.execute(
        sa.delete(Sesion).where(
            Sesion.usuario_id == usuario_id,
            sa.or_(Sesion.expira_en <= ahora, Sesion.expira_absoluta_en <= ahora),
        )
    )
    fila, token = _nueva_fila(
        usuario_id, uuid.uuid4(), rol_activo, ahora, ahora + config.REFRESH_TOKEN_MAX, ip_origen
    )
    db.add(fila)
    db.commit()
    return TokensEmitidos(sesion_service.crear_access_token(usuario_id, rol_activo), token)


def _revocar_familia(db: Session, familia_id: uuid.UUID, ahora: datetime) -> None:
    db.execute(
        sa.update(Sesion)
        .where(Sesion.familia_id == familia_id, Sesion.revocada_en.is_(None))
        .values(revocada_en=ahora)
    )


def _fila_vigente_de(db: Session, familia_id: uuid.UUID) -> Sesion | None:
    return db.scalar(
        select(Sesion)
        .where(
            Sesion.familia_id == familia_id,
            Sesion.revocada_en.is_(None),
            Sesion.reemplazada_en.is_(None),
        )
        .order_by(Sesion.creada_en.desc())
        .limit(1)
    )


def rotar(db: Session, token: str, ip_origen: str | None) -> TokensEmitidos:
    ahora = ahora_utc()
    fila = db.scalar(
        select(Sesion).where(Sesion.token_hash == hashear_token(token)).with_for_update()
    )
    if fila is None or fila.revocada_en is not None:
        raise TokenInvalido()

    if fila.reemplazada_en is not None:
        if ahora - fila.reemplazada_en > config.REFRESH_GRACIA:
            # Reuso de un token viejo: se asume robo y se corta toda la cadena.
            _revocar_familia(db, fila.familia_id, ahora)
            db.commit()
            raise TokenInvalido()
        vigente = _fila_vigente_de(db, fila.familia_id)
        usuario = db.get(Usuario, fila.usuario_id)
        if vigente is None or usuario is None or usuario.estado != ESTADO_ACTIVO:
            raise TokenInvalido()
        return TokensEmitidos(
            sesion_service.crear_access_token(usuario.id, vigente.rol_activo), None
        )

    usuario = db.get(Usuario, fila.usuario_id)
    if (
        fila.expira_en <= ahora
        or fila.expira_absoluta_en <= ahora
        or usuario is None
        or usuario.estado != ESTADO_ACTIVO
    ):
        _revocar_familia(db, fila.familia_id, ahora)
        db.commit()
        raise TokenInvalido()

    nueva, nuevo_token = _nueva_fila(
        usuario.id, fila.familia_id, fila.rol_activo, ahora, fila.expira_absoluta_en, ip_origen
    )
    fila.reemplazada_en = ahora
    db.add(nueva)
    db.commit()
    return TokensEmitidos(
        sesion_service.crear_access_token(usuario.id, nueva.rol_activo), nuevo_token
    )


def revocar(db: Session, token: str) -> None:
    fila = db.scalar(select(Sesion).where(Sesion.token_hash == hashear_token(token)))
    if fila is None:
        return
    _revocar_familia(db, fila.familia_id, ahora_utc())
    db.commit()


def revocar_todas(db: Session, usuario_id: uuid.UUID) -> None:
    """No hace commit: se llama dentro de la transacción de quien da de baja o cambia el acceso."""
    db.execute(
        sa.update(Sesion)
        .where(Sesion.usuario_id == usuario_id, Sesion.revocada_en.is_(None))
        .values(revocada_en=ahora_utc())
    )


def actualizar_rol(db: Session, token: str, rol_activo: str) -> None:
    fila = db.scalar(select(Sesion).where(Sesion.token_hash == hashear_token(token)))
    if fila is None or fila.revocada_en is not None:
        return
    db.execute(
        sa.update(Sesion)
        .where(
            Sesion.familia_id == fila.familia_id,
            Sesion.revocada_en.is_(None),
            Sesion.reemplazada_en.is_(None),
        )
        .values(rol_activo=rol_activo)
    )
    db.commit()
