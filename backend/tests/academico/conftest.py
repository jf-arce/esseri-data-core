"""Fixtures de autenticación para Académico."""

import pytest

from src.auth import service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_LEER,
    MODULO_ACADEMICO,
    MODULO_INSCRIPCIONES,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_docente(client, db_session):
    """Cliente autenticado con el mismo permiso que el rol `docente` de grupo-b.yaml:
    Académico (leer, actualizar) + Inscripciones (leer) -- nunca `crear`."""
    usuario = Usuario(
        email="docente@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre="docente de prueba")
    db_session.add_all([usuario, rol])
    db_session.flush()

    permisos = [
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_LEER),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR),
        Permiso(modulo=MODULO_INSCRIPCIONES, accion=ACCION_LEER),
    ]
    db_session.add_all(permisos)
    db_session.flush()
    for permiso in permisos:
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client
