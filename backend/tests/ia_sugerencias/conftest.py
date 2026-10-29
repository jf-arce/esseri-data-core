"""Fixtures compartidas para tests del módulo IA/Sugerencias."""

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_LEER,
    MODULO_IA_SUGERENCIAS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


def _crear_usuario_con_permisos(db_session, email: str, acciones: tuple[str, ...]) -> Usuario:
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre=f"rol {email}")
    db_session.add_all([usuario, rol])
    db_session.flush()
    for accion in acciones:
        permiso = Permiso(modulo=MODULO_IA_SUGERENCIAS, accion=accion)
        db_session.add(permiso)
        db_session.flush()
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()
    return usuario


def _login(client, usuario: Usuario):
    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client


@pytest.fixture()
def usuario_revisor(db_session):
    """Usuario con los tres permisos que el seed le da al módulo (crear, leer, actualizar)."""
    return _crear_usuario_con_permisos(
        db_session, "revisor-ia@esseri.edu.ar", (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR)
    )


@pytest.fixture()
def client_autenticado(client, usuario_revisor):
    return _login(client, usuario_revisor)


@pytest.fixture()
def client_solo_lectura(client, db_session):
    usuario = _crear_usuario_con_permisos(db_session, "lector-ia@esseri.edu.ar", (ACCION_LEER,))
    return _login(client, usuario)
