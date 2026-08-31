"""Lógica de negocio del módulo Académico."""

import logging
import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.exceptions import (
    AnioConDivisiones,
    AnioDuplicado,
    AsignacionDocenteDuplicada,
    AsistenciaDuplicada,
    AsistenciaYaJustificada,
    DivisionConAsignaciones,
    DivisionDuplicada,
    DocenteConAsignaciones,
    InscripcionNoActiva,
    LegajoDuplicado,
    MateriaConAsignaciones,
    MateriaDuplicada,
    NivelEducativoConAnios,
    NombreNivelDuplicado,
)
from src.academico.models import (
    Anio,
    AsignacionDocente,
    Division,
    Docente,
    Materia,
    NivelEducativo,
)
from src.academico.schemas import (
    AnioCreate,
    AnioUpdate,
    AsignacionDocenteCreate,
    AsistenciaBulkCreate,
    AsistenciaBulkResponse,
    AsistenciaCreate,
    AsistenciaUpdate,
    DivisionCreate,
    DivisionUpdate,
    DocenteCreate,
    DocenteUpdate,
    MateriaCreate,
    MateriaUpdate,
    NivelEducativoCreate,
    NivelEducativoUpdate,
)
from src.familias_alumnos.models import FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion

logger = logging.getLogger(__name__)

# --- Asistencia --------------------------------------------------------------------------


_TIPO_DOCENTE_A_DB = {
    "presente": "presente",
    "tardanza": "tardanza",
    "ausente": "ausente_pendiente",
}

_TIPOS_JUSTIFICADOS = {"ausente_justificado", "ausente_injustificado"}


def _notificar_ausencia(db: Session, inscripcion: Inscripcion, fecha: date) -> int:
    """Notificar a todos los responsables con recibe_comunicaciones=true.

    Placeholder: loggea la notificación. Cuando exista infraestructura de
    email/SMS/push, este función es el único punto a modificar.
    """
    responsables = (
        db.query(FamiliaAlumno)
        .filter(
            FamiliaAlumno.alumno_id == inscripcion.alumno_id,
            FamiliaAlumno.recibe_comunicaciones.is_(True),
        )
        .all()
    )
    for resp in responsables:
        logger.info(
            "Notificación de ausencia: alumno_id=%s fecha=%s familia_id=%s parentesco=%s",
            inscripcion.alumno_id,
            fecha,
            resp.familia_id,
            resp.parentesco,
        )
    return len(responsables)


def registrar_asistencia(
    db: Session, datos: AsistenciaCreate, usuario_id: uuid.UUID | None = None
) -> Asistencia:
    """Registrar asistencia diaria de un alumno.

    - presente/tardanza se guardan tal cual.
    - ausente se guarda como 'ausente_pendiente' y dispara notificación.
    """
    inscripcion = db.get(Inscripcion, datos.inscripcion_id)
    if inscripcion is None or inscripcion.estado != "activa":
        raise InscripcionNoActiva()

    existente = db.scalar(
        select(Asistencia.id).where(
            Asistencia.inscripcion_id == datos.inscripcion_id,
            Asistencia.fecha == datos.fecha,
        )
    )
    if existente is not None:
        raise AsistenciaDuplicada()

    tipo_db = _TIPO_DOCENTE_A_DB[datos.tipo]
    nuevo = Asistencia(
        inscripcion_id=datos.inscripcion_id,
        fecha=datos.fecha,
        tipo=tipo_db,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)

    if tipo_db == "ausente_pendiente":
        _notificar_ausencia(db, inscripcion, datos.fecha)

    return nuevo


