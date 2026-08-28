"""Lógica de negocio de inscripciones."""

import uuid

from sqlalchemy import exists, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.exceptions import (
    ConflictoInscripcion,
    InscripcionInvalida,
    InscripcionNoEncontrada,
)
from src.inscripciones.models import Inscripcion, SolicitudInscripcion
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    DivisionOpcionRead,
    InscripcionNuevaCreate,
    ReinscripcionCreate,
    SolicitudInscripcionOpcionRead,
)
from src.models import Persona


def _obtener_alumno_y_division(
    db: Session, alumno_id: uuid.UUID, division_id: uuid.UUID
) -> tuple[Alumno, Division, Anio]:
    alumno = db.get(Alumno, alumno_id, with_for_update=True)
    if alumno is None:
        raise InscripcionNoEncontrada("El alumno indicado no existe.")

    division = db.get(Division, division_id)
    if division is None:
        raise InscripcionNoEncontrada("La división indicada no existe.")

    anio = db.get(Anio, division.anio_id)
    if anio is None:
        raise InscripcionInvalida("La división no está vinculada a un año académico válido.")

    return alumno, division, anio


def _validar_vinculo_familiar(db: Session, alumno_id: uuid.UUID) -> None:
    vinculo_familiar = db.scalar(
        select(FamiliaAlumno.id).where(FamiliaAlumno.alumno_id == alumno_id).limit(1)
    )
    if vinculo_familiar is None:
        raise InscripcionInvalida(
            "El alumno debe estar vinculado al menos a una familia antes de inscribirse."
        )


def _validar_inscripcion_no_duplicada(
    db: Session, alumno_id: uuid.UUID, ciclo_lectivo: str
) -> None:
    inscripcion_existente = db.scalar(
        select(Inscripcion.id)
        .where(
            Inscripcion.alumno_id == alumno_id,
            Inscripcion.ciclo_lectivo == ciclo_lectivo,
        )
        .limit(1)
    )
    if inscripcion_existente is not None:
        raise ConflictoInscripcion("El alumno ya tiene una inscripción para ese ciclo lectivo.")


def _guardar_inscripcion(db: Session, inscripcion: Inscripcion) -> Inscripcion:
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


def crear_inscripcion_nueva(db: Session, datos: InscripcionNuevaCreate) -> Inscripcion:
    """Confirma la inscripción de un alumno que completó el proceso de admisión."""

    # Los bloqueos serializan altas concurrentes para el mismo alumno o solicitud.
    alumno, division, anio = _obtener_alumno_y_division(db, datos.alumno_id, datos.division_id)
    _validar_vinculo_familiar(db, alumno.id)

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

    _validar_inscripcion_no_duplicada(db, alumno.id, datos.ciclo_lectivo)

    solicitud_utilizada = db.scalar(
        select(Inscripcion.id).where(Inscripcion.solicitud_inscripcion_id == solicitud.id).limit(1)
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
    return _guardar_inscripcion(db, inscripcion)


def crear_reinscripcion(db: Session, datos: ReinscripcionCreate) -> Inscripcion:
    """Reinscribe a un alumno activo en el ciclo lectivo inmediatamente siguiente."""

    alumno, division, _ = _obtener_alumno_y_division(db, datos.alumno_id, datos.division_id)
    if alumno.estado != "activo":
        raise InscripcionInvalida("Solo se puede reinscribir a un alumno activo.")

    _validar_vinculo_familiar(db, alumno.id)
    _validar_inscripcion_no_duplicada(db, alumno.id, datos.ciclo_lectivo)

    ciclo_anterior = str(int(datos.ciclo_lectivo) - 1)
    inscripcion_anterior = db.scalar(
        select(Inscripcion.id)
        .where(
            Inscripcion.alumno_id == alumno.id,
            Inscripcion.ciclo_lectivo == ciclo_anterior,
            Inscripcion.estado != "baja",
        )
        .limit(1)
    )
    if inscripcion_anterior is None:
        raise InscripcionInvalida(
            "El alumno debe tener una inscripción no dada de baja en el ciclo lectivo anterior."
        )

    reinscripcion = Inscripcion(
        ciclo_lectivo=datos.ciclo_lectivo,
        fecha_inscripcion=datos.fecha_inscripcion,
        tipo="reinscripcion",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division.id,
        solicitud_inscripcion_id=None,
    )
    return _guardar_inscripcion(db, reinscripcion)


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


def obtener_inscripcion(db: Session, inscripcion_id: uuid.UUID) -> Inscripcion:
    inscripcion = db.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción indicada no existe.")
    return inscripcion
