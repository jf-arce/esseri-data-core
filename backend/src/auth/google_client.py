"""Cliente que se comunica con Google Identity/OAuth para el login (RF-27).

Flujo Authorization Code + PKCE: el navegador va a Google, Google devuelve un `code` al callback,
y el backend lo canjea acá usando el client secret. El secret nunca sale de este proceso.
"""

from dataclasses import dataclass
from urllib.parse import urlencode

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from src.auth import config
from src.auth.exceptions import CredencialesInvalidas

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
ISSUERS_VALIDOS = ("accounts.google.com", "https://accounts.google.com")

TIMEOUT_SEGUNDOS = 10


@dataclass(frozen=True)
class GoogleIdentity:
    """Lo único que nos interesa del id_token: quién es y si Google verificó su email."""

    subject: str
    email: str
    email_verified: bool


def build_authorization_url(state: str, code_challenge: str) -> str:
    params = {
        "client_id": config.GOOGLE_CLIENT_ID,
        "redirect_uri": config.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    return f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}"


def exchange_code(code: str, code_verifier: str) -> str:
    """Canjea el `code` por el id_token. Devuelve el id_token crudo, sin verificar."""
    respuesta = requests.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": config.GOOGLE_CLIENT_ID,
            "client_secret": config.GOOGLE_CLIENT_SECRET,
            "redirect_uri": config.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
            "code_verifier": code_verifier,
        },
        timeout=TIMEOUT_SEGUNDOS,
    )
    if respuesta.status_code != 200:
        raise CredencialesInvalidas("Google rechazó el código de autorización")

    id_token = respuesta.json().get("id_token")
    if not id_token:
        raise CredencialesInvalidas("Google no devolvió un id_token")
    return id_token


def verify_id_token(raw_id_token: str) -> GoogleIdentity:
    """Verifica firma, `exp`, `iss` y `aud` del id_token.

    Chequear `aud` contra nuestro client ID no es opcional: sin eso, un id_token emitido por Google
    para cualquier otra aplicación serviría para entrar acá.
    """
    try:
        claims = google_id_token.verify_oauth2_token(
            raw_id_token,
            google_requests.Request(),
            audience=config.GOOGLE_CLIENT_ID,
        )
    except ValueError as exc:
        raise CredencialesInvalidas("El token de Google no es válido") from exc

    if claims.get("iss") not in ISSUERS_VALIDOS:
        raise CredencialesInvalidas("El token de Google no es válido")

    email = claims.get("email")
    subject = claims.get("sub")
    if not email or not subject:
        raise CredencialesInvalidas("El token de Google no trae email ni subject")

    return GoogleIdentity(
        subject=subject,
        email=email.lower(),
        email_verified=bool(claims.get("email_verified", False)),
    )
