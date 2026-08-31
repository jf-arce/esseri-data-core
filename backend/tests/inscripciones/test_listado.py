import uuid
from datetime import date

import pytest

from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Inscripcion
from src.models import Persona
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


def test_ordenar_listado_inscripciones_antes_de_paginar(client, db_session):
    escenario = crear_escenario(db_session)
    primera = crear_inscripcion_previa(db_session, escenario, ciclo="2027")
    primera.fecha_inscripcion = date(2026, 3, 10)
    persona_id = uuid.uuid4()
    alumno_id = uuid.uuid4()
    db_session.add_all(
        [
            Persona(id=persona_id, nombre="Sofía", apellido="Vega", dni="50999888"),
            Alumno(
                id=alumno_id,
                numero_legajo="A-2028-002",
                estado="activo",
                persona_id=persona_id,
            ),
            Inscripcion(
                ciclo_lectivo="2028",
                fecha_inscripcion=date(2026, 8, 10),
                tipo="nueva",
                estado="finalizada",
                alumno_id=alumno_id,
                division_id=escenario["division_id"],
            ),
        ]
    )
    db_session.commit()

    por_fecha = client.get("/inscripciones", params={"ordenar_por": "fecha", "direccion": "asc"})
    por_alumno = client.get("/inscripciones", params={"ordenar_por": "alumno", "direccion": "desc"})

    assert por_fecha.status_code == 200
    assert [item["ciclo_lectivo"] for item in por_fecha.json()["items"]] == ["2027", "2028"]
    assert por_alumno.status_code == 200
    assert [item["alumno_nombre"] for item in por_alumno.json()["items"]] == ["Sofía", "Tiziano"]


def test_exportar_inscripciones_csv_respeta_filtros_y_orden(client, db_session):
    escenario = crear_escenario(db_session, nombre_alumno="Sofía")
    crear_inscripcion_previa(db_session, escenario, ciclo="2027")
    otra_persona_id = uuid.uuid4()
    otro_alumno_id = uuid.uuid4()
    db_session.add_all(
        [
            Persona(id=otra_persona_id, nombre="Sofía", apellido="Vega", dni="50999888"),
            Alumno(
                id=otro_alumno_id,
                numero_legajo="A-2027-002",
                estado="activo",
                persona_id=otra_persona_id,
            ),
            Inscripcion(
                ciclo_lectivo="2027",
                fecha_inscripcion=date(2026, 8, 28),
                tipo="nueva",
                estado="activa",
                alumno_id=otro_alumno_id,
                division_id=escenario["division_id"],
            ),
        ]
    )
    db_session.commit()

    response = client.get(
        "/inscripciones/exportar",
        params={"buscar": "Sofia", "ordenar_por": "alumno", "direccion": "asc"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment" in response.headers["content-disposition"]
    texto = response.content.decode("utf-8-sig")
    lineas = texto.strip().split("\n")
    assert lineas[0] == "Alumno,Legajo,División,Nivel educativo,Ciclo lectivo,Tipo,Fecha,Estado"
    assert "Cabral, Sofía" in lineas[1]
    assert "Vega, Sofía" in lineas[2]


def test_obtener_resumen_inscripciones_del_ciclo(client, db_session):
    escenario = crear_escenario(db_session)
    activa = crear_inscripcion_previa(db_session, escenario, ciclo="2027", estado="activa")
    activa.tipo = "nueva"
    reinscripcion = crear_inscripcion_previa(db_session, escenario, ciclo="2028", estado="activa")
    reinscripcion.solicitud_inscripcion_id = None
    reinscripcion.tipo = "reinscripcion"
    baja = crear_inscripcion_previa(db_session, escenario, ciclo="2027", estado="baja")
    baja.solicitud_inscripcion_id = None
    baja.tipo = "baja"
    db_session.commit()

    response = client.get("/inscripciones/resumen", params={"ciclo_lectivo": "2027"})

    assert response.status_code == 200
    assert response.json() == {
        "ciclo_lectivo": "2027",
        "inscripciones_activas": 1,
        "nuevas": 1,
        "reinscripciones": 0,
        "bajas": 1,
    }


@pytest.mark.parametrize(
    "parametros",
    [
        {"pagina": 0},
        {"tamanio_pagina": 0},
        {"tamanio_pagina": 101},
        {"estado": "desconocida"},
        {"tipo": "desconocido"},
        {"ordenar_por": "desconocido"},
        {"direccion": "lateral"},
    ],
)
def test_rechaza_filtros_invalidos_del_listado(client, parametros):
    response = client.get("/inscripciones", params=parametros)

    assert response.status_code == 422


def test_listar_inscripciones_sin_sesion_rechaza(client):
    client.cookies.clear()

    response = client.get("/inscripciones")

    assert response.status_code == 401


def test_exportar_inscripciones_sin_sesion_rechaza(client):
    client.cookies.clear()

    response = client.get("/inscripciones/exportar")

    assert response.status_code == 401
