"""Bandeja institucional de justificaciones de inasistencia.

Vive aparte de `service.py` porque es un subdominio propio (filtros, paginación, resumen y
opciones para los selectores) y `service.py` ya supera el umbral razonable de tamaño.
"""

import math
import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from src.academico.models import (
    Anio,
    Division,
    JustificacionInasistencia,
    MotivoJustificacion,
    NivelEducativo,
)
from src.academico.schemas import (
    FiltrosJustificaciones,
    JustificacionesPaginadasResponse,
    JustificacionesResumen,
    JustificacionFamiliaResponse,
    OpcionJustificacion,
)
from src.familias_alumnos.models import Alumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda


def _query_contexto(db: Session):
    """Justificaciones con el contexto que necesita la bandeja (alumno, curso y motivo)."""
    return (
        db.query(
            JustificacionInasistencia,
            Asistencia.fecha,
            Persona.nombre,
            Persona.apellido,
            Alumno.id,
            NivelEducativo.id,
            NivelEducativo.nombre,
            Anio.id,
            Anio.numero,
            Division.id,
            Division.nombre,
            MotivoJustificacion.nombre,
        )
        .join(Asistencia, JustificacionInasistencia.asistencia_id == Asistencia.id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .join(Division, Division.id == Inscripcion.division_id)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .outerjoin(
            MotivoJustificacion,
            MotivoJustificacion.id == JustificacionInasistencia.motivo_justificacion_id,
        )
    )


def _aplicar_filtros(query, filtros: FiltrosJustificaciones, incluir_estado: bool = True):
    if filtros.nivel_id is not None:
        query = query.filter(NivelEducativo.id == filtros.nivel_id)
    if filtros.anio_id is not None:
        query = query.filter(Anio.id == filtros.anio_id)
    if filtros.division_id is not None:
        query = query.filter(Division.id == filtros.division_id)
    if filtros.alumno_id is not None:
        query = query.filter(Alumno.id == filtros.alumno_id)
    if incluir_estado and filtros.estado is not None:
        query = query.filter(JustificacionInasistencia.estado == filtros.estado)
    if filtros.fecha_desde is not None:
        query = query.filter(Asistencia.fecha >= filtros.fecha_desde)
    if filtros.fecha_hasta is not None:
        query = query.filter(Asistencia.fecha <= filtros.fecha_hasta)
    if filtros.busqueda and filtros.busqueda.strip():
        patron = f"%{normalizar_texto_busqueda(filtros.busqueda.strip())}%"
        query = query.filter(
            or_(
                normalizar_columna_busqueda(Persona.nombre).like(patron),
                normalizar_columna_busqueda(Persona.apellido).like(patron),
                normalizar_columna_busqueda(
                    func.concat(Persona.apellido, ", ", Persona.nombre)
                ).like(patron),
            )
        )
    return query


def _respuesta(fila) -> JustificacionFamiliaResponse:
    (
        justificacion,
        fecha_asistencia,
        nombre,
        apellido,
        alumno_id,
        nivel_id,
        nivel_nombre,
        anio_id,
        anio_numero,
        division_id,
        division_nombre,
        motivo,
    ) = fila
    return JustificacionFamiliaResponse(
        id=justificacion.id,
        asistencia_id=justificacion.asistencia_id,
        fecha_asistencia=fecha_asistencia,
        alumno_nombre=f"{nombre} {apellido}",
        estado=justificacion.estado,
        motivo=motivo or "Otro",
        observacion=justificacion.observacion,
        archivo_nombre=justificacion.archivo,
        fecha_carga=justificacion.fecha_carga,
        alumno_id=alumno_id,
        nivel_educativo_id=nivel_id,
        nivel_educativo_nombre=nivel_nombre,
        anio_id=anio_id,
        anio_numero=anio_numero,
        division_id=division_id,
        division_nombre=division_nombre,
        fecha_resolucion=justificacion.fecha_resolucion,
    )


def respuesta_justificacion(
    db: Session, justificacion: JustificacionInasistencia
) -> JustificacionFamiliaResponse:
    """Respuesta completa de una justificación puntual (alta de familia, resolución)."""
    fila = _query_contexto(db).filter(JustificacionInasistencia.id == justificacion.id).first()
    if fila is None:
        raise LookupError("Asistencia de justificación no encontrada")
    return _respuesta(fila)


def resumen_justificaciones(
    db: Session, filtros: FiltrosJustificaciones | None = None
) -> JustificacionesResumen:
    """Conteos por estado dentro de los filtros activos (sin contar el propio estado).

    Así las pestañas de la bandeja muestran cuántas hay de cada estado para el curso o la
    búsqueda elegidos, no solo para la página que se está viendo.
    """
    query = _query_contexto(db)
    if filtros is not None:
        query = _aplicar_filtros(query, filtros, incluir_estado=False)

    filas = (
        query.with_entities(
            JustificacionInasistencia.estado,
            func.count(JustificacionInasistencia.id),
        )
        .group_by(JustificacionInasistencia.estado)
        .all()
    )
    conteos = {estado: cantidad for estado, cantidad in filas}
    pendientes = conteos.get("pendiente", 0)
    aprobadas = conteos.get("aprobada", 0)
    rechazadas = conteos.get("rechazada", 0)
    return JustificacionesResumen(
        pendientes=pendientes,
        aprobadas=aprobadas,
        rechazadas=rechazadas,
        total=pendientes + aprobadas + rechazadas,
    )


def pagina_justificaciones(
    db: Session, filtros: FiltrosJustificaciones
) -> JustificacionesPaginadasResponse:
    """Listado paginado y filtrado de justificaciones."""
    query = _aplicar_filtros(_query_contexto(db), filtros)
    total = query.count()
    total_paginas = math.ceil(total / filtros.tamanio_pagina) if total else 0
    filas = (
        query.order_by(JustificacionInasistencia.fecha_carga.desc())
        .offset((filtros.pagina - 1) * filtros.tamanio_pagina)
        .limit(filtros.tamanio_pagina)
        .all()
    )
    return JustificacionesPaginadasResponse(
        items=[_respuesta(fila) for fila in filas],
        total=total,
        pagina=filtros.pagina,
        tamanio_pagina=filtros.tamanio_pagina,
        total_paginas=total_paginas,
        resumen=resumen_justificaciones(db, filtros),
    )


def opciones_justificaciones(db: Session) -> list[OpcionJustificacion]:
    """Combinaciones nivel/año/división/alumno que tienen al menos una justificación."""
    filas = (
        _query_contexto(db)
        .with_entities(
            NivelEducativo.id,
            NivelEducativo.nombre,
            Anio.id,
            Anio.numero,
            Division.id,
            Division.nombre,
            Alumno.id,
            Persona.nombre,
            Persona.apellido,
        )
        .distinct()
        .order_by(
            NivelEducativo.nombre,
            Anio.numero,
            Division.nombre,
            Persona.apellido,
            Persona.nombre,
        )
        .all()
    )
    return [
        OpcionJustificacion(
            nivel_educativo_id=nivel_id,
            nivel_educativo_nombre=nivel_nombre,
            anio_id=anio_id,
            anio_numero=anio_numero,
            division_id=division_id,
            division_nombre=division_nombre,
            alumno_id=alumno_id,
            alumno_nombre=f"{apellido}, {nombre}",
        )
        for (
            nivel_id,
            nivel_nombre,
            anio_id,
            anio_numero,
            division_id,
            division_nombre,
            alumno_id,
            nombre,
            apellido,
        ) in filas
    ]


def justificacion_por_id(
    db: Session, justificacion_id: uuid.UUID
) -> JustificacionInasistencia | None:
    return db.get(JustificacionInasistencia, justificacion_id)
