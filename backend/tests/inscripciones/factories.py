import uuid
from datetime import date

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.models import Persona


def crear_escenario(
    db_session,
    *,
    estado_solicitud="aprobada",
    etapa="inscripcion_confirmada",
    nombre_alumno="Tiziano",
):
    aspirante_persona_id = uuid.uuid4()
    familiar_persona_id = uuid.uuid4()
    alumno_id = uuid.uuid4()
    familia_id = uuid.uuid4()
    nivel_id = uuid.uuid4()
    anio_id = uuid.uuid4()
    division_id = uuid.uuid4()
    usuario_id = uuid.uuid4()
    solicitud_id = uuid.uuid4()

    db_session.add_all(
        [
            Persona(
                id=aspirante_persona_id,
                nombre=nombre_alumno,
                apellido="Cabral",
                dni="50111222",
            ),
            Persona(
                id=familiar_persona_id,
                nombre="Lorena",
                apellido="Cabral",
                dni="30111222",
            ),
            Alumno(
                id=alumno_id,
                numero_legajo="A-2027-001",
                estado="activo",
                persona_id=aspirante_persona_id,
            ),
            Familia(id=familia_id, estado_deuda="al_dia", persona_id=familiar_persona_id),
            FamiliaAlumno(
                parentesco="madre",
                responsable_principal=True,
                recibe_comunicaciones=True,
                familia_id=familia_id,
                alumno_id=alumno_id,
            ),
            NivelEducativo(id=nivel_id, nombre="Primario"),
            Anio(id=anio_id, numero=4, nivel_educativo_id=nivel_id),
            Division(id=division_id, nombre="4°B", anio_id=anio_id),
            Usuario(
                id=usuario_id,
                email="secretaria@esseri.edu.ar",
                auth_provider="google",
                estado="activo",
            ),
            SolicitudInscripcion(
                id=solicitud_id,
                ciclo_lectivo="2027",
                etapa=etapa,
                estado=estado_solicitud,
                fecha_solicitud=date(2026, 8, 2),
                aspirante_persona_id=aspirante_persona_id,
                nivel_educativo_id=nivel_id,
                usuario_id=usuario_id,
            ),
        ]
    )
    db_session.commit()

    return {
        "aspirante_persona_id": aspirante_persona_id,
        "alumno_id": alumno_id,
        "familia_id": familia_id,
        "nivel_id": nivel_id,
        "division_id": division_id,
        "solicitud_id": solicitud_id,
    }


def crear_payload(escenario):
    return {
        "ciclo_lectivo": "2027",
        "fecha_inscripcion": "2026-08-27",
        "alumno_id": str(escenario["alumno_id"]),
        "division_id": str(escenario["division_id"]),
        "solicitud_inscripcion_id": str(escenario["solicitud_id"]),
    }


def crear_inscripcion_previa(db_session, escenario, *, ciclo="2027", estado="finalizada"):
    inscripcion = Inscripcion(
        ciclo_lectivo=ciclo,
        fecha_inscripcion=date(2026, 8, 27),
        tipo="nueva",
        estado=estado,
        alumno_id=escenario["alumno_id"],
        division_id=escenario["division_id"],
        solicitud_inscripcion_id=escenario["solicitud_id"],
    )
    db_session.add(inscripcion)
    db_session.commit()
    return inscripcion


def crear_payload_reinscripcion(escenario, *, ciclo="2028"):
    return {
        "ciclo_lectivo": ciclo,
        "fecha_inscripcion": "2027-08-27",
        "alumno_id": str(escenario["alumno_id"]),
        "division_id": str(escenario["division_id"]),
    }


def crear_payload_solicitud(escenario):
    return {
        "ciclo_lectivo": "2027",
        "fecha_solicitud": "2026-08-02",
        "nivel_educativo_id": str(escenario["nivel_id"]),
        "aspirante": {
            "nombre": "Sofía",
            "apellido": "Vega",
            "dni": "50999888",
            "telefono": "1122334455",
        },
        "contacto": {
            "nombre": "Laura",
            "apellido": "Vega",
            "dni": "30999888",
        },
        "observaciones": "Consulta inicial.",
    }


def crear_division_destino(db_session, escenario):
    division_id = uuid.uuid4()
    db_session.add(
        Division(
            id=division_id,
            nombre="4°A",
            anio_id=db_session.get(Division, escenario["division_id"]).anio_id,
        )
    )
    db_session.commit()
    return division_id
