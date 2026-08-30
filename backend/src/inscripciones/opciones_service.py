"""Opciones válidas para los formularios de inscripción."""

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    DivisionOpcionRead,
    SolicitudInscripcionOpcionRead,
)
from src.models import Persona


def listar_solicitudes_disponibles(
    db: Session,
    *,
    buscar: str | None = None,
    limite: int = 50,
) -> list[SolicitudInscripcionOpcionRead]:
    """Lista solicitudes confirmadas que todavía cumplen las reglas de una inscripción nueva."""

    tiene_vinculo_familiar = exists(
        select(FamiliaAlumno.id).where(FamiliaAlumno.alumno_id == Alumno.id)
    )
    solicitud_utilizada = exists(
        select(Inscripcion.id).where(
            Inscripcion.solicitud_inscripcion_id == SolicitudInscripcion.id
        )
    )
    alumno_ya_inscripto = exists(
        select(Inscripcion.id).where(
            Inscripcion.alumno_id == Alumno.id,
            Inscripcion.ciclo_lectivo == SolicitudInscripcion.ciclo_lectivo,
        )
    )

    statement = (
        select(SolicitudInscripcion, Alumno, Persona, NivelEducativo)
        .join(Alumno, Alumno.persona_id == SolicitudInscripcion.aspirante_persona_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .join(
            NivelEducativo,
            NivelEducativo.id == SolicitudInscripcion.nivel_educativo_id,
        )
        .where(
            SolicitudInscripcion.estado == "aprobada",
            SolicitudInscripcion.etapa == "inscripcion_confirmada",
            tiene_vinculo_familiar,
            ~solicitud_utilizada,
            ~alumno_ya_inscripto,
        )
        .order_by(Persona.apellido, Persona.nombre, SolicitudInscripcion.fecha_solicitud)
    )
    termino = buscar.strip() if buscar else ""
    if termino:
        patron = f"%{termino}%"
        statement = statement.where(
            or_(
                Persona.nombre.ilike(patron),
                Persona.apellido.ilike(patron),
                Alumno.numero_legajo.ilike(patron),
            )
        )
    statement = statement.limit(limite)

    return [
        SolicitudInscripcionOpcionRead(
            id=solicitud.id,
            ciclo_lectivo=solicitud.ciclo_lectivo,
            fecha_solicitud=solicitud.fecha_solicitud,
            alumno_id=alumno.id,
            alumno_nombre=persona.nombre,
            alumno_apellido=persona.apellido,
            numero_legajo=alumno.numero_legajo,
            nivel_educativo_id=nivel.id,
            nivel_educativo_nombre=nivel.nombre,
        )
        for solicitud, alumno, persona, nivel in db.execute(statement).all()
    ]


def listar_divisiones_disponibles(db: Session) -> list[DivisionOpcionRead]:
    """Lista divisiones con nivel y año para evitar exponer identificadores sin contexto."""

    statement = (
        select(Division, Anio, NivelEducativo)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .order_by(NivelEducativo.nombre, Anio.numero, Division.nombre)
    )

    return [
        DivisionOpcionRead(
            id=division.id,
            nombre=division.nombre,
            anio_numero=anio.numero,
            nivel_educativo_id=nivel.id,
            nivel_educativo_nombre=nivel.nombre,
        )
        for division, anio, nivel in db.execute(statement).all()
    ]


def listar_alumnos_elegibles_reinscripcion(
    db: Session,
    ciclo_lectivo: str,
    *,
    buscar: str | None = None,
    limite: int = 50,
) -> list[AlumnoReinscripcionOpcionRead]:
    """Lista alumnos que satisfacen las mismas reglas usadas al crear una reinscripción."""

    ciclo_anterior = str(int(ciclo_lectivo) - 1)
    tiene_vinculo_familiar = exists(
        select(FamiliaAlumno.id).where(FamiliaAlumno.alumno_id == Alumno.id)
    )
    tiene_inscripcion_anterior = exists(
        select(Inscripcion.id).where(
            Inscripcion.alumno_id == Alumno.id,
            Inscripcion.ciclo_lectivo == ciclo_anterior,
            Inscripcion.estado != "baja",
        )
    )
    tiene_inscripcion_destino = exists(
        select(Inscripcion.id).where(
            Inscripcion.alumno_id == Alumno.id,
            Inscripcion.ciclo_lectivo == ciclo_lectivo,
        )
    )

    statement = (
        select(Alumno, Persona)
        .join(Persona, Persona.id == Alumno.persona_id)
        .where(
            Alumno.estado == "activo",
            tiene_vinculo_familiar,
            tiene_inscripcion_anterior,
            ~tiene_inscripcion_destino,
        )
        .order_by(Persona.apellido, Persona.nombre)
    )
    termino = buscar.strip() if buscar else ""
    if termino:
        patron = f"%{termino}%"
        statement = statement.where(
            or_(
                Persona.nombre.ilike(patron),
                Persona.apellido.ilike(patron),
                Alumno.numero_legajo.ilike(patron),
            )
        )
    statement = statement.limit(limite)

    return [
        AlumnoReinscripcionOpcionRead(
            alumno_id=alumno.id,
            alumno_nombre=persona.nombre,
            alumno_apellido=persona.apellido,
            numero_legajo=alumno.numero_legajo,
            ciclo_anterior=ciclo_anterior,
        )
        for alumno, persona in db.execute(statement).all()
    ]
