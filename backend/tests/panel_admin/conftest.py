"""Clientes autenticados con los permisos que el Panel de Dirección necesita para el feed."""

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_LEER,
    MODULO_FACTURACION,
    MODULO_FAMILIAS_ALUMNOS,
    MODULO_INSCRIPCIONES,
    MODULO_PANEL_ADMIN,
    MODULO_PROVEEDORES_COMPRAS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol

PASSWORD_VALIDA = "Secreta123!"


def _crear_cliente(client, db_session, *, email: str, codigo: str, modulos: list[str]):
    usuario = Usuario(
        email=email,
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre=f"rol de prueba {email}", codigo=codigo)
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
        codigo="direccion",
        modulos=[
            MODULO_PANEL_ADMIN,
            MODULO_FACTURACION,
            MODULO_FAMILIAS_ALUMNOS,
            MODULO_PROVEEDORES_COMPRAS,
        ],
    )


@pytest.fixture()
def client_solo_compras(client, db_session):
    """Dirección sin facturación ni alumnado: solo compras habilitadas en el feed."""
    return _crear_cliente(
        client,
        db_session,
        email="compras-panel@esseri.edu.ar",
        codigo="direccion",
        modulos=[MODULO_PANEL_ADMIN, MODULO_PROVEEDORES_COMPRAS],
    )


@pytest.fixture()
def client_sin_modulos(client, db_session):
    """Dirección con solo el panel: ninguna categoría del feed queda habilitada."""
    return _crear_cliente(
        client,
        db_session,
        email="panel-solo@esseri.edu.ar",
        codigo="direccion",
        modulos=[MODULO_PANEL_ADMIN],
    )


@pytest.fixture()
def client_administracion(client, db_session):
    """Rol de Administración: panel, facturación, compras, legajos e inscripciones."""
    return _crear_cliente(
        client,
        db_session,
        email="administracion-panel@esseri.edu.ar",
        codigo="administracion",
        modulos=[
            MODULO_PANEL_ADMIN,
            MODULO_FACTURACION,
            MODULO_PROVEEDORES_COMPRAS,
            MODULO_FAMILIAS_ALUMNOS,
            MODULO_INSCRIPCIONES,
        ],
    )


@pytest.fixture()
def client_administracion_sin_modulos(client, db_session):
    """Administración con el panel pero sin Facturación ni Compras."""
    return _crear_cliente(
        client,
        db_session,
        email="administracion-sin-modulos@esseri.edu.ar",
        codigo="administracion",
        modulos=[MODULO_PANEL_ADMIN],
    )


@pytest.fixture()
def client_administrador_sistema(client, db_session):
    """Rol técnico: entra a los dos paneles."""
    return _crear_cliente(
        client,
        db_session,
        email="sistema-panel@esseri.edu.ar",
        codigo="administrador_del_sistema",
        modulos=[
            MODULO_PANEL_ADMIN,
            MODULO_FACTURACION,
            MODULO_PROVEEDORES_COMPRAS,
        ],
    )