def registrar_asistencia_masiva(
    db: Session, datos: AsistenciaBulkCreate, usuario_id: uuid.UUID | None = None
) -> AsistenciaBulkResponse:
    """Registrar asistencia de toda una división en una fecha.

    Si ya existe un registro para (inscripcion_id, fecha), se actualiza.
    Si no existe, se crea. Para 'ausente' se dispara notificación.
    """
    creadas = 0
    actualizadas = 0
    notificaciones = 0

    for registro in datos.registros:
        inscripcion = db.get(Inscripcion, registro.inscripcion_id)
        if inscripcion is None or inscripcion.estado != "activa":
            continue

        existente = (
            db.query(Asistencia)
            .filter(
                Asistencia.inscripcion_id == registro.inscripcion_id,
                Asistencia.fecha == datos.fecha,
            )
            .first()
        )

        tipo_db = _TIPO_DOCENTE_A_DB[registro.tipo]

        if existente is not None:
            if existente.tipo in _TIPOS_JUSTIFICADOS:
                continue
            existente.tipo = tipo_db
            actualizadas += 1
        else:
            nuevo = Asistencia(
                inscripcion_id=registro.inscripcion_id,
                fecha=datos.fecha,
                tipo=tipo_db,
            )
            db.add(nuevo)
            creadas += 1

        if tipo_db == "ausente_pendiente":
            notificaciones += _notificar_ausencia(db, inscripcion, datos.fecha)

    db.commit()
    return AsistenciaBulkResponse(
        creadas=creadas,
        actualizadas=actualizadas,
        notificaciones_disparadas=notificaciones,
    )


def obtener_asistencia_por_id(db: Session, asistencia_id: uuid.UUID) -> Asistencia | None:
    """Obtener un registro de asistencia por su ID."""
    return db.query(Asistencia).filter(Asistencia.id == asistencia_id).first()


def listar_asistencias(
    db: Session,
    inscripcion_id: uuid.UUID | None = None,
    fecha: date | None = None,
    division_id: uuid.UUID | None = None,
) -> list[Asistencia]:
    """Listar registros de asistencia con filtros opcionales."""
    query = db.query(Asistencia)
    if inscripcion_id is not None:
        query = query.filter(Asistencia.inscripcion_id == inscripcion_id)
    if fecha is not None:
        query = query.filter(Asistencia.fecha == fecha)
    if division_id is not None:
        query = query.join(Inscripcion).filter(Inscripcion.division_id == division_id)
    return query.order_by(Asistencia.fecha.desc()).all()


