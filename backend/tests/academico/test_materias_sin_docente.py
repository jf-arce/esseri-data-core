"""Aviso de materias sin docente: cuenta solo el ciclo pedido y mira todas las divisiones."""

import uuid
from datetime import time

from src.academico.models import Anio, AsignacionDocente, Division, Docente, NivelEducativo
from src.academico.schemas import HorarioMateriaCursoCreate, MateriaCreate, MateriaCursoCreate
from src.academico.service import crear_materia, crear_materia_curso
from src.models import Persona

URL = "/academico/materias-curso/sin-docente"


def _division(db, nivel_nombre="Primario", numero=4, nombre="4°B"):
    nivel = NivelEducativo(nombre=nivel_nombre)
    db.add(nivel)
    db.flush()
    anio = Anio(numero=numero, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    division = Division(nombre=nombre, anio_id=anio.id)
    db.add(division)
    db.flush()
    return division


def _materia_curso(db, division, nombre, dia=1):
    materia = crear_materia(db, MateriaCreate(nombre=nombre, tipo="materia"))
    return crear_materia_curso(
        db,
        MateriaCursoCreate(
            materia_id=materia.id,
            division_id=division.id,
            horarios=[
                HorarioMateriaCursoCreate(
                    dia_semana=dia, hora_inicio=time(8, 0), hora_fin=time(9, 0)
                )
            ],
        ),
    )


def _asignar(db, materia_curso, ciclo):
    persona = Persona(nombre="Ana", apellido="Pérez", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    docente = Docente(legajo=f"D-{uuid.uuid4().hex[:8]}", persona_id=persona.id)
    db.add(docente)
    db.flush()
    db.add(
        AsignacionDocente(
            ciclo_lectivo=ciclo, docente_id=docente.id, materia_curso_id=materia_curso.id
        )
    )
    db.flush()


def test_lista_solo_las_materias_sin_docente_del_ciclo(client_secretaria, db_session):
    division = _division(db_session)
    con_docente = _materia_curso(db_session, division, "Lengua", dia=1)
    _materia_curso(db_session, division, "Matemática", dia=2)
    _asignar(db_session, con_docente, "2027")
    db_session.commit()

    respuesta = client_secretaria.get(f"{URL}?ciclo_lectivo=2027")

    assert respuesta.status_code == 200
    assert [m["materia_nombre"] for m in respuesta.json()] == ["Matemática"]


def test_ignora_las_asignaciones_de_ciclos_anteriores(client_secretaria, db_session):
    division = _division(db_session)
    materia_curso = _materia_curso(db_session, division, "Lengua")
    _asignar(db_session, materia_curso, "2026")
    db_session.commit()

    respuesta = client_secretaria.get(f"{URL}?ciclo_lectivo=2027")

    assert [m["materia_nombre"] for m in respuesta.json()] == ["Lengua"]


def test_incluye_todas_las_divisiones_con_su_curso_y_nivel(client_secretaria, db_session):
    primario = _division(db_session, "Primario", 4, "4°B")
    secundario = _division(db_session, "Secundario", 1, "1°A")
    _materia_curso(db_session, primario, "Lengua")
    _materia_curso(db_session, secundario, "Historia")
    db_session.commit()

    respuesta = client_secretaria.get(f"{URL}?ciclo_lectivo=2027")

    assert [
        (m["nivel_educativo_nombre"], m["anio_numero"], m["division_nombre"], m["materia_nombre"])
        for m in respuesta.json()
    ] == [("Primario", 4, "4°B", "Lengua"), ("Secundario", 1, "1°A", "Historia")]


def test_exige_permiso_de_lectura(client_familia):
    assert client_familia.get(f"{URL}?ciclo_lectivo=2027").status_code == 403
