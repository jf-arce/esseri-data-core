"""Fixtures de autenticación para Académico."""

import uuid

import pytest

from src.academico.models import AsignacionDocente, Division, Docente, Materia
from src.auth import service
from src.auth.constants import (
    ACCION_ACTUALIZAR,
    ACCION_CREAR,
    ACCION_LEER,
    MODULO_ACADEMICO,
    MODULO_INSCRIPCIONES,
)
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.models import Persona

PASSWORD_VALIDA = "una-contrasenia-larga"


@pytest.fixture()
def persona_docente(db_session):
    """La persona detrás de `client_docente`: separada para que un test pueda crear un
    `Docente` + `AsignacionDocente` ligados a ella (ver `asignar_division_a_docente`) y así
    ejercitar el scoping por fila de RF-06 — sin esto, `verificar_acceso_a_division` no
    encuentra ningún `Docente` para la cuenta y la trata como sin restricción."""
    persona = Persona(nombre="Julieta", apellido="Amaya", dni="40222333")
    db_session.add(persona)
    db_session.commit()
    return persona


@pytest.fixture()
def client_docente(client, db_session, persona_docente):
    """Cliente autenticado con el mismo permiso que el rol `docente` de grupo-b.yaml:
    Académico (leer; `actualizar` acotado a `tipo_informacion=asistencia`, nunca el `actualizar`
    sin tipo que pide la estructura curricular) + Inscripciones (leer) -- nunca `crear`."""
    usuario = Usuario(
        email="docente@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
        persona_id=persona_docente.id,
    )
    rol = Rol(nombre="docente de prueba")
    db_session.add_all([usuario, rol])
    db_session.flush()

    permisos = [
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_LEER),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR, tipo_informacion="asistencia"),
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


@pytest.fixture()
def client_secretaria(client, db_session):
    """Cliente autenticado con el mismo permiso que el rol `secretaría` de grupo-b.yaml para
    Académico: CRUD amplio, sin tipo (`crear, leer, actualizar`) — a diferencia de `docente`,
    no está acotado a ninguna división en particular ni al `actualizar` tipado de asistencia."""
    usuario = Usuario(
        # No "secretaria@esseri.edu.ar": ese email ya lo usa el usuario que crea
        # `tests/inscripciones/factories.py::crear_escenario`, y varios tests de este archivo
        # usan las dos fixtures juntas.
        email="secretaria-academico@esseri.edu.ar",
        password_hash=service.hashear_password(PASSWORD_VALIDA),
        auth_provider="local",
        estado="activo",
    )
    rol = Rol(nombre="secretaría de prueba")
    db_session.add_all([usuario, rol])
    db_session.flush()

    permisos = [
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_CREAR),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_LEER),
        Permiso(modulo=MODULO_ACADEMICO, accion=ACCION_ACTUALIZAR),
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


@pytest.fixture()
def asignar_division_a_docente(db_session, persona_docente):
    """Liga la cuenta de `client_docente` a una `AsignacionDocente` vigente para una división,
    simulando que ese docente realmente la tiene a cargo (RF-06: scoping por fila)."""

    def _asignar(division_id: uuid.UUID, *, ciclo_lectivo: str = "2027") -> None:
        docente = db_session.query(Docente).filter_by(persona_id=persona_docente.id).first()
        if docente is None:
            docente = Docente(legajo="D-TEST-001", persona_id=persona_docente.id)
            db_session.add(docente)
            db_session.flush()

        division = db_session.get(Division, division_id)
        materia = Materia(
            nombre="Materia de prueba",
            tipo="materia",
            anio_id=division.anio_id,
        )
        db_session.add(materia)
        db_session.flush()

        db_session.add(
            AsignacionDocente(
                ciclo_lectivo=ciclo_lectivo,
                docente_id=docente.id,
                materia_id=materia.id,
                division_id=division_id,
            )
        )
        db_session.commit()

    return _asignar
