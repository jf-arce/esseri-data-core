"""Lógica de negocio de inscripciones."""

import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.exceptions import (
    ConflictoInscripcion,
    InscripcionInvalida,
    InscripcionNoEncontrada,
)
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.inscripciones.schemas import InscripcionNuevaCreate


def crear_inscripcion_nueva(db: Session, datos: InscripcionNuevaCreate) -> Inscripcion:
    """Confirma la inscripción de un alumno que completó el proceso de admisión."""

    # Los bloqueos serializan altas concurrentes para el mismo alumno o solicitud.
    alumno = db.get(Alumno, datos.alumno_id, with_for_update=True)
    if alumno is None:
        raise InscripcionNoEncontrada("El alumno indicado no existe.")

    division = db.get(Division, datos.division_id)
    if division is None:
        raise InscripcionNoEncontrada("La división indicada no existe.")

    anio = db.get(Anio, division.anio_id)
    if anio is None:
        raise InscripcionInvalida("La división no está vinculada a un año académico válido.")

    vinculo_familiar = db.scalar(
        select(FamiliaAlumno.id).where(FamiliaAlumno.alumno_id == alumno.id).limit(1)
    )
    if vinculo_familiar is None:
        raise InscripcionInvalida(
            "El alumno debe estar vinculado al menos a una familia antes de inscribirse."
        )

    solicitud = db.get(
        SolicitudInscripcion,
        datos.solicitud_inscripcion_id,
        with_for_update=True,
    )
    if solicitud is None:
        raise InscripcionNoEncontrada("La solicitud de inscripción indicada no existe.")

    if solicitud.estado != "aprobada" or solicitud.etapa != "inscripcion_confirmada":
        raise InscripcionInvalida(
            "La solicitud debe estar aprobada y en la etapa de inscripción confirmada."
        )

    if solicitud.aspirante_persona_id != alumno.persona_id:
        raise InscripcionInvalida("La solicitud no corresponde a la persona vinculada al alumno.")

    if solicitud.nivel_educativo_id != anio.nivel_educativo_id:
        raise InscripcionInvalida(
            "La división no pertenece al nivel educativo aprobado en la solicitud."
        )

    if solicitud.ciclo_lectivo != datos.ciclo_lectivo:
        raise InscripcionInvalida(
            "El ciclo lectivo debe coincidir con el de la solicitud aprobada."
        )

    inscripcion_existente = db.scalar(
        select(Inscripcion.id)
        .where(
            Inscripcion.alumno_id == alumno.id,
            Inscripcion.ciclo_lectivo == datos.ciclo_lectivo,
        )
        .limit(1)
    )
    if inscripcion_existente is not None:
        raise ConflictoInscripcion("El alumno ya tiene una inscripción para ese ciclo lectivo.")

    solicitud_utilizada = db.scalar(
        select(Inscripcion.id)
        .where(Inscripcion.solicitud_inscripcion_id == solicitud.id)
        .limit(1)
    )
    if solicitud_utilizada is not None:
        raise ConflictoInscripcion("La solicitud ya fue utilizada para generar una inscripción.")

    inscripcion = Inscripcion(
        ciclo_lectivo=datos.ciclo_lectivo,
        fecha_inscripcion=datos.fecha_inscripcion,
        tipo="nueva",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division.id,
        solicitud_inscripcion_id=solicitud.id,
    )
    db.add(inscripcion)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictoInscripcion(
            "No se pudo registrar la inscripción porque sus datos entran en conflicto."
        ) from exc

    db.refresh(inscripcion)
    return inscripcion


def obtener_inscripcion(db: Session, inscripcion_id: uuid.UUID) -> Inscripcion:
    inscripcion = db.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción indicada no existe.")
    return inscripcion
