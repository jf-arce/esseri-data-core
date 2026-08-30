import pytest

from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
    crear_payload_reinscripcion,
)


def test_listar_solicitudes_disponibles(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(escenario["solicitud_id"]),
            "ciclo_lectivo": "2027",
            "fecha_solicitud": "2026-08-02",
            "alumno_id": str(escenario["alumno_id"]),
            "alumno_nombre": "Tiziano",
            "alumno_apellido": "Cabral",
            "numero_legajo": "A-2027-001",
            "nivel_educativo_id": str(escenario["nivel_id"]),
            "nivel_educativo_nombre": "Primario",
        }
    ]


def test_buscar_solicitudes_disponibles(client, db_session):
    crear_escenario(db_session)

    response = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"buscar": "A-2027-001"},
    )
    response_sin_coincidencias = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"buscar": "Vega"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response_sin_coincidencias.status_code == 200
    assert response_sin_coincidencias.json() == []


def test_rechaza_limite_invalido_al_listar_solicitudes(client):
    response = client.get(
        "/inscripciones/opciones/solicitudes",
        params={"limite": 101},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    ("estado_solicitud", "etapa"),
    [
        ("en_proceso", "inscripcion_confirmada"),
        ("aprobada", "documentacion_contrato"),
    ],
)
def test_no_lista_solicitudes_sin_confirmar(client, db_session, estado_solicitud, etapa):
    crear_escenario(db_session, estado_solicitud=estado_solicitud, etapa=etapa)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == []


def test_no_lista_solicitud_ya_utilizada(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get("/inscripciones/opciones/solicitudes")

    assert response.status_code == 200
    assert response.json() == []


def test_listar_divisiones_disponibles(client, db_session):
    escenario = crear_escenario(db_session)

    response = client.get("/inscripciones/opciones/divisiones")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": str(escenario["division_id"]),
            "nombre": "4°B",
            "anio_numero": 4,
            "nivel_educativo_id": str(escenario["nivel_id"]),
            "nivel_educativo_nombre": "Primario",
        }
    ]


def test_listar_alumnos_elegibles_para_reinscripcion(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028"},
    )

    assert response.status_code == 200
    assert response.json() == [
        {
            "alumno_id": str(escenario["alumno_id"]),
            "alumno_nombre": "Tiziano",
            "alumno_apellido": "Cabral",
            "numero_legajo": "A-2027-001",
            "ciclo_anterior": "2027",
        }
    ]


def test_buscar_alumnos_elegibles_para_reinscripcion(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028", "buscar": "Cabral"},
    )
    response_sin_coincidencias = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028", "buscar": "Vega"},
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response_sin_coincidencias.status_code == 200
    assert response_sin_coincidencias.json() == []


def test_no_lista_alumno_que_ya_tiene_inscripcion_destino(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)
    response_creacion = client.post(
        "/inscripciones/reinscripciones",
        json=crear_payload_reinscripcion(escenario),
    )

    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028"},
    )

    assert response_creacion.status_code == 201
    assert response.status_code == 200
    assert response.json() == []


def test_rechaza_ciclo_invalido_al_listar_reinscripciones(client):
    response = client.get(
        "/inscripciones/opciones/reinscripciones",
        params={"ciclo_lectivo": "2028-2029"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "ruta",
    [
        "/inscripciones/opciones/solicitudes",
        "/inscripciones/opciones/divisiones",
        "/inscripciones/opciones/reinscripciones?ciclo_lectivo=2028",
    ],
)
def test_listar_opciones_sin_sesion_rechaza(client, ruta):
    client.cookies.clear()

    response = client.get(ruta)

    assert response.status_code == 401
