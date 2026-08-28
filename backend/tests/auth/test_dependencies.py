"""get_current_user y GET /auth/me: la puerta que van a usar los otros módulos."""

import uuid
from datetime import UTC, datetime, timedelta

from jose import jwt

from src.auth import config, service
from tests.auth.conftest import PASSWORD_VALIDA


def login(client, usuario):
    return client.post("/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA})


def test_me_sin_cookie_rechaza(client):
    assert client.get("/auth/me").status_code == 401


def test_me_con_token_invalido_rechaza(client):
    client.cookies.set(config.COOKIE_SESION, "no-es-un-jwt")
    assert client.get("/auth/me").status_code == 401


def test_me_con_token_expirado_rechaza(client, usuario_local):
    vencido = jwt.encode(
        {"sub": str(usuario_local.id), "exp": datetime.now(UTC) - timedelta(minutes=1)},
        config.JWT_SECRET,
        algorithm=config.JWT_ALGORITHM,
    )
    client.cookies.set(config.COOKIE_SESION, vencido)
    assert client.get("/auth/me").status_code == 401


def test_me_con_usuario_borrado_rechaza(client):
    client.cookies.set(config.COOKIE_SESION, service.crear_access_token(uuid.uuid4()))
    assert client.get("/auth/me").status_code == 401


def test_me_devuelve_el_usuario_y_sus_roles(client, db_session, usuario_local, con_rol):
    con_rol(usuario_local)
    login(client, usuario_local)

    cuerpo = client.get("/auth/me").json()

    assert cuerpo["email"] == usuario_local.email
    assert cuerpo["estado"] == "activo"
    assert cuerpo["roles"] == ["administrador del sistema"]


def test_me_sin_roles_devuelve_lista_vacia(client, usuario_local):
    """Un usuario recién cargado, antes de que le asignen rol, igual se autentica."""
    login(client, usuario_local)
    assert client.get("/auth/me").json()["roles"] == []


def test_dar_de_baja_corta_la_sesion_sin_esperar_al_vencimiento(client, db_session, usuario_local):
    login(client, usuario_local)
    assert client.get("/auth/me").status_code == 200

    usuario_local.estado = "inactivo"
    db_session.commit()

    assert client.get("/auth/me").status_code == 403


def test_logout_borra_la_cookie(client, usuario_local):
    login(client, usuario_local)
    assert client.get("/auth/me").status_code == 200

    client.post("/auth/logout")

    assert client.get("/auth/me").status_code == 401
