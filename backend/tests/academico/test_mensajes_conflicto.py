"""Los 409 del módulo tienen que nombrar materia, curso con nivel y, si aplica, docente y ciclo."""

import uuid
from datetime import time

import pytest

from src.academico.exceptions import (
    AsignacionDocenteDuplicada,
    DivisionConMaterias,
    DocenteConAsignaciones,
    HorarioDuplicado,
    MateriaConCursos,
    MateriaCursoDuplicada,
)
from src.academico.models import Anio, Division, Docente, NivelEducativo
from src.academico.schemas import (
    AsignacionDocenteCreate,
    HorarioMateriaCursoCreate,
    MateriaCreate,
    MateriaCursoCreate,
)
from src.academico.service import (
    crear_asignacion_docente,
    crear_materia,
    crear_materia_curso,
    eliminar_division,
    eliminar_docente,
    eliminar_materia,
)
from src.models import Persona


def _franja(inicio=time(8, 0), fin=time(9, 0)):
    return HorarioMateriaCursoCreate(dia_semana=1, hora_inicio=inicio, hora_fin=fin)


def _divisiones(db, letras="B"):
    nivel = NivelEducativo(nombre="Primario")
    db.add(nivel)
    db.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    divisiones = [Division(nombre=f"4°{letra}", anio_id=anio.id) for letra in letras]
    db.add_all(divisiones)
    db.flush()
    return divisiones


def _docente(db):
    persona = Persona(nombre="Juan", apellido="Pérez", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    docente = Docente(legajo=f"D-{uuid.uuid4().hex[:8]}", persona_id=persona.id)
    db.add(docente)
    db.flush()
    return docente


def _curso(db, division, materia, *franjas):
    return crear_materia_curso(
        db,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division.id, horarios=list(franjas or [_franja()])
        ),
    )


def test_materia_repetida_en_el_curso_nombra_materia_y_curso(db_session):
    (division,) = _divisiones(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))
    _curso(db_session, division, materia)

    with pytest.raises(MateriaCursoDuplicada) as error:
        _curso(db_session, division, materia, _franja(time(10, 0), time(11, 0)))

    assert error.value.message == "Matemática ya está en 4°B de Primario"


def test_horarios_propios_que_se_pisan_dicen_cuales(db_session):
    (division,) = _divisiones(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))

    with pytest.raises(HorarioDuplicado) as error:
        _curso(db_session, division, materia, _franja(), _franja(time(8, 30), time(9, 30)))

    assert error.value.message == (
        "Dos horarios de esta materia se pisan: lunes de 08:00 a 09:00 y lunes de 08:30 a 09:30"
    )


def test_asignacion_repetida_nombra_docente_materia_curso_y_ciclo(db_session):
    (division,) = _divisiones(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))
    curso = _curso(db_session, division, materia)
    docente = _docente(db_session)
    datos = AsignacionDocenteCreate(
        ciclo_lectivo="2026", docente_id=docente.id, materia_curso_id=curso.id
    )
    crear_asignacion_docente(db_session, datos)

    with pytest.raises(AsignacionDocenteDuplicada) as error:
        crear_asignacion_docente(db_session, datos)

    assert error.value.message == (
        "Juan Pérez ya tiene asignada Matemática en 4°B de Primario para el ciclo 2026"
    )


def test_materia_del_catalogo_en_cursos_lista_hasta_tres(db_session):
    divisiones = _divisiones(db_session, "ABCDE")
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))
    for division in divisiones:
        _curso(db_session, division, materia)

    with pytest.raises(MateriaConCursos) as error:
        eliminar_materia(db_session, materia)

    assert error.value.message == (
        "No se puede eliminar Matemática del catálogo: está en 4°A de Primario, "
        "4°B de Primario, 4°C de Primario y 2 más. Primero eliminala de esos cursos."
    )


def test_division_con_materias_dice_cuantas(db_session):
    (division,) = _divisiones(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))
    _curso(db_session, division, materia)

    with pytest.raises(DivisionConMaterias) as error:
        eliminar_division(db_session, division)

    assert error.value.message == "No se puede dar de baja 4°B de Primario: tiene 1 materia"


def test_docente_con_asignaciones_dice_cuantas(db_session):
    (division,) = _divisiones(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))
    curso = _curso(db_session, division, materia)
    docente = _docente(db_session)
    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2026", docente_id=docente.id, materia_curso_id=curso.id
        ),
    )

    with pytest.raises(DocenteConAsignaciones) as error:
        eliminar_docente(db_session, docente)

    assert error.value.message == "No se puede eliminar a Juan Pérez: tiene 1 materia asignada"
