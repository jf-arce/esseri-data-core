"""Un docente no puede dictar dos materias distintas en la misma franja del mismo ciclo."""

import uuid
from datetime import time

import pytest

from src.academico.exceptions import DocenteConHorarioSuperpuesto
from src.academico.models import Anio, AsignacionDocente, Division, Docente, NivelEducativo
from src.academico.schemas import (
    AsignacionDocenteBulkCreate,
    AsignacionDocenteBulkItem,
    AsignacionDocenteCreate,
    AsignacionDocenteUpdate,
    HorarioMateriaCursoCreate,
    MateriaCreate,
    MateriaCursoCreate,
    MateriaCursoUpdate,
)
from src.academico.service import (
    actualizar_asignacion_docente,
    actualizar_materia_curso,
    crear_asignacion_docente,
    crear_asignaciones_docentes_bulk,
    crear_materia,
    crear_materia_curso,
)
from src.models import Persona


def _franja(dia=1, inicio=time(8, 0), fin=time(9, 0)):
    return HorarioMateriaCursoCreate(dia_semana=dia, hora_inicio=inicio, hora_fin=fin)


def _docente(db):
    persona = Persona(nombre="Julia", apellido="Sosa", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    docente = Docente(legajo=f"D-{uuid.uuid4().hex[:8]}", persona_id=persona.id)
    db.add(docente)
    db.flush()
    return docente


def _divisiones(db):
    nivel = NivelEducativo(nombre="Primario")
    db.add(nivel)
    db.flush()
    anio = Anio(numero=2, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    divisiones = [Division(nombre=nombre, anio_id=anio.id) for nombre in ("2°A", "2°B", "2°C")]
    db.add_all(divisiones)
    db.flush()
    return divisiones


def _materia_curso(db, division, nombre, *franjas):
    materia = crear_materia(db, MateriaCreate(nombre=nombre, tipo="materia"))
    return crear_materia_curso(
        db,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=list(franjas)),
    )


def _asignar(db, docente, materia_curso, ciclo="2026"):
    return crear_asignacion_docente(
        db,
        AsignacionDocenteCreate(
            docente_id=docente.id, materia_curso_id=materia_curso.id, ciclo_lectivo=ciclo
        ),
    )


@pytest.fixture()
def escenario(db_session):
    division_a, division_b, division_c = _divisiones(db_session)
    return {
        "biologia_c": _materia_curso(
            db_session, division_c, "Biología", _franja(inicio=time(10, 0), fin=time(11, 0))
        ),
        "docente": _docente(db_session),
        "lengua_a": _materia_curso(db_session, division_a, "Lengua", _franja()),
        "ingles_b": _materia_curso(db_session, division_b, "Inglés", _franja()),
        "historia_b": _materia_curso(
            db_session, division_b, "Historia", _franja(inicio=time(9, 0), fin=time(10, 0))
        ),
    }


def test_bloquea_el_mismo_ciclo_con_mensaje_claro(db_session, escenario):
    _asignar(db_session, escenario["docente"], escenario["lengua_a"])

    with pytest.raises(DocenteConHorarioSuperpuesto) as error:
        _asignar(db_session, escenario["docente"], escenario["ingles_b"])

    assert error.value.message == (
        "Julia Sosa ya dicta Lengua en 2°A de Primario el lunes de 08:00 a 09:00, en el ciclo 2026"
    )


def test_permite_otro_ciclo(db_session, escenario):
    _asignar(db_session, escenario["docente"], escenario["lengua_a"], "2026")

    assert _asignar(db_session, escenario["docente"], escenario["ingles_b"], "2027")


def test_permite_franjas_contiguas(db_session, escenario):
    _asignar(db_session, escenario["docente"], escenario["lengua_a"])

    assert _asignar(db_session, escenario["docente"], escenario["historia_b"])


def test_permite_pareja_pedagogica_en_la_misma_materia_curso(db_session, escenario):
    _asignar(db_session, escenario["docente"], escenario["lengua_a"])

    assert _asignar(db_session, _docente(db_session), escenario["lengua_a"])


def test_bulk_con_conflicto_no_crea_nada(db_session, escenario):
    docente = escenario["docente"]

    with pytest.raises(DocenteConHorarioSuperpuesto):
        crear_asignaciones_docentes_bulk(
            db_session,
            AsignacionDocenteBulkCreate(
                docente_id=docente.id,
                ciclo_lectivo="2026",
                items=[
                    AsignacionDocenteBulkItem(materia_curso_id=escenario["lengua_a"].id),
                    AsignacionDocenteBulkItem(materia_curso_id=escenario["ingles_b"].id),
                ],
            ),
        )
    db_session.rollback()

    assert db_session.query(AsignacionDocente).filter_by(docente_id=docente.id).count() == 0


def test_cambiar_el_horario_de_la_materia_revalida_a_sus_docentes(db_session, escenario):
    docente = escenario["docente"]
    _asignar(db_session, docente, escenario["lengua_a"])
    _asignar(db_session, docente, escenario["biologia_c"])

    with pytest.raises(DocenteConHorarioSuperpuesto):
        actualizar_materia_curso(
            db_session,
            escenario["biologia_c"],
            MateriaCursoUpdate(horarios=[_franja(inicio=time(8, 30), fin=time(9, 30))]),
        )


def test_mover_una_asignacion_a_otra_materia_revalida_el_horario(db_session, escenario):
    docente = escenario["docente"]
    _asignar(db_session, docente, escenario["lengua_a"])
    asignacion = _asignar(db_session, docente, escenario["historia_b"])

    with pytest.raises(DocenteConHorarioSuperpuesto):
        actualizar_asignacion_docente(
            db_session,
            asignacion,
            AsignacionDocenteUpdate(materia_curso_id=escenario["ingles_b"].id),
        )
