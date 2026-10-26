"""JWT y hashing: las dos primitivas sobre las que se apoya todo el módulo."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt
from pydantic import ValidationError

from src.auth import config, sesion_service
from src.auth.exceptions import TokenInvalido
from src.config import Settings


def test_el_token_redondea():
    usuario_id = uuid.uuid4()
    assert (
        sesion_service.decodificar_access_token(sesion_service.crear_access_token(usuario_id))
        == usuario_id
    )


def test_el_token_expira_segun_la_config():
    token = sesion_service.crear_access_token(uuid.uuid4())
    claims = jwt.decode(token, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
    vida = datetime.fromtimestamp(claims["exp"], UTC) - datetime.fromtimestamp(claims["iat"], UTC)
    assert vida == timedelta(minutes=config.JWT_EXPIRE_MINUTES)


def test_un_token_expirado_no_vale():
    vencido = jwt.encode(
        {"sub": str(uuid.uuid4()), "exp": datetime.now(UTC) - timedelta(minutes=1)},
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM,
    )
    with pytest.raises(TokenInvalido):
        sesion_service.decodificar_access_token(vencido)


def test_un_token_firmado_con_otro_secreto_no_vale():
    ajeno = jwt.encode({"sub": str(uuid.uuid4())}, "otro-secreto", algorithm=config.JWT_ALGORITHM)
    with pytest.raises(TokenInvalido):
        sesion_service.decodificar_access_token(ajeno)


def test_el_hash_verifica_y_no_es_el_texto_plano():
    hash_ = sesion_service.hashear_password("secreta")
    assert hash_ != "secreta"
    assert sesion_service.verificar_password("secreta", hash_)
    assert not sesion_service.verificar_password("otra", hash_)


def test_dos_hashes_de_la_misma_password_son_distintos():
    assert sesion_service.hashear_password("secreta") != sesion_service.hashear_password("secreta")


def test_email_inexistente_igual_dispara_una_comparacion_de_hash(db_session, monkeypatch):
    """Si no comparara nada, un email inexistente respondería más rápido y sería enumerable."""
    llamadas = []
    original = sesion_service.verificar_password
    monkeypatch.setattr(
        sesion_service,
        "verificar_password",
        lambda password, hash_: llamadas.append(hash_) or original(password, hash_),
    )

    with pytest.raises(sesion_service.CredencialesInvalidas):
        sesion_service.autenticar_local(db_session, "nadie@esseri.edu.ar", "algo", ip_origen=None)

    assert llamadas == [sesion_service._DUMMY_PASSWORD_HASH]


def test_bloqueado_hasta_trata_igual_fechas_con_y_sin_zona(monkeypatch):
    monkeypatch.setattr(config, "LOGIN_MAX_INTENTOS", 3)
    ahora = datetime.now(UTC)
    naive = [(ahora - timedelta(seconds=i)).replace(tzinfo=None) for i in range(3)]
    con_zona = [ahora - timedelta(seconds=i) for i in range(3)]

    hasta = sesion_service._bloqueado_hasta(naive, ahora)

    assert hasta is not None
    assert hasta == sesion_service._bloqueado_hasta(con_zona, ahora)


def test_bloqueado_hasta_sin_suficientes_fallidos_no_bloquea(monkeypatch):
    monkeypatch.setattr(config, "LOGIN_MAX_INTENTOS", 3)
    ahora = datetime.now(UTC)

    assert sesion_service._bloqueado_hasta([ahora, ahora], ahora) is None


def test_settings_exige_que_el_bloqueo_cubra_la_ventana():
    with pytest.raises(ValidationError):
        Settings(
            DATABASE_URL="sqlite://",
            JWT_SECRET="x",
            LOGIN_VENTANA_MINUTOS=15,
            LOGIN_BLOQUEO_MINUTOS=5,
        )
