import uuid
from datetime import date

import pytest

from src.academico.models import MotivoJustificacion
from src.academico.solicitud_periodo_service import crear_solicitud_periodo
from src.auth.models import Usuario
from src.inscripciones.models import Asistencia


@pytest.fixture()
def solicitud(db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    db_session.add(motivo)
    db_session.add(
        Asistencia(
            inscripcion_id=ids["inscripcion_a"],
            fecha=date(2027, 3, 1),
            tipo="ausente_pendiente",
        )
    )
    db_session.commit()
    usuario_a = db_session.get(Usuario, ids["usuario_a"])
    creada = crear_solicitud_periodo(
        db_session,
        usuario_a,
        ids["alumno_a"],
        date(2027, 3, 1),
        date(2027, 3, 1),
        "enfermedad",
        None,
    )
    return creada, ids


def test_aprobar_solicitud_desde_la_bandeja(client_secretaria, db_session, solicitud):
    creada, ids = solicitud

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/resolver",
        json={"aprobar": True},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "aprobada"
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id == creada.id


def test_rechazar_sin_observacion_devuelve_422(client_secretaria, solicitud):
    creada, _ = solicitud

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/resolver",
        json={"aprobar": False},
    )

    assert respuesta.status_code == 422


def test_rechazar_con_observacion_no_modifica_asistencia(client_secretaria, db_session, solicitud):
    creada, ids = solicitud

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/resolver",
        json={"aprobar": False, "observacion": "No corresponde"},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "rechazada"
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )
    assert asistencia.tipo == "ausente_pendiente"


def test_docente_no_puede_resolver(client_docente, solicitud):
    creada, _ = solicitud

    respuesta = client_docente.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/resolver",
        json={"aprobar": True},
    )

    assert respuesta.status_code == 403


def test_solicitud_inexistente_devuelve_404(client_secretaria):
    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{uuid.uuid4()}/resolver",
        json={"aprobar": True},
    )

    assert respuesta.status_code == 404
