from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, defer

from src.academico.models import (
    Anio,
    Division,
    JustificacionInasistencia,
    MotivoJustificacion,
    SolicitudAusenciaPeriodo,
)
from src.auth.autorizacion_service import roles_de, tiene_permiso_en_rol
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
    PERMISO_FACTURACION_LEER,
)
from src.auth.models import Usuario
from src.comunicaciones.conversaciones_schemas import ContextoConversacion, TipoContexto
from src.comunicaciones.models import ConversacionContextual
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    LoteCobranza,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Alumno
from src.familias_alumnos.service import familia_tiene_alumno, obtener_familia_de_usuario
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import EventLog, Persona
from src.workflows.models import TipoEvento

CONTEXTO_FK = {
    "debito_cobranza": ConversacionContextual.debito_id,
    "justificacion_inasistencia": ConversacionContextual.justificacion_id,
    "solicitud_ausencia_periodo": ConversacionContextual.solicitud_periodo_id,
}
ROLES_ADMIN = {"administracion", "administrador_del_sistema"}


def no_encontrado() -> HTTPException:
    return HTTPException(404, "No se encontró el trámite o la conversación.")


def tipos_administrativos(db: Session, usuario: Usuario, rol: str | None) -> set[str]:
    if rol not in ROLES_ADMIN:
        return set()
    tipos = set()
    if tiene_permiso_en_rol(db, usuario.id, rol, PERMISO_FACTURACION_LEER):
        tipos.add("debito_cobranza")
    if tiene_permiso_en_rol(db, usuario.id, rol, PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES):
        tipos.update(("justificacion_inasistencia", "solicitud_ausencia_periodo"))
    return tipos


def contexto_de_hilo(hilo: ConversacionContextual) -> tuple[TipoContexto, UUID]:
    if hilo.debito_id is not None:
        return "debito_cobranza", hilo.debito_id
    if hilo.justificacion_id is not None:
        return "justificacion_inasistencia", hilo.justificacion_id
    if hilo.solicitud_periodo_id is not None:
        return "solicitud_ausencia_periodo", hilo.solicitud_periodo_id
    raise no_encontrado()


def resolver_contexto(
    db: Session,
    usuario: Usuario,
    rol: str | None,
    tipo: TipoContexto,
    id_contexto: UUID,
    *,
    bloquear: bool = False,
) -> tuple[ContextoConversacion, UUID]:
    if rol == "familia":
        familia = obtener_familia_de_usuario(db, usuario)
        if familia is None or "familia" not in roles_de(db, usuario.id):
            raise no_encontrado()
    elif tipo not in tipos_administrativos(db, usuario, rol):
        raise no_encontrado()

    if tipo == "debito_cobranza":
        origen = DebitoCobranza
        consulta = (
            select(origen, ResponsableEconomico.familia_id, Inscripcion.alumno_id)
            .join(Factura, Factura.id == origen.factura_id)
            .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
            .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
            .where(origen.resultado == "RECHAZADO_SIM")
        )
    elif tipo == "justificacion_inasistencia":
        origen = JustificacionInasistencia
        consulta = (
            select(origen, origen.familia_id, Inscripcion.alumno_id, Asistencia.fecha)
            .join(Asistencia, Asistencia.id == origen.asistencia_id)
            .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        )
    else:
        origen = SolicitudAusenciaPeriodo
        consulta = select(origen, origen.familia_id, origen.alumno_id).options(
            defer(origen.archivo_contenido)
        )

    consulta = consulta.where(origen.id == id_contexto)
    if bloquear:
        consulta = consulta.with_for_update(of=origen)
    fila = db.execute(consulta).one_or_none()
    if fila is None:
        raise no_encontrado()
    tramite, familia_id, alumno_id = fila[:3]
    if rol == "familia" and (
        familia.id != familia_id or not familia_tiene_alumno(db, familia_id, alumno_id)
    ):
        raise no_encontrado()

    nombre, apellido = db.execute(
        select(Persona.nombre, Persona.apellido)
        .join(Alumno, Alumno.persona_id == Persona.id)
        .where(Alumno.id == alumno_id)
    ).one()
    curso = db.execute(
        select(Anio.numero, Division.nombre)
        .join(Anio, Anio.id == Division.anio_id)
        .join(Inscripcion, Inscripcion.division_id == Division.id)
        .where(Inscripcion.alumno_id == alumno_id, Inscripcion.estado == "activa")
        .order_by(Inscripcion.fecha_inscripcion.desc())
        .limit(1)
    ).one_or_none()
    curso = f"{curso.numero}° {curso.nombre}" if curso is not None else None
    concepto = importe = motivo = None
    fecha_intento = None
    if tipo == "debito_cobranza":
        inicio = tramite.vencimiento
        estado = "rechazado"
        concepto = tramite.concepto
        importe = f"{tramite.importe:.2f}"
        evento = db.execute(
            select(EventLog.payload, EventLog.timestamp)
            .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
            .where(
                EventLog.entidad == "debito_cobranza",
                EventLog.entidad_id == id_contexto,
                TipoEvento.nombre == "debito.resultado_registrado",
            )
            .order_by(EventLog.timestamp.desc(), EventLog.id.desc())
            .limit(1)
        ).one_or_none()
        if evento is not None:
            datos = evento.payload or {}
            motivo = str(datos.get("motivo_rechazo") or datos.get("codigo_resultado") or "") or None
            fecha_intento = evento.timestamp.date()
        if fecha_intento is None:
            fecha_intento = db.scalar(
                select(LoteCobranza.fecha).where(LoteCobranza.id == tramite.lote_id)
            )
    elif tipo == "justificacion_inasistencia":
        inicio = fila[3]
        estado = tramite.estado
    else:
        inicio = tramite.fecha_inicio
        estado = tramite.estado
    if tipo != "debito_cobranza":
        motivo = db.scalar(
            select(MotivoJustificacion.nombre).where(
                MotivoJustificacion.id == tramite.motivo_justificacion_id
            )
        )
    return ContextoConversacion(
        tipo=tipo,
        id=id_contexto,
        alumno_nombre=f"{nombre} {apellido}",
        alumno_id=alumno_id,
        fecha_inicio=inicio,
        fecha_fin=tramite.fecha_fin if tipo == "solicitud_ausencia_periodo" else None,
        estado_tramite=estado,
        factura_id=tramite.factura_id if tipo == "debito_cobranza" else None,
        alumno_curso=curso,
        concepto=concepto,
        importe=importe,
        motivo=motivo,
        fecha_intento=fecha_intento,
    ), familia_id
