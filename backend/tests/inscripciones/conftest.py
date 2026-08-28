"""Fixtures compartidas para tests del módulo Inscripciones."""

import pytest

from src.auth import service
from src.auth.constants import ACCION_CREAR, ACCION_LEER, MODULO_INSCRIPCIONES
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client(client, db_session):
    """Sobreescribe el `client` de la raíz: con RF-30, todos los endpoints de Inscripciones
    pasan a exigir sesión (antes eran públicos), así que el fixture ya viene logueado."""
    usuario = Usuario(
        email="secretaria-inscripciones@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()

    rol = Rol(nombre="secretaría de prueba")
    db_session.add(rol)
    db_session.commit()

    for accion in (ACCION_CREAR, ACCION_LEER):
        permiso = Permiso(modulo=MODULO_INSCRIPCIONES, accion=accion)
        db_session.add(permiso)
        db_session.commit()
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client
