import uuid

import pytest

from src.academico.models import Anio, Division, NivelEducativo
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.models import Persona
from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
    crear_payload,
    crear_payload_reinscripcion,
)


def test_crear_inscripcion_nueva(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "nueva"
    assert body["estado"] == "activa"
    assert body["ciclo_lectivo"] == "2027"
    assert body["alumno_id"] == str(escenario["alumno_id"])
    assert body["division_id"] == str(escenario["division_id"])
    assert body["solicitud_inscripcion_id"] == str(escenario["solicitud_id"])
    assert db_session.query(Inscripcion).count() == 1


def test_obtener_inscripcion_creada(client, db_session):
    escenario = crear_escenario(db_session)
    created = client.post("/inscripciones", json=crear_payload(escenario)).json()

    response = client.get(f"/inscripciones/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_rechaza_alumno_inexistente(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["alumno_id"] = str(uuid.uuid4())

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 404
    assert response.json() == {"detail": "El alumno indicado no existe."}


def test_rechaza_alumno_sin_familia(client, db_session):
    escenario = crear_escenario(db_session)
    db_session.query(FamiliaAlumno).delete()
    db_session.commit()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "El alumno debe estar vinculado al menos a una familia antes de inscribirse."
    }


@pytest.mark.parametrize(
    ("estado_solicitud", "etapa"),
    [
        ("en_proceso", "inscripcion_confirmada"),
        ("aprobada", "documentacion_contrato"),
    ],
)
def test_rechaza_solicitud_sin_confirmar(client, db_session, estado_solicitud, etapa):
    escenario = crear_escenario(db_session, estado_solicitud=estado_solicitud, etapa=etapa)

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La solicitud debe estar aprobada y en la etapa de inscripción confirmada."
    }


def test_rechaza_solicitud_de_otra_persona(client, db_session):
    escenario = crear_escenario(db_session)
    otra_persona = Persona(
        id=uuid.uuid4(),
        nombre="Bianca",
        apellido="Alfonsín",
        dni="50999888",
    )
    db_session.add(otra_persona)
    solicitud = db_session.get(SolicitudInscripcion, escenario["solicitud_id"])
    solicitud.aspirante_persona_id = otra_persona.id
    db_session.commit()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La solicitud no corresponde a la persona vinculada al alumno."
    }


def test_rechaza_nivel_distinto_al_aprobado(client, db_session):
    escenario = crear_escenario(db_session)
    otro_nivel_id = uuid.uuid4()
    otro_anio_id = uuid.uuid4()
    otra_division_id = uuid.uuid4()
    db_session.add_all(
        [
            NivelEducativo(id=otro_nivel_id, nombre="Secundario"),
            Anio(id=otro_anio_id, numero=1, nivel_educativo_id=otro_nivel_id),
            Division(id=otra_division_id, nombre="1°A", anio_id=otro_anio_id),
        ]
    )
    db_session.commit()
    payload = crear_payload(escenario)
    payload["division_id"] = str(otra_division_id)

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "La división no pertenece al nivel educativo aprobado en la solicitud."
    }


def test_rechaza_ciclo_distinto_al_aprobado(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["ciclo_lectivo"] = "2028"

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert response.json() == {
        "detail": "El ciclo lectivo debe coincidir con el de la solicitud aprobada."
    }


def test_rechaza_ciclo_compuesto_solo_por_espacios(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    payload["ciclo_lectivo"] = "    "

    response = client.post("/inscripciones", json=payload)

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 0


def test_rechaza_inscripcion_duplicada(client, db_session):
    escenario = crear_escenario(db_session)
    payload = crear_payload(escenario)
    first_response = client.post("/inscripciones", json=payload)

    response = client.post("/inscripciones", json=payload)

    assert first_response.status_code == 201
    assert response.status_code == 409
    assert response.json() == {
        "detail": "El alumno ya tiene una inscripción para ese ciclo lectivo."
    }
    assert db_session.query(Inscripcion).count() == 1


def test_crear_reinscripcion_para_ciclo_siguiente(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion_anterior = crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["tipo"] == "reinscripcion"
    assert body["estado"] == "activa"
    assert body["ciclo_lectivo"] == "2028"
    assert body["alumno_id"] == str(escenario["alumno_id"])
    assert body["division_id"] == str(escenario["division_id"])
    assert body["solicitud_inscripcion_id"] is None
    assert db_session.query(Inscripcion).count() == 2
    assert db_session.get(Inscripcion, inscripcion_anterior.id).estado == "finalizada"


def test_rechaza_reinscripcion_de_alumno_inactivo(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    alumno = db_session.get(Alumno, escenario["alumno_id"])
    alumno.estado = "inactivo"
    db_session.commit()

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Solo se puede reinscribir a un alumno activo."}
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_sin_inscripcion_anterior(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    mensaje_esperado = (
        "El alumno debe tener una inscripción no dada de baja en el ciclo lectivo anterior."
    )
    assert response.status_code == 422
    assert response.json() == {"detail": mensaje_esperado}
    assert db_session.query(Inscripcion).count() == 0


def test_rechaza_reinscripcion_si_la_anterior_esta_dada_de_baja(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario, estado="baja")

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_para_un_ciclo_no_consecutivo(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario, ciclo="2029"),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_rechaza_reinscripcion_duplicada(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    payload = crear_payload_reinscripcion(escenario)
    primera_respuesta = client.post("/inscripciones/reinscripciones", json=payload)

    response = client.post("/inscripciones/reinscripciones", json=payload)

    assert primera_respuesta.status_code == 201
    assert response.status_code == 409
    assert response.json() == {
        "detail": "El alumno ya tiene una inscripción para ese ciclo lectivo."
    }
    assert db_session.query(Inscripcion).count() == 2


def test_rechaza_reinscripcion_con_ciclo_no_anual(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario, ciclo="2028-2029"),
    )

    assert response.status_code == 422
    assert db_session.query(Inscripcion).count() == 1


def test_obtener_inscripcion_inexistente(client):
    response = client.get(f"/inscripciones/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "La inscripción indicada no existe."}


def test_crear_inscripcion_sin_sesion_rechaza(client, db_session):
    """RF-30: antes estos endpoints eran públicos, ahora exigen sesión + permiso."""
    escenario = crear_escenario(db_session)
    client.cookies.clear()

    response = client.post("/inscripciones", json=crear_payload(escenario))

    assert response.status_code == 401
