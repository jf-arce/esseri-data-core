"""Flujo Authorization Code contra Google: /auth/google/login y /auth/google/callback."""

from urllib.parse import parse_qs, urlparse

from src.auth import config, google_client


def test_login_redirige_a_google_con_pkce(client):
    respuesta = client.get("/auth/google/login", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    destino = urlparse(respuesta.headers["location"])
    params = parse_qs(destino.query)

    assert destino.netloc == "accounts.google.com"
    assert params["response_type"] == ["code"]
    assert params["code_challenge_method"] == ["S256"]
    assert params["redirect_uri"] == [config.GOOGLE_REDIRECT_URI]
    assert params["state"]
    assert config.COOKIE_OAUTH_STATE in respuesta.cookies


def test_dos_logins_no_repiten_el_state(client):
    primero = client.get("/auth/google/login", follow_redirects=False)
    segundo = client.get("/auth/google/login", follow_redirects=False)
    estados = [
        parse_qs(urlparse(r.headers["location"]).query)["state"][0] for r in (primero, segundo)
    ]
    assert estados[0] != estados[1]


def test_usuario_habilitado_entra(client, usuario_google, google_responde, iniciar_flujo_google):
    google_responde(usuario_google.email, usuario_google.provider_subject)
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == config.FRONTEND_URL
    assert config.COOKIE_SESION in respuesta.cookies


def test_usuario_desconocido_no_entra(client, google_responde, iniciar_flujo_google):
    """Pre-provisioning: Google autentica, pero habilitar la cuenta es decisión del sistema."""
    google_responde("cualquiera@gmail.com", "google-sub-random")
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=no_habilitado"
    assert config.COOKIE_SESION not in respuesta.cookies


def test_usuario_inactivo_no_entra(client, usuario_inactivo, google_responde, iniciar_flujo_google):
    google_responde(usuario_inactivo.email, usuario_inactivo.provider_subject)
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=inactivo"


def test_state_que_no_coincide_se_rechaza(
    client, usuario_google, google_responde, iniciar_flujo_google
):
    """Sin esto, un tercero podría completar el callback con su propio código (CSRF)."""
    google_responde(usuario_google.email, usuario_google.provider_subject)
    iniciar_flujo_google()

    respuesta = client.get("/auth/google/callback?code=abc&state=inventado", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=oauth_invalido"


def test_callback_sin_cookie_de_state_se_rechaza(client, usuario_google, google_responde):
    google_responde(usuario_google.email, usuario_google.provider_subject)

    respuesta = client.get("/auth/google/callback?code=abc&state=algo", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=oauth_invalido"


def test_callback_con_error_de_google_no_se_confunde_con_state_invalido(
    client, iniciar_flujo_google
):
    """`error=access_denied` (usuario cancela en Google) es un caso distinto de un state trucho."""
    state = iniciar_flujo_google()

    respuesta = client.get(
        f"/auth/google/callback?error=access_denied&state={state}", follow_redirects=False
    )

    assert respuesta.status_code in (302, 307)
    assert respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=cancelado"


def test_subject_distinto_al_registrado_se_rechaza(
    client, usuario_google, google_responde, iniciar_flujo_google
):
    """Mismo email, otro `sub` de Google: no es la misma cuenta."""
    google_responde(usuario_google.email, "otro-sub-cualquiera")
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert (
        respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=credenciales_invalidas"
    )


def test_cuenta_local_se_vincula_y_conserva_la_password(
    client, db_session, usuario_local, google_responde, iniciar_flujo_google
):
    """El fallback tiene que sobrevivir a la vinculación, si no deja de ser un fallback."""
    hash_previo = usuario_local.password_hash
    google_responde(usuario_local.email, "google-sub-admin")
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)
    assert respuesta.status_code in (302, 307)

    db_session.refresh(usuario_local)
    assert usuario_local.provider_subject == "google-sub-admin"
    assert usuario_local.auth_provider == "google"
    assert usuario_local.password_hash == hash_previo


def test_email_no_verificado_no_vincula(
    client, db_session, usuario_local, google_responde, iniciar_flujo_google
):
    """Sin email_verified, cualquiera que registre ese email en Google se quedaría con la cuenta."""
    google_responde(usuario_local.email, "google-sub-admin", email_verified=False)
    state = iniciar_flujo_google()

    respuesta = client.get(f"/auth/google/callback?code=abc&state={state}", follow_redirects=False)

    assert respuesta.status_code in (302, 307)
    assert (
        respuesta.headers["location"] == f"{config.FRONTEND_URL}/login?error=credenciales_invalidas"
    )
    db_session.refresh(usuario_local)
    assert usuario_local.provider_subject is None


def test_verify_id_token_exige_el_audience_correcto(monkeypatch):
    """Sin chequear `aud`, un id_token emitido para otra app serviría para entrar acá."""
    capturado = {}

    def falso_verify(raw, request, audience=None):
        capturado["audience"] = audience
        return {"iss": "https://accounts.google.com", "sub": "s", "email": "a@b.c"}

    monkeypatch.setattr("src.auth.google_client.google_id_token.verify_oauth2_token", falso_verify)
    monkeypatch.setattr("src.auth.google_client.config.GOOGLE_CLIENT_ID", "el-client-id")

    google_client.verify_id_token("token")

    assert capturado["audience"] == "el-client-id"
