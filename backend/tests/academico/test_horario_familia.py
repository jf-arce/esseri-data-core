"""Horario semanal de solo lectura que ve el Portal Familia."""

from datetime import time

from src.academico.models import HorarioMateriaCurso, Materia, MateriaCurso
from src.inscripciones.models import Inscripcion


def _crear_materia_con_horario(db_session, division_id):
    materia = Materia(nombre="Matemática", tipo="materia", color="#2563eb")
    db_session.add(materia)
    db_session.flush()

    materia_curso = MateriaCurso(materia_id=materia.id, division_id=division_id)
    db_session.add(materia_curso)
    db_session.flush()

    db_session.add(
        HorarioMateriaCurso(
            dia_semana=1,
            hora_inicio=time(8, 0),
            hora_fin=time(9, 30),
            materia_curso_id=materia_curso.id,
        )
    )
    db_session.commit()
    return materia_curso


def test_familia_ve_el_horario_del_curso_de_su_alumno(
    client_familia, db_session, escenario_dos_familias
):
    _crear_materia_con_horario(db_session, escenario_dos_familias["division"])

    respuesta = client_familia.get(
        f"/academico/familia/alumnos/{escenario_dos_familias['alumno_a']}/horario"
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo) == 1
    assert cuerpo[0]["materia_nombre"] == "Matemática"
    assert cuerpo[0]["division_nombre"] == "4°B"
    assert len(cuerpo[0]["horarios"]) == 1
    horario = cuerpo[0]["horarios"][0]
    assert (horario["dia_semana"], horario["hora_inicio"], horario["hora_fin"]) == (
        1,
        "08:00:00",
        "09:30:00",
    )


def test_familia_ajena_no_puede_ver_el_horario(client_familia, db_session, escenario_dos_familias):
    _crear_materia_con_horario(db_session, escenario_dos_familias["division"])

    respuesta = client_familia.get(
        f"/academico/familia/alumnos/{escenario_dos_familias['alumno_b']}/horario"
    )

    assert respuesta.status_code == 403


def test_alumno_sin_inscripcion_activa_no_tiene_horario(
    client_familia, db_session, escenario_dos_familias
):
    _crear_materia_con_horario(db_session, escenario_dos_familias["division"])
    inscripcion = db_session.get(Inscripcion, escenario_dos_familias["inscripcion_a"])
    inscripcion.estado = "finalizada"
    db_session.commit()

    respuesta = client_familia.get(
        f"/academico/familia/alumnos/{escenario_dos_familias['alumno_a']}/horario"
    )

    assert respuesta.status_code == 200
    assert respuesta.json() == []
