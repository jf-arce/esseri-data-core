"""Regresión: el rol docente tiene que poder tomar asistencia de punta a punta.

Bug reproducido en RF-06: `docente` en grupo-b.yaml solo tiene Académico
(leer, actualizar) e Inscripciones (leer) -- nunca `crear` en ningún módulo. Pero
GET /inscripciones exigía Inscripciones/leer (ok) y POST /academico/asistencias(/bulk)
exigían Académico/crear, permiso que el docente nunca tuvo. El resultado real: la
pantalla "Tomar asistencia" ni siquiera cargaba el listado de alumnos para un docente.
"""

from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def test_docente_puede_listar_inscripciones_de_su_division(client_docente, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.get(f"/inscripciones?division_id={escenario['division_id']}")

    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 1


def test_docente_puede_registrar_asistencia_individual(client_docente, db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.post(
        "/academico/asistencias",
        json={
            "inscripcion_id": str(inscripcion.id),
            "fecha": "2027-03-15",
            "tipo": "presente",
        },
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["tipo"] == "presente"


def test_docente_puede_registrar_asistencia_masiva(client_docente, db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")

    respuesta = client_docente.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-03-15",
            "division_id": str(escenario["division_id"]),
            "registros": [{"inscripcion_id": str(inscripcion.id), "tipo": "ausente"}],
        },
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["creadas"] == 1
    assert cuerpo["notificaciones_disparadas"] == 1
