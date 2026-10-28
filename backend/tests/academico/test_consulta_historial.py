import csv
import uuid
from datetime import date
from io import BytesIO, StringIO

import pytest
from openpyxl import load_workbook

from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from tests.inscripciones.factories import (
    crear_division_destino,
    crear_escenario,
    crear_inscripcion_previa,
)


@pytest.fixture
def historial(db_session):
    escenario = crear_escenario(db_session)
    anterior = crear_inscripcion_previa(db_session, escenario, ciclo="2026", estado="finalizada")
    otra_division = crear_division_destino(db_session, escenario)
    actual = Inscripcion(
        ciclo_lectivo="2027",
        fecha_inscripcion=date(2027, 3, 1),
        tipo="reinscripcion",
        estado="activa",
        alumno_id=escenario["alumno_id"],
        division_id=otra_division,
    )
    db_session.add(actual)
    db_session.flush()
    for indice, tipo in enumerate(
        (
            "presente",
            "tardanza",
            "ausente_justificado",
            "ausente_injustificado",
            "ausente_pendiente",
        ),
        start=1,
    ):
        db_session.add(
            Asistencia(inscripcion_id=anterior.id, fecha=date(2026, 3, indice), tipo=tipo)
        )
    db_session.add(Asistencia(inscripcion_id=actual.id, fecha=date(2027, 3, 1), tipo="presente"))
    db_session.commit()
    return escenario, anterior, actual


def test_filtros_historicos_indicadores_y_paginacion(client_direccion, historial):
    escenario, anterior, actual = historial
    filtros = {
        "ciclo_lectivo": "2026",
        "fecha_desde": "2026-01-01",
        "fecha_hasta": "2027-12-31",
        "tamanio_pagina": 2,
    }
    respuesta = client_direccion.get("/academico/asistencias/consulta", params=filtros)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["total"] == 5
    assert datos["total_paginas"] == 3
    assert datos["resumen"] == {
        "total_registros": 5,
        "presentes": 1,
        "ausentes_justificadas": 1,
        "ausentes_injustificadas": 1,
        "porcentaje_presencia": 40.0,
    }
    assert [fila["fecha"] for fila in datos["items"]] == ["2026-03-05", "2026-03-04"]
    assert all(fila["inscripcion_id"] == str(anterior.id) for fila in datos["items"])
    assert all(fila["division"] == "4°B" for fila in datos["items"])
    ids = []
    for pagina in range(1, 4):
        ids.extend(
            fila["id"]
            for fila in client_direccion.get(
                "/academico/asistencias/consulta", params=filtros | {"pagina": pagina}
            ).json()["items"]
        )
    assert len(ids) == len(set(ids)) == 5
    for filtro in (
        {"nivel_educativo_id": str(escenario["nivel_id"])},
        {"division_id": str(escenario["division_id"])},
        {"inscripcion_id": str(anterior.id)},
    ):
        assert (
            client_direccion.get("/academico/asistencias/consulta", params=filtros | filtro).json()[
                "total"
            ]
            == 5
        )
    assert (
        client_direccion.get(
            "/academico/asistencias/consulta", params=filtros | {"inscripcion_id": str(actual.id)}
        ).json()["total"]
        == 0
    )
    for estado in (
        "presente",
        "tardanza",
        "ausente_justificado",
        "ausente_injustificado",
        "ausente_pendiente",
    ):
        filtrado = client_direccion.get(
            "/academico/asistencias/consulta", params=filtros | {"estado": estado}
        ).json()
        assert filtrado["total"] == 1
        assert filtrado["items"][0]["tipo"] == estado
        assert filtrado["resumen"]["porcentaje_presencia"] == (
            100 if estado in ("presente", "tardanza") else 0
        )
    vacio = client_direccion.get(
        "/academico/asistencias/consulta",
        params=filtros | {"fecha_desde": "2026-04-01", "fecha_hasta": "2026-04-02"},
    ).json()
    assert vacio["items"] == []
    assert vacio["total"] == vacio["resumen"]["porcentaje_presencia"] == 0


