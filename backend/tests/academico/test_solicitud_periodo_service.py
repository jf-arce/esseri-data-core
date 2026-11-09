from datetime import date

import pytest
from fastapi import HTTPException

from src.academico.models import (
    JustificacionInasistencia,
    MotivoJustificacion,
    SolicitudAusenciaPeriodo,
)
from src.academico.solicitud_periodo_service import (
    cancelar_solicitud_periodo,
    crear_solicitud_periodo,
)
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
from src.familias_alumnos.models import Familia
from src.inscripciones.models import Asistencia
from src.models import AuditLog
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


@pytest.fixture
def contexto(db_session):
    escenario = crear_escenario(db_session)
    familia = db_session.get(Familia, escenario["familia_id"])
    usuario = Usuario(
        email="family-period@example.test",
        auth_provider="local",
        estado="activo",
        persona_id=familia.persona_id,
    )
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    db_session.add_all([usuario, motivo])
    db_session.commit()
    return usuario, escenario


def test_creates_single_day_period_and_audits_without_attendance(db_session, contexto):
    usuario, escenario = contexto
    alumno_id = escenario["alumno_id"]
    solicitud = crear_solicitud_periodo(
        db_session, usuario, alumno_id, date(2027, 3, 1), date(2027, 3, 1), "enfermedad", None
    )
    assert solicitud.fecha_inicio == solicitud.fecha_fin == date(2027, 3, 1)
    assert solicitud.estado == "pendiente"
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 1
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO", entidad_id=solicitud.id, usuario_id=usuario.id
        )
        .count()
        == 1
    )


def test_rejects_overlapping_active_period_without_partial_write(db_session, contexto):
    usuario, escenario = contexto
    alumno_id = escenario["alumno_id"]
    crear_solicitud_periodo(
        db_session, usuario, alumno_id, date(2027, 3, 1), date(2027, 3, 5), "enfermedad", None
    )
    with pytest.raises(HTTPException) as error:
        crear_solicitud_periodo(
            db_session, usuario, alumno_id, date(2027, 3, 5), date(2027, 3, 7), "enfermedad", None
        )
    assert error.value.status_code == 409
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 1


def test_rejects_unrelated_family(db_session, contexto):
    _, escenario = contexto
    alumno_id = escenario["alumno_id"]
    unrelated = Usuario(email="other@example.test", auth_provider="local", estado="activo")
    db_session.add(unrelated)
    db_session.commit()
    with pytest.raises(PermisoDenegado):
        crear_solicitud_periodo(
            db_session, unrelated, alumno_id, date(2027, 3, 1), date(2027, 3, 1), "enfermedad", None
        )
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


def test_rejects_inverted_range_without_writes(db_session, contexto):
    usuario, escenario = contexto
    alumno_id = escenario["alumno_id"]
    with pytest.raises(HTTPException) as error:
        crear_solicitud_periodo(
            db_session, usuario, alumno_id, date(2027, 3, 2), date(2027, 3, 1), "enfermedad", None
        )
    assert error.value.status_code == 422
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


@pytest.mark.parametrize(
    "estado,conflicts", [("pendiente", True), ("aprobada", False), ("rechazada", False)]
)
def test_legacy_pending_conflicts_but_resolved_decisions_are_preserved(
    db_session, contexto, estado, conflicts
):
    usuario, escenario = contexto
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    asistencia = Asistencia(
        inscripcion_id=inscripcion.id, fecha=date(2027, 3, 3), tipo="ausente_pendiente"
    )
    motivo = db_session.query(MotivoJustificacion).filter_by(nombre="enfermedad").one()
    db_session.add(asistencia)
    db_session.flush()
    anterior = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=escenario["familia_id"],
        motivo_justificacion_id=motivo.id,
        usuario_id=usuario.id,
        estado=estado,
    )
    db_session.add(anterior)
    db_session.commit()
    if conflicts:
        with pytest.raises(HTTPException) as error:
            crear_solicitud_periodo(
                db_session,
                usuario,
                escenario["alumno_id"],
                date(2027, 3, 1),
                date(2027, 3, 5),
                "enfermedad",
                None,
            )
        assert error.value.status_code == 409
        assert error.value.detail["id"] == str(anterior.id)
        assert db_session.query(SolicitudAusenciaPeriodo).count() == 0
    else:
        crear_solicitud_periodo(
            db_session,
            usuario,
            escenario["alumno_id"],
            date(2027, 3, 1),
            date(2027, 3, 5),
            "enfermedad",
            None,
        )
        assert db_session.query(SolicitudAusenciaPeriodo).count() == 1
    assert anterior.estado == estado


