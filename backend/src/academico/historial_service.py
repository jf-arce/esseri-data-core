"""Historical attendance queries, always anchored to each record's enrollment."""

import math
import uuid

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from src.academico.historial_schemas import (
    FilaHistorial,
    FiltrosHistorial,
    OpcionHistorial,
    PaginaHistorial,
    ResumenHistorial,
)
from src.academico.models import Anio, AsignacionDocente, Division, NivelEducativo
from src.academico.service import (
    _ETIQUETA_TIPO_ASISTENCIA,
    FilaReporteAsistencia,
    _docente_de,
    _tiene_acceso_estructural,
    verificar_acceso_a_division,
)
from src.auth.exceptions import PermisoDenegado
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona


def _inscripciones(db: Session):
    return (
        db.query(Inscripcion, Persona, Alumno, Division, Anio, NivelEducativo)
        .select_from(Inscripcion)
        .join(
            Alumno,
            Alumno.id == Inscripcion.alumno_id,
        )
        .join(Persona, Persona.id == Alumno.persona_id)
        .join(
            Division,
            Division.id == Inscripcion.division_id,
        )
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
    )


def _inscripciones_autorizadas(db: Session, usuario_id: uuid.UUID, rol: str):
    query = _inscripciones(db)
    if not _tiene_acceso_estructural(db, usuario_id, rol):
        docente = _docente_de(db, usuario_id)
        if docente is None:
            return query.filter(False)
        # EXISTS prevents duplicate enrollment options for teachers with several subjects.
        query = query.filter(
            db.query(AsignacionDocente.id)
            .filter(
                AsignacionDocente.docente_id == docente.id,
                AsignacionDocente.division_id == Inscripcion.division_id,
                AsignacionDocente.ciclo_lectivo == Inscripcion.ciclo_lectivo,
            )
            .exists()
        )
    return query


def ciclos_historial(db: Session, usuario_id: uuid.UUID, rol: str) -> list[str]:
    return [
        fila[0]
        for fila in _inscripciones_autorizadas(db, usuario_id, rol)
        .with_entities(
            Inscripcion.ciclo_lectivo,
        )
        .distinct()
        .order_by(Inscripcion.ciclo_lectivo.desc())
        .all()
    ]


def opciones_historial(
    db: Session, usuario_id: uuid.UUID, rol: str, ciclo: str
) -> list[OpcionHistorial]:
    query = _inscripciones_autorizadas(db, usuario_id, rol).filter(
        Inscripcion.ciclo_lectivo == ciclo
    )
    return [
        OpcionHistorial(
            inscripcion_id=inscripcion.id,
            alumno=f"{persona.apellido}, {persona.nombre}",
            division_id=division.id,
            division=division.nombre,
            anio_id=anio.id,
            anio=anio.numero,
            nivel_educativo_id=nivel.id,
            nivel=nivel.nombre,
        )
        for inscripcion, persona, _, division, anio, nivel in query.order_by(
            Persona.apellido, Persona.nombre, Inscripcion.id
        ).all()
    ]


def consulta_historial(db: Session, usuario_id: uuid.UUID, rol: str, filtros: FiltrosHistorial):
    division = filtros.division_id
    if filtros.inscripcion_id:
        inscripcion = db.get(Inscripcion, filtros.inscripcion_id)
        if inscripcion is not None:
            verificar_acceso_a_division(
                db, usuario_id, inscripcion.division_id, rol, inscripcion.ciclo_lectivo
            )
            division = division or inscripcion.division_id
    if division is not None:
        verificar_acceso_a_division(db, usuario_id, division, rol, filtros.ciclo_lectivo)
    elif not _tiene_acceso_estructural(db, usuario_id, rol):
        raise PermisoDenegado("Elegí una división asignada para consultar la asistencia.")
    query = (
        _inscripciones(db)
        .add_entity(Asistencia)
        .join(Asistencia, Asistencia.inscripcion_id == Inscripcion.id)
    )
    for columna, valor in (
        (Inscripcion.ciclo_lectivo, filtros.ciclo_lectivo),
        (Anio.nivel_educativo_id, filtros.nivel_educativo_id),
        (Anio.id, filtros.anio_id),
        (Inscripcion.division_id, filtros.division_id),
        (Inscripcion.id, filtros.inscripcion_id),
        (Asistencia.tipo, filtros.estado),
    ):
        if valor is not None:
            query = query.filter(columna == valor)
    if filtros.fecha_desde:
        query = query.filter(Asistencia.fecha >= filtros.fecha_desde)
    if filtros.fecha_hasta:
        query = query.filter(Asistencia.fecha <= filtros.fecha_hasta)
    return query


def ordenar_historial(query, orden: str):
    if orden.startswith("alumno"):
        apellido = Persona.apellido.desc() if orden.endswith("desc") else Persona.apellido.asc()
        nombre = Persona.nombre.desc() if orden.endswith("desc") else Persona.nombre.asc()
        return query.order_by(apellido, nombre, Asistencia.fecha.desc(), Asistencia.id)
    fecha = Asistencia.fecha.asc() if orden == "fecha_asc" else Asistencia.fecha.desc()
    return query.order_by(fecha, Persona.apellido, Persona.nombre, Asistencia.id)


def pagina_historial(
    db: Session, usuario_id: uuid.UUID, rol: str, filtros: FiltrosHistorial
) -> PaginaHistorial:
    query = consulta_historial(db, usuario_id, rol, filtros)
    total, presentes, tardanzas, justificadas, injustificadas = query.with_entities(
        func.count(Asistencia.id),
        *[
            func.coalesce(func.sum(case((Asistencia.tipo == tipo, 1), else_=0)), 0)
            for tipo in (
                "presente",
                "tardanza",
                "ausente_justificado",
                "ausente_injustificado",
            )
        ],
    ).one()
    resumen = ResumenHistorial(
        total_registros=total,
        presentes=presentes,
        ausentes_justificadas=justificadas,
        ausentes_injustificadas=injustificadas,
        porcentaje_presencia=round((presentes + tardanzas) / total * 100, 2) if total else 0,
    )
    filas = (
        ordenar_historial(query, filtros.orden)
        .offset((filtros.pagina - 1) * filtros.tamanio_pagina)
        .limit(filtros.tamanio_pagina)
        .all()
    )
    items = [
        FilaHistorial(
            id=asistencia.id,
            fecha=asistencia.fecha,
            tipo=asistencia.tipo,
            inscripcion_id=inscripcion.id,
            updated_at=asistencia.updated_at,
            alumno=f"{persona.apellido}, {persona.nombre}",
            division=division.nombre,
        )
        for inscripcion, persona, _, division, _, _, asistencia in filas
    ]
    return PaginaHistorial(
        items=items,
        resumen=resumen,
        total=total,
        pagina=filtros.pagina,
        tamanio_pagina=filtros.tamanio_pagina,
        total_paginas=math.ceil(total / filtros.tamanio_pagina),
    )


def reporte_historial(
    db: Session, usuario_id: uuid.UUID, rol: str, filtros: FiltrosHistorial
) -> list[FilaReporteAsistencia]:
    return [
        FilaReporteAsistencia(
            fecha=asistencia.fecha,
            alumno=f"{persona.apellido}, {persona.nombre}",
            numero_legajo=alumno.numero_legajo,
            division=division.nombre,
            estado=_ETIQUETA_TIPO_ASISTENCIA[asistencia.tipo],
        )
        for _, persona, alumno, division, _, _, asistencia in ordenar_historial(
            consulta_historial(db, usuario_id, rol, filtros), filtros.orden
        ).all()
    ]
