from datetime import date

from src.academico.models import Division
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def test_bulk_rejects_student_from_another_division(
    client_docente, db_session, asignar_division_a_docente
):
    escenario = crear_escenario(db_session)
    propia = crear_inscripcion_previa(db_session, escenario, estado="activa")
    anio_id = db_session.get(Division, escenario["division_id"]).anio_id
    otra = Division(nombre="4°C", anio_id=anio_id)
    persona = Persona(nombre="Otra", apellido="Alumna", dni="50999888")
    db_session.add_all([otra, persona])
    db_session.flush()
    alumno = Alumno(numero_legajo="A-2027-099", estado="activo", persona_id=persona.id)
    db_session.add(alumno)
    db_session.flush()
    ajena = Inscripcion(
        ciclo_lectivo="2027",
        fecha_inscripcion=date(2026, 8, 27),
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=otra.id,
    )
    db_session.add(ajena)
    db_session.commit()
    asignar_division_a_docente(escenario["division_id"])
    respuesta = client_docente.post(
        "/academico/asistencias/bulk",
        json={
            "fecha": "2027-03-15",
            "division_id": str(escenario["division_id"]),
            "ciclo_lectivo": "2027",
            "registros": [
                {"inscripcion_id": str(propia.id), "tipo": "presente"},
                {"inscripcion_id": str(ajena.id), "tipo": "presente"},
            ],
        },
    )
    assert respuesta.status_code == 403
    assert (
        db_session.query(Asistencia)
        .filter(Asistencia.inscripcion_id.in_([propia.id, ajena.id]))
        .count()
        == 0
    )
