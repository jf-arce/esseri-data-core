"""JWT y hashing: las dos primitivas sobre las que se apoya todo el módulo."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from src.auth import config, service
from src.auth.exceptions import TokenInvalido


def test_el_token_redondea():
    usuario_id = uuid.uuid4()
    assert service.decodificar_access_token(service.crear_access_token(usuario_id)) == usuario_id


def test_el_token_expira_segun_la_config():
    token = service.crear_access_token(uuid.uuid4())
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
        service.decodificar_access_token(vencido)


def test_un_token_firmado_con_otro_secreto_no_vale():
    ajeno = jwt.encode({"sub": str(uuid.uuid4())}, "otro-secreto", algorithm=config.JWT_ALGORITHM)
    with pytest.raises(TokenInvalido):
        service.decodificar_access_token(ajeno)


def test_el_hash_verifica_y_no_es_el_texto_plano():
    hash_ = service.hashear_password("secreta")
    assert hash_ != "secreta"
    assert service.verificar_password("secreta", hash_)
    assert not service.verificar_password("otra", hash_)


def test_dos_hashes_de_la_misma_password_son_distintos():
    assert service.hashear_password("secreta") != service.hashear_password("secreta")