def actualizar_asistencia(
    db: Session,
    asistencia: Asistencia,
    datos: AsistenciaUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Asistencia:
    """Actualizar un registro de asistencia.

    El docente solo puede cambiar entre presente/tardanza/ausente.
    No puede modificar un registro ya justificado.
    """
    if asistencia.tipo in _TIPOS_JUSTIFICADOS:
        raise AsistenciaYaJustificada()

    tipo_db = _TIPO_DOCENTE_A_DB[datos.tipo]
    tipo_anterior = asistencia.tipo
    asistencia.tipo = tipo_db
    db.commit()
    db.refresh(asistencia)

    if tipo_db == "ausente_pendiente" and tipo_anterior != "ausente_pendiente":
        inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
        if inscripcion is not None:
            _notificar_ausencia(db, inscripcion, asistencia.fecha)

    return asistencia


def eliminar_asistencia(
    db: Session, asistencia: Asistencia, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un registro de asistencia."""
    db.delete(asistencia)
    db.commit()


# --- NivelEducativo ----------------------------------------------------------------------


def crear_nivel_educativo(
    db: Session, datos: NivelEducativoCreate, usuario_id: uuid.UUID | None = None
) -> NivelEducativo:
    """Crear un nuevo nivel educativo. Valida nombre único."""
    if (
        db.scalar(select(NivelEducativo.id).where(NivelEducativo.nombre == datos.nombre.strip()))
        is not None
    ):
        raise NombreNivelDuplicado()

    nuevo = NivelEducativo(nombre=datos.nombre.strip())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_nivel_educativo_por_id(db: Session, nivel_id: uuid.UUID) -> NivelEducativo | None:
    """Obtener un nivel educativo por su ID."""
    return db.query(NivelEducativo).filter(NivelEducativo.id == nivel_id).first()


def listar_niveles_educativos(db: Session) -> list[NivelEducativo]:
    """Listar todos los niveles educativos ordenados por nombre."""
    return db.query(NivelEducativo).order_by(NivelEducativo.nombre).all()


def actualizar_nivel_educativo(
    db: Session,
    nivel: NivelEducativo,
    datos: NivelEducativoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> NivelEducativo:
    """Actualizar un nivel educativo existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data and update_data["nombre"] != nivel.nombre:
        if (
            db.scalar(
                select(NivelEducativo.id).where(
                    NivelEducativo.nombre == update_data["nombre"].strip(),
                    NivelEducativo.id != nivel.id,
                )
            )
            is not None
        ):
            raise NombreNivelDuplicado()
        update_data["nombre"] = update_data["nombre"].strip()

    for field, value in update_data.items():
        setattr(nivel, field, value)

    db.commit()
    db.refresh(nivel)
    return nivel


def eliminar_nivel_educativo(
    db: Session, nivel: NivelEducativo, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un nivel educativo. Valida que no tenga años asociados."""
    tiene_anios = db.query(Anio).filter(Anio.nivel_educativo_id == nivel.id).first() is not None
    if tiene_anios:
        raise NivelEducativoConAnios()

    db.delete(nivel)
    db.commit()


# --- Anio --------------------------------------------------------------------------------


def crear_anio(db: Session, datos: AnioCreate, usuario_id: uuid.UUID | None = None) -> Anio:
    """Crear un nuevo año. Valida que no exista el mismo número para el nivel."""
    if (
        db.scalar(
            select(Anio.id).where(
                Anio.numero == datos.numero,
                Anio.nivel_educativo_id == datos.nivel_educativo_id,
            )
        )
        is not None
    ):
        raise AnioDuplicado()

    nuevo = Anio(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_anio_por_id(db: Session, anio_id: uuid.UUID) -> Anio | None:
    """Obtener un año por su ID."""
    return db.query(Anio).filter(Anio.id == anio_id).first()


def listar_anios(db: Session) -> list[Anio]:
    """Listar todos los años ordenados por número."""
    return db.query(Anio).order_by(Anio.numero).all()


def listar_anios_por_nivel(db: Session, nivel_educativo_id: uuid.UUID) -> list[Anio]:
    """Listar los años de un nivel educativo específico."""
    return (
        db.query(Anio)
        .filter(Anio.nivel_educativo_id == nivel_educativo_id)
        .order_by(Anio.numero)
        .all()
    )


def actualizar_anio(
    db: Session,
    anio: Anio,
    datos: AnioUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Anio:
    """Actualizar un año existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "numero" in update_data or "nivel_educativo_id" in update_data:
        numero_check = update_data.get("numero", anio.numero)
        nivel_check = update_data.get("nivel_educativo_id", anio.nivel_educativo_id)
        if (
            db.scalar(
                select(Anio.id).where(
                    Anio.numero == numero_check,
                    Anio.nivel_educativo_id == nivel_check,
                    Anio.id != anio.id,
                )
            )
            is not None
        ):
            raise AnioDuplicado()

    for field, value in update_data.items():
        setattr(anio, field, value)

    db.commit()
    db.refresh(anio)
    return anio


def eliminar_anio(db: Session, anio: Anio, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un año. Valida que no tenga divisiones asociadas."""
    tiene_divisiones = db.query(Division).filter(Division.anio_id == anio.id).first() is not None
    if tiene_divisiones:
        raise AnioConDivisiones()

    db.delete(anio)
    db.commit()


# --- Division ----------------------------------------------------------------------------


def crear_division(
    db: Session, datos: DivisionCreate, usuario_id: uuid.UUID | None = None
) -> Division:
    """Crear una nueva división. Valida nombre único por año."""
    if (
        db.scalar(
            select(Division.id).where(
                Division.nombre == datos.nombre.strip(),
                Division.anio_id == datos.anio_id,
            )
        )
        is not None
    ):
        raise DivisionDuplicada()

    nuevo = Division(nombre=datos.nombre.strip(), anio_id=datos.anio_id)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_division_por_id(db: Session, division_id: uuid.UUID) -> Division | None:
    """Obtener una división por su ID."""
    return db.query(Division).filter(Division.id == division_id).first()


def listar_divisiones(db: Session) -> list[Division]:
    """Listar todas las divisiones."""
    return db.query(Division).order_by(Division.nombre).all()


def listar_divisiones_por_anio(db: Session, anio_id: uuid.UUID) -> list[Division]:
    """Listar las divisiones de un año específico."""
    return db.query(Division).filter(Division.anio_id == anio_id).order_by(Division.nombre).all()


def actualizar_division(
    db: Session,
    division: Division,
    datos: DivisionUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Division:
    """Actualizar una división existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data or "anio_id" in update_data:
        nombre_check = update_data.get("nombre", division.nombre)
        anio_check = update_data.get("anio_id", division.anio_id)
        if (
            db.scalar(
                select(Division.id).where(
                    Division.nombre
                    == (nombre_check.strip() if isinstance(nombre_check, str) else nombre_check),
                    Division.anio_id == anio_check,
                    Division.id != division.id,
                )
            )
            is not None
        ):
            raise DivisionDuplicada()
        if isinstance(nombre_check, str):
            update_data["nombre"] = nombre_check.strip()

    for field, value in update_data.items():
        setattr(division, field, value)

    db.commit()
    db.refresh(division)
    return division


def eliminar_division(db: Session, division: Division, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una división. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.division_id == division.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise DivisionConAsignaciones()

    db.delete(division)
    db.commit()


# --- Materia -----------------------------------------------------------------------------


def crear_materia(
    db: Session, datos: MateriaCreate, usuario_id: uuid.UUID | None = None
) -> Materia:
    """Crear una nueva materia.

    Valida que no exista otra materia con el mismo nombre para el mismo año
    y la misma división (incluyendo division_id = None).
    """
    if (
        db.scalar(
            select(Materia.id).where(
                Materia.nombre == datos.nombre.strip(),
                Materia.anio_id == datos.anio_id,
                Materia.division_id == datos.division_id,
            )
        )
        is not None
    ):
        raise MateriaDuplicada()

    nuevo = Materia(
        nombre=datos.nombre.strip(),
        tipo=datos.tipo,
        anio_id=datos.anio_id,
        division_id=datos.division_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_materia_por_id(db: Session, materia_id: uuid.UUID) -> Materia | None:
    """Obtener una materia por su ID."""
    return db.query(Materia).filter(Materia.id == materia_id).first()


def listar_materias(db: Session) -> list[Materia]:
    """Listar todas las materias ordenadas por nombre."""
    return db.query(Materia).order_by(Materia.nombre).all()


def listar_materias_por_anio(db: Session, anio_id: uuid.UUID) -> list[Materia]:
    """Listar las materias de un año específico."""
    return db.query(Materia).filter(Materia.anio_id == anio_id).order_by(Materia.nombre).all()


def listar_materias_por_division(db: Session, division_id: uuid.UUID) -> list[Materia]:
    """Listar las materias de una división específica."""
    return (
        db.query(Materia).filter(Materia.division_id == division_id).order_by(Materia.nombre).all()
    )


def actualizar_materia(
    db: Session,
    materia: Materia,
    datos: MateriaUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Materia:
    """Actualizar una materia existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data or "anio_id" in update_data or "division_id" in update_data:
        nombre_check = update_data.get("nombre", materia.nombre)
        anio_check = update_data.get("anio_id", materia.anio_id)
        division_check = update_data.get("division_id", materia.division_id)
        if isinstance(nombre_check, str):
            nombre_check = nombre_check.strip()
        if (
            db.scalar(
                select(Materia.id).where(
                    Materia.nombre == nombre_check,
                    Materia.anio_id == anio_check,
                    Materia.division_id == division_check,
                    Materia.id != materia.id,
                )
            )
            is not None
        ):
            raise MateriaDuplicada()
        if isinstance(update_data.get("nombre"), str):
            update_data["nombre"] = update_data["nombre"].strip()

    for field, value in update_data.items():
        setattr(materia, field, value)

    db.commit()
    db.refresh(materia)
    return materia


def eliminar_materia(db: Session, materia: Materia, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una materia. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.materia_id == materia.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise MateriaConAsignaciones()

    db.delete(materia)
    db.commit()


# --- Docente -----------------------------------------------------------------------------


def crear_docente(
    db: Session, datos: DocenteCreate, usuario_id: uuid.UUID | None = None
) -> Docente:
    """Crear un nuevo docente. Valida legajo único."""
    if db.scalar(select(Docente.id).where(Docente.legajo == datos.legajo.strip())) is not None:
        raise LegajoDuplicado()

    nuevo = Docente(legajo=datos.legajo.strip(), persona_id=datos.persona_id)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_docente_por_id(db: Session, docente_id: uuid.UUID) -> Docente | None:
    """Obtener un docente por su ID."""
    return db.query(Docente).filter(Docente.id == docente_id).first()


def listar_docentes(db: Session) -> list[Docente]:
    """Listar todos los docentes ordenados por legajo."""
    return db.query(Docente).order_by(Docente.legajo).all()


def actualizar_docente(
    db: Session,
    docente: Docente,
    datos: DocenteUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Docente:
    """Actualizar un docente existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "legajo" in update_data and update_data["legajo"] != docente.legajo:
        if (
            db.scalar(
                select(Docente.id).where(
                    Docente.legajo == update_data["legajo"].strip(),
                    Docente.id != docente.id,
                )
            )
            is not None
        ):
            raise LegajoDuplicado()
        update_data["legajo"] = update_data["legajo"].strip()

    for field, value in update_data.items():
        setattr(docente, field, value)

    db.commit()
    db.refresh(docente)
    return docente


def eliminar_docente(db: Session, docente: Docente, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un docente. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.docente_id == docente.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise DocenteConAsignaciones()

    db.delete(docente)
    db.commit()


# --- AsignacionDocente -------------------------------------------------------------------


def crear_asignacion_docente(
    db: Session, datos: AsignacionDocenteCreate, usuario_id: uuid.UUID | None = None
) -> AsignacionDocente:
    """Asignar un docente a materia+división por ciclo lectivo.

    Valida que no exista ya una asignación para el mismo docente,
    materia, división y ciclo lectivo.
    """
    if (
        db.scalar(
            select(AsignacionDocente.id).where(
                AsignacionDocente.docente_id == datos.docente_id,
                AsignacionDocente.materia_id == datos.materia_id,
                AsignacionDocente.division_id == datos.division_id,
                AsignacionDocente.ciclo_lectivo == datos.ciclo_lectivo.strip(),
            )
        )
        is not None
    ):
        raise AsignacionDocenteDuplicada()

    nuevo = AsignacionDocente(
        ciclo_lectivo=datos.ciclo_lectivo.strip(),
        docente_id=datos.docente_id,
        materia_id=datos.materia_id,
        division_id=datos.division_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_asignacion_docente_por_id(
    db: Session, asignacion_id: uuid.UUID
) -> AsignacionDocente | None:
    """Obtener una asignación docente por su ID."""
    return db.query(AsignacionDocente).filter(AsignacionDocente.id == asignacion_id).first()


def listar_asignaciones_docentes(
    db: Session,
    ciclo_lectivo: str | None = None,
    docente_id: uuid.UUID | None = None,
    materia_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
) -> list[AsignacionDocente]:
    """Listar asignaciones docentes con filtros opcionales."""
    query = db.query(AsignacionDocente)
    if ciclo_lectivo is not None:
        query = query.filter(AsignacionDocente.ciclo_lectivo == ciclo_lectivo)
    if docente_id is not None:
        query = query.filter(AsignacionDocente.docente_id == docente_id)
    if materia_id is not None:
        query = query.filter(AsignacionDocente.materia_id == materia_id)
    if division_id is not None:
        query = query.filter(AsignacionDocente.division_id == division_id)
    return query.order_by(AsignacionDocente.ciclo_lectivo).all()


def eliminar_asignacion_docente(
    db: Session, asignacion: AsignacionDocente, usuario_id: uuid.UUID | None = None
) -> None:
    """Desasignar un docente (eliminar la asignación docente)."""
    db.delete(asignacion)
    db.commit()
