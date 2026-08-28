"""Endpoints de Autenticación (RF-27).

El JWT viaja en una cookie httpOnly: nunca queda expuesto a JavaScript ni en la barra de
direcciones. `state` y el verifier de PKCE viajan en su propia cookie firmada, de vida corta.
"""

import base64
import hashlib
import secrets

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt

from src.auth import config, google_client, service
from src.auth.dependencies import DbSession, UsuarioAutenticado
from src.auth.exceptions import (
    CredencialesInvalidas,
    EstadoOAuthInvalido,
    LoginCancelado,
    UsuarioInactivo,
    UsuarioNoHabilitado,
)
from src.auth.schemas import LoginLocalIn, UsuarioActual
from src.exceptions import AppException

router = APIRouter(prefix="/auth", tags=["auth"])

# Slug corto por excepción para el `?error=` del redirect al frontend. El callback es una
# navegación de página completa del browser, no un fetch: si dejáramos que la excepción llegue
# al exception handler global, el usuario vería el JSON crudo en vez de la pantalla de error.
_SLUG_DE_ERROR: dict[type[AppException], str] = {
    UsuarioNoHabilitado: "no_habilitado",
    UsuarioInactivo: "inactivo",
    CredencialesInvalidas: "credenciales_invalidas",
    EstadoOAuthInvalido: "oauth_invalido",
    LoginCancelado: "cancelado",
}


def _redirect_de_error(exc: AppException) -> RedirectResponse:
    slug = _SLUG_DE_ERROR.get(type(exc), "login_fallido")
    return RedirectResponse(f"{config.FRONTEND_URL}/login?error={slug}")


def _ip_de(request: Request) -> str | None:
    return request.client.host if request.client else None


def _generar_pkce() -> tuple[str, str]:
    """Devuelve (verifier, challenge) según RFC 7636, método S256."""
    verifier = secrets.token_urlsafe(64)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return verifier, challenge


def _setear_cookie_sesion(response: Response, token: str) -> None:
    response.set_cookie(
        config.COOKIE_SESION,
        token,
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        max_age=config.JWT_EXPIRE_MINUTES * 60,
        path="/",
    )


@router.get("/google/login")
def google_login() -> RedirectResponse:
    """Manda el navegador a Google. El frontend solo necesita linkear acá."""
    state = secrets.token_urlsafe(32)
    verifier, challenge = _generar_pkce()

    respuesta = RedirectResponse(google_client.build_authorization_url(state, challenge))
    # Firmado con el mismo secreto del JWT: el callback tiene que poder confiar en que este state
    # lo emitimos nosotros y no un tercero (anti-CSRF).
    respuesta.set_cookie(
        config.COOKIE_OAUTH_STATE,
        jwt.encode(
            {"state": state, "verifier": verifier},
            config.JWT_SECRET,
            algorithm=config.JWT_ALGORITHM,
        ),
        httponly=True,
        secure=config.COOKIE_SECURE,
        samesite="lax",
        max_age=config.OAUTH_STATE_EXPIRE_SECONDS,
        path="/auth",
    )
    return respuesta


@router.get("/google/callback")
def google_callback(
    request: Request, state: str, db: DbSession, code: str = "", error: str = ""
) -> RedirectResponse:
    try:
        if error:
            # error=access_denied: el usuario canceló en Google, no es un state inválido.
            raise LoginCancelado()

        cookie = request.cookies.get(config.COOKIE_OAUTH_STATE)
        if not cookie or not code:
            raise EstadoOAuthInvalido()

        try:
            emitido = jwt.decode(cookie, config.JWT_SECRET, algorithms=[config.JWT_ALGORITHM])
        except JWTError as exc:
            raise EstadoOAuthInvalido() from exc

        if not secrets.compare_digest(emitido.get("state", ""), state):
            raise EstadoOAuthInvalido()

        identidad = google_client.verify_id_token(
            google_client.exchange_code(code, emitido["verifier"])
        )

        ip = _ip_de(request)
        usuario = service.resolver_usuario_google(db, identidad, ip)
        token = service.finalizar_login(db, usuario, ip)
    except AppException as exc:
        return _redirect_de_error(exc)

    respuesta = RedirectResponse(config.FRONTEND_URL)
    _setear_cookie_sesion(respuesta, token)
    respuesta.delete_cookie(config.COOKIE_OAUTH_STATE, path="/auth")
    return respuesta


@router.post("/login")
def login_local(datos: LoginLocalIn, request: Request, db: DbSession) -> JSONResponse:
    """Fallback con contraseña, para cuando Google no está disponible."""
    ip = _ip_de(request)
    usuario = service.autenticar_local(db, datos.email, datos.password, ip)
    token = service.finalizar_login(db, usuario, ip)

    respuesta = JSONResponse({"detail": "Sesión iniciada"})
    _setear_cookie_sesion(respuesta, token)
    return respuesta


@router.get("/me", response_model=UsuarioActual)
def me(usuario: UsuarioAutenticado, db: DbSession) -> UsuarioActual:
    return UsuarioActual(
        id=usuario.id,
        email=usuario.email,
        auth_provider=usuario.auth_provider,
        estado=usuario.estado,
        roles=service.roles_de(db, usuario.id),
    )


@router.post("/logout")
def logout() -> JSONResponse:
    respuesta = JSONResponse({"detail": "Sesión cerrada"})
    respuesta.delete_cookie(config.COOKIE_SESION, path="/")
    return respuesta
