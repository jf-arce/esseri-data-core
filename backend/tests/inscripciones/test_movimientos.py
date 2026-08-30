from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from tests.inscripciones.factories import (
    crear_division_destino,
    crear_escenario,
    crear_inscripcion_previa,
)


def test_registrar_cambio_matricula_conserva_el_historial(client, db_session):
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
