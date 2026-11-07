"""Mejoras de estructura, asignaciones docentes y bandeja de justificaciones.

Cubre las validaciones de dependencias al borrar, la edición/alta masiva de asignaciones y
los filtros de la bandeja institucional.
"""

import uuid
from datetime import date, datetime

import pytest

from src.academico.exceptions import (
    AnioConMaterias,
    DivisionConInscripciones,
    DivisionConMaterias,
    MateriaNoCorrespondeADivision,
)
from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    JustificacionInasistencia,
    Materia,
    MotivoJustificacion,
    NivelEducativo,
)
from src.academico.schemas import (
    AsignacionDocenteBulkCreate,
    AsignacionDocenteBulkItem,
    AsignacionDocenteCreate,
    AsignacionDocenteUpdate,
)
from src.academico.service import (
    actualizar_asignacion_docente,
    crear_asignacion_docente,
    crear_asignaciones_docentes_bulk,
    eliminar_anio,
    eliminar_division,
)
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from tests.familias_alumnos.test_mis_alumnos import _crear_familia_con_alumno


def _estructura(db, *, nivel="Primario", numero=4, division="4°B"):
    nivel_row = NivelEducativo(nombre=nivel)
    db.add(nivel_row)
    db.flush()
    anio = Anio(numero=numero, nivel_educativo_id=nivel_row.id)
    db.add(anio)
    db.flush()
    division_row = Division(nombre=division, anio_id=anio.id)
    db.add(division_row)
    db.flush()
    return nivel_row, anio, division_row


def _docente(db):
    persona = Persona(nombre="Julia", apellido="Sosa", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    docente = Docente(legajo=f"D-{uuid.uuid4().hex[:8]}", persona_id=persona.id)
    db.add(docente)
    db.flush()
    return docente


def _inscripcion(db, division):
    persona = Persona(nombre="Ana", apellido="Paz", dni=uuid.uuid4().hex[:8])
    db.add(persona)
    db.flush()
    alumno = Alumno(
        numero_legajo=f"A-{uuid.uuid4().hex[:8]}", estado="activo", persona_id=persona.id
    )
    db.add(alumno)
    db.flush()
    inscripcion = Inscripcion(
        ciclo_lectivo="2027",
        fecha_inscripcion=date(2027, 3, 1),
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division.id,
    )
    db.add(inscripcion)
    db.flush()
    return inscripcion


# --- Dependencias al eliminar estructura ------------------------------------------------


def test_no_elimina_anio_con_materias(db_session):
    nivel = NivelEducativo(nombre="Primario")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    db_session.add(Materia(nombre="Matemática", tipo="materia", anio_id=anio.id))
    db_session.commit()

    with pytest.raises(AnioConMaterias):
        eliminar_anio(db_session, anio)


def test_no_elimina_division_con_materias_propias(db_session):
    _, anio, division = _estructura(db_session)
    db_session.add(
        Materia(nombre="Taller de arte", tipo="taller", anio_id=anio.id, division_id=division.id)
    )
    db_session.commit()

    with pytest.raises(DivisionConMaterias):
        eliminar_division(db_session, division)


def test_no_elimina_division_con_inscripciones(db_session):
    _, _, division = _estructura(db_session)
    _inscripcion(db_session, division)
    db_session.commit()

    with pytest.raises(DivisionConInscripciones):
        eliminar_division(db_session, division)


# --- Asignaciones docentes ---------------------------------------------------------------


def test_crear_asignacion_rechaza_materia_de_otro_anio(db_session):
    _, _, division = _estructura(db_session, nivel="Primario", numero=4, division="4°A")
    _, anio_secundario, _ = _estructura(db_session, nivel="Secundario", numero=1, division="1°A")
    materia = Materia(nombre="Historia", tipo="materia", anio_id=anio_secundario.id)
    db_session.add(materia)
    docente = _docente(db_session)
    db_session.commit()

    with pytest.raises(MateriaNoCorrespondeADivision):
        crear_asignacion_docente(
            db_session,
            AsignacionDocenteCreate(
                ciclo_lectivo="2027",
                docente_id=docente.id,
                materia_id=materia.id,
                division_id=division.id,
            ),
        )


def test_actualizar_asignacion_cambia_materia(db_session):
    _, anio, division = _estructura(db_session)
    materia_uno = Materia(nombre="Lengua", tipo="materia", anio_id=anio.id)
    materia_dos = Materia(nombre="Matemática", tipo="materia", anio_id=anio.id)
    docente = _docente(db_session)
    db_session.add_all([materia_uno, materia_dos])
    db_session.commit()
    asignacion = crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027",
            docente_id=docente.id,
            materia_id=materia_uno.id,
            division_id=division.id,
        ),
    )

    actualizada = actualizar_asignacion_docente(
        db_session, asignacion, AsignacionDocenteUpdate(materia_id=materia_dos.id)
    )

    assert actualizada.materia_id == materia_dos.id


