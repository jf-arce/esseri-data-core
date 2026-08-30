"""Altas, consultas y movimientos de matrícula."""

import uuid
from datetime import date

from sqlalchemy import func, or_, select
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
    BajaInscripcionCreate,
    CambioMatriculaCreate,
    InscripcionesResumenRead,
    InscripcionListadoItemRead,
    InscripcionListadoRead,
    InscripcionNuevaCreate,
    ReinscripcionCreate,
)
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda


def listar_inscripciones(
    db: Session,
    *,
    ciclo_lectivo: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    alumno_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
    buscar: str | None = None,
    ordenar_por: str = "fecha",
    direccion: str = "desc",
    pagina: int = 1,
    tamanio_pagina: int = 20,
) -> InscripcionListadoRead:
    """Lista inscripciones con filtros y contexto de alumno y división."""

    filtros = []
    if ciclo_lectivo is not None:
        filtros.append(Inscripcion.ciclo_lectivo == ciclo_lectivo)
    if estado is not None:
        filtros.append(Inscripcion.estado == estado)
    if tipo is not None:
        filtros.append(Inscripcion.tipo == tipo)
    if alumno_id is not None:
        filtros.append(Inscripcion.alumno_id == alumno_id)
    if division_id is not None:
        filtros.append(Inscripcion.division_id == division_id)

    termino = normalizar_texto_busqueda(buscar.strip()) if buscar else ""
    if termino:
        patron = f"%{termino}%"
        filtros.append(
            or_(
                normalizar_columna_busqueda(Persona.nombre).like(patron),
                normalizar_columna_busqueda(Persona.apellido).like(patron),
                normalizar_columna_busqueda(Alumno.numero_legajo).like(patron),
            )
        )

    joins = (
        (Alumno, Alumno.id == Inscripcion.alumno_id),
        (Persona, Persona.id == Alumno.persona_id),
        (Division, Division.id == Inscripcion.division_id),
        (Anio, Anio.id == Division.anio_id),
        (NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id),
    )
    total_statement = select(func.count(Inscripcion.id))
    listado_statement = select(
        Inscripcion,
        Alumno,
        Persona,
        Division,
        Anio,
        NivelEducativo,
    )
    for entidad, condicion in joins:
        total_statement = total_statement.join(entidad, condicion)
        listado_statement = listado_statement.join(entidad, condicion)

    total = db.scalar(total_statement.where(*filtros)) or 0
    offset = (pagina - 1) * tamanio_pagina
    if ordenar_por == "alumno":
        orden = (
            (Persona.apellido.asc(), Persona.nombre.asc())
            if direccion == "asc"
            else (Persona.apellido.desc(), Persona.nombre.desc())
        )
        orden = (*orden, Inscripcion.fecha_inscripcion.desc(), Inscripcion.id)
    else:
        orden_fecha = (
            Inscripcion.fecha_inscripcion.asc()
            if direccion == "asc"
            else Inscripcion.fecha_inscripcion.desc()
        )
        orden = (
            orden_fecha,
            Inscripcion.ciclo_lectivo.desc(),
            Persona.apellido,
            Persona.nombre,
            Inscripcion.id,
        )

    listado_statement = (
        listado_statement.where(*filtros).order_by(*orden).offset(offset).limit(tamanio_pagina)
    )

    items = [
        InscripcionListadoItemRead(
            id=inscripcion.id,
            ciclo_lectivo=inscripcion.ciclo_lectivo,
            fecha_inscripcion=inscripcion.fecha_inscripcion,
            tipo=inscripcion.tipo,
            estado=inscripcion.estado,
            alumno_id=alumno.id,
            alumno_nombre=persona.nombre,
            alumno_apellido=persona.apellido,
            numero_legajo=alumno.numero_legajo,
            division_id=division.id,
            division_nombre=division.nombre,
            anio_numero=anio.numero,
            nivel_educativo_nombre=nivel.nombre,
        )
        for inscripcion, alumno, persona, division, anio, nivel in db.execute(
            listado_statement
        ).all()
    ]
    total_paginas = (total + tamanio_pagina - 1) // tamanio_pagina

    return InscripcionListadoRead(
        items=items,
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=total_paginas,
    )


