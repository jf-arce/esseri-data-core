"""Permiso institucional para la bandeja y resolución de justificaciones.

Las rutas de la bandeja no pueden depender de ``academico.leer``: ese permiso también
lo tienen familia y docente para sus propios flujos de asistencia.
"""

import uuid

from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO
from src.auth.models import Permiso, Rol, RolPermiso, UsuarioRol
from tests.familias_alumnos.test_mis_alumnos import _crear_familia_con_alumno, login

ID_INEXISTENTE = uuid.UUID("00000000-0000-0000-0000-000000000000")


def _verificar_acceso_institucional(client):
    """Una respuesta distinta de 403 confirma que pasó el guard del permiso específico."""
    assert client.get("/academico/justificaciones").status_code == 200
    assert (
        client.patch(
            f"/academico/justificaciones/{ID_INEXISTENTE}/resolver",
            json={"aprobar": True},
        ).status_code
        == 404
    )
    assert client.get(f"/academico/justificaciones/{ID_INEXISTENTE}/archivo").status_code == 404


def test_secretaria_puede_ver_resolver_y_descargar_justificaciones(client_secretaria):
    _verificar_acceso_institucional(client_secretaria)


def test_direccion_puede_ver_resolver_y_descargar_justificaciones(client_direccion):
    _verificar_acceso_institucional(client_direccion)


def test_docente_no_puede_acceder_a_la_bandeja_ni_a_sus_operaciones(client_docente):
    assert client_docente.get("/academico/justificaciones").status_code == 403
    assert (
        client_docente.patch(
            f"/academico/justificaciones/{ID_INEXISTENTE}/resolver",
            json={"aprobar": True},
        ).status_code
        == 403
    )
    assert (
        client_docente.get(f"/academico/justificaciones/{ID_INEXISTENTE}/archivo").status_code
        == 403
    )


def test_familia_no_puede_acceder_a_la_bandeja_institucional(client, db_session):
    usuario, _ = _crear_familia_con_alumno(db_session)
    rol = Rol(nombre="familia de prueba")
    permiso_lectura = Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_LEER)
    db_session.add_all([rol, permiso_lectura])
    db_session.flush()
    db_session.add_all(
        [
            RolPermiso(rol_id=rol.id, permiso_id=permiso_lectura.id),
            UsuarioRol(usuario_id=usuario.id, rol_id=rol.id),
        ]
    )
    db_session.commit()
    assert login(client, usuario).status_code == 200

    assert client.get("/academico/justificaciones").status_code == 403
    assert (
        client.patch(
            f"/academico/justificaciones/{ID_INEXISTENTE}/resolver",
            json={"aprobar": True},
        ).status_code
        == 403
    )
    assert client.get(f"/academico/justificaciones/{ID_INEXISTENTE}/archivo").status_code == 403
