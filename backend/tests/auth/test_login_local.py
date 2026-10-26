"""Fallback con contraseña (POST /auth/login)."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from src.auth import config
from src.auth.models import LogAcceso
from tests.auth.conftest import PASSWORD_VALIDA

IP_TESTCLIENT = "testclient"


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


# --- Bloqueo por intentos ----------------------------------------------------------------


def _fallidos(db_session, cantidad, hace, separacion=timedelta(seconds=1), ip=IP_TESTCLIENT):
    """Inserta `cantidad` fallidos; el más nuevo es de hace `hace`, cada uno `separacion` antes."""
    ahora = datetime.now(UTC).replace(tzinfo=None)
    for i in range(cantidad):
        db_session.add(
            LogAcceso(resultado="fallido", ip_origen=ip, fecha=ahora - hace - separacion * i)
        )
    db_session.commit()


def _login(client, email, password="no-es"):
    return client.post("/auth/login", json={"email": email, "password": password})


def _total_log(db_session):
    return db_session.scalar(select(func.count()).select_from(LogAcceso))


def test_bloquea_despues_de_n_fallidos(client, usuario_local, monkeypatch):
    monkeypatch.setattr(config, "LOGIN_MAX_INTENTOS", 3)

    assert [_login(client, usuario_local.email).status_code for _ in range(3)] == [401] * 3
    assert _login(client, usuario_local.email).status_code == 429


def test_bloqueado_rechaza_aun_con_la_password_correcta(client, db_session, usuario_local):
    _fallidos(db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5))

    respuesta = _login(client, usuario_local.email, PASSWORD_VALIDA)

    assert respuesta.status_code == 429
    assert config.COOKIE_SESION not in respuesta.cookies


def test_el_429_es_igual_para_cualquier_email(client, db_session, usuario_local, usuario_google):
    _fallidos(db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5))

    respuestas = [
        _login(client, usuario_local.email),
        _login(client, "nadie@esseri.edu.ar"),
        _login(client, usuario_google.email),
    ]

    assert {r.status_code for r in respuestas} == {429}
    assert all(r.json() == respuestas[0].json() for r in respuestas)


def test_el_intento_bloqueado_no_se_registra(client, db_session, usuario_local):
    _fallidos(db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5))
    antes = _total_log(db_session)

    _login(client, usuario_local.email)

    assert _total_log(db_session) == antes


def test_el_bloqueo_se_levanta_con_el_tiempo(client, db_session, usuario_local):
    _fallidos(
        db_session, config.LOGIN_MAX_INTENTOS, hace=config.LOGIN_BLOQUEO + timedelta(minutes=1)
    )

    assert _login(client, usuario_local.email, PASSWORD_VALIDA).status_code == 200


def test_fallidos_mas_separados_que_la_ventana_no_bloquean(client, db_session, usuario_local):
    separacion = config.LOGIN_VENTANA / (config.LOGIN_MAX_INTENTOS - 1) * 1.5
    _fallidos(
        db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5), separacion=separacion
    )

    assert _login(client, usuario_local.email).status_code == 401


def test_un_fallido_nuevo_tras_vencer_el_bloqueo_no_vuelve_a_bloquear(
    client, db_session, usuario_local
):
    _fallidos(
        db_session, config.LOGIN_MAX_INTENTOS, hace=config.LOGIN_BLOQUEO + timedelta(minutes=1)
    )

    assert _login(client, usuario_local.email).status_code == 401
    assert _login(client, usuario_local.email).status_code == 401


def test_un_login_exitoso_no_reinicia_el_contador(client, db_session, usuario_local, monkeypatch):
    monkeypatch.setattr(config, "LOGIN_MAX_INTENTOS", 3)
    _login(client, usuario_local.email)
    _login(client, usuario_local.email)
    assert _login(client, usuario_local.email, PASSWORD_VALIDA).status_code == 200

    _login(client, usuario_local.email)

    assert _login(client, usuario_local.email, PASSWORD_VALIDA).status_code == 429


def test_el_bloqueo_es_por_ip(client, db_session, usuario_local):
    _fallidos(db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5), ip="10.0.0.9")

    assert _login(client, usuario_local.email, PASSWORD_VALIDA).status_code == 200


def test_google_funciona_con_la_ip_bloqueada(
    client, db_session, usuario_google, google_responde, iniciar_flujo_google
):
    _fallidos(db_session, config.LOGIN_MAX_INTENTOS, hace=timedelta(seconds=5))
    google_responde(usuario_google.email, usuario_google.provider_subject)
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert config.COOKIE_SESION in respuesta.cookies
