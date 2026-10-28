from datetime import date

import pytest

from src.academico.models import Anio, Division, NivelEducativo
from src.familias_alumnos.models import Alumno
from src.inscripciones import matriculas_service
from src.inscripciones.models import Inscripcion
from src.inscripciones.schemas import CambioMatriculaCreate
from src.models import EventLog
from tests.inscripciones.conftest import crear_catalogo_evento_cambio_matricula
from tests.inscripciones.factories import (
    crear_division_destino,
    crear_escenario,
    crear_inscripcion_previa,
)


def _crear_division_de_otro_nivel(db_session):
    nivel = NivelEducativo(nombre="Secundario")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=1, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="1°A", anio_id=anio.id)
    db_session.add(division)
    db_session.commit()
    return division


def test_registrar_cambio_matricula_conserva_el_historial(client, db_session):
    crear_catalogo_evento_cambio_matricula(db_session)
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")
    division_destino_id = crear_division_destino(db_session, escenario)

    response = client.post(
        f"/inscripciones/{inscripcion_actual.id}/cambios-matricula",
        json={"division_id": str(division_destino_id), "fecha_cambio": "2027-03-10"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "cambio_matricula"
    assert body["estado"] == "activa"
    assert body["fecha_inscripcion"] == "2027-03-10"
    assert body["division_id"] == str(division_destino_id)
    assert body["alumno_id"] == str(escenario["alumno_id"])
    assert db_session.get(Inscripcion, inscripcion_actual.id).estado == "finalizada"
    assert db_session.get(Alumno, escenario["alumno_id"]).estado == "activo"
    assert db_session.query(Inscripcion).count() == 2


def test_registrar_cambio_matricula_emite_evento_de_division(db_session):
    crear_catalogo_evento_cambio_matricula(db_session)
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")
    division_destino_id = crear_division_destino(db_session, escenario)

    cambio = matriculas_service.registrar_cambio_matricula(
        db_session,
        inscripcion_actual.id,
        CambioMatriculaCreate(fecha_cambio=date(2027, 3, 10), division_id=division_destino_id),
    )

    evento = db_session.query(EventLog).one()
    assert evento.entidad == "inscripcion"
    assert evento.entidad_id == cambio.id
    assert evento.payload == {
        "alumno_nombre": "Tiziano Cabral",
        "tipo_cambio": "division",
        "fecha": "2027-03-10",
    }


def test_registrar_cambio_matricula_emite_evento_de_nivel(db_session):
    crear_catalogo_evento_cambio_matricula(db_session)
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")
    division_destino = _crear_division_de_otro_nivel(db_session)

    matriculas_service.registrar_cambio_matricula(
        db_session,
        inscripcion_actual.id,
        CambioMatriculaCreate(fecha_cambio=date(2027, 3, 10), division_id=division_destino.id),
    )

    evento = db_session.query(EventLog).one()
    assert evento.payload["tipo_cambio"] == "nivel"


def test_falla_despues_de_emitir_evento_revierte_cambio_y_evento(db_session, monkeypatch):
    crear_catalogo_evento_cambio_matricula(db_session)
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")
    division_destino_id = crear_division_destino(db_session, escenario)

    def fallar_despues_de_emitir(*args, **kwargs):
        raise RuntimeError("fallo de prueba")

    monkeypatch.setattr(matriculas_service, "log_audit", fallar_despues_de_emitir)

    with pytest.raises(RuntimeError, match="fallo de prueba"):
        matriculas_service.registrar_cambio_matricula(
            db_session,
            inscripcion_actual.id,
            CambioMatriculaCreate(fecha_cambio=date(2027, 3, 10), division_id=division_destino_id),
        )

    db_session.rollback()
    assert db_session.query(EventLog).count() == 0
    assert db_session.get(Inscripcion, inscripcion_actual.id).estado == "activa"
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_cambio_matricula_a_la_misma_division(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")

    response = client.post(
        f"/inscripciones/{inscripcion_actual.id}/cambios-matricula",
        json={"division_id": str(escenario["division_id"]), "fecha_cambio": "2027-03-10"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "La división de destino debe ser distinta de la actual."}
    assert db_session.query(Inscripcion).count() == 1


def test_registrar_baja_conserva_el_historial_y_actualiza_alumno(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion_actual = crear_inscripcion_previa(db_session, escenario, estado="activa")

    response = client.post(
        f"/inscripciones/{inscripcion_actual.id}/bajas",
        json={"fecha_baja": "2027-05-15"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "baja"
    assert body["estado"] == "baja"
    assert body["fecha_inscripcion"] == "2027-05-15"
    assert body["division_id"] == str(escenario["division_id"])
    assert db_session.get(Inscripcion, inscripcion_actual.id).estado == "finalizada"
    assert db_session.get(Alumno, escenario["alumno_id"]).estado == "inactivo"
    assert db_session.query(Inscripcion).count() == 2


def test_rechaza_movimiento_sobre_inscripcion_no_activa(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        f"/inscripciones/{inscripcion.id}/bajas",
        json={"fecha_baja": "2027-05-15"},
    )

    assert response.status_code == 422
    assert response.json() == {
        "detail": "Solo se puede registrar un movimiento sobre una inscripción activa."
    }
