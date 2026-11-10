"""Creation of family absence requests covering an inclusive period."""

import math
import uuid
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from src.academico.models import (
    JustificacionInasistencia,
    MotivoJustificacion,
    SolicitudAusenciaPeriodo,
)
from src.academico.schemas import (
    FiltrosSolicitudesPeriodo,
    SolicitudAusenciaPeriodoAdminResponse,
    SolicitudesPeriodoPaginadasResponse,
    SolicitudesPeriodoResumen,
)
from src.academico.service import _familia_del_usuario, _validar_comprobante_justificacion
from src.auditoria.service import log_audit
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import AuditLog, Persona
from src.search import normalizar_columna_busqueda, normalizar_texto_busqueda


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
        origen="familia",
        motivo=motivo_db.nombre,
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
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


def _query_solicitudes_periodo(db: Session):
    """Solicitudes con el contexto mínimo que necesita la bandeja administrativa."""
    return (
        db.query(
            SolicitudAusenciaPeriodo,
            Persona.nombre,
            Persona.apellido,
            MotivoJustificacion.nombre,
        )
        .join(Alumno, Alumno.id == SolicitudAusenciaPeriodo.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .outerjoin(
            MotivoJustificacion,
            MotivoJustificacion.id == SolicitudAusenciaPeriodo.motivo_justificacion_id,
        )
    )


def _aplicar_filtros_solicitudes(
    query, filtros: FiltrosSolicitudesPeriodo, incluir_estado: bool = True
):
    if filtros.alumno_id is not None:
        query = query.filter(SolicitudAusenciaPeriodo.alumno_id == filtros.alumno_id)
    if incluir_estado and filtros.estado is not None:
        query = query.filter(SolicitudAusenciaPeriodo.estado == filtros.estado)
    if filtros.fecha_desde is not None:
        query = query.filter(SolicitudAusenciaPeriodo.fecha_fin >= filtros.fecha_desde)
    if filtros.fecha_hasta is not None:
        query = query.filter(SolicitudAusenciaPeriodo.fecha_inicio <= filtros.fecha_hasta)
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


def _respuesta_admin(fila) -> SolicitudAusenciaPeriodoAdminResponse:
    solicitud, nombre, apellido, motivo = fila
    return SolicitudAusenciaPeriodoAdminResponse(
        id=solicitud.id,
        alumno_id=solicitud.alumno_id,
        alumno_nombre=f"{nombre} {apellido}",
        familia_id=solicitud.familia_id,
        fecha_inicio=solicitud.fecha_inicio,
        fecha_fin=solicitud.fecha_fin,
        estado=solicitud.estado,
        motivo=motivo or "",
        observacion=solicitud.observacion,
        observacion_resolucion=solicitud.observacion_resolucion,
        archivo_nombre=solicitud.archivo_nombre,
        fecha_carga=solicitud.fecha_carga,
        fecha_resolucion=solicitud.fecha_resolucion,
    )


def resumen_solicitudes_periodo(
    db: Session, filtros: FiltrosSolicitudesPeriodo | None = None
) -> SolicitudesPeriodoResumen:
    """Conteos por estado dentro de los filtros activos, sin contar el estado pedido."""
    query = _query_solicitudes_periodo(db)
    if filtros is not None:
        query = _aplicar_filtros_solicitudes(query, filtros, incluir_estado=False)
    filas = (
        query.with_entities(
            SolicitudAusenciaPeriodo.estado,
            func.count(SolicitudAusenciaPeriodo.id),
        )
        .group_by(SolicitudAusenciaPeriodo.estado)
        .all()
    )
    conteos = {estado: cantidad for estado, cantidad in filas}
    pendientes = conteos.get("pendiente", 0)
    aprobadas = conteos.get("aprobada", 0)
    rechazadas = conteos.get("rechazada", 0)
    canceladas = conteos.get("cancelada", 0)
    revocadas = conteos.get("revocada", 0)
    return SolicitudesPeriodoResumen(
        pendientes=pendientes,
        aprobadas=aprobadas,
        rechazadas=rechazadas,
        canceladas=canceladas,
        revocadas=revocadas,
        total=pendientes + aprobadas + rechazadas + canceladas + revocadas,
    )


def pagina_solicitudes_periodo(
    db: Session, filtros: FiltrosSolicitudesPeriodo
) -> SolicitudesPeriodoPaginadasResponse:
    """Listado paginado y filtrado de solicitudes de ausencia por período."""
    query = _aplicar_filtros_solicitudes(_query_solicitudes_periodo(db), filtros)
    total = query.count()
    total_paginas = math.ceil(total / filtros.tamanio_pagina) if total else 0
    filas = (
        query.order_by(SolicitudAusenciaPeriodo.fecha_carga.desc())
        .offset((filtros.pagina - 1) * filtros.tamanio_pagina)
        .limit(filtros.tamanio_pagina)
        .all()
    )
    return SolicitudesPeriodoPaginadasResponse(
        items=[_respuesta_admin(fila) for fila in filas],
        total=total,
        pagina=filtros.pagina,
        tamanio_pagina=filtros.tamanio_pagina,
        total_paginas=total_paginas,
        resumen=resumen_solicitudes_periodo(db, filtros),
    )


def respuesta_admin_solicitud(
    db: Session, solicitud: SolicitudAusenciaPeriodo
) -> SolicitudAusenciaPeriodoAdminResponse:
    """Respuesta con contexto para la bandeja después de una decisión."""
    fila = (
        _query_solicitudes_periodo(db).filter(SolicitudAusenciaPeriodo.id == solicitud.id).first()
    )
    if fila is None:
        raise LookupError("Solicitud no encontrada")
    return _respuesta_admin(fila)


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
        origen="familia",
        motivo="cancelación familiar",
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
    )
    db.commit()
    db.refresh(solicitud)
    return solicitud