def obtener_resumen_inscripciones(
    db: Session, ciclo_lectivo: str | None = None
) -> InscripcionesResumenRead:
    """Cuenta las inscripciones del ciclo sin depender de la página visible del listado."""

    ciclo = ciclo_lectivo or str(date.today().year)
    resumen = db.execute(
        select(
            func.count(Inscripcion.id)
            .filter(Inscripcion.estado == "activa")
            .label("inscripciones_activas"),
            func.count(Inscripcion.id).filter(Inscripcion.tipo == "nueva").label("nuevas"),
            func.count(Inscripcion.id)
            .filter(Inscripcion.tipo == "reinscripcion")
            .label("reinscripciones"),
            func.count(Inscripcion.id).filter(Inscripcion.tipo == "baja").label("bajas"),
        ).where(Inscripcion.ciclo_lectivo == ciclo)
    ).one()

    return InscripcionesResumenRead(
        ciclo_lectivo=ciclo,
        inscripciones_activas=resumen.inscripciones_activas,
        nuevas=resumen.nuevas,
        reinscripciones=resumen.reinscripciones,
        bajas=resumen.bajas,
    )


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


def _obtener_inscripcion_activa_para_movimiento(
    db: Session, inscripcion_id: uuid.UUID
) -> Inscripcion:
    inscripcion = db.get(Inscripcion, inscripcion_id, with_for_update=True)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción indicada no existe.")
    if inscripcion.estado != "activa":
        raise InscripcionInvalida(
            "Solo se puede registrar un movimiento sobre una inscripción activa."
        )
    return inscripcion


def registrar_cambio_matricula(
    db: Session, inscripcion_id: uuid.UUID, datos: CambioMatriculaCreate
) -> Inscripcion:
    """Traslada una inscripción activa y conserva ambos movimientos en el historial."""

    inscripcion_anterior = _obtener_inscripcion_activa_para_movimiento(db, inscripcion_id)
    alumno, division_destino, _ = _obtener_alumno_y_division(
        db,
        inscripcion_anterior.alumno_id,
        datos.division_id,
    )
    if alumno.estado != "activo":
        raise InscripcionInvalida("Solo se puede cambiar la matrícula de un alumno activo.")
    if division_destino.id == inscripcion_anterior.division_id:
        raise InscripcionInvalida("La división de destino debe ser distinta de la actual.")

    inscripcion_anterior.estado = "finalizada"
    cambio_matricula = Inscripcion(
        ciclo_lectivo=inscripcion_anterior.ciclo_lectivo,
        fecha_inscripcion=datos.fecha_cambio,
        tipo="cambio_matricula",
        estado="activa",
        alumno_id=alumno.id,
        division_id=division_destino.id,
        solicitud_inscripcion_id=None,
    )
    return _guardar_inscripcion(db, cambio_matricula)


def registrar_baja_inscripcion(
    db: Session, inscripcion_id: uuid.UUID, datos: BajaInscripcionCreate
) -> Inscripcion:
    """Registra la baja sin borrar la matrícula ni sus movimientos previos."""

    inscripcion_anterior = _obtener_inscripcion_activa_para_movimiento(db, inscripcion_id)
    alumno = db.get(Alumno, inscripcion_anterior.alumno_id, with_for_update=True)
    if alumno is None:
        raise InscripcionNoEncontrada("El alumno indicado no existe.")

    inscripcion_anterior.estado = "finalizada"
    alumno.estado = "inactivo"
    baja = Inscripcion(
        ciclo_lectivo=inscripcion_anterior.ciclo_lectivo,
        fecha_inscripcion=datos.fecha_baja,
        tipo="baja",
        estado="baja",
        alumno_id=alumno.id,
        division_id=inscripcion_anterior.division_id,
        solicitud_inscripcion_id=None,
    )
    return _guardar_inscripcion(db, baja)


def obtener_inscripcion(db: Session, inscripcion_id: uuid.UUID) -> Inscripcion:
    inscripcion = db.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise InscripcionNoEncontrada("La inscripción indicada no existe.")
    return inscripcion
