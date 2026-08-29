"""Fixtures compartidas para tests del módulo Proveedores y Compras."""

import pytest

from src.auth import service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_LEER,
    MODULO_PROVEEDORES_COMPRAS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def client_autenticado(client, db_session):
    """Cliente de test ya logueado, con el CRUD de Proveedores y Compras (RF-27 + RF-30)."""
    usuario = Usuario(
        email="compras@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()

    rol = Rol(nombre="compras de prueba")
    db_session.add(rol)
    db_session.commit()

    for accion in (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR, ACCION_ELIMINAR):
        permiso = Permiso(modulo=MODULO_PROVEEDORES_COMPRAS, accion=accion)
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
