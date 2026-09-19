"""Endpoints de Autenticación (RF-27).

El JWT viaja en una cookie httpOnly: nunca queda expuesto a JavaScript ni en la barra de
direcciones. `state` y el verifier de PKCE viajan en su propia cookie firmada, de vida corta.
"""

import base64
import hashlib
import secrets
import uuid
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt

from src.auth import (
    autorizacion_service,
    config,
    google_client,
    roles_service,
    sesion_service,
    usuarios_service,
)
from src.auth.constants import (
    PERMISO_AUTENTICACION_ACTUALIZAR,
    PERMISO_AUTENTICACION_CREAR,
    PERMISO_AUTENTICACION_ELIMINAR,
    PERMISO_AUTENTICACION_LEER,
)
from src.auth.dependencies import (
    DbSession,
    RolActivo,
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
    PermisoDenegado,
    UsuarioInactivo,
    UsuarioNoHabilitado,
)
from src.auth.models import Permiso, Rol, Usuario
from src.auth.schemas import (
    AccesoUpdate,
    EstadoUsuarioIn,
    LoginLocalIn,
    PermisoCreate,
    PermisoRead,
    PermisoUpdate,
    RolActivoIn,
    RolConPermisos,
    RolCreate,
    RolRead,
    RolUpdate,
    UsuarioActual,
    UsuarioConRoles,
    UsuarioCreate,
    UsuarioDetalle,
    UsuarioUpdate,
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
        usuario = sesion_service.resolver_usuario_google(db, identidad, ip)
        token = sesion_service.finalizar_login(db, usuario, ip)
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
    usuario = sesion_service.autenticar_local(db, datos.email, datos.password, ip)
    token = sesion_service.finalizar_login(db, usuario, ip)

    respuesta = JSONResponse({"detail": "Sesión iniciada"})
    _setear_cookie_sesion(respuesta, token)
    return respuesta


@router.get("/me", response_model=UsuarioActual)
def me(usuario: UsuarioAutenticado, db: DbSession, rol_activo: RolActivo) -> UsuarioActual:
    perfiles = autorizacion_service.perfiles_de(db, usuario.id)
    codigos = [rol.codigo for rol, _ in perfiles]
    return UsuarioActual(
        id=usuario.id,
        email=usuario.email,
        auth_provider=usuario.auth_provider,
        estado=usuario.estado,
        # Informativo/display: nombres, no códigos.
        roles=[rol.nombre for rol, _ in perfiles],
        permisos=autorizacion_service.permisos_de(db, usuario.id),
        perfiles=[
            RolConPermisos(
                id=rol.id,
                codigo=rol.codigo,
                nombre=rol.nombre,
                descripcion=rol.descripcion,
                permisos=permisos,
            )
            for rol, permisos in perfiles
        ],
        # Si el rol de la cookie ya no es válido (revocado), se reporta null en vez de un
        # código viejo — el frontend vuelve a preguntar en vez de quedar inconsistente.
        rol_activo=rol_activo if rol_activo in codigos else None,
    )


@router.post("/rol-activo")
def establecer_rol_activo(
    datos: RolActivoIn, usuario: UsuarioAutenticado, db: DbSession
) -> JSONResponse:
    if datos.rol not in autorizacion_service.roles_de(db, usuario.id):
        raise PermisoDenegado("Ese rol no pertenece a tu cuenta")

    token = sesion_service.crear_access_token(usuario.id, datos.rol)
    respuesta = JSONResponse({"detail": "Rol activo actualizado"})
    _setear_cookie_sesion(respuesta, token)
    return respuesta


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
    return roles_service.listar_roles(db)


@router.post("/roles", response_model=RolRead, status_code=status.HTTP_201_CREATED)
def crear_rol(
    datos: RolCreate,
    db: DbSession,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_CREAR))],
) -> Rol:
    return roles_service.crear_rol(db, datos, usuario.id)


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
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> Rol:
    return roles_service.actualizar_rol(db, rol, datos, usuario.id)


@router.delete("/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    roles_service.eliminar_rol(db, rol, usuario.id)


@router.get("/permisos", response_model=list[PermisoRead])
def listar_permisos(
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
    modulo: str | None = None,
) -> list[Permiso]:
    return roles_service.listar_permisos(db, modulo)


@router.post("/permisos", response_model=PermisoRead, status_code=status.HTTP_201_CREATED)
def crear_permiso(
    datos: PermisoCreate,
    db: DbSession,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_CREAR))],
) -> Permiso:
    return roles_service.crear_permiso(db, datos, usuario.id)


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
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> Permiso:
    return roles_service.actualizar_permiso(db, permiso, datos, usuario.id)