def test_alta_masiva_omite_asignaciones_ya_existentes(db_session):
    _, anio, division = _estructura(db_session)
    materia_uno = Materia(nombre="Lengua", tipo="materia", anio_id=anio.id)
    materia_dos = Materia(nombre="Matemática", tipo="materia", anio_id=anio.id)
    docente = _docente(db_session)
    db_session.add_all([materia_uno, materia_dos])
    db_session.commit()
    crear_asignacion_docente(
        db_session,
        AsignacionDocenteCreate(
            ciclo_lectivo="2027",
            docente_id=docente.id,
            materia_id=materia_uno.id,
            division_id=division.id,
        ),
    )

    resultado = crear_asignaciones_docentes_bulk(
        db_session,
        AsignacionDocenteBulkCreate(
            ciclo_lectivo="2027",
            docente_id=docente.id,
            items=[
                AsignacionDocenteBulkItem(materia_id=materia_uno.id, division_id=division.id),
                AsignacionDocenteBulkItem(materia_id=materia_dos.id, division_id=division.id),
            ],
        ),
    )

    assert len(resultado.creadas) == 1
    assert len(resultado.omitidas) == 1
    assert db_session.query(AsignacionDocente).count() == 2


# --- Bandeja de justificaciones ----------------------------------------------------------


def _crear_justificacion(db, alumno_id, *, estado="pendiente", fecha=date(2027, 4, 1)):
    inscripcion = db.query(Inscripcion).filter_by(alumno_id=alumno_id).one()
    asistencia = Asistencia(fecha=fecha, tipo="ausente_pendiente", inscripcion_id=inscripcion.id)
    db.add(asistencia)
    db.flush()
    motivo = MotivoJustificacion(nombre="Salud")
    db.add(motivo)
    db.flush()
    justificacion = JustificacionInasistencia(
        estado=estado,
        fecha_carga=datetime(2027, 4, 2, 9, 0),
        asistencia_id=asistencia.id,
        familia_id=db.query(Familia).first().id,
        motivo_justificacion_id=motivo.id,
        usuario_id=db.query(Usuario).first().id,
    )
    db.add(justificacion)
    db.commit()
    return justificacion


def test_bandeja_pagina_y_resume_por_estado(client_secretaria, db_session):
    _, alumno_uno = _crear_familia_con_alumno(db_session)
    _crear_justificacion(db_session, alumno_uno, estado="pendiente")

    respuesta = client_secretaria.get("/academico/justificaciones?tamanio_pagina=10")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["total"] == 1
    assert cuerpo["resumen"] == {
        "pendientes": 1,
        "aprobadas": 0,
        "rechazadas": 0,
        "total": 1,
    }
    assert cuerpo["items"][0]["alumno_nombre"] == "Martina Ibáñez"
    assert cuerpo["items"][0]["division_nombre"] == "4°B"


def test_bandeja_filtra_por_estado_y_busqueda(client_secretaria, db_session):
    _, alumno_uno = _crear_familia_con_alumno(db_session)
    _crear_justificacion(db_session, alumno_uno, estado="aprobada", fecha=date(2027, 4, 1))
    _crear_justificacion(db_session, alumno_uno, estado="rechazada", fecha=date(2027, 4, 2))

    aprobadas = client_secretaria.get("/academico/justificaciones?estado=aprobada").json()
    assert aprobadas["total"] == 1
    assert aprobadas["items"][0]["estado"] == "aprobada"

    sin_resultados = client_secretaria.get("/academico/justificaciones?busqueda=NoExiste").json()
    assert sin_resultados["total"] == 0


def test_bandeja_busqueda_ignora_acentos_y_mayusculas(client_secretaria, db_session):
    _, alumno_uno = _crear_familia_con_alumno(db_session)
    _crear_justificacion(db_session, alumno_uno)

    for termino in ("ibanez", "IBAÑEZ", "Ibáñez"):
        respuesta = client_secretaria.get(
            "/academico/justificaciones", params={"busqueda": termino}
        )
        assert respuesta.status_code == 200
        assert respuesta.json()["total"] == 1


def test_opciones_de_justificaciones_incluye_alumno_y_curso(client_secretaria, db_session):
    _, alumno_uno = _crear_familia_con_alumno(db_session)
    _crear_justificacion(db_session, alumno_uno)

    respuesta = client_secretaria.get("/academico/justificaciones/opciones")

    assert respuesta.status_code == 200
    opciones = respuesta.json()
    assert len(opciones) == 1
    assert opciones[0]["alumno_nombre"] == "Ibáñez, Martina"
    assert opciones[0]["division_nombre"] == "4°B"
