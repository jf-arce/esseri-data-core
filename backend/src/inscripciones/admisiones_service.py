"""Pipeline de solicitudes de admisión y su documentación."""

import uuid
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import NivelEducativo
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
    DocumentoSolicitudCreate,
    DocumentoSolicitudRead,
    DocumentoSolicitudUpdate,
    SolicitudInscripcionAdministrativaUpdate,
    SolicitudInscripcionCreate,
    SolicitudInscripcionListadoItemRead,
    SolicitudInscripcionListadoRead,
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


def _tiene_inscripcion_asociada(db: Session, solicitud_id: uuid.UUID) -> bool:
    return (
        db.scalar(
            select(Inscripcion.id)
            .where(Inscripcion.solicitud_inscripcion_id == solicitud_id)
            .limit(1)
        )
        is not None
    )


def _validar_sin_inscripcion_asociada(db: Session, solicitud: SolicitudInscripcion) -> None:
    if _tiene_inscripcion_asociada(db, solicitud.id):
        raise InscripcionInvalida(
            "La solicitud ya tiene una inscripción asociada y no admite esta operación."
        )


def _etapa_actual_en_proceso(db: Session, solicitud: SolicitudInscripcion) -> EtapaSolicitud | None:
    return db.scalar(
        select(EtapaSolicitud)
        .where(
            EtapaSolicitud.solicitud_inscripcion_id == solicitud.id,
            EtapaSolicitud.etapa == solicitud.etapa,
            EtapaSolicitud.estado == "en_proceso",
        )
        .order_by(EtapaSolicitud.fecha.desc())
        .limit(1)
    )


def _agregar_motivo(observaciones: str | None, etiqueta: str, motivo: str) -> str:
    detalle = f"{etiqueta}: {motivo}"
    return f"{observaciones}\n\n{detalle}" if observaciones else detalle


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


