"""Endpoints de Autenticación (RF-27).

El JWT viaja en una cookie httpOnly: nunca queda expuesto a JavaScript ni en la barra de
direcciones. `state` y el verifier de PKCE viajan en su propia cookie firmada, de vida corta.
"""

import base64
import hashlib
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt

from src.auth import config, google_client, service
from src.auth.constants import (
    PERMISO_AUTENTICACION_ACTUALIZAR,
    PERMISO_AUTENTICACION_CREAR,
    PERMISO_AUTENTICACION_ELIMINAR,
    PERMISO_AUTENTICACION_LEER,
)
from src.auth.dependencies import (
    DbSession,
    UsuarioAutenticado,
    obtener_permiso_o_404,
    obtener_rol_o_404,
    obtener_usuario_o_404,
    requiere_permiso,
)
from src.auth.exceptions import (
    CredencialesInvalidas,
    EstadoOAuthInvalido,
    LoginCancelado,
    UsuarioInactivo,
    UsuarioNoHabilitado,
)
from src.auth.models import Permiso, Rol, Usuario
from src.auth.schemas import (
    LoginLocalIn,
    PermisoCreate,
    PermisoRead,
    PermisoUpdate,
    RolCreate,
    RolRead,
    RolUpdate,
    UsuarioActual,
    UsuarioConRoles,
)
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
        permisos=service.permisos_de(db, usuario.id),
    )


@router.post("/logout")
def logout() -> JSONResponse:
    respuesta = JSONResponse({"detail": "Sesión cerrada"})
    respuesta.delete_cookie(config.COOKIE_SESION, path="/")
    return respuesta


# --- ABM de Rol y Permiso (RF-28) ---------------------------------------------------------
# Guardados con requiere_permiso: el ABM se protege con el mismo mecanismo que instala.


@router.get("/roles", response_model=list[RolRead])
def listar_roles(
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[Rol]:
    return service.listar_roles(db)


@router.post("/roles", response_model=RolRead, status_code=status.HTTP_201_CREATED)
def crear_rol(
    datos: RolCreate,
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_CREAR))],
) -> Rol:
    return service.crear_rol(db, datos)


@router.get("/roles/{rol_id}", response_model=RolRead)
def obtener_rol(
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> Rol:
    return rol


@router.put("/roles/{rol_id}", response_model=RolRead)
def actualizar_rol(
    datos: RolUpdate,
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> Rol:
    return service.actualizar_rol(db, rol, datos)


@router.delete("/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    service.eliminar_rol(db, rol)


@router.get("/permisos", response_model=list[PermisoRead])
def listar_permisos(
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
    modulo: str | None = None,
) -> list[Permiso]:
    return service.listar_permisos(db, modulo)


@router.post("/permisos", response_model=PermisoRead, status_code=status.HTTP_201_CREATED)
def crear_permiso(
    datos: PermisoCreate,
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_CREAR))],
) -> Permiso:
    return service.crear_permiso(db, datos)


@router.get("/permisos/{permiso_id}", response_model=PermisoRead)
def obtener_permiso(
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> Permiso:
    return permiso


@router.put("/permisos/{permiso_id}", response_model=PermisoRead)
def actualizar_permiso(
    datos: PermisoUpdate,
    db: DbSession,
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> Permiso:
    return service.actualizar_permiso(db, permiso, datos)


@router.delete("/permisos/{permiso_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_permiso(
    db: DbSession,
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    service.eliminar_permiso(db, permiso)


# --- ROL_PERMISO (RF-28) ------------------------------------------------------------------


@router.get("/roles/{rol_id}/permisos", response_model=list[PermisoRead])
def listar_permisos_de_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[Permiso]:
    return service.permisos_de_rol(db, rol.id)


@router.post("/roles/{rol_id}/permisos", status_code=status.HTTP_204_NO_CONTENT)
def asignar_permiso_a_rol(
    db: DbSession,
    permiso_id: Annotated[uuid.UUID, Body(embed=True)],
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    service.asignar_permiso_a_rol(db, rol.id, permiso_id)


@router.delete("/roles/{rol_id}/permisos/{permiso_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_permiso_a_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    service.quitar_permiso_a_rol(db, rol.id, permiso.id)


# --- USUARIO_ROL (RF-29) ------------------------------------------------------------------


@router.get("/usuarios", response_model=list[UsuarioConRoles])
def listar_usuarios(
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[UsuarioConRoles]:
    return [
        UsuarioConRoles(
            id=usuario.id,
            email=usuario.email,
            estado=usuario.estado,
            auth_provider=usuario.auth_provider,
            ultimo_acceso=usuario.ultimo_acceso,
            roles=roles,
        )
        for usuario, roles in service.listar_usuarios(db)
    ]


@router.get("/usuarios/{usuario_id}/roles", response_model=list[RolRead])
def listar_roles_de_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[Rol]:
    return service.roles_de_usuario(db, usuario.id)


@router.post("/usuarios/{usuario_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
def asignar_rol_a_usuario(
    db: DbSession,
    rol_id: Annotated[uuid.UUID, Body(embed=True)],
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    service.asignar_rol_a_usuario(db, usuario.id, rol_id)


@router.delete("/usuarios/{usuario_id}/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_rol_a_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    service.quitar_rol_a_usuario(db, usuario.id, rol.id)