def test_validates_and_keeps_attachment(db_session, contexto):
    usuario, escenario = contexto
    data = b"%PDF-test"
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario,
        escenario["alumno_id"],
        date(2027, 3, 1),
        date(2027, 3, 1),
        "enfermedad",
        None,
        "proof.pdf",
        "application/pdf",
        data,
    )
    assert (solicitud.archivo_nombre, solicitud.archivo_tipo, solicitud.archivo_contenido) == (
        "proof.pdf",
        "application/pdf",
        data,
    )


def test_rejects_missing_actor_without_writes(db_session, contexto):
    _, escenario = contexto
    with pytest.raises(PermisoDenegado):
        crear_solicitud_periodo(
            db_session,
            None,
            escenario["alumno_id"],
            date(2027, 3, 1),
            date(2027, 3, 1),
            "enfermedad",
            None,
        )
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0


@pytest.mark.parametrize(
    "estado,blocks", [("aprobada", True), ("rechazada", False), ("cancelada", False)]
)
def test_period_conflict_depends_on_state(db_session, contexto, estado, blocks):
    usuario, escenario = contexto
    existing = crear_solicitud_periodo(
        db_session,
        usuario,
        escenario["alumno_id"],
        date(2027, 4, 1),
        date(2027, 4, 5),
        "enfermedad",
        None,
    )
    existing.estado = estado
    db_session.commit()
    if blocks:
        with pytest.raises(HTTPException) as error:
            crear_solicitud_periodo(
                db_session,
                usuario,
                escenario["alumno_id"],
                date(2027, 4, 5),
                date(2027, 4, 6),
                "enfermedad",
                None,
            )
        assert error.value.status_code == 409
        assert error.value.detail["id"] == str(existing.id)
    else:
        crear_solicitud_periodo(
            db_session,
            usuario,
            escenario["alumno_id"],
            date(2027, 4, 5),
            date(2027, 4, 6),
            "enfermedad",
            None,
        )
    assert db_session.query(SolicitudAusenciaPeriodo).count() == (1 if blocks else 2)


def test_audit_failure_rolls_back_request(db_session, contexto, monkeypatch):
    usuario, escenario = contexto

    def fail(*args, **kwargs):
        raise RuntimeError("audit failed")

    monkeypatch.setattr("src.academico.solicitud_periodo_service.log_audit", fail)
    with pytest.raises(RuntimeError):
        crear_solicitud_periodo(
            db_session,
            usuario,
            escenario["alumno_id"],
            date(2027, 3, 1),
            date(2027, 3, 1),
            "enfermedad",
            None,
        )
    db_session.rollback()
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0
    assert db_session.query(AuditLog).filter_by(entidad="SOLICITUD_AUSENCIA_PERIODO").count() == 0


def test_family_cancels_only_pending_request_with_audit(db_session, contexto):
    usuario, escenario = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario,
        escenario["alumno_id"],
        date(2027, 3, 1),
        date(2027, 3, 1),
        "enfermedad",
        None,
    )
    result = cancelar_solicitud_periodo(db_session, usuario, solicitud.id)
    assert result.estado == "cancelada"
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_anterior="pendiente",
            valor_nuevo="cancelada",
            usuario_id=usuario.id,
        )
        .count()
        == 1
    )
    with pytest.raises(HTTPException) as error:
        cancelar_solicitud_periodo(db_session, usuario, solicitud.id)
    assert error.value.status_code == 409


def test_other_family_cannot_cancel_request(db_session, contexto):
    usuario, escenario = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario,
        escenario["alumno_id"],
        date(2027, 3, 1),
        date(2027, 3, 1),
        "enfermedad",
        None,
    )
    unrelated = Usuario(email="cancel-other@example.test", auth_provider="local", estado="activo")
    db_session.add(unrelated)
    db_session.commit()
    with pytest.raises(PermisoDenegado):
        cancelar_solicitud_periodo(db_session, unrelated, solicitud.id)
    assert solicitud.estado == "pendiente"