def resolver_solicitud_periodo(
    db: Session,
    usuario: Usuario | None,
    solicitud_id: uuid.UUID,
    aprobar: bool,
    observacion: str | None,
) -> SolicitudAusenciaPeriodo:
    """Aprueba o rechaza una solicitud pendiente.

    La aprobación solo transforma asistencias reales que siguen pendientes
    (`ausente_pendiente`). No crea asistencias futuras ni toca presencias,
    tardanzas o decisiones históricas ya resueltas. Cada aplicación queda auditada.
    """
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    db.scalar(select(Alumno.id).where(Alumno.id == solicitud.alumno_id).with_for_update())
    db.refresh(solicitud)
    if solicitud.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, "La solicitud ya fue resuelta")

    estado_nuevo = "aprobada" if aprobar else "rechazada"
    solicitud.estado = estado_nuevo
    solicitud.observacion_resolucion = observacion
    solicitud.fecha_resolucion = datetime.now()
    solicitud.usuario_resolucion_id = usuario.id
    decision = log_audit(
        db,
        entidad="SOLICITUD_AUSENCIA_PERIODO",
        entidad_id=solicitud.id,
        campo="estado",
        valor_anterior="pendiente",
        valor_nuevo=estado_nuevo,
        usuario_id=usuario.id,
        origen="administracion",
        motivo=observacion
        or ("aprobación administrativa" if aprobar else "rechazo administrativo"),
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
    )
    if aprobar:
        asistencias = db.scalars(
            select(Asistencia)
            .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
            .where(
                Inscripcion.alumno_id == solicitud.alumno_id,
                Asistencia.fecha.between(solicitud.fecha_inicio, solicitud.fecha_fin),
                Asistencia.tipo == "ausente_pendiente",
            )
            .order_by(Asistencia.fecha)
        ).all()
        for asistencia in asistencias:
            asistencia.tipo = "ausente_justificado"
            asistencia.solicitud_ausencia_periodo_id = solicitud.id
            log_audit(
                db,
                entidad="ASISTENCIA",
                entidad_id=asistencia.id,
                campo="tipo",
                valor_anterior="ausente_pendiente",
                valor_nuevo="ausente_justificado",
                usuario_id=None,
                actor_tipo="sistema",
                origen="aplicacion_automatica",
                motivo="cobertura por solicitud aprobada",
                referencia_entidad="AUDIT_LOG",
                referencia_id=decision.id,
            )
            log_audit(
                db,
                entidad="ASISTENCIA",
                entidad_id=asistencia.id,
                campo="solicitud_ausencia_periodo_id",
                valor_anterior=None,
                valor_nuevo=str(solicitud.id),
                usuario_id=None,
                actor_tipo="sistema",
                origen="aplicacion_automatica",
                motivo="cobertura por solicitud aprobada",
                referencia_entidad="AUDIT_LOG",
                referencia_id=decision.id,
            )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def revocar_solicitud_periodo(
    db: Session,
    usuario: Usuario | None,
    solicitud_id: uuid.UUID,
    motivo: str,
) -> SolicitudAusenciaPeriodo:
    """Revoca una solicitud aprobada y retira solo sus aplicaciones.

    Es idempotente: una solicitud ya revocada se devuelve sin nuevas auditorías.
    No toca presencias, tardanzas ni decisiones históricas independientes.
    """
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La solicitud requiere un usuario autenticado")
    if not motivo or not motivo.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "El motivo de la revocación es obligatorio",
        )
    solicitud = db.get(SolicitudAusenciaPeriodo, solicitud_id)
    if solicitud is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Solicitud no encontrada")
    db.scalar(select(Alumno.id).where(Alumno.id == solicitud.alumno_id).with_for_update())
    db.refresh(solicitud)
    if solicitud.estado == "revocada":
        return solicitud
    if solicitud.estado != "aprobada":
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Solo se puede revocar una solicitud aprobada",
        )

    solicitud.estado = "revocada"
    solicitud.observacion_resolucion = motivo
    solicitud.fecha_resolucion = datetime.now()
    solicitud.usuario_resolucion_id = usuario.id
    decision = log_audit(
        db,
        entidad="SOLICITUD_AUSENCIA_PERIODO",
        entidad_id=solicitud.id,
        campo="estado",
        valor_anterior="aprobada",
        valor_nuevo="revocada",
        usuario_id=usuario.id,
        origen="revocacion_administrativa",
        motivo=motivo,
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
    )
    asistencias = db.scalars(
        select(Asistencia)
        .where(Asistencia.solicitud_ausencia_periodo_id == solicitud.id)
        .order_by(Asistencia.fecha)
    ).all()
    for asistencia in asistencias:
        tipo_anterior = asistencia.tipo
        log_audit(
            db,
            entidad="ASISTENCIA",
            entidad_id=asistencia.id,
            campo="solicitud_ausencia_periodo_id",
            valor_anterior=str(solicitud.id),
            valor_nuevo=None,
            usuario_id=None,
            actor_tipo="sistema",
            origen="revocacion_administrativa",
            motivo=motivo,
            referencia_entidad="AUDIT_LOG",
            referencia_id=decision.id,
        )
        asistencia.solicitud_ausencia_periodo_id = None
        if tipo_anterior == "ausente_justificado":
            asistencia.tipo = "ausente_pendiente"
            log_audit(
                db,
                entidad="ASISTENCIA",
                entidad_id=asistencia.id,
                campo="tipo",
                valor_anterior="ausente_justificado",
                valor_nuevo="ausente_pendiente",
                usuario_id=None,
                actor_tipo="sistema",
                origen="revocacion_administrativa",
                motivo=motivo,
                referencia_entidad="AUDIT_LOG",
                referencia_id=decision.id,
            )

    db.commit()
    db.refresh(solicitud)
    return solicitud


