"""Catálogo global de materias, materia-curso y horarios.

Cubre el rediseño de Académico: la materia se crea una sola vez en un catálogo y se asigna a
distintos cursos con día y horario. La asignación docente apunta a la materia-curso, que es la
única fuente de verdad de materia + división + horario.
"""

import uuid
from datetime import time

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from src.academico.exceptions import (
    AsignacionDocenteDuplicada,
    HorarioDuplicado,
    MateriaConCursos,
    MateriaCursoDuplicada,
    MateriaDuplicada,
)
from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    Materia,
    MateriaCurso,
    NivelEducativo,
)
from src.academico.schemas import (
    AsignacionDocenteCreate,
    HorarioMateriaCursoCreate,
    MateriaCreate,
    MateriaCursoCreate,
    MateriaCursoResponse,
    MateriaCursoUpdate,
    MateriaUpdate,
)
from src.academico.service import (
    actualizar_materia,
    actualizar_materia_curso,
    crear_asignacion_docente,
    crear_materia,
    crear_materia_curso,
    eliminar_materia,
    eliminar_materia_curso,
    listar_materias,
    listar_materias_curso,
)
from src.models import AuditLog, Persona


def _estructura(db, *, numero=4, division="4°B"):
    nivel = NivelEducativo(nombre="Primario")
    db.add(nivel)
    db.flush()
    anio = Anio(numero=numero, nivel_educativo_id=nivel.id)
    db.add(anio)
    db.flush()
    division_row = Division(nombre=division, anio_id=anio.id)
    db.add(division_row)
    db.flush()
    return anio, division_row


def _docente(db):
    persona = Persona(nombre="Julia", apellido="Sosa", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    docente = Docente(legajo=f"D-{uuid.uuid4().hex[:8]}", persona_id=persona.id)
    db.add(docente)
    db.flush()
    return docente


def _franja(dia=1, inicio=time(8, 0), fin=time(9, 0)):
    return HorarioMateriaCursoCreate(dia_semana=dia, hora_inicio=inicio, hora_fin=fin)


# --- Catálogo -----------------------------------------------------------------------------


def test_crear_materia_guarda_nombre_normalizado(db_session):
    materia = crear_materia(db_session, MateriaCreate(nombre="  Inglés  ", tipo="materia"))

    assert materia.nombre == "Inglés"
    assert materia.nombre_normalizado == "ingles"


def test_crear_materia_rechaza_duplicado_con_mayusculas_y_acentos(db_session):
    crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    with pytest.raises(MateriaDuplicada):
        crear_materia(db_session, MateriaCreate(nombre="INGLES", tipo="materia"))


def test_actualizar_materia_rechaza_nombre_duplicado(db_session):
    crear_materia(db_session, MateriaCreate(nombre="Lengua", tipo="materia"))
    matematica = crear_materia(db_session, MateriaCreate(nombre="Matemática", tipo="materia"))

    with pytest.raises(MateriaDuplicada):
        actualizar_materia(db_session, matematica, MateriaUpdate(nombre="lengua"))


def test_actualizar_materia_permite_mantener_su_propio_nombre(db_session):
    materia = crear_materia(db_session, MateriaCreate(nombre="Lengua", tipo="materia"))

    actualizada = actualizar_materia(db_session, materia, MateriaUpdate(tipo="taller"))

    assert actualizada.tipo == "taller"
    assert actualizada.nombre_normalizado == "lengua"


def test_listar_materias_cuenta_los_cursos(db_session):
    _, division_uno = _estructura(db_session)
    _, division_dos = _estructura(db_session, numero=5, division="5°A")
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_uno.id, horarios=[_franja()]
        ),
    )
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_dos.id, horarios=[_franja()]
        ),
    )

    listado = listar_materias(db_session)

    assert len(listado) == 1
    assert listado[0].cantidad_cursos == 2


def test_no_elimina_materia_asignada_a_un_curso(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )

    with pytest.raises(MateriaConCursos):
        eliminar_materia(db_session, materia)


def test_elimina_materia_sin_cursos(db_session):
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    eliminar_materia(db_session, materia)

    assert db_session.get(Materia, materia.id) is None


# --- MateriaCurso -------------------------------------------------------------------------


def test_una_misma_materia_se_asigna_a_distintos_cursos(db_session):
    _, division_uno = _estructura(db_session)
    _, division_dos = _estructura(db_session, numero=5, division="5°A")
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    curso_uno = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_uno.id, horarios=[_franja()]
        ),
    )
    curso_dos = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_dos.id, horarios=[_franja(dia=2)]
        ),
    )

    assert curso_uno.materia_id == materia.id
    assert curso_dos.materia_id == materia.id
    assert curso_uno.division_id != curso_dos.division_id