def actualizar_solicitud_inscripcion(
    db: Session,
    solicitud_id: uuid.UUID,
    datos: SolicitudInscripcionAdministrativaUpdate,
) -> SolicitudInscripcionRead:
    """Actualiza únicamente datos administrativos de una admisión aún abierta."""

    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "en_proceso":
        raise InscripcionInvalida("Solo se puede editar una admisión que está en proceso.")
    _validar_sin_inscripcion_asociada(db, solicitud)

    nivel = db.get(NivelEducativo, datos.nivel_educativo_id)
    if nivel is None:
        raise InscripcionNoEncontrada("El nivel educativo indicado no existe.")

    solicitud.ciclo_lectivo = datos.ciclo_lectivo
    solicitud.fecha_solicitud = datos.fecha_solicitud
    solicitud.nivel_educativo_id = nivel.id
    solicitud.observaciones = datos.observaciones
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def revertir_ultima_etapa_solicitud(
    db: Session, solicitud_id: uuid.UUID, motivo: str, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    """Reabre exactamente la etapa anterior sin eliminar el historial recorrido."""

    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "en_proceso":
        raise InscripcionInvalida("Solo se puede revertir una solicitud que está en proceso.")
    _validar_sin_inscripcion_asociada(db, solicitud)

    indice_actual = ETAPAS_ADMISION.index(solicitud.etapa)
    if indice_actual == 0:
        raise InscripcionInvalida("No se puede revertir la primera etapa de la admisión.")

    etapa_actual = _etapa_actual_en_proceso(db, solicitud)
    if etapa_actual is not None:
        etapa_actual.estado = "revertida"
        etapa_actual.observaciones = _agregar_motivo(
            etapa_actual.observaciones, "Etapa revertida", motivo
        )

    etapa_anterior = ETAPAS_ADMISION[indice_actual - 1]
    solicitud.etapa = etapa_anterior
    db.add(
        EtapaSolicitud(
            etapa=etapa_anterior,
            estado="en_proceso",
            observaciones=f"Etapa reabierta. Motivo: {motivo}",
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario_id,
        )
    )
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def desistir_solicitud_inscripcion(
    db: Session, solicitud_id: uuid.UUID, motivo: str
) -> SolicitudInscripcionRead:
    """Cierra una admisión abandonada, preservando la etapa y los registros existentes."""

    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado not in {"en_proceso", "aprobada"}:
        raise InscripcionInvalida("Solo se puede desistir una solicitud que sigue abierta.")
    if solicitud.etapa == "inscripcion_confirmada":
        raise InscripcionInvalida("No se puede desistir una solicitud con inscripción confirmada.")
    _validar_sin_inscripcion_asociada(db, solicitud)

    etapa_actual = _etapa_actual_en_proceso(db, solicitud)
    if etapa_actual is not None:
        etapa_actual.estado = "desistida"
        etapa_actual.observaciones = _agregar_motivo(
            etapa_actual.observaciones, "Solicitud desistida", motivo
        )

    solicitud.estado = "desistida"
    solicitud.fecha_resolucion = date.today()
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


def revocar_aprobacion_solicitud(
    db: Session, solicitud_id: uuid.UUID, motivo: str, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    """Deshace una aprobación accidental antes de que genere una inscripción."""

    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "aprobada" or solicitud.etapa != "reserva_matricula":
        raise InscripcionInvalida(
            "Solo se puede revocar una aprobación durante la reserva de matrícula."
        )
    _validar_sin_inscripcion_asociada(db, solicitud)

    etapa_actual = _etapa_actual_en_proceso(db, solicitud)
    if etapa_actual is not None:
        etapa_actual.estado = "revertida"
        etapa_actual.observaciones = _agregar_motivo(
            etapa_actual.observaciones, "Aprobación revocada", motivo
        )

    solicitud.estado = "en_proceso"
    solicitud.etapa = "evaluacion_aprobacion"
    solicitud.fecha_resolucion = None
    db.add(
        EtapaSolicitud(
            etapa="evaluacion_aprobacion",
            estado="en_proceso",
            observaciones=f"Aprobación revocada. Motivo: {motivo}",
            solicitud_inscripcion_id=solicitud.id,
            usuario_id=usuario_id,
        )
    )
    _guardar_cambios(db)
    db.refresh(solicitud)
    return _respuesta_solicitud(db, solicitud)


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
            "La confirmación final se realiza desde la etapa de documentación y contrato."
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


def confirmar_inscripcion_solicitud(
    db: Session, solicitud_id: uuid.UUID, usuario_id: uuid.UUID
) -> SolicitudInscripcionRead:
    """Confirma una admisión cuya documentación ya fue validada.

    Esta operación no crea Alumno, Familia, Factura ni la inscripción académica. Solo deja la
    solicitud disponible para que el alta de inscripción nueva use el flujo existente.
    """

    solicitud = _obtener_solicitud(db, solicitud_id, bloquear=True)
    if solicitud.estado != "aprobada" or solicitud.etapa != "documentacion_contrato":
        raise InscripcionInvalida(
            "Solo se puede confirmar una solicitud en documentación y contrato."
        )
    _validar_sin_inscripcion_asociada(db, solicitud)

    documentos = db.scalars(
        select(DocumentoSolicitud.estado).where(
            DocumentoSolicitud.solicitud_inscripcion_id == solicitud.id
        )
    ).all()
    if not documentos:
        raise InscripcionInvalida(
            "Debe cargarse y validarse al menos un documento antes de confirmar la inscripción."
        )
    if "validado" not in documentos or "pendiente" in documentos:
        raise InscripcionInvalida(
            "Debe existir un documento validado y no pueden quedar documentos pendientes."
        )

    etapa_actual = _etapa_actual_en_proceso(db, solicitud)
    if etapa_actual is not None:
        etapa_actual.estado = "completada"

    solicitud.etapa = "inscripcion_confirmada"
    db.add(
        EtapaSolicitud(
            etapa="inscripcion_confirmada",
            estado="completada",
            observaciones="Inscripción confirmada con documentación validada.",
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
