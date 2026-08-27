import uuid
from datetime import date

import pytest

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.models import Persona


def crear_escenario(db_session, *, estado_solicitud="aprobada", etapa="inscripcion_confirmada"):
    aspirante_persona_id = uuid.uuid4()
    familiar_persona_id = uuid.uuid4()
    alumno_id = uuid.uuid4()
    familia_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()
    usuario_id = uuid.uuid4()
    solicitud_id = uuid.uuid4()

    db_session.add_all(
        [
            Persona(
                id=aspirante_persona_id,
                nombre="Tiziano",
                apellido="Cabral",
                dni="50111222",
            ),
            Persona(
                id=familiar_persona_id,
                nombre="Lorena",
                apellido="Cabral",
                dni="30111222",
            ),
            Alumno(
                id=alumno_id,
                numero_legajo="A-2027-001",
                estado="activo",
                persona_id=aspirante_persona_id,
            ),
            Familia(id=familia_id, estado_deuda="al_dia", persona_id=familiar_persona_id),
            FamiliaAlumno(
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
                familia_id=familia_id,
                alumno_id=alumno_id,
            ),
            NivelEducativo(id=nivel_id, nombre="Primario"),
            Anio(id=anio_id, numero=4, nivel_educativo_id=nivel_id),
            Division(id=division_id, nombre="4°B", anio_id=anio_id),
            Usuario(
                id=usuario_id,
                email="secretaria@esseri.edu.ar",
                auth_provider="google",
                estado="activo",
            ),
            SolicitudInscripcion(
                id=solicitud_id,
                ciclo_lectivo="2027",
                etapa=etapa,
                estado=estado_solicitud,
                fecha_solicitud=date(2026, 8, 2),
                aspirante_persona_id=aspirante_persona_id,
                nivel_educativo_id=nivel_id,
                usuario_id=usuario_id,
            ),
        ]
    )
    db_session.commit()

    return {
        "aspirante_persona_id": aspirante_persona_id,
        "alumno_id": alumno_id,
        "familia_id": familia_id,
        "nivel_id": nivel_id,
        "division_id": division_id,
        "solicitud_id": solicitud_id,
    }


def crear_payload(escenario):
    return {
        "ciclo_lectivo": "2027",
        "fecha_inscripcion": "2026-08-27",
        "alumno_id": str(escenario["alumno_id"]),
        "division_id": str(escenario["division_id"]),
        "solicitud_inscripcion_id": str(escenario["solicitud_id"]),
    }


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


def test_obtener_inscripcion_inexistente(client):
    response = client.get(f"/inscripciones/{uuid.uuid4()}")

    assert response.status_code == 404
    assert response.json() == {"detail": "La inscripción indicada no existe."}
