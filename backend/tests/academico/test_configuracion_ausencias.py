from datetime import date, timedelta

import pytest
from fastapi import HTTPException

from src.academico import solicitud_periodo_service
from src.academico.models import MotivoJustificacion, SolicitudAusenciaPeriodo
from src.academico.solicitud_periodo_service import crear_solicitud_periodo
from src.auth.models import Usuario
from src.config import settings
from src.familias_alumnos.models import Familia
from tests.inscripciones.factories import crear_escenario

RUTA_CONFIGURACION = "/academico/familia/configuracion-ausencias"


@pytest.fixture
def contexto(db_session):
    escenario = crear_escenario(db_session)
    familia = db_session.get(Familia, escenario["familia_id"])
    usuario = Usuario(
        email="family-config@example.test",
        auth_provider="local",
        estado="activo",
        persona_id=familia.persona_id,
    )
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    db_session.add_all([usuario, motivo])
    db_session.commit()
    return usuario, escenario


def test_configuracion_ausencias_expone_el_limite_configurado(client_familia, monkeypatch):
    monkeypatch.setattr(settings, "ACADEMICO_DIAS_LIMITE_JUSTIFICACION", 12)

    respuesta = client_familia.get(RUTA_CONFIGURACION)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"dias_limite_justificacion": 12}


def test_limite_de_justificacion_usa_la_configuracion(db_session, contexto, monkeypatch):
    usuario, escenario = contexto
    hoy = date(2026, 11, 15)
    monkeypatch.setattr(solicitud_periodo_service, "fecha_operativa_argentina", lambda: hoy)
    monkeypatch.setattr(settings, "ACADEMICO_DIAS_LIMITE_JUSTIFICACION", 10)

    with pytest.raises(HTTPException) as error:
        crear_solicitud_periodo(
            db_session,
            usuario,
            escenario["alumno_id"],
            hoy - timedelta(days=13),
            hoy - timedelta(days=11),
            "enfermedad",
            None,
        )

    assert error.value.status_code == 422
    assert error.value.detail == "Solo se pueden justificar ausencias de los últimos 10 días."
    assert db_session.query(SolicitudAusenciaPeriodo).count() == 0
