"""Fixtures compartidas para tests del módulo Inscripciones."""

import pytest

from src.auth import sesion_service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_EXPORTAR,
    ACCION_LEER,
    MODULO_INSCRIPCIONES,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.workflows.models import CampoEvento, TipoEvento

PASSWORD_VALIDA = "una-contrasenia-larga"


def crear_catalogo_evento_cambio_matricula(db_session) -> TipoEvento:
    """Replica el catálogo de producción requerido por un cambio de matrícula."""
    tipo = TipoEvento(nombre="inscripcion.cambio_matricula", descripcion="Cambio de matrícula")
    db_session.add(tipo)
    db_session.flush()
    db_session.add_all(
        [
            CampoEvento(
                nombre_interno=nombre,
                etiqueta=etiqueta,
                tipo_dato=tipo_dato,
                tipo_evento_id=tipo.id,
            )
            for nombre, etiqueta, tipo_dato in (
                ("alumno_nombre", "Nombre del alumno", "texto"),
                ("tipo_cambio", "Tipo de cambio", "texto"),
                ("fecha", "Fecha del cambio", "fecha"),
            )
        ]
    )
    return tipo


@pytest.fixture()
def client(client, db_session):
    """Sobreescribe el `client` de la raíz: con RF-30, todos los endpoints de Inscripciones
    pasan a exigir sesión (antes eran públicos), así que el fixture ya viene logueado."""
    usuario = Usuario(
        email="secretaria-inscripciones@esseri.edu.ar",
        password_hash=sesion_service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.commit()

    rol = Rol(nombre="secretaría de prueba")
    db_session.add(rol)
    db_session.commit()

    for accion in (ACCION_CREAR, ACCION_LEER, ACCION_ACTUALIZAR, ACCION_EXPORTAR):
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
