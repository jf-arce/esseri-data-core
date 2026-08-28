"""Fallback con contraseña (POST /auth/login)."""

from src.auth import config
from tests.auth.conftest import PASSWORD_VALIDA


def test_password_correcta_inicia_sesion(client, usuario_local):
    respuesta = client.post(
        "/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    assert config.COOKIE_SESION in respuesta.cookies


def test_el_email_no_distingue_mayusculas(client, usuario_local):
    respuesta = client.post(
        "/auth/login", json={"email": "  ADMIN@esseri.edu.ar ", "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200


def test_password_incorrecta_rechaza(client, usuario_local):
    respuesta = client.post("/auth/login", json={"email": usuario_local.email, "password": "no-es"})
    assert respuesta.status_code == 401
    assert config.COOKIE_SESION not in respuesta.cookies


def test_email_inexistente_da_el_mismo_error_que_password_incorrecta(client, usuario_local):
    """Distinguirlos permitiría averiguar qué emails están cargados en el sistema."""
    inexistente = client.post(
        "/auth/login", json={"email": "nadie@esseri.edu.ar", "password": PASSWORD_VALIDA}
    )
    incorrecta = client.post(
        "/auth/login", json={"email": usuario_local.email, "password": "no-es"}
    )
    assert inexistente.status_code == incorrecta.status_code == 401
    assert inexistente.json() == incorrecta.json()


def test_usuario_solo_google_no_entra_por_password(client, usuario_google):
    """password_hash es NULL: no hay contraseña contra la cual comparar."""
    respuesta = client.post(
        "/auth/login", json={"email": usuario_google.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 401


def test_usuario_inactivo_no_entra(client, usuario_inactivo):
    respuesta = client.post(
        "/auth/login", json={"email": usuario_inactivo.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 403


def test_el_login_actualiza_ultimo_acceso(client, db_session, usuario_local):
    assert usuario_local.ultimo_acceso is None
    client.post("/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA})
    db_session.refresh(usuario_local)
    assert usuario_local.ultimo_acceso is not None
