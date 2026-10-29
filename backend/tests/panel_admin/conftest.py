"""Clientes autenticados con los permisos que el Panel de Dirección necesita para el feed."""

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_LEER,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_PANEL_ADMIN,
    MODULO_PROVEEDORES_COMPRAS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "Secreta123!"


def _crear_cliente(client, db_session, *, email: str, modulos: list[str]):
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre=f"rol de prueba {email}")
    db_session.add_all([usuario, rol])
    db_session.flush()

    for modulo in modulos:
        permiso = Permiso(modulo=modulo, accion=ACCION_LEER)
        db_session.add(permiso)
        db_session.flush()
        db_session.add(RolPermiso(rol_id=rol.id, permiso_id=permiso.id))
    db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db_session.commit()

    respuesta = client.post("/auth/login", json={"email": email, "password": PASSWORD_VALIDA})
    assert respuesta.status_code == 200
    return client


@pytest.fixture()
def client_direccion(client, db_session):
    """Mismos módulos que el rol `dirección` del seed, para el feed completo."""
    return _crear_cliente(
        client,
        db_session,
        email="direccion-panel@esseri.edu.ar",
        modulos=[
            MODULO_PANEL_ADMIN,
            MODULO_FACTURACION,
            MODULO_FAMILIAS_ALUMNOS,
            MODULO_PROVEEDORES_COMPRAS,
        ],
    )


@pytest.fixture()
def client_solo_compras(client, db_session):
    """Puede ver el panel y compras, pero no facturación ni alumnado."""
    return _crear_cliente(
        client,
        db_session,
        email="compras-panel@esseri.edu.ar",
        modulos=[MODULO_PANEL_ADMIN, MODULO_PROVEEDORES_COMPRAS],
    )


@pytest.fixture()
def client_sin_modulos(client, db_session):
    """Solo puede abrir el panel: ninguna categoría del feed queda habilitada."""
    return _crear_cliente(
        client,
        db_session,
        email="panel-solo@esseri.edu.ar",
        modulos=[MODULO_PANEL_ADMIN],
    )
