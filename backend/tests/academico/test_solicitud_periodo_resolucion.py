from datetime import date

import pytest
from fastapi import HTTPException

from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.solicitud_periodo_service import (
    crear_solicitud_periodo,
    resolver_solicitud_periodo,
)
from src.auth.models import Usuario
from src.inscripciones.models import Asistencia
from src.models import AuditLog


@pytest.fixture()
def contexto(db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    admin = Usuario(
        email="admin-resolucion@example.test",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([motivo, admin])
    db_session.commit()
    return ids, admin


def _asistencia(ids, fecha, tipo):
    return Asistencia(inscripcion_id=ids["inscripcion_a"], fecha=fecha, tipo=tipo)


def test_aprobar_aplica_solo_ausencias_pendientes_reales(db_session, contexto):
    ids, admin = contexto
    db_session.add_all(
        [
            _asistencia(ids, date(2027, 3, 1), "ausente_pendiente"),
            _asistencia(ids, date(2027, 3, 2), "ausente_pendiente"),
            _asistencia(ids, date(2027, 3, 3), "presente"),
            _asistencia(ids, date(2027, 3, 4), "tardanza"),
            _asistencia(ids, date(2027, 3, 5), "ausente_justificado"),
            _asistencia(ids, date(2027, 3, 6), "ausente_injustificado"),
            _asistencia(ids, date(2027, 3, 7), "ausente_pendiente"),
        ]
    )
    db_session.commit()
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 3, 1),
        date(2027, 3, 5),
        "enfermedad",
        None,
    )
    cantidad_inicial = db_session.query(Asistencia).count()

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=True, observacion=None
    )

    assert resuelta.estado == "aprobada"
    assert resuelta.fecha_resolucion is not None
    assert resuelta.usuario_resolucion_id == admin.id
    assert db_session.query(Asistencia).count() == cantidad_inicial

    tipos = {
        asistencia.fecha: (asistencia.tipo, asistencia.solicitud_ausencia_periodo_id)
        for asistencia in db_session.query(Asistencia).all()
    }
    assert tipos[date(2027, 3, 1)] == ("ausente_justificado", solicitud.id)
    assert tipos[date(2027, 3, 2)] == ("ausente_justificado", solicitud.id)
    assert tipos[date(2027, 3, 3)] == ("presente", None)
    assert tipos[date(2027, 3, 4)] == ("tardanza", None)
    assert tipos[date(2027, 3, 5)] == ("ausente_justificado", None)
    assert tipos[date(2027, 3, 6)] == ("ausente_injustificado", None)
    assert tipos[date(2027, 3, 7)] == ("ausente_pendiente", None)

    aplicaciones = (
        db_session.query(AuditLog)
        .filter_by(entidad="ASISTENCIA", campo="tipo", valor_nuevo="ausente_justificado")
        .count()
    )
    vinculos = (
        db_session.query(AuditLog)
        .filter_by(
            entidad="ASISTENCIA",
            campo="solicitud_ausencia_periodo_id",
            valor_nuevo=str(solicitud.id),
        )
        .count()
    )
    assert aplicaciones == 2
    assert vinculos == 2
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_nuevo="aprobada",
        )
        .count()
        == 1
    )


def test_rechazar_no_modifica_asistencias(db_session, contexto):
    ids, admin = contexto
    db_session.add(_asistencia(ids, date(2027, 4, 1), "ausente_pendiente"))
    db_session.commit()
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 4, 1),
        date(2027, 4, 2),
        "enfermedad",
        None,
    )

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=False, observacion="No corresponde"
    )

    assert resuelta.estado == "rechazada"
    assert resuelta.observacion_resolucion == "No corresponde"
    asistencia = db_session.query(Asistencia).filter_by(fecha=date(2027, 4, 1)).one()
    assert asistencia.tipo == "ausente_pendiente"
    assert asistencia.solicitud_ausencia_periodo_id is None
    assert (
        db_session.query(AuditLog)
        .filter_by(
            entidad="SOLICITUD_AUSENCIA_PERIODO",
            entidad_id=solicitud.id,
            campo="estado",
            valor_nuevo="rechazada",
        )
        .count()
        == 1
    )


def test_no_crea_asistencias_futuras_al_aprobar(db_session, contexto):
    ids, admin = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 5, 1),
        date(2027, 5, 5),
        "enfermedad",
        None,
    )

    resuelta = resolver_solicitud_periodo(
        db_session, admin, solicitud.id, aprobar=True, observacion=None
    )

    assert resuelta.estado == "aprobada"
    assert db_session.query(Asistencia).count() == 0


def test_no_resuelve_dos_veces(db_session, contexto):
    ids, admin = contexto
    solicitud = crear_solicitud_periodo(
        db_session,
        ids["usuario_a_obj"],
        ids["alumno_a"],
        date(2027, 6, 1),
        date(2027, 6, 1),
        "enfermedad",
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)

    with pytest.raises(HTTPException) as error:
        resolver_solicitud_periodo(db_session, admin, solicitud.id, False, "otra")

    assert error.value.status_code == 409
    assert db_session.get(SolicitudAusenciaPeriodo, solicitud.id).estado == "aprobada"
