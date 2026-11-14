from datetime import date

import pytest

from src.academico import solicitud_periodo_service
from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.solicitud_periodo_service import (
    cancelar_solicitud_periodo,
    crear_solicitud_periodo,
    resolver_solicitud_periodo,
    revocar_solicitud_periodo,
)
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno
from src.models import Persona

RUTA_BANDEJA = "/academico/solicitudes-ausencia"


@pytest.fixture(autouse=True)
def fijar_dia_operativo(monkeypatch):
    """Los tests usan 2027 como año futuro: se fija el día operativo en ese ciclo."""
    monkeypatch.setattr(
        solicitud_periodo_service, "fecha_operativa_argentina", lambda: date(2027, 1, 1)
    )


@pytest.fixture()
def solicitudes(db_session, escenario_dos_familias):
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    db_session.add(motivo)
    db_session.commit()
    ids = escenario_dos_familias
    usuario_a = db_session.get(Usuario, ids["usuario_a"])
    usuario_b = db_session.get(Usuario, ids["usuario_otro"])
    crear_solicitud_periodo(
        db_session,
        usuario_a,
        ids["alumno_a"],
        date(2027, 3, 1),
        date(2027, 3, 5),
        "enfermedad",
        "reposo",
    )
    crear_solicitud_periodo(
        db_session,
        usuario_b,
        ids["alumno_b"],
        date(2027, 4, 1),
        date(2027, 4, 1),
        "enfermedad",
        None,
    )
    return ids


def test_bandeja_lista_y_resume(client_secretaria, solicitudes):
    respuesta = client_secretaria.get(RUTA_BANDEJA)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 2
    assert cuerpo["resumen"]["pendientes"] == 2
    assert cuerpo["resumen"]["total"] == 2
    assert len(cuerpo["items"]) == 2
    assert {item["estado"] for item in cuerpo["items"]} == {"pendiente"}


def test_bandeja_filtra_por_alumno(client_secretaria, solicitudes):
    respuesta = client_secretaria.get(
        RUTA_BANDEJA, params={"alumno_id": str(solicitudes["alumno_a"])}
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["alumno_id"] == str(solicitudes["alumno_a"])


def test_bandeja_filtra_por_nombre(client_secretaria, db_session, solicitudes):
    alumno = db_session.get(Alumno, solicitudes["alumno_a"])
    persona = db_session.get(Persona, alumno.persona_id)

    respuesta = client_secretaria.get(RUTA_BANDEJA, params={"busqueda": persona.nombre})

    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_bandeja_filtra_por_solapamiento_de_fechas(client_secretaria, solicitudes):
    respuesta = client_secretaria.get(
        RUTA_BANDEJA,
        params={"fecha_desde": "2027-03-05", "fecha_hasta": "2027-03-06"},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_bandeja_refleja_cancelacion(client_secretaria, db_session, solicitudes):
    solicitud = (
        db_session.query(SolicitudAusenciaPeriodo)
        .filter_by(alumno_id=solicitudes["alumno_a"])
        .one()
    )
    cancelar_solicitud_periodo(db_session, solicitudes["usuario_a_obj"], solicitud.id)

    respuesta = client_secretaria.get(RUTA_BANDEJA, params={"estado": "cancelada"})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["resumen"]["canceladas"] == 1


def test_bandeja_pagina(client_secretaria, solicitudes):
    respuesta = client_secretaria.get(RUTA_BANDEJA, params={"tamanio_pagina": 1, "pagina": 1})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 2
    assert cuerpo["total_paginas"] == 2
    assert len(cuerpo["items"]) == 1


def test_bandeja_filtra_y_resume_revocadas(client_secretaria, db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="revocada-tray", activo=True)
    admin = Usuario(
        email="admin-revocada-tray@example.test",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([motivo, admin])
    db_session.commit()
    usuario = db_session.get(Usuario, ids["usuario_a"])
    solicitud = crear_solicitud_periodo(
        db_session,
        usuario,
        ids["alumno_a"],
        date(2027, 11, 1),
        date(2027, 11, 1),
        "revocada-tray",
        None,
    )
    resolver_solicitud_periodo(db_session, admin, solicitud.id, True, None)
    revocar_solicitud_periodo(db_session, admin, solicitud.id, "Error", False)

    respuesta = client_secretaria.get(RUTA_BANDEJA, params={"estado": "revocada"})

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["resumen"]["revocadas"] == 1
    assert cuerpo["items"][0]["estado"] == "revocada"


def test_docente_sin_permiso_no_accede_a_la_bandeja(client_docente, solicitudes):
    respuesta = client_docente.get(RUTA_BANDEJA)

    assert respuesta.status_code == 403
