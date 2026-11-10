"""Creation of family absence requests covering an inclusive period."""

import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.models import (
    JustificacionInasistencia,
    MotivoJustificacion,
    SolicitudAusenciaPeriodo,
)
from src.academico.service import _familia_del_usuario, _validar_comprobante_justificacion
from src.auditoria.service import log_audit
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion


def crear_solicitud_periodo(
    db: Session,
    usuario: Usuario | None,
    alumno_id: uuid.UUID,
    fecha_inicio: date,
    fecha_fin: date,
    motivo: str,
    observacion: str | None,
    comprobante_nombre: str | None = None,
    comprobante_tipo_contenido: str | None = None,
    comprobante_contenido: bytes | None = None,
) -> SolicitudAusenciaPeriodo:
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    familia = _familia_del_usuario(db, usuario)
    consulta_vinculo = select(FamiliaAlumno.id).where(
        FamiliaAlumno.familia_id == familia.id, FamiliaAlumno.alumno_id == alumno_id
    )
    if db.scalar(consulta_vinculo) is None:
        raise PermisoDenegado("No tenés acceso a este alumno")
    if fecha_inicio > fecha_fin:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, "El período de fechas es inválido"
        )
    _validar_comprobante_justificacion(
        nombre=comprobante_nombre,
        tipo_contenido=comprobante_tipo_contenido,
        contenido=comprobante_contenido,
    )
    motivo_db = db.scalar(
        select(MotivoJustificacion).where(
            MotivoJustificacion.nombre == motivo.strip(), MotivoJustificacion.activo.is_(True)
        )
    )
    if motivo_db is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "El motivo de la justificación no está disponible en el catálogo.",
        )
    db.scalar(select(Alumno.id).where(Alumno.id == alumno_id).with_for_update())
    if db.scalar(consulta_vinculo.with_for_update()) is None:
        raise PermisoDenegado("No tenés acceso a este alumno")
    conflicto = db.scalar(
        select(SolicitudAusenciaPeriodo.id)
        .where(
            SolicitudAusenciaPeriodo.alumno_id == alumno_id,
            SolicitudAusenciaPeriodo.estado.in_(("pendiente", "aprobada")),
            SolicitudAusenciaPeriodo.fecha_inicio <= fecha_fin,
            SolicitudAusenciaPeriodo.fecha_fin >= fecha_inicio,
        )
        .limit(1)
    )
    if conflicto is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "mensaje": "Ya existe una solicitud para este período",
                "origen": "periodo",
                "id": str(conflicto),
            },
        )
    individual = db.scalar(
        select(JustificacionInasistencia.id)
        .join(Asistencia, Asistencia.id == JustificacionInasistencia.asistencia_id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(
            Inscripcion.alumno_id == alumno_id,
            Asistencia.fecha.between(fecha_inicio, fecha_fin),
            JustificacionInasistencia.estado == "pendiente",
        )
        .limit(1)
    )
    if individual is not None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            {
                "mensaje": "Ya existe una justificación pendiente",
                "origen": "individual",
                "id": str(individual),
            },
        )
    solicitud = SolicitudAusenciaPeriodo(
        alumno_id=alumno_id,
        familia_id=familia.id,
        usuario_id=usuario.id,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        motivo_justificacion_id=motivo_db.id,
        observacion=observacion,
        archivo_nombre=comprobante_nombre,
        archivo_tipo=comprobante_tipo_contenido,
        archivo_contenido=comprobante_contenido,
    )
    db.add(solicitud)
    db.flush()
    log_audit(
        db,
        entidad="SOLICITUD_AUSENCIA_PERIODO",
        entidad_id=solicitud.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=motivo_db.nombre,
        usuario_id=usuario.id,
    )
    db.commit()
    db.refresh(solicitud)
    return solicitud


def listar_solicitudes_periodo_familia(
    db: Session, usuario: Usuario | None, alumno_id: uuid.UUID
) -> list[SolicitudAusenciaPeriodo]:
    """Lista las solicitudes de un alumno vinculado a la familia autenticada."""
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    familia = _familia_del_usuario(db, usuario)
    consulta_vinculo = select(FamiliaAlumno.id).where(
        FamiliaAlumno.familia_id == familia.id, FamiliaAlumno.alumno_id == alumno_id
    )
    if db.scalar(consulta_vinculo) is None:
        raise PermisoDenegado("No tenés acceso a este alumno")
    return list(
        db.scalars(
            select(SolicitudAusenciaPeriodo)
            .where(SolicitudAusenciaPeriodo.alumno_id == alumno_id)
            .order_by(
                SolicitudAusenciaPeriodo.fecha_inicio.desc(),
                SolicitudAusenciaPeriodo.fecha_carga.desc(),
            )
        ).all()
    )


def archivo_solicitud_periodo_familia(
    db: Session, usuario: Usuario | None, solicitud_id: uuid.UUID
) -> tuple[bytes, str, str]:
    """Devuelve el comprobante de una solicitud propia, si existe."""
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    familia = _familia_del_usuario(db, usuario)
    solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    if solicitud.familia_id != familia.id:
        raise PermisoDenegado("No tenés acceso a esta solicitud")
    consulta_vinculo = select(FamiliaAlumno.id).where(
        FamiliaAlumno.familia_id == familia.id,
        FamiliaAlumno.alumno_id == solicitud.alumno_id,
    )
    if db.scalar(consulta_vinculo) is None:
        raise PermisoDenegado("No tenés acceso a esta solicitud")
    if solicitud.archivo_contenido is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La solicitud no tiene comprobante")
    return (
        solicitud.archivo_contenido,
        solicitud.archivo_tipo or "application/octet-stream",
        solicitud.archivo_nombre or "comprobante",
    )


def cancelar_solicitud_periodo(
    db: Session, usuario: Usuario | None, solicitud_id: uuid.UUID
) -> SolicitudAusenciaPeriodo:
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    familia = _familia_del_usuario(db, usuario)
    solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    consulta_vinculo = select(FamiliaAlumno.id).where(
        FamiliaAlumno.familia_id == familia.id,
        FamiliaAlumno.alumno_id == solicitud.alumno_id,
    )
    if solicitud.familia_id != familia.id or db.scalar(consulta_vinculo) is None:
        raise PermisoDenegado("No tenés acceso a esta solicitud")
    db.scalar(select(Alumno.id).where(Alumno.id == solicitud.alumno_id).with_for_update())
    if db.scalar(consulta_vinculo.with_for_update()) is None:
        raise PermisoDenegado("No tenés acceso a esta solicitud")
    db.refresh(solicitud)
    if solicitud.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, "La solicitud ya no está pendiente")
    solicitud.estado = "cancelada"
    solicitud.fecha_resolucion = datetime.now()
    solicitud.usuario_resolucion_id = usuario.id
    log_audit(
        db,
        entidad="SOLICITUD_AUSENCIA_PERIODO",
        entidad_id=solicitud.id,
        campo="estado",
        valor_anterior="pendiente",
        valor_nuevo="cancelada",
        usuario_id=usuario.id,
    )
    db.commit()
    db.refresh(solicitud)
    return solicitud
