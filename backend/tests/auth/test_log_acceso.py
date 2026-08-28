"""Registro de accesos en LOG_ACCESO (RF-27 / RNF-10)."""

from sqlalchemy import select

from src.auth.models import LogAcceso
from tests.auth.conftest import PASSWORD_VALIDA


def logs(db_session):
    return list(db_session.scalars(select(LogAcceso)))


def test_login_local_exitoso_queda_registrado(client, db_session, usuario_local):
    client.post("/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA})

    registros = logs(db_session)
    assert len(registros) == 1
    assert registros[0].resultado == "exitoso"
    assert registros[0].usuario_id == usuario_local.id


def test_password_incorrecta_queda_registrada_contra_el_usuario(client, db_session, usuario_local):
    client.post("/auth/login", json={"email": usuario_local.email, "password": "no-es"})

    registros = logs(db_session)
    assert len(registros) == 1
    assert registros[0].resultado == "fallido"
    assert registros[0].usuario_id == usuario_local.id


def test_email_inexistente_queda_registrado_sin_usuario(client, db_session):
    """El caso que obligó a hacer usuario_id nullable: no hay a quién apuntar."""
    client.post("/auth/login", json={"email": "nadie@esseri.edu.ar", "password": "x"})

    registros = logs(db_session)
    assert len(registros) == 1
    assert registros[0].resultado == "fallido"
    assert registros[0].usuario_id is None


def test_login_google_exitoso_queda_registrado(
    client, db_session, usuario_google, google_responde, iniciar_flujo_google
):
    google_responde(usuario_google.email, usuario_google.provider_subject)
    state = iniciar_flujo_google()
    client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    registros = logs(db_session)
    assert len(registros) == 1
    assert registros[0].resultado == "exitoso"
    assert registros[0].usuario_id == usuario_google.id


def test_google_con_usuario_desconocido_queda_registrado_sin_usuario(
    client, db_session, google_responde, iniciar_flujo_google
):
    google_responde("cualquiera@gmail.com", "sub-random")
    state = iniciar_flujo_google()
    client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    registros = logs(db_session)
    assert len(registros) == 1
    assert registros[0].resultado == "fallido"
    assert registros[0].usuario_id is None


def test_se_registra_la_ip_de_origen(client, db_session, usuario_local):
    client.post("/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA})
    assert logs(db_session)[0].ip_origen is not None
