"""Lógica de negocio de inscripciones."""

import unicodedata
import uuid
from datetime import date

from sqlalchemy import exists, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import Anio, Division, NivelEducativo
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.exceptions import (
    ConflictoInscripcion,
    InscripcionInvalida,
    InscripcionNoEncontrada,
)
from src.inscripciones.models import (
    DocumentoSolicitud,
    EtapaSolicitud,
    Inscripcion,
    SolicitudInscripcion,
)
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    BajaInscripcionCreate,
    CambioMatriculaCreate,
    DivisionOpcionRead,
    DocumentoSolicitudCreate,
    DocumentoSolicitudRead,
    DocumentoSolicitudUpdate,
    InscripcionListadoItemRead,
    InscripcionListadoRead,
    InscripcionNuevaCreate,
    ReinscripcionCreate,
    SolicitudInscripcionCreate,
    SolicitudInscripcionListadoItemRead,
    SolicitudInscripcionListadoRead,
    SolicitudInscripcionOpcionRead,
    SolicitudInscripcionRead,
)
from src.models import Persona

ETAPAS_ADMISION = (
    "consulta_lead",
    "entrevista",
    "postulacion",
    "evaluacion_aprobacion",
    "reserva_matricula",
    "documentacion_contrato",
    "inscripcion_confirmada",
)


def _normalizar_texto_busqueda(valor: str) -> str:
    """Quita tildes y unifica mayúsculas para comparar términos de búsqueda."""

    return "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", valor.casefold())
        if unicodedata.category(caracter) != "Mn"
    )


def _normalizar_columna_busqueda(columna):
    """Expresión SQL portable para búsquedas sin tildes en SQLite y PostgreSQL."""

    resultado = func.lower(columna)
    for origen, destino in (
        ("á", "a"),
        ("é", "e"),
        ("í", "i"),
        ("ó", "o"),
        ("ú", "u"),
        ("ü", "u"),
        ("ñ", "n"),
        ("Á", "a"),
        ("É", "e"),
        ("Í", "i"),
        ("Ó", "o"),
        ("Ú", "u"),
        ("Ü", "u"),
        ("Ñ", "n"),
    ):
        resultado = func.replace(resultado, origen, destino)
    return resultado


