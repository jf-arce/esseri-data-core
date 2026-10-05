"""Fixtures compartidas para tests del módulo Proveedores y Compras."""

from pathlib import Path

import pytest
import yaml

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_ELIMINAR,
    ACCION_EXPORTAR,
    ACCION_LEER,
    MODULO_PROVEEDORES_COMPRAS,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.workflows.models import CampoEvento, TipoEvento

PASSWORD_VALIDA = "una-contrasenia-larga"

SEEDS = Path(__file__).resolve().parents[3] / "database" / "seeds"
EVENTOS_COMPRAS = ("orden_compra.emitida", "recepcion_compra.registrada")


@pytest.fixture(autouse=True)
def catalogo_eventos_compras(db_session):
    """Carga los tipos de evento que emite el módulo, con sus campos.

    Es `autouse` porque emitir una orden o registrar una recepción llama a `emit_event()`, que
    falla si el tipo no está en `TIPO_EVENTO`. Se lee de los seeds reales en vez de repetirlos
    acá: así los tests comparan el payload contra el mismo catálogo que se carga en la base.
    """
    descripciones = {
        item["nombre"]: item.get("descripcion")
        for item in yaml.safe_load((SEEDS / "grupo-a.yaml").read_text(encoding="utf-8"))[
            "tipo_evento"
        ]
    }
    campos = yaml.safe_load((SEEDS / "grupo-b.yaml").read_text(encoding="utf-8"))["campo_evento"]
    for nombre in EVENTOS_COMPRAS:
        tipo = TipoEvento(nombre=nombre, descripcion=descripciones[nombre])
        db_session.add(tipo)
        db_session.flush()
        db_session.add_all(CampoEvento(tipo_evento_id=tipo.id, **campo) for campo in campos[nombre])
    db_session.commit()


@pytest.fixture()
def client_autenticado(client, db_session):
    """Cliente de test ya logueado, con el CRUD de Proveedores y Compras (RF-27 + RF-30)."""
    usuario = Usuario(
        email="compras@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()

    rol = Rol(nombre="compras de prueba")
    db_session.add(rol)
    db_session.commit()

    for accion in (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR, ACCION_ELIMINAR, ACCION_EXPORTAR):
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
