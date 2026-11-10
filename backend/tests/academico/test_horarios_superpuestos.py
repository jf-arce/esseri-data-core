"""Una división no puede tener dos materias en la misma franja horaria."""

from datetime import time

import pytest

from src.academico.exceptions import HorarioDuplicado, HorarioSuperpuestoEnDivision
from src.academico.models import Anio, Division, NivelEducativo
from src.academico.schemas import (
    HorarioMateriaCursoCreate,
    MateriaCreate,
    MateriaCursoCreate,
    MateriaCursoUpdate,
)
from src.academico.service import (
    actualizar_materia_curso,
    crear_materia,
    crear_materia_curso,
)


def _franja(dia=1, inicio=time(8, 0), fin=time(9, 0)):
    return HorarioMateriaCursoCreate(dia_semana=dia, hora_inicio=inicio, hora_fin=fin)


def _division(db, nombre="4°B"):
    nivel = db.query(NivelEducativo).first() or NivelEducativo(nombre="Primario")
    db.add(nivel)
    db.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    division = Division(nombre=nombre, anio_id=anio.id)
    db.add(division)
    db.flush()
    return division


def _asignar(db, division, nombre, *franjas):
    materia = crear_materia(db, MateriaCreate(nombre=nombre, tipo="materia"))
    return crear_materia_curso(
        db,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=list(franjas)),
    )


def test_rechaza_superposicion_total_con_otra_materia(db_session):
    division = _division(db_session)
    _asignar(db_session, division, "Matemática", _franja())

    with pytest.raises(HorarioSuperpuestoEnDivision) as error:
        _asignar(db_session, division, "Lengua", _franja())

    assert error.value.message == "Se superpone con Matemática, lunes de 08:00 a 09:00"


def test_rechaza_superposicion_parcial(db_session):
    division = _division(db_session)
    _asignar(db_session, division, "Matemática", _franja())

    with pytest.raises(HorarioSuperpuestoEnDivision):
        _asignar(db_session, division, "Lengua", _franja(inicio=time(8, 30), fin=time(9, 30)))


def test_permite_franjas_contiguas(db_session):
    division = _division(db_session)
    _asignar(db_session, division, "Matemática", _franja())

    lengua = _asignar(db_session, division, "Lengua", _franja(inicio=time(9, 0), fin=time(10, 0)))

    assert len(lengua.horarios) == 1


def test_permite_el_mismo_horario_en_otro_dia(db_session):
    division = _division(db_session)
    _asignar(db_session, division, "Matemática", _franja(dia=1))

    assert _asignar(db_session, division, "Lengua", _franja(dia=2))


def test_permite_el_mismo_horario_en_otra_division(db_session):
    _asignar(db_session, _division(db_session, "4°B"), "Matemática", _franja())

    assert _asignar(db_session, _division(db_session, "4°C"), "Lengua", _franja())


def test_rechaza_franjas_que_se_pisan_dentro_de_la_misma_materia(db_session):
    division = _division(db_session)

    with pytest.raises(HorarioDuplicado):
        _asignar(
            db_session,
            division,
            "Matemática",
            _franja(),
            _franja(inicio=time(8, 30), fin=time(9, 30)),
        )


def test_editar_una_materia_no_choca_con_sus_propias_franjas(db_session):
    division = _division(db_session)
    matematica = _asignar(db_session, division, "Matemática", _franja())

    actualizada = actualizar_materia_curso(
        db_session,
        matematica,
        MateriaCursoUpdate(horarios=[_franja(inicio=time(8, 30), fin=time(9, 30))]),
    )

    assert actualizada.horarios[0].hora_inicio == time(8, 30)


def test_editar_rechaza_pisar_otra_materia_y_conserva_las_franjas(db_session):
    division = _division(db_session)
    _asignar(db_session, division, "Matemática", _franja())
    lengua = _asignar(db_session, division, "Lengua", _franja(inicio=time(9, 0), fin=time(10, 0)))

    with pytest.raises(HorarioSuperpuestoEnDivision):
        actualizar_materia_curso(
            db_session,
            lengua,
            MateriaCursoUpdate(horarios=[_franja(inicio=time(8, 30), fin=time(9, 30))]),
        )

    db_session.refresh(lengua)
    assert lengua.horarios[0].hora_inicio == time(9, 0)


def test_rechaza_horas_con_zona_horaria(client_secretaria, db_session):
    division = _division(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Lengua", tipo="materia"))
    db_session.commit()

    respuesta = client_secretaria.post(
        "/academico/materias-curso",
        json={
            "materia_id": str(materia.id),
            "division_id": str(division.id),
            "horarios": [{"dia_semana": 1, "hora_inicio": "08:30:00Z", "hora_fin": "09:30:00Z"}],
        },
    )

    assert respuesta.status_code == 422