def listar_inscripciones(
    db: Session,
    *,
    ciclo_lectivo: str | None = None,
    estado: str | None = None,
    tipo: str | None = None,
    alumno_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
    buscar: str | None = None,
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

    termino = _normalizar_texto_busqueda(buscar.strip()) if buscar else ""
    if termino:
        patron = f"%{termino}%"
        filtros.append(
            or_(
                _normalizar_columna_busqueda(Persona.nombre).like(patron),
                _normalizar_columna_busqueda(Persona.apellido).like(patron),
                _normalizar_columna_busqueda(Alumno.numero_legajo).like(patron),
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
    listado_statement = (
        listado_statement.where(*filtros)
        .order_by(
            Inscripcion.ciclo_lectivo.desc(),
            Persona.apellido,
            Persona.nombre,
            Inscripcion.id,
        )
        .offset(offset)
        .limit(tamanio_pagina)
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


def _guardar_cambios(db: Session) -> None:
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise ConflictoInscripcion("No se pudieron guardar los cambios de la solicitud.") from exc


def _obtener_o_crear_persona(db: Session, datos) -> Persona:
    persona = db.scalar(select(Persona).where(Persona.dni == datos.dni).limit(1))
    if persona is not None:
        return persona

    persona = Persona(**datos.model_dump())
    db.add(persona)
    db.flush()
    return persona


def _obtener_solicitud(
    db: Session, solicitud_id: uuid.UUID, *, bloquear: bool = False
) -> SolicitudInscripcion:
    solicitud = db.get(SolicitudInscripcion, solicitud_id, with_for_update=bloquear)
    if solicitud is None:
        raise InscripcionNoEncontrada("La solicitud de inscripción indicada no existe.")
    return solicitud


def _respuesta_solicitud(db: Session, solicitud: SolicitudInscripcion) -> SolicitudInscripcionRead:
    aspirante = db.get(Persona, solicitud.aspirante_persona_id)
    contacto = (
        db.get(Persona, solicitud.contacto_persona_id) if solicitud.contacto_persona_id else None
    )
    if aspirante is None:
        raise InscripcionInvalida("La solicitud no tiene un aspirante válido.")

    etapas = db.scalars(
        select(EtapaSolicitud)
        .where(EtapaSolicitud.solicitud_inscripcion_id == solicitud.id)
        .order_by(EtapaSolicitud.fecha, EtapaSolicitud.id)
    ).all()
    documentos = db.scalars(
        select(DocumentoSolicitud)
        .where(DocumentoSolicitud.solicitud_inscripcion_id == solicitud.id)
        .order_by(DocumentoSolicitud.fecha_carga, DocumentoSolicitud.id)
    ).all()
    return SolicitudInscripcionRead(
        id=solicitud.id,
        ciclo_lectivo=solicitud.ciclo_lectivo,
        etapa=solicitud.etapa,
        estado=solicitud.estado,
        fecha_solicitud=solicitud.fecha_solicitud,
        fecha_resolucion=solicitud.fecha_resolucion,
        observaciones=solicitud.observaciones,
        updated_at=solicitud.updated_at,
        nivel_educativo_id=solicitud.nivel_educativo_id,
        aspirante=aspirante,
        contacto=contacto,
        usuario_id=solicitud.usuario_id,
        etapas=etapas,
        documentos=documentos,
    )


def crear_solicitud_inscripcion(
    db: Session, datos: SolicitudInscripcionCreate, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    nivel = db.get(NivelEducativo, datos.nivel_educativo_id)
    if nivel is None:
        raise InscripcionNoEncontrada("El nivel educativo indicado no existe.")

    aspirante = _obtener_o_crear_persona(db, datos.aspirante)
    contacto = _obtener_o_crear_persona(db, datos.contacto) if datos.contacto else None
    solicitud = SolicitudInscripcion(
        ciclo_lectivo=datos.ciclo_lectivo,
        etapa=ETAPAS_ADMISION[0],
        estado="en_proceso",
        fecha_solicitud=datos.fecha_solicitud,
        observaciones=datos.observaciones,
        aspirante_persona_id=aspirante.id,
        contacto_persona_id=contacto.id if contacto else None,
        nivel_educativo_id=nivel.id,
        usuario_id=usuario_id,
    )
    db.add(solicitud)
    db.flush()
    db.add(
        EtapaSolicitud(
            etapa=ETAPAS_ADMISION[0],
            estado="en_proceso",
            observaciones=datos.observaciones,
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario_id,
        )
    )
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def listar_solicitudes_inscripcion(
    db: Session,
    *,
    estado: str | None = None,
    etapa: str | None = None,
    buscar: str | None = None,
    pagina: int = 1,
    tamanio_pagina: int = 20,
) -> SolicitudInscripcionListadoRead:
    filtros = []
    if estado:
        filtros.append(SolicitudInscripcion.estado == estado)
    if etapa:
        filtros.append(SolicitudInscripcion.etapa == etapa)
    if buscar:
        patron = f"%{buscar.strip()}%"
        filtros.append(
            or_(
                Persona.nombre.ilike(patron),
                Persona.apellido.ilike(patron),
                Persona.dni.ilike(patron),
            )
        )

    base = (
        select(SolicitudInscripcion, Persona, NivelEducativo)
        .join(Persona, Persona.id == SolicitudInscripcion.aspirante_persona_id)
        .join(NivelEducativo, NivelEducativo.id == SolicitudInscripcion.nivel_educativo_id)
    )
    total = (
        db.scalar(
            select(func.count(SolicitudInscripcion.id))
            .join(Persona, Persona.id == SolicitudInscripcion.aspirante_persona_id)
            .where(*filtros)
        )
        or 0
    )
    resultados = db.execute(
        base.where(*filtros)
        .order_by(SolicitudInscripcion.fecha_solicitud.desc(), Persona.apellido, Persona.nombre)
        .offset((pagina - 1) * tamanio_pagina)
        .limit(tamanio_pagina)
    ).all()
    return SolicitudInscripcionListadoRead(
        items=[
            SolicitudInscripcionListadoItemRead(
                id=solicitud.id,
                ciclo_lectivo=solicitud.ciclo_lectivo,
                etapa=solicitud.etapa,
                estado=solicitud.estado,
                fecha_solicitud=solicitud.fecha_solicitud,
                aspirante_nombre=aspirante.nombre,
                aspirante_apellido=aspirante.apellido,
                aspirante_dni=aspirante.dni,
                nivel_educativo_nombre=nivel.nombre,
            )
            for solicitud, aspirante, nivel in resultados
        ],
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=(total + tamanio_pagina - 1) // tamanio_pagina,
    )


def obtener_solicitud_inscripcion(db: Session, solicitud_id: uuid.UUID) -> SolicitudInscripcionRead:
    return _respuesta_solicitud(db, _obtener_solicitud(db, solicitud_id))


def avanzar_solicitud_inscripcion(
    db: Session, solicitud_id: uuid.UUID, observaciones: str | None, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado not in {"en_proceso", "aprobada"}:
        raise InscripcionInvalida("Solo se puede avanzar una solicitud en proceso o aprobada.")
    indice_actual = ETAPAS_ADMISION.index(solicitud.etapa)
    if solicitud.etapa == "evaluacion_aprobacion" and solicitud.estado != "aprobada":
        raise InscripcionInvalida(
            "La solicitud debe aprobarse antes de avanzar a reserva de matrícula."
        )
    if indice_actual >= len(ETAPAS_ADMISION) - 2:
        raise InscripcionInvalida(
            "La confirmación final requiere documentación y pago validados por Facturación."
        )

    etapa_actual = db.scalar(
        select(EtapaSolicitud)
        .where(
            EtapaSolicitud.solicitud_inscripcion_id == solicitud.id,
            EtapaSolicitud.etapa == solicitud.etapa,
            EtapaSolicitud.estado == "en_proceso",
        )
        .order_by(EtapaSolicitud.fecha.desc())
        .limit(1)
    )
    if etapa_actual is not None:
        etapa_actual.estado = "completada"
    siguiente_etapa = ETAPAS_ADMISION[indice_actual + 1]
    solicitud.etapa = siguiente_etapa
    db.add(
        EtapaSolicitud(
            etapa=siguiente_etapa,
            estado="en_proceso",
            observaciones=observaciones,
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario_id,
        )
    )
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def aprobar_solicitud_inscripcion(
    db: Session, solicitud_id: uuid.UUID, observaciones: str | None, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "en_proceso" or solicitud.etapa != "evaluacion_aprobacion":
        raise InscripcionInvalida(
            "Solo se puede aprobar una solicitud en etapa de evaluación y aprobación."
        )

    etapa_actual = db.scalar(
        select(EtapaSolicitud)
        .where(
            EtapaSolicitud.solicitud_inscripcion_id == solicitud.id,
            EtapaSolicitud.etapa == solicitud.etapa,
            EtapaSolicitud.estado == "en_proceso",
        )
        .order_by(EtapaSolicitud.fecha.desc())
        .limit(1)
    )
    if etapa_actual is not None:
        etapa_actual.estado = "completada"
        etapa_actual.observaciones = observaciones

    solicitud.estado = "aprobada"
    solicitud.fecha_resolucion = date.today()
    solicitud.etapa = "reserva_matricula"
    db.add(
        EtapaSolicitud(
            etapa="reserva_matricula",
            estado="en_proceso",
            observaciones=observaciones,
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario_id,
        )
    )
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def rechazar_solicitud_inscripcion(
    db: Session, solicitud_id: uuid.UUID, observaciones: str | None
) -> SolicitudInscripcionRead:
    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "en_proceso" or solicitud.etapa != "evaluacion_aprobacion":
        raise InscripcionInvalida(
            "Solo se puede rechazar una solicitud en etapa de evaluación y aprobación."
        )

    etapa_actual = db.scalar(
        select(EtapaSolicitud)
        .where(
            EtapaSolicitud.solicitud_inscripcion_id == solicitud.id,
            EtapaSolicitud.etapa == solicitud.etapa,
            EtapaSolicitud.estado == "en_proceso",
        )
        .order_by(EtapaSolicitud.fecha.desc())
        .limit(1)
    )
    if etapa_actual is not None:
        etapa_actual.estado = "rechazada"
        etapa_actual.observaciones = observaciones

    solicitud.estado = "rechazada"
    solicitud.fecha_resolucion = date.today()
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def registrar_documento_solicitud(
    db: Session,
    solicitud_id: uuid.UUID,
    datos: DocumentoSolicitudCreate,
    usuario_id: uuid.UUID,
) -> DocumentoSolicitudRead:
    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "aprobada" or solicitud.etapa != "documentacion_contrato":
        raise InscripcionInvalida(
            "Solo se pueden cargar documentos durante la etapa de documentación y contrato."
        )

    documento = DocumentoSolicitud(
        tipo_documento=datos.tipo_documento,
        archivo=datos.archivo,
        estado="pendiente",
        solicitud_inscripcion_id=solicitud.id,
        usuario_id=usuario_id,
    )
    db.add(documento)
    _guardar_cambios(db)
    db.refresh(documento)
    return DocumentoSolicitudRead.model_validate(documento)


def actualizar_documento_solicitud(
    db: Session,
    solicitud_id: uuid.UUID,
    documento_id: uuid.UUID,
    datos: DocumentoSolicitudUpdate,
) -> DocumentoSolicitudRead:
    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    documento = db.get(DocumentoSolicitud, documento_id, with_for_update=True)
    if documento is None or documento.solicitud_inscripcion_id != solicitud.id:
        raise InscripcionNoEncontrada("El documento de solicitud indicado no existe.")
    if solicitud.estado != "aprobada" or solicitud.etapa != "documentacion_contrato":
        raise InscripcionInvalida("El documento solo se puede validar en la etapa correspondiente.")

    documento.estado = datos.estado
    _guardar_cambios(db)
    db.refresh(documento)
    return DocumentoSolicitudRead.model_validate(documento)