def rectificar_asistencia_administrativa(
    db: Session,
    usuario: Usuario | None,
    asistencia: Asistencia,
    tipo: str,
    motivo: str,
) -> Asistencia:
    """Corrige una asistencia aplicada por una solicitud por período.

    Solo admite presente/tardanza. Retira el vínculo y conserva la solicitud aprobada.
    Si la asistencia ya fue rectificada al mismo tipo, el reintento es idempotente.
    """
    if usuario is None or usuario.id is None:
        raise PermisoDenegado("La rectificación requiere un usuario autenticado")
    if tipo not in {"presente", "tardanza"}:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "La rectificación administrativa solo admite presente o tardanza",
        )
    if not motivo or not motivo.strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "El motivo de la rectificación es obligatorio",
        )
    inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
    if inscripcion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Asistencia no encontrada")
    db.scalar(select(Alumno.id).where(Alumno.id == inscripcion.alumno_id).with_for_update())
    db.refresh(asistencia)

    if asistencia.solicitud_ausencia_periodo_id is None:
        previa = db.scalar(
            select(AuditLog.id)
            .where(
                AuditLog.entidad == "ASISTENCIA",
                AuditLog.entidad_id == asistencia.id,
                AuditLog.campo == "tipo",
                AuditLog.valor_nuevo == tipo,
                AuditLog.origen == "rectificacion_administrativa",
            )
            .limit(1)
        )
        if previa is not None and asistencia.tipo == tipo:
            return asistencia
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La asistencia no fue aplicada por una solicitud por período",
        )

    solicitud = db.get(SolicitudAusenciaPeriodo, asistencia.solicitud_ausencia_periodo_id)
    if solicitud is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "La solicitud asociada a la asistencia no existe",
        )
    tipo_anterior = asistencia.tipo
    vinculo_anterior = asistencia.solicitud_ausencia_periodo_id
    asistencia.tipo = tipo
    asistencia.solicitud_ausencia_periodo_id = None
    log_audit(
        db,
        entidad="ASISTENCIA",
        entidad_id=asistencia.id,
        campo="tipo",
        valor_anterior=tipo_anterior,
        valor_nuevo=tipo,
        usuario_id=usuario.id,
        origen="rectificacion_administrativa",
        motivo=motivo,
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
    )
    log_audit(
        db,
        entidad="ASISTENCIA",
        entidad_id=asistencia.id,
        campo="solicitud_ausencia_periodo_id",
        valor_anterior=str(vinculo_anterior),
        valor_nuevo=None,
        usuario_id=usuario.id,
        origen="rectificacion_administrativa",
        motivo=motivo,
        referencia_entidad="SOLICITUD_AUSENCIA_PERIODO",
        referencia_id=solicitud.id,
    )
    db.commit()
    db.refresh(asistencia)
    return asistencia
