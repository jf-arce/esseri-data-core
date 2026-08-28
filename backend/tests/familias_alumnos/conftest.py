"""Fixtures compartidas para tests del módulo Familias y Alumnos."""

import pytest

from src.auth import service
from src.auth.models import Usuario

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_autenticado(client, db_session):
    """Cliente de test ya logueado: los endpoints de ABM de Familia exigen sesión (RF-27)."""
    usuario = Usuario(
        email="staff@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()

    respuesta = client.post(
        "/auth/login", json={"email": usuario.email, "password": PASSWORD_VALIDA}
    )
    assert respuesta.status_code == 200
    return client
