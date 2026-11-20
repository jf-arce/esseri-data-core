from datetime import date
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, defer

from src.academico.models import JustificacionInasistencia, SolicitudAusenciaPeriodo
from src.auth.autorizacion_service import roles_de, tiene_permiso_en_rol
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
    PERMISO_FACTURACION_LEER,
)
from src.auth.models import Usuario
from src.comunicaciones.conversaciones_schemas import ContextoConversacion, TipoContexto
from src.comunicaciones.models import ConversacionContextual
from src.facturacion.models import DebitoCobranza, Factura, ResponsableEconomico
from src.familias_alumnos.models import Alumno
from src.familias_alumnos.service import familia_tiene_alumno, obtener_familia_de_usuario
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona

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
    inicio: date
    if tipo == "debito_cobranza":
        inicio = tramite.vencimiento
        estado = "rechazado"
    elif tipo == "justificacion_inasistencia":
        inicio = fila[3]
        estado = tramite.estado
    else:
        inicio = tramite.fecha_inicio
        estado = tramite.estado
    return ContextoConversacion(
        tipo=tipo,
        id=id_contexto,
        alumno_nombre=f"{nombre} {apellido}",
        alumno_id=alumno_id,
        fecha_inicio=inicio,
        fecha_fin=tramite.fecha_fin if tipo == "solicitud_ausencia_periodo" else None,
        estado_tramite=estado,
        factura_id=tramite.factura_id if tipo == "debito_cobranza" else None,
    ), familia_id