@router.delete("/permisos/{permiso_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_permiso(
    db: DbSession,
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    roles_service.eliminar_permiso(db, permiso, usuario.id)


# --- ROL_PERMISO (RF-28) ------------------------------------------------------------------


@router.get("/roles/{rol_id}/permisos", response_model=list[PermisoRead])
def listar_permisos_de_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[Permiso]:
    return roles_service.permisos_de_rol(db, rol.id)


@router.post("/roles/{rol_id}/permisos", status_code=status.HTTP_204_NO_CONTENT)
def asignar_permiso_a_rol(
    db: DbSession,
    permiso_id: Annotated[uuid.UUID, Body(embed=True)],
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    roles_service.asignar_permiso_a_rol(db, rol.id, permiso_id, usuario.id)


@router.delete("/roles/{rol_id}/permisos/{permiso_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_permiso_a_rol(
    db: DbSession,
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    permiso: Annotated[Permiso, Depends(obtener_permiso_o_404)],
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    roles_service.quitar_permiso_a_rol(db, rol.id, permiso.id, usuario.id)


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
            persona_id=usuario.persona_id,
            persona_nombre=persona.nombre if persona else None,
            persona_apellido=persona.apellido if persona else None,
        )
        for usuario, roles, persona in usuarios_service.listar_usuarios(db)
    ]


@router.post("/usuarios", response_model=UsuarioConRoles, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    datos: UsuarioCreate,
    db: DbSession,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_CREAR))],
) -> UsuarioConRoles:
    """Alta de una cuenta de personal. Familia y docente tienen su propio formulario (crean,
    además, Familia/Docente) — acá se rechazan con 422 si vienen entre los roles pedidos."""
    try:
        usuario, roles = usuarios_service.crear_usuario(db, datos)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return UsuarioConRoles(
        id=usuario.id,
        email=usuario.email,
        estado=usuario.estado,
        auth_provider=usuario.auth_provider,
        ultimo_acceso=usuario.ultimo_acceso,
        roles=roles,
        persona_id=usuario.persona_id,
        persona_nombre=datos.persona.nombre.strip(),
        persona_apellido=datos.persona.apellido.strip(),
    )


def _a_usuario_detalle(usuario: Usuario, roles: list[Rol], persona) -> UsuarioDetalle:
    return UsuarioDetalle(
        id=usuario.id,
        email=usuario.email,
        estado=usuario.estado,
        auth_provider=usuario.auth_provider,
        ultimo_acceso=usuario.ultimo_acceso,
        roles=roles,
        persona_id=usuario.persona_id,
        persona_nombre=persona.nombre if persona else None,
        persona_apellido=persona.apellido if persona else None,
        persona_dni=persona.dni if persona else None,
        persona_telefono=persona.telefono if persona else None,
    )


@router.get("/usuarios/{usuario_id}", response_model=UsuarioDetalle)
def obtener_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> UsuarioDetalle:
    usuario, roles, persona = usuarios_service.obtener_usuario_detalle(db, usuario)
    return _a_usuario_detalle(usuario, roles, persona)


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioDetalle)
def actualizar_usuario(
    datos: UsuarioUpdate,
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> UsuarioDetalle:
    try:
        usuario = usuarios_service.actualizar_usuario(db, usuario, datos)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    _, roles, persona = usuarios_service.obtener_usuario_detalle(db, usuario)
    return _a_usuario_detalle(usuario, roles, persona)


@router.put("/usuarios/{usuario_id}/acceso", status_code=status.HTTP_204_NO_CONTENT)
def actualizar_acceso_usuario(
    datos: AccesoUpdate,
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    usuarios_service.actualizar_acceso(db, usuario, datos)


@router.put("/usuarios/{usuario_id}/estado", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_estado_usuario(
    datos: EstadoUsuarioIn,
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    actor: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    """Baja lógica (`inactivo`) o reactivación (`activo`). Va detrás del permiso de eliminar:
    dar de baja es la acción destructiva de esta pareja, y reactivar comparte el mismo endpoint."""
    usuarios_service.cambiar_estado(db, usuario, datos.estado, actor.id)


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    actor: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ELIMINAR))],
) -> None:
    """Borrado físico, irreversible. Rechaza cuentas con historial (usar la baja lógica en ese
    caso) y la propia cuenta del actor."""
    usuarios_service.eliminar_usuario(db, usuario, actor.id)


@router.get("/usuarios/{usuario_id}/roles", response_model=list[RolRead])
def listar_roles_de_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_LEER))],
) -> list[Rol]:
    return usuarios_service.roles_de_usuario(db, usuario.id)


@router.post("/usuarios/{usuario_id}/roles", status_code=status.HTTP_204_NO_CONTENT)
def asignar_rol_a_usuario(
    db: DbSession,
    rol_id: Annotated[uuid.UUID, Body(embed=True)],
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    usuarios_service.asignar_rol_a_usuario(db, usuario.id, rol_id)


@router.delete("/usuarios/{usuario_id}/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def quitar_rol_a_usuario(
    db: DbSession,
    usuario: Annotated[Usuario, Depends(obtener_usuario_o_404)],
    rol: Annotated[Rol, Depends(obtener_rol_o_404)],
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_AUTENTICACION_ACTUALIZAR))],
) -> None:
    usuarios_service.quitar_rol_a_usuario(db, usuario.id, rol.id)