def test_materia_curso_rechaza_la_misma_materia_en_el_mismo_curso(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )

    with pytest.raises(MateriaCursoDuplicada):
        crear_materia_curso(
            db_session,
            MateriaCursoCreate(
                materia_id=materia.id, division_id=division.id, horarios=[_franja(dia=2)]
            ),
        )


def test_materia_curso_puede_crear_la_materia_en_el_momento(db_session):
    _, division = _estructura(db_session)

    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_nombre="Plástica",
            materia_tipo="taller",
            division_id=division.id,
            horarios=[_franja()],
        ),
    )

    assert curso.materia.nombre == "Plástica"
    assert curso.materia.tipo == "taller"
    assert curso.materia.nombre_normalizado == "plastica"


def test_materia_curso_rechaza_crear_materia_con_nombre_duplicado(db_session):
    _, division = _estructura(db_session)
    crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    with pytest.raises(MateriaDuplicada):
        crear_materia_curso(
            db_session,
            MateriaCursoCreate(
                materia_nombre="ingles",
                division_id=division.id,
                horarios=[_franja()],
            ),
        )


def test_materia_curso_rechaza_franjas_repetidas(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    with pytest.raises(HorarioDuplicado):
        crear_materia_curso(
            db_session,
            MateriaCursoCreate(
                materia_id=materia.id,
                division_id=division.id,
                horarios=[_franja(dia=1), _franja(dia=1)],
            ),
        )


def test_materia_curso_guarda_varias_franjas_ordenadas(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))

    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id,
            division_id=division.id,
            horarios=[
                _franja(dia=3, inicio=time(10, 0), fin=time(11, 0)),
                _franja(dia=1, inicio=time(8, 0), fin=time(9, 0)),
            ],
        ),
    )

    assert [(h.dia_semana, h.hora_inicio) for h in curso.horarios] == [
        (1, time(8, 0)),
        (3, time(10, 0)),
    ]


def test_actualizar_horarios_reemplaza_las_franjas_anteriores(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division.id, horarios=[_franja(dia=1)]
        ),
    )

    actualizado = actualizar_materia_curso(
        db_session,
        curso,
        MateriaCursoUpdate(horarios=[_franja(dia=5, inicio=time(14, 0), fin=time(15, 0))]),
    )

    assert [(h.dia_semana, h.hora_inicio) for h in actualizado.horarios] == [(5, time(14, 0))]


def test_listar_materias_curso_filtra_por_division(db_session):
    _, division_uno = _estructura(db_session)
    _, division_dos = _estructura(db_session, numero=5, division="5°A")
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_uno.id, horarios=[_franja()]
        ),
    )
    crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division_dos.id, horarios=[_franja()]
        ),
    )

    listado = listar_materias_curso(db_session, division_id=division_uno.id)

    assert len(listado) == 1
    assert listado[0].division_id == division_uno.id


def test_quita_materia_curso_con_sus_asignaciones_de_todos_los_ciclos(db_session):
    _, division = _estructura(db_session)
    ingles = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    arte = crear_materia(db_session, MateriaCreate(nombre="Arte", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=ingles.id, division_id=division.id, horarios=[_franja()]),
    )
    otra = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=arte.id, division_id=division.id, horarios=[_franja(dia=2)]),
    )
    docente = _docente(db_session)
    for ciclo in ("2026", "2027"):
        crear_asignacion_docente(
            db_session,
            AsignacionDocenteCreate(
                ciclo_lectivo=ciclo, docente_id=docente.id, materia_curso_id=curso.id
            ),
        )
    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=otra.id
        ),
    )
    curso_id = curso.id

    eliminar_materia_curso(db_session, curso)

    assert db_session.get(MateriaCurso, curso_id) is None
    restantes = db_session.scalars(select(AsignacionDocente)).all()
    assert [a.materia_curso_id for a in restantes] == [otra.id]
    auditadas = db_session.scalars(
        select(AuditLog).where(
            AuditLog.entidad == "ASIGNACION_DOCENTE", AuditLog.campo == "__eliminacion__"
        )
    ).all()
    assert len(auditadas) == 2


def test_quita_materia_curso_sin_docentes(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )

    eliminar_materia_curso(db_session, curso)

    assert db_session.get(MateriaCurso, curso.id) is None


# --- Asignación docente sobre materia-curso -----------------------------------------------