@pytest.mark.parametrize(
    "orden,primera",
    [
        ("fecha_asc", "2026-03-01"),
        ("fecha_desc", "2026-03-05"),
        ("alumno_asc", "2026-03-05"),
        ("alumno_desc", "2026-03-05"),
    ],
)
def test_ordenamiento(client_direccion, historial, orden, primera):
    respuesta = client_direccion.get(
        "/academico/asistencias/consulta", params={"ciclo_lectivo": "2026", "orden": orden}
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["items"][0]["fecha"] == primera


def test_opciones_no_excluyen_inscripciones_finalizadas(client_direccion, historial):
    escenario, anterior, _ = historial
    respuesta = client_direccion.get(
        "/academico/asistencias/filtros", params={"ciclo_lectivo": "2026"}
    )
    assert respuesta.status_code == 200
    filas = respuesta.json()
    assert client_direccion.get("/academico/asistencias/ciclos").json() == ["2027", "2026"]
    assert [fila["inscripcion_id"] for fila in filas] == [str(anterior.id)]
    filtro = {"ciclo_lectivo": "2026", "anio_id": filas[0]["anio_id"]}
    assert (
        client_direccion.get("/academico/asistencias/consulta", params=filtro).json()["total"] == 5
    )


@pytest.mark.parametrize(
    "campo", ["nivel_educativo_id", "anio_id", "division_id", "inscripcion_id"]
)
def test_filtro_inexistente_no_devuelve_registros(client_direccion, historial, campo):
    respuesta = client_direccion.get(
        "/academico/asistencias/consulta",
        params={"ciclo_lectivo": "2026", campo: str(uuid.uuid4())},
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["total"] == 0


def test_orden_por_alumno_y_exportacion_sin_recorte(client_direccion, db_session, historial):
    escenario, _, _ = historial
    persona = Persona(nombre="Ana", apellido="Alvarez", dni="50999999")
    db_session.add(persona)
    db_session.flush()
    alumno = Alumno(numero_legajo="A-HIST-002", estado="activo", persona_id=persona.id)
    db_session.add(alumno)
    db_session.flush()
    inscripcion = Inscripcion(
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 3, 1),
        tipo="nueva",
        estado="baja",
        alumno_id=alumno.id,
        division_id=escenario["division_id"],
    )
    db_session.add(inscripcion)
    db_session.flush()
    db_session.add(
        Asistencia(inscripcion_id=inscripcion.id, fecha=date(2026, 3, 1), tipo="presente")
    )
    db_session.commit()
    filtros = {"ciclo_lectivo": "2026", "tamanio_pagina": 1, "orden": "alumno_asc"}
    datos = client_direccion.get("/academico/asistencias/consulta", params=filtros).json()
    assert datos["items"][0]["alumno"] == "Alvarez, Ana"
    assert datos["resumen"]["total_registros"] == 6
    assert datos["resumen"]["porcentaje_presencia"] == 50
    datos = client_direccion.get(
        "/academico/asistencias/consulta", params=filtros | {"orden": "alumno_desc"}
    ).json()
    assert datos["items"][0]["alumno"] == "Cabral, Tiziano"
    respuesta = client_direccion.get("/academico/asistencias/consulta/exportar", params=filtros)
    assert len(list(csv.reader(StringIO(respuesta.content.decode("utf-8-sig"))))) == 7


@pytest.mark.parametrize("formato", ["csv", "xlsx"])
def test_exportacion_usa_todos_los_filtros_sin_paginar(client_direccion, historial, formato):
    filtros = {
        "ciclo_lectivo": "2026",
        "estado": "ausente_justificado",
        "formato": formato,
        "tamanio_pagina": 1,
    }
    respuesta = client_direccion.get("/academico/asistencias/consulta/exportar", params=filtros)
    assert respuesta.status_code == 200
    if formato == "csv":
        filas = list(csv.reader(StringIO(respuesta.content.decode("utf-8-sig"))))
    else:
        filas = list(load_workbook(BytesIO(respuesta.content)).active.values)
    assert len(filas) == 2
    assert filas[1][0] == "03/03/2026"
    assert filas[1][1] == "Cabral, Tiziano"
    assert filas[1][-1] == "Ausente justificado"


def test_exporta_pdf_con_los_mismos_filtros(client_direccion, historial, monkeypatch):
    from src.academico import historial_router
    from src.academico.service import generar_pdf_reporte_asistencias

    observados = []

    def generar(filas, desde, hasta):
        observados.append((filas, desde, hasta))
        return generar_pdf_reporte_asistencias(filas, desde, hasta)

    monkeypatch.setattr(historial_router, "generar_pdf_reporte_asistencias", generar)
    respuesta = client_direccion.get(
        "/academico/asistencias/consulta/exportar",
        params={"ciclo_lectivo": "2026", "estado": "ausente_justificado", "formato": "pdf"},
    )
    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.headers["content-disposition"].endswith('.pdf"')
    assert respuesta.content.startswith(b"%PDF-")
    filas, desde, hasta = observados[0]
    assert len(filas) == 1
    assert filas[0].estado == "Ausente justificado"
    assert desde == hasta == date(2026, 3, 3)


def test_alcance_y_permiso_exportacion(client_docente, historial, asignar_division_a_docente):
    escenario, _, _ = historial
    filtros = {"ciclo_lectivo": "2026"}
    assert client_docente.get("/academico/asistencias/consulta", params=filtros).status_code == 403
    assert client_docente.get("/academico/asistencias/filtros", params=filtros).json() == []
    assert client_docente.get("/academico/asistencias/ciclos").json() == []
    asignar_division_a_docente(escenario["division_id"], ciclo_lectivo="2026")
    opciones = client_docente.get("/academico/asistencias/filtros", params=filtros).json()
    assert client_docente.get("/academico/asistencias/ciclos").json() == ["2026"]
    assert len(opciones) == 1
    filtros["division_id"] = str(escenario["division_id"])
    assert (
        client_docente.get("/academico/asistencias/consulta", params=filtros).json()["total"] == 5
    )
    assert (
        client_docente.get("/academico/asistencias/consulta/exportar", params=filtros).status_code
        == 403
    )
    assert (
        client_docente.get(
            "/academico/asistencias/consulta", params=filtros | {"ciclo_lectivo": "2027"}
        ).status_code
        == 403
    )


@pytest.mark.parametrize(
    "filtros",
    [
        {"pagina": 0},
        {"tamanio_pagina": 0},
        {"estado": "inexistente"},
        {"orden": "inexistente"},
        {"fecha_desde": "2026-04-01", "fecha_hasta": "2026-03-01"},
    ],
)
def test_rechaza_filtros_invalidos(client_direccion, filtros):
    respuesta = client_direccion.get(
        "/academico/asistencias/consulta", params={"ciclo_lectivo": "2026"} | filtros
    )
    assert respuesta.status_code == 422
