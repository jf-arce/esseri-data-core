import uuid
from datetime import date

import pytest

from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.solicitud_periodo_service import (
    crear_solicitud_periodo,
    resolver_solicitud_periodo,
)
from src.auth.models import Usuario
from src.inscripciones.models import Asistencia
from src.models import EventLog
from src.workflows.models import TipoEvento


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


def _crear_solicitud_aprobada(db_session, ids, fecha):
    motivo = MotivoJustificacion(nombre=f"enfermedad-{fecha.isoformat()}", activo=True)
    admin = Usuario(
        email=f"admin-{fecha.isoformat()}@example.test",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([motivo, admin])
    db_session.commit()
    usuario_a = db_session.get(Usuario, ids["usuario_a"])
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario_a,
        ids["alumno_a"],
        fecha,
        fecha,
        motivo.nombre,
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)
    return solicitud


def _aprobar(client, solicitud):
    return client.patch(
        f"/academico/solicitudes-ausencia/{solicitud.id}/resolver",
        json={"aprobar": True},
    )


def test_revocar_solicitud_aprobada(client_secretaria, db_session, solicitud):
    creada, ids = solicitud
    assert _aprobar(client_secretaria, creada).status_code == 200

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/revocar",
        json={"motivo": "Error administrativo"},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "revocada"
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )
    assert asistencia.tipo == "ausente_pendiente"
    assert asistencia.solicitud_ausencia_periodo_id is None


def test_revocar_con_notificacion_emite_evento(client_secretaria, db_session, solicitud):
    db_session.add(
        TipoEvento(
            nombre="solicitud_ausencia_periodo.revocada",
            descripcion="Se revocó una solicitud de ausencia por período",
        )
    )
    db_session.commit()
    creada, _ = solicitud
    assert _aprobar(client_secretaria, creada).status_code == 200

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/revocar",
        json={"motivo": "Error administrativo", "notificar_familia": True},
    )

    assert respuesta.status_code == 200
    assert (
        db_session.query(EventLog)
        .filter_by(
            entidad="solicitud_ausencia_periodo",
            entidad_id=creada.id,
        )
        .count()
        == 1
    )


def test_revocar_sin_motivo_devuelve_422(client_secretaria, solicitud):
    creada, _ = solicitud
    assert _aprobar(client_secretaria, creada).status_code == 200

    respuesta = client_secretaria.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/revocar",
        json={"motivo": ""},
    )

    assert respuesta.status_code == 422


def test_docente_no_puede_revocar(client_docente, solicitud):
    creada, _ = solicitud

    respuesta = client_docente.patch(
        f"/academico/solicitudes-ausencia/{creada.id}/revocar",
        json={"motivo": "No autorizado"},
    )

    assert respuesta.status_code == 403


def test_rectificar_asistencia_aplicada(client_secretaria, db_session, solicitud):
    creada, ids = solicitud
    assert _aprobar(client_secretaria, creada).status_code == 200
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )

    respuesta = client_secretaria.patch(
        f"/academico/asistencias/{asistencia.id}/rectificar",
        json={"tipo": "presente", "motivo": "Corrección administrativa"},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["tipo"] == "presente"
    db_session.refresh(asistencia)
    assert asistencia.solicitud_ausencia_periodo_id is None
    assert db_session.get(SolicitudAusenciaPeriodo, creada.id).estado == "aprobada"


def test_rectificar_no_admite_ausente_pendiente(client_secretaria, db_session, solicitud):
    creada, ids = solicitud
    assert _aprobar(client_secretaria, creada).status_code == 200
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )

    respuesta = client_secretaria.patch(
        f"/academico/asistencias/{asistencia.id}/rectificar",
        json={"tipo": "ausente_pendiente", "motivo": "No permitido"},
    )

    assert respuesta.status_code == 422


def test_docente_no_puede_rectificar(client_docente, db_session, solicitud):
    creada, ids = solicitud
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 3, 1))
        .one()
    )

    respuesta = client_docente.patch(
        f"/academico/asistencias/{asistencia.id}/rectificar",
        json={"tipo": "presente", "motivo": "No autorizado"},
    )

    assert respuesta.status_code == 403


def test_registrar_asistencia_aplica_cobertura_y_conserva_evento(
    client_secretaria,
    db_session,
    escenario_dos_familias,
    tipo_inasistencia_registrada,
):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="enfermedad-auto", activo=True)
    admin = Usuario(email="admin-auto@example.test", auth_provider="local", estado="activo")
    db_session.add_all([motivo, admin])
    db_session.commit()
    usuario_a = db_session.get(Usuario, ids["usuario_a"])
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario_a,
        ids["alumno_a"],
        date(2027, 8, 1),
        date(2027, 8, 1),
        "enfermedad-auto",
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)

    respuesta = client_secretaria.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(ids["inscripcion_a"]),
            "fecha": "2027-08-01",
            "tipo": "ausente",
        },
    )

    assert respuesta.status_code == 201
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 8, 1))
        .one()
    )
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id == solicitud.id
    evento = (
        db_session.query(EventLog).filter_by(entidad="asistencia", entidad_id=asistencia.id).one()
    )
    assert evento.payload["tipo_asistencia"] == "ausente_pendiente"


def test_bulk_aplica_cobertura_de_periodo(
    client_secretaria,
    db_session,
    escenario_dos_familias,
    tipo_inasistencia_registrada,
):
    ids = escenario_dos_familias
    solicitud = _crear_solicitud_aprobada(db_session, ids, date(2027, 9, 1))

    respuesta = client_secretaria.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-09-01",
            "division_id": str(ids["division"]),
            "registros": [{"inscripcion_id": str(ids["inscripcion_a"]), "tipo": "ausente"}],
        },
    )

    assert respuesta.status_code == 200
    asistencia = (
        db_session.query(Asistencia)
        .filter_by(inscripcion_id=ids["inscripcion_a"], fecha=date(2027, 9, 1))
        .one()
    )
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id == solicitud.id


def test_actualizar_asistencia_a_ausente_aplica_cobertura(
    client_secretaria,
    db_session,
    escenario_dos_familias,
    tipo_inasistencia_registrada,
):
    ids = escenario_dos_familias
    solicitud = _crear_solicitud_aprobada(db_session, ids, date(2027, 10, 1))
    asistencia = Asistencia(
        inscripcion_id=ids["inscripcion_a"],
        fecha=date(2027, 10, 1),
        tipo="presente",
    )
    db_session.add(asistencia)
    db_session.commit()

    respuesta = client_secretaria.put(
        f"/academico/asistencias/{asistencia.id}",
        json={"tipo": "ausente"},
    )

    assert respuesta.status_code == 200
    db_session.refresh(asistencia)
    assert asistencia.tipo == "ausente_justificado"
    assert asistencia.solicitud_ausencia_periodo_id == solicitud.id
