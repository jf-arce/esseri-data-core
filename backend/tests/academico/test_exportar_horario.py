"""Exportación a Excel del horario semanal de una división."""

import uuid
from datetime import time
from io import BytesIO

from openpyxl import load_workbook

from src.academico.horario_export_service import nombre_archivo_horario
from src.academico.models import Anio, AsignacionDocente, Division, Docente, NivelEducativo
from src.academico.schemas import HorarioMateriaCursoCreate, MateriaCreate, MateriaCursoCreate
from src.academico.service import crear_materia, crear_materia_curso
from src.config import settings
from src.models import Persona


def _division(db):
    nivel = NivelEducativo(nombre="Primario")
    db.add(nivel)
    db.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    division = Division(nombre="B", anio_id=anio.id)
    db.add(division)
    db.flush()
    return division


def _franja(dia, inicio, fin):
    return HorarioMateriaCursoCreate(dia_semana=dia, hora_inicio=inicio, hora_fin=fin)


def _asignar(db, division, nombre, *franjas):
    materia = crear_materia(db, MateriaCreate(nombre=nombre, tipo="materia"))
    return crear_materia_curso(
        db,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=list(franjas)),
    )


def _docente(db, nombre, apellido, legajo):
    persona = Persona(nombre=nombre, apellido=apellido, dni=legajo)
    db.add(persona)
    db.flush()
    docente = Docente(legajo=legajo, persona_id=persona.id)
    db.add(docente)
    db.flush()
    return docente


def _libro(respuesta):
    return load_workbook(BytesIO(respuesta.content))


def test_exporta_grilla_y_listado(client_secretaria, db_session):
    division = _division(db_session)
    matematica = _asignar(db_session, division, "Matemática", _franja(1, time(8, 0), time(9, 30)))
    _asignar(db_session, division, "Lengua", _franja(2, time(8, 0), time(9, 0)))
    docente = _docente(db_session, "Ana", "Pérez", "D-1")
    db_session.add(
        AsignacionDocente(
            ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=matematica.id
        )
    )
    db_session.commit()

    respuesta = client_secretaria.get(
        f"/academico/divisiones/{division.id}/horario/exportar?ciclo_lectivo=2027"
    )

    assert respuesta.status_code == 200
    assert (
        'filename="horario_semanal_nivel_primario_4b_2027.xlsx"'
        in respuesta.headers["content-disposition"]
    )
    libro = _libro(respuesta)
    assert libro.sheetnames == ["Horario", "Listado"]

    grilla = libro["Horario"]
    assert [c.value for c in grilla[3]] == [
        "Hora",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
    ]
    assert grilla["A4"].value == "08:00"
    assert grilla["B4"].value == "Matemática\n08:00 a 09:30\nPérez, Ana"
    assert grilla["A1"].value == "Horario de 4°B"
    assert "B4:B6" in {str(r) for r in grilla.merged_cells.ranges}
    assert grilla["C4"].value.startswith("Lengua")

    filas = [[c.value for c in fila] for fila in libro["Listado"].iter_rows(min_row=2)]
    assert filas[0] == [None, "Lunes", "08:00", "09:30", "Matemática", "Materia", "Pérez, Ana"]
    assert filas[1][:5] == [None, "Martes", "08:00", "09:00", "Lengua"]


def test_ignora_docentes_de_otro_ciclo(client_secretaria, db_session):
    division = _division(db_session)
    materia = _asignar(db_session, division, "Historia", _franja(3, time(10, 0), time(11, 0)))
    docente = _docente(db_session, "Luis", "Gómez", "D-2")
    db_session.add(
        AsignacionDocente(ciclo_lectivo="2026", docente_id=docente.id, materia_curso_id=materia.id)
    )
    db_session.commit()

    respuesta = client_secretaria.get(
        f"/academico/divisiones/{division.id}/horario/exportar?ciclo_lectivo=2027"
    )

    assert _libro(respuesta)["Listado"]["G2"].value in (None, "")


def test_division_sin_materias_devuelve_un_archivo_valido(client_secretaria, db_session):
    division = _division(db_session)
    db_session.commit()

    respuesta = client_secretaria.get(f"/academico/divisiones/{division.id}/horario/exportar")

    assert respuesta.status_code == 200
    assert "no tiene horarios" in _libro(respuesta)["Horario"]["A3"].value


def test_franjas_superpuestas_no_rompen_el_archivo(client_secretaria, db_session):
    division = _division(db_session)
    a = _asignar(db_session, division, "Física", _franja(1, time(8, 0), time(9, 0)))
    b = _asignar(db_session, division, "Química", _franja(2, time(8, 0), time(9, 0)))
    # Dato anterior a la validación de superposición: se fuerza la segunda franja al lunes.
    b.horarios[0].dia_semana = 1
    b.horarios[0].hora_inicio = time(8, 30)
    b.horarios[0].hora_fin = time(9, 30)
    db_session.commit()

    respuesta = client_secretaria.get(f"/academico/divisiones/{division.id}/horario/exportar")

    assert respuesta.status_code == 200
    libro = _libro(respuesta)
    assert libro["Horario"]["B4"].value.startswith(("Física", "Química"))
    assert libro["Listado"].max_row == 3
    assert a.id != b.id


def test_division_inexistente_devuelve_404(client_secretaria):
    respuesta = client_secretaria.get(f"/academico/divisiones/{uuid.uuid4()}/horario/exportar")

    assert respuesta.status_code == 404


def test_docente_puede_exportar_el_horario(client_docente, db_session):
    division = _division(db_session)
    db_session.commit()

    respuesta = client_docente.get(f"/academico/divisiones/{division.id}/horario/exportar")

    assert respuesta.status_code == 200


def test_expone_el_nombre_del_archivo_a_otros_origenes(client_secretaria, db_session):
    """Sin `Access-Control-Expose-Headers` el front no puede leer `Content-Disposition`."""
    division = _division(db_session)
    db_session.commit()

    respuesta = client_secretaria.get(
        f"/academico/divisiones/{division.id}/horario/exportar",
        headers={"Origin": settings.CORS_ORIGINS[0]},
    )

    assert "content-disposition" in respuesta.headers["access-control-expose-headers"].lower()


def test_nombre_de_archivo_no_repite_la_palabra_nivel(db_session):
    division = _division(db_session)
    division.anio.nivel_educativo.nombre = "Nivel Primario"

    assert nombre_archivo_horario(division, "2027") == "horario_semanal_nivel_primario_4b_2027.xlsx"