def test_asignacion_docente_hereda_materia_division_y_horario(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_id=materia.id, division_id=division.id, horarios=[_franja(dia=2)]
        ),
    )
    docente = _docente(db_session)

    asignacion = crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=curso.id
        ),
    )

    assert asignacion.materia_id == materia.id
    assert asignacion.division_id == division.id
    assert [h.dia_semana for h in asignacion.horarios] == [2]


def test_asignacion_docente_duplicada_en_el_mismo_ciclo(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )
    docente = _docente(db_session)
    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=curso.id
        ),
    )

    with pytest.raises(AsignacionDocenteDuplicada):
        crear_asignacion_docente(
            db_session,
            AsignacionDocenteCreate(
                ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=curso.id
            ),
        )


def test_asignacion_docente_rechaza_materia_curso_inexistente(db_session):
    docente = _docente(db_session)

    with pytest.raises(HTTPException) as excinfo:
        crear_asignacion_docente(
            db_session,
            AsignacionDocenteCreate(
                ciclo_lectivo="2027",
                docente_id=docente.id,
                materia_curso_id=uuid.uuid4(),
            ),
        )

    assert excinfo.value.status_code == 404


def test_asignacion_docente_puede_repetirse_en_otro_ciclo(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Inglés", tipo="materia"))
    curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )
    docente = _docente(db_session)

    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027", docente_id=docente.id, materia_curso_id=curso.id
        ),
    )
    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2028", docente_id=docente.id, materia_curso_id=curso.id
        ),
    )

    assert db_session.query(AsignacionDocente).count() == 2


# --- Color de la materia ------------------------------------------------------------------


def test_materia_guarda_color_en_minusculas(db_session):
    materia = crear_materia(
        db_session, MateriaCreate(nombre="Arte", tipo="taller", color="#1E90FF")
    )

    assert materia.color == "#1e90ff"


def test_materia_sin_color_recibe_uno_sorteado(db_session):
    from src.academico.models import COLORES_MATERIA

    materia = crear_materia(db_session, MateriaCreate(nombre="Arte", tipo="taller"))

    assert materia.color in COLORES_MATERIA


@pytest.mark.parametrize("invalido", ["rojo", "#12345", "#12345g", "123456", "#1234567"])
def test_materia_rechaza_color_invalido(invalido):
    with pytest.raises(ValueError):
        MateriaCreate(nombre="Arte", tipo="taller", color=invalido)


def test_actualizar_color(db_session):
    materia = crear_materia(db_session, MateriaCreate(nombre="Arte", tipo="taller"))

    actualizar_materia(db_session, materia, MateriaUpdate(color="#00FF00"))

    assert materia.color == "#00ff00"


def test_actualizar_rechaza_dejar_el_color_vacio():
    with pytest.raises(ValueError):
        MateriaUpdate(color=None)


def test_actualizar_otro_campo_no_toca_el_color(db_session):
    materia = crear_materia(
        db_session, MateriaCreate(nombre="Arte", tipo="taller", color="#00ff00")
    )

    actualizar_materia(db_session, materia, MateriaUpdate(nombre="Arte y Música"))

    assert materia.color == "#00ff00"


def test_materia_curso_expone_el_color_de_la_materia(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(
        db_session, MateriaCreate(nombre="Arte", tipo="taller", color="#00ff00")
    )
    materia_curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_id=materia.id, division_id=division.id, horarios=[_franja()]),
    )

    assert MateriaCursoResponse.model_validate(materia_curso).materia_color == "#00ff00"


def test_materia_curso_crea_la_materia_nueva_con_el_color_elegido(db_session):
    _, division = _estructura(db_session)

    materia_curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(
            materia_nombre="Arte",
            materia_tipo="taller",
            materia_color="#AA00FF",
            division_id=division.id,
            horarios=[_franja()],
        ),
    )

    assert materia_curso.materia.color == "#aa00ff"


def test_materia_curso_sortea_color_si_no_se_elige(db_session):
    from src.academico.models import COLORES_MATERIA

    _, division = _estructura(db_session)

    materia_curso = crear_materia_curso(
        db_session,
        MateriaCursoCreate(materia_nombre="Arte", division_id=division.id, horarios=[_franja()]),
    )

    assert materia_curso.materia.color in COLORES_MATERIA


def test_materia_curso_rechaza_color_con_materia_existente(db_session):
    _, division = _estructura(db_session)
    materia = crear_materia(db_session, MateriaCreate(nombre="Arte", tipo="taller"))

    with pytest.raises(ValueError):
        MateriaCursoCreate(
            materia_id=materia.id,
            materia_color="#aa00ff",
            division_id=division.id,
            horarios=[_franja()],
        )
