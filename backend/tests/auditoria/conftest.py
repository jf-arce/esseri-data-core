"""Fixtures de autenticación para Auditoría."""

import pytest

from src.auth import service
from src.auth.constants import ACCION_LEER, MODULO_AUDITORIA
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_autenticado(client, db_session):
    usuario = Usuario(
        email="auditoria@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre="auditoria de prueba")
    db_session.add_all([usuario, rol])
    db_session.flush()

    permiso = Permiso(modulo=MODULO_AUDITORIA, accion=ACCION_LEER)
    db_session.add(permiso)
    db_session.flush()
    db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client
