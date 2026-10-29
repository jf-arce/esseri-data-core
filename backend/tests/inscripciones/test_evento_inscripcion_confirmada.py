"""Finalizar el alta integrada emite `inscripcion.confirmada` para el Loop A de Workflows (#207)."""

import uuid

import pytest
from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.inscripciones.exceptions import InscripcionInvalida
from src.models import EventLog
from tests.inscripciones.test_alta_integrada_admision import (
    _crear_admision_documentada,
    _finalizar,
)


def _eventos(db):
    return db.scalars(select(EventLog)).all()


def test_emite_el_evento_con_la_inscripcion_creada(db_session):
    escenario = _crear_admision_documentada(db_session)

    respuesta = _finalizar(db_session, escenario)

    [evento] = _eventos(db_session)
    assert evento.entidad == "inscripcion"
    assert evento.entidad_id == respuesta.inscripcion.id
    assert evento.usuario_id == escenario["usuario"].id
    assert evento.payload == {
        "alumno_nombre": "Integrada, Emilia",
        "nivel_educativo": escenario["nivel"].nombre,
        "fecha": "2026-08-28",
    }


def test_si_el_alta_falla_no_queda_el_evento(db_session):
    escenario = _crear_admision_documentada(db_session)
    nivel = NivelEducativo(nombre=f"Secundario {uuid.uuid4()}")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=1, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="1° A", anio_id=anio.id)
    db_session.add(division)
    db_session.commit()

    with pytest.raises(InscripcionInvalida):
        _finalizar(db_session, escenario, division_id=str(division.id))

    assert _eventos(db_session) == []
