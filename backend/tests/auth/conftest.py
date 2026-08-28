"""Fixtures de Autenticación. Compartidas solo dentro de tests/auth/ por ahora."""

import pytest

from src.auth import service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_AUTENTICACION,
)
from src.auth.google_client import GoogleIdentity
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def rol_admin(db_session):
    rol = Rol(nombre="administrador del sistema", descripcion="Rol precargado en grupo-a.yaml")
    db_session.add(rol)
    db_session.commit()
    return rol


@pytest.fixture()
def usuario_google(db_session):
    """Cuenta que ya entró por Google alguna vez: sin contraseña, con provider_subject."""
    usuario = Usuario(
        email="docente@esseri.edu.ar",
        password_hash=None,
        auth_provider="google",
        provider_subject="google-sub-docente",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture()
def usuario_local(db_session):
    """Cuenta creada por el bootstrap: contraseña, todavía sin vincular a Google."""
    usuario = Usuario(
        email="admin@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        provider_subject=None,
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture()
def usuario_inactivo(db_session):
    usuario = Usuario(
        email="baja@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="google",
        provider_subject="google-sub-baja",
        estado="inactivo",
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture()
def con_rol(db_session, rol_admin):
    def _asignar(usuario):
        db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol_admin.id))
        db_session.commit()
        return usuario

    return _asignar


@pytest.fixture()
def google_responde(monkeypatch):
    """Reemplaza la ida a Google por una identidad fija. El resto del flujo corre de verdad."""

    def _configurar(email, subject, email_verified=True):
        identidad = GoogleIdentity(subject=subject, email=email, email_verified=email_verified)
        monkeypatch.setattr(
            "src.auth.router.google_client.exchange_code",
            lambda code, verifier: "id-token-de-prueba",
        )
        monkeypatch.setattr(
            "src.auth.router.google_client.verify_id_token",
            lambda raw: identidad,
        )
        return identidad

    return _configurar


@pytest.fixture()
def permiso_factory(db_session):
    def _crear(modulo, accion, tipo_informacion=None):
        permiso = Permiso(modulo=modulo, accion=accion, tipo_informacion=tipo_informacion)
        db_session.add(permiso)
        db_session.commit()
        return permiso

    return _crear


@pytest.fixture()
def rol_con_permisos(db_session, permiso_factory):
    def _crear(nombre, permisos):
        """`permisos`: lista de tuplas (modulo, accion) o (modulo, accion, tipo_informacion)."""
        rol = Rol(nombre=nombre)
        db_session.add(rol)
        db_session.commit()
        for datos in permisos:
            permiso = permiso_factory(*datos)
            db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
        db_session.commit()
        return rol

    return _crear


@pytest.fixture()
def client_admin(client, db_session, rol_con_permisos, usuario_local):
    """Cliente logueado con un rol que tiene el CRUD completo de Autenticación."""
    rol = rol_con_permisos(
        "admin de prueba",
        [
            (MODULO_AUTENTICACION, ACCION_CREAR),
            (MODULO_AUTENTICACION, ACCION_LEER),
            (MODULO_AUTENTICACION, ACCION_ACTUALIZAR),
            (MODULO_AUTENTICACION, ACCION_ELIMINAR),
        ],
    )
    db_session.add(UsuarioRol(usuario_id=usuario_local.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario_local.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


@pytest.fixture()
def iniciar_flujo_google(client):
    """Hace el GET /auth/google/login y devuelve el `state` que quedó en la cookie."""
    from urllib.parse import parse_qs, urlparse

    def _iniciar():
        respuesta = client.get("/auth/google/login", follow_redirects=False)
        assert respuesta.status_code in (302, 307)
        destino = urlparse(respuesta.headers["location"])
        return parse_qs(destino.query)["state"][0]

    return _iniciar
