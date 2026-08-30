import uuid

import pytest

from tests.inscripciones.factories import (
    crear_escenario,
    crear_inscripcion_previa,
)


def test_listar_inscripciones_con_contexto(client, db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario)

    response = client.get("/inscripciones")

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": str(inscripcion.id),
                "ciclo_lectivo": "2027",
                "fecha_inscripcion": "2026-08-27",
                "tipo": "nueva",
                "estado": "finalizada",
                "alumno_id": str(escenario["alumno_id"]),
                "alumno_nombre": "Tiziano",
                "alumno_apellido": "Cabral",
                "numero_legajo": "A-2027-001",
                "division_id": str(escenario["division_id"]),
                "division_nombre": "4°B",
                "anio_numero": 4,
                "nivel_educativo_nombre": "Primario",
            }
        ],
        "total": 1,
        "pagina": 1,
        "tamanio_pagina": 20,
        "total_paginas": 1,
    }


@pytest.mark.parametrize(
    ("parametros", "cantidad_esperada"),
    [
        ({"ciclo_lectivo": "2027"}, 1),
        ({"ciclo_lectivo": "2028"}, 0),
        ({"estado": "finalizada"}, 1),
        ({"estado": "activa"}, 0),
        ({"tipo": "nueva"}, 1),
        ({"tipo": "reinscripcion"}, 0),
        ({"buscar": "Cabral"}, 1),
        ({"buscar": "A-2027-001"}, 1),
        ({"buscar": "Sin coincidencia"}, 0),
    ],
)
def test_filtrar_listado_inscripciones(client, db_session, parametros, cantidad_esperada):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get("/inscripciones", params=parametros)

    assert response.status_code == 200
    assert response.json()["total"] == cantidad_esperada
    assert len(response.json()["items"]) == cantidad_esperada


def test_filtrar_listado_inscripciones_sin_distinguir_tildes(client, db_session):
    escenario = crear_escenario(db_session, nombre_alumno="Sofía")
    crear_inscripcion_previa(db_session, escenario)

    response = client.get("/inscripciones", params={"buscar": "Sofia"})

    assert response.status_code == 200
    assert response.json()["total"] == 1


def test_filtrar_listado_por_alumno_y_division(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario)

    response = client.get(
        "/inscripciones",
        params={
            "alumno_id": str(escenario["alumno_id"]),
            "division_id": str(escenario["division_id"]),
        },
    )
    response_sin_coincidencias = client.get(
        "/inscripciones",
        params={"alumno_id": str(uuid.uuid4())},
    )

    assert response.status_code == 200
    assert response.json()["total"] == 1
    assert response_sin_coincidencias.status_code == 200
    assert response_sin_coincidencias.json()["total"] == 0


def test_paginar_listado_inscripciones(client, db_session):
    escenario = crear_escenario(db_session)
    crear_inscripcion_previa(db_session, escenario, ciclo="2027")
    segunda = crear_inscripcion_previa(db_session, escenario, ciclo="2028")
    segunda.solicitud_inscripcion_id = None
    db_session.commit()

    primera_pagina = client.get(
        "/inscripciones",
        params={"pagina": 1, "tamanio_pagina": 1},
    )
    segunda_pagina = client.get(
        "/inscripciones",
        params={"pagina": 2, "tamanio_pagina": 1},
    )

    assert primera_pagina.status_code == 200
    assert primera_pagina.json()["total"] == 2
    assert primera_pagina.json()["total_paginas"] == 2
    assert primera_pagina.json()["items"][0]["ciclo_lectivo"] == "2028"
    assert segunda_pagina.status_code == 200
    assert segunda_pagina.json()["items"][0]["ciclo_lectivo"] == "2027"


@pytest.mark.parametrize(
    "parametros",
    [
        {"pagina": 0},
        {"tamanio_pagina": 0},
        {"tamanio_pagina": 101},
        {"estado": "desconocida"},
        {"tipo": "desconocido"},
    ],
)
def test_rechaza_filtros_invalidos_del_listado(client, parametros):
    response = client.get("/inscripciones", params=parametros)

    assert response.status_code == 422


def test_listar_inscripciones_sin_sesion_rechaza(client):
    client.cookies.clear()

    response = client.get("/inscripciones")

    assert response.status_code == 401
