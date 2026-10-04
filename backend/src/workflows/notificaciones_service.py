"""Ejecución de la acción `notificar`: resuelve destinatarios, renderiza la plantilla, registra
`NOTIFICACION` y pide el envío a n8n (RF-24).

El envío corre dentro de la transacción del evento y en serie. Un envío que falla deja su fila
en `fallido` sin lanzar, para no revertir las filas ya registradas. No es idempotente: si n8n
envía y la respuesta se pierde, un reintento manda el email otra vez."""

import logging
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.academico.models import JustificacionInasistencia
from src.auth.models import Usuario, UsuarioRol
from src.facturacion.models import Factura, Pago, ResponsableEconomico
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import EventLog
from src.workflows import n8n_client, plantillas_service
from src.workflows.constants import MAX_DESTINATARIOS_POR_EJECUCION
from src.workflows.exceptions import (
    N8nNoConfigurado,
    N8nNoDisponible,
    NotificacionNoEncontrada,
    PlantillaInvalida,
)
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    ReglaDestinatario,
    WorkflowExecution,
    WorkflowRule,
)
from src.workflows.schemas import (
    ConfigAlertaInterna,
    ConfigNotificar,
    DestinatarioTipo,
    EstadoEnvioNotificacion,
    NotificacionDetalleRead,
    NotificacionListadoRead,
    NotificacionRead,
    ResultadoAccion,
)

logger = logging.getLogger(__name__)

ERROR_SIN_PLANTILLA = "La regla no tiene plantilla de notificación."
ERROR_SIN_MENSAJE = "La regla no tiene mensaje ni plantilla de notificación."
ERROR_RENDER = "La plantilla no se pudo completar con los datos del evento."
ERROR_SIN_DESTINATARIOS = "No se encontró ningún destinatario con email."
ERROR_SIN_ALUMNO = "No se pudo determinar el alumno del evento."
ERROR_TOPE = "La regla supera el máximo de destinatarios por envío."
ERROR_ENVIO = "No se pudo enviar el email a todos los destinatarios."
ERRORES_CONTROLADOS = frozenset(
    {
        ERROR_SIN_PLANTILLA,
        ERROR_SIN_MENSAJE,
        ERROR_RENDER,
        ERROR_SIN_DESTINATARIOS,
        ERROR_SIN_ALUMNO,
        ERROR_TOPE,
        ERROR_ENVIO,
    }
)


@dataclass(frozen=True)
class Destinatario:
    tipo: str  # "usuario" | "familia"
    email: str
    usuario_id: uuid.UUID | None = None
    familia_id: uuid.UUID | None = None


@dataclass(frozen=True)
class _Mensaje:
    destinatario: Destinatario
    asunto: str
    cuerpo: str


class _SinAlumno(Exception):
    pass


class _SinContenido(Exception):
    def __init__(self, error: str) -> None:
        super().__init__(error)
        self.error = error


# --- Destinatarios -------------------------------------------------------------------------


def resolver_destinatarios(
    db: Session, regla: WorkflowRule, evento: EventLog, destino: str
) -> tuple[list[Destinatario], int]:
    """Devuelve los destinatarios deduplicados y cuántas familias quedaron sin email."""
    if destino == "destinatarios_regla":
        return _deduplicar(_destinatarios_de_regla(db, regla)), 0

    alumno_id = _alumno_del_evento(db, evento)
    if destino == "responsables_habilitados":
        familias = list(
            db.scalars(
                select(FamiliaAlumno.familia_id).where(
                    FamiliaAlumno.alumno_id == alumno_id,
                    FamiliaAlumno.recibe_comunicaciones.is_(True),
                )
            )
        )
    else:
        familias = [_familia_responsable_economico(db, evento, alumno_id)]

    destinatarios: list[Destinatario] = []
    sin_email = 0
    for familia_id in dict.fromkeys(f for f in familias if f is not None):
        emails = _emails_de_familia(db, familia_id)
        sin_email += 0 if emails else 1
        destinatarios.extend(
            Destinatario(tipo="familia", email=email, familia_id=familia_id) for email in emails
        )
    return _deduplicar(destinatarios), sin_email


def _deduplicar(destinatarios: list[Destinatario]) -> list[Destinatario]:
    vistos: dict[tuple[str, uuid.UUID | None, str], Destinatario] = {}
    for d in destinatarios:
        vistos.setdefault((d.tipo, d.familia_id or d.usuario_id, d.email), d)
    return list(vistos.values())


def _destinatarios_de_regla(db: Session, regla: WorkflowRule) -> list[Destinatario]:
    asignados = db.scalars(
        select(ReglaDestinatario).where(ReglaDestinatario.workflow_rule_id == regla.id)
    ).all()
    usuarios_ids = {a.usuario_id for a in asignados if a.usuario_id is not None}
    roles_ids = {a.rol_id for a in asignados if a.rol_id is not None}
    consulta = select(Usuario).where(Usuario.estado == "activo")
    por_rol = select(UsuarioRol.usuario_id).where(UsuarioRol.rol_id.in_(roles_ids))
    usuarios = db.scalars(
        consulta.where(Usuario.id.in_(usuarios_ids) | Usuario.id.in_(por_rol)).order_by(
            Usuario.email
        )
    )
    return [Destinatario(tipo="usuario", email=u.email, usuario_id=u.id) for u in usuarios]


def _emails_de_familia(db: Session, familia_id: uuid.UUID) -> list[str]:
    """`Persona` no tiene email: sale de las cuentas activas de esa persona."""
    persona_id = db.scalar(select(Familia.persona_id).where(Familia.id == familia_id))
    if persona_id is None:
        return []
    return list(
        db.scalars(
            select(Usuario.email)
            .where(Usuario.persona_id == persona_id, Usuario.estado == "activo")
            .order_by(Usuario.email)
        )
    )


def _alumno_del_evento(db: Session, evento: EventLog) -> uuid.UUID:
    entidad_id = evento.entidad_id
    match evento.entidad:
        case "inscripcion":
            inscripcion_id: uuid.UUID | None = entidad_id
        case "factura":
            inscripcion_id = db.scalar(
                select(Factura.inscripcion_id).where(Factura.id == entidad_id)
            )
        case "pago":
            inscripcion_id = db.scalar(
                select(Factura.inscripcion_id)
                .join(Pago, Pago.factura_id == Factura.id)
                .where(Pago.id == entidad_id)
            )
        case "asistencia":
            inscripcion_id = db.scalar(
                select(Asistencia.inscripcion_id).where(Asistencia.id == entidad_id)
            )
        case "justificacion_inasistencia":
            inscripcion_id = db.scalar(
                select(Asistencia.inscripcion_id)
                .join(
                    JustificacionInasistencia,
                    JustificacionInasistencia.asistencia_id == Asistencia.id,
                )
                .where(JustificacionInasistencia.id == entidad_id)
            )
        case _:
            raise _SinAlumno()
    if inscripcion_id is None:
        raise _SinAlumno()
    alumno_id = db.scalar(select(Inscripcion.alumno_id).where(Inscripcion.id == inscripcion_id))
    if alumno_id is None:
        raise _SinAlumno()
    return alumno_id


def _familia_responsable_economico(
    db: Session, evento: EventLog, alumno_id: uuid.UUID
) -> uuid.UUID | None:
    """En facturas y pagos vale el responsable que tenía la factura, aunque ya no esté vigente."""
    if evento.entidad in {"factura", "pago"}:
        consulta = select(ResponsableEconomico.familia_id).join(
            Factura, Factura.responsable_economico_id == ResponsableEconomico.id
        )
        if evento.entidad == "factura":
            return db.scalar(consulta.where(Factura.id == evento.entidad_id))
        return db.scalar(
            consulta.join(Pago, Pago.factura_id == Factura.id).where(Pago.id == evento.entidad_id)
        )
    return db.scalar(
        select(ResponsableEconomico.familia_id).where(
            ResponsableEconomico.alumno_id == alumno_id,
            ResponsableEconomico.vigencia_hasta.is_(None),
        )
    )


# --- Ejecución -----------------------------------------------------------------------------


def ejecutar_notificar(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    destino = ConfigNotificar.model_validate(regla.accion_config or {}).destinatario
    return _ejecutar(db, regla, evento, ejecucion, destino, _contenido_notificar)


def ejecutar_alerta_interna(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> ResultadoAccion:
    """Avisa por email a los usuarios y roles de la regla. Usa la plantilla si la regla la tiene
    y, si no, `accion_config.mensaje` como cuerpo."""
    return _ejecutar(db, regla, evento, ejecucion, "destinatarios_regla", _contenido_alerta)


def _contenido_notificar(db: Session, regla: WorkflowRule, evento: EventLog) -> tuple[str, str]:
    plantilla = _plantilla_de(db, regla)
    if plantilla is None:
        raise _SinContenido(ERROR_SIN_PLANTILLA)
    return _renderizar(regla, evento, plantilla)


def _contenido_alerta(db: Session, regla: WorkflowRule, evento: EventLog) -> tuple[str, str]:
    plantilla = _plantilla_de(db, regla)
    if plantilla is not None:
        return _renderizar(regla, evento, plantilla)
    mensaje = ConfigAlertaInterna.model_validate(regla.accion_config or {}).mensaje
    if mensaje is None:
        raise _SinContenido(ERROR_SIN_MENSAJE)
    return f"Alerta interna: {regla.nombre}", mensaje


def _plantilla_de(db: Session, regla: WorkflowRule) -> NotificacionTemplate | None:
    if regla.notificacion_template_id is None:
        return None
    return db.get(NotificacionTemplate, regla.notificacion_template_id)


def _renderizar(
    regla: WorkflowRule, evento: EventLog, plantilla: NotificacionTemplate
) -> tuple[str, str]:
    try:
        return plantillas_service.renderizar_contenido(
            plantilla.asunto, plantilla.cuerpo, evento.payload or {}
        )
    except PlantillaInvalida:
        logger.warning("No se pudo renderizar la plantilla de la regla %s", regla.id, exc_info=True)
        raise _SinContenido(ERROR_RENDER) from None


def _ejecutar(
    db: Session,
    regla: WorkflowRule,
    evento: EventLog,
    ejecucion: WorkflowExecution,
    destino: str,
    obtener_contenido: Callable[[Session, WorkflowRule, EventLog], tuple[str, str]],
) -> ResultadoAccion:
    previas = _notificaciones_del_ultimo_intento(db, regla, evento, ejecucion)
    if previas:
        # Reintento: se reenvía solo lo que falló, tal como se registró.
        pendientes = [
            _Mensaje(
                Destinatario(
                    tipo=n.destinatario_tipo,
                    email=n.destinatario_snapshot,
                    usuario_id=n.usuario_id,
                    familia_id=n.familia_id,
                ),
                n.asunto_snapshot,
                n.cuerpo_snapshot,
            )
            for n in previas
            if n.estado_envio == "fallido"
        ]
        if not pendientes:
            return ResultadoAccion(detalle="Todos los emails ya habían sido enviados.")
        return _enviar_todos(db, ejecucion, pendientes, total=len(pendientes), sin_email=0)

    try:
        asunto, cuerpo = obtener_contenido(db, regla, evento)
    except _SinContenido as e:
        return ResultadoAccion(error=e.error)

    try:
        destinatarios, sin_email = resolver_destinatarios(db, regla, evento, destino)
    except _SinAlumno:
        return ResultadoAccion(error=ERROR_SIN_ALUMNO)
    if not destinatarios:
        detalle = _detalle_sin_email(sin_email)
        return ResultadoAccion(detalle=detalle, error=ERROR_SIN_DESTINATARIOS)
    if len(destinatarios) > MAX_DESTINATARIOS_POR_EJECUCION:
        return ResultadoAccion(error=ERROR_TOPE)

    mensajes = [_Mensaje(d, asunto, cuerpo) for d in destinatarios]
    return _enviar_todos(db, ejecucion, mensajes, total=len(mensajes), sin_email=sin_email)


def _detalle_sin_email(sin_email: int) -> str | None:
    return f"{sin_email} familia(s) sin email." if sin_email else None


def _notificaciones_del_ultimo_intento(
    db: Session, regla: WorkflowRule, evento: EventLog, ejecucion: WorkflowExecution
) -> list[Notificacion]:
    ultimo_intento_id = db.scalar(
        select(WorkflowExecution.id)
        .join(Notificacion, Notificacion.workflow_execution_id == WorkflowExecution.id)
        .where(
            WorkflowExecution.workflow_rule_id == regla.id,
            WorkflowExecution.event_log_id == evento.id,
            WorkflowExecution.id != ejecucion.id,
        )
        .order_by(WorkflowExecution.intento.desc())
        .limit(1)
    )
    if ultimo_intento_id is None:
        return []
    return list(
        db.scalars(
            select(Notificacion)
            .where(Notificacion.workflow_execution_id == ultimo_intento_id)
            .order_by(Notificacion.destinatario_snapshot)
        )
    )


def _enviar_todos(
    db: Session,
    ejecucion: WorkflowExecution,
    mensajes: list[_Mensaje],
    *,
    total: int,
    sin_email: int,
) -> ResultadoAccion:
    enviados = 0
    n8n_caido = False
    for mensaje in mensajes:
        notificacion = Notificacion(
            destinatario_tipo=mensaje.destinatario.tipo,
            canal="email",
            destinatario_snapshot=mensaje.destinatario.email,
            asunto_snapshot=mensaje.asunto,
            cuerpo_snapshot=mensaje.cuerpo,
            estado_envio="fallido",
            workflow_execution_id=ejecucion.id,
            familia_id=mensaje.destinatario.familia_id,
            usuario_id=mensaje.destinatario.usuario_id,
        )
        db.add(notificacion)
        db.flush()
        if n8n_caido:
            continue
        try:
            n8n_client.enviar_email(mensaje.destinatario.email, mensaje.asunto, mensaje.cuerpo)
        except (N8nNoConfigurado, N8nNoDisponible):
            logger.warning("n8n no está disponible: se corta el envío", exc_info=True)
            n8n_caido = True
            continue
        except Exception:
            logger.warning("Falló el envío de la notificación %s", notificacion.id, exc_info=True)
            continue
        notificacion.estado_envio = "enviado"
        notificacion.sent_at = datetime.now()
        enviados += 1

    detalle = f"{enviados} de {total} emails enviados"
    if sin_email:
        detalle += f"; {_detalle_sin_email(sin_email)}"
    return ResultadoAccion(detalle=detalle, error=None if enviados == total else ERROR_ENVIO)


# --- Log de notificaciones (RF-26) ---


def listar_notificaciones(
    db: Session,
    *,
    estado_envio: EstadoEnvioNotificacion | None,
    destinatario_tipo: DestinatarioTipo | None,
    workflow_execution_id: uuid.UUID | None,
    pagina: int,
    tamanio_pagina: int,
) -> NotificacionListadoRead:
    filtros = []
    if estado_envio is not None:
        filtros.append(Notificacion.estado_envio == estado_envio)
    if destinatario_tipo is not None:
        filtros.append(Notificacion.destinatario_tipo == destinatario_tipo)
    if workflow_execution_id is not None:
        filtros.append(Notificacion.workflow_execution_id == workflow_execution_id)

    total = db.scalar(select(func.count(Notificacion.id)).where(*filtros)) or 0
    # NOTIFICACION no tiene created_at y sent_at es NULL en las fallidas: se ordena por el
    # inicio de la ejecución. El id de ejecución evita intercalar ejecuciones con igual inicio.
    filas = db.execute(
        _consulta_notificaciones()
        .where(*filtros)
        .order_by(
            WorkflowExecution.started_at.desc(),
            WorkflowExecution.id,
            Notificacion.destinatario_snapshot,
            Notificacion.id,
        )
        .offset((pagina - 1) * tamanio_pagina)
        .limit(tamanio_pagina)
    ).all()
    return NotificacionListadoRead(
        items=[_fila_notificacion_read(*fila) for fila in filas],
        total=total,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
        total_paginas=(total + tamanio_pagina - 1) // tamanio_pagina,
    )


def obtener_notificacion_read(db: Session, notificacion_id: uuid.UUID) -> NotificacionDetalleRead:
    fila = db.execute(
        _consulta_notificaciones().where(Notificacion.id == notificacion_id)
    ).one_or_none()
    if fila is None:
        raise NotificacionNoEncontrada()
    notificacion = fila[0]
    return NotificacionDetalleRead(
        **_fila_notificacion_read(*fila).model_dump(),
        cuerpo_snapshot=notificacion.cuerpo_snapshot,
    )


def _consulta_notificaciones():
    return (
        select(
            Notificacion,
            WorkflowExecution.intento,
            WorkflowExecution.started_at,
            WorkflowRule.id,
            WorkflowRule.nombre,
        )
        .join(WorkflowExecution, WorkflowExecution.id == Notificacion.workflow_execution_id)
        .join(WorkflowRule, WorkflowRule.id == WorkflowExecution.workflow_rule_id)
    )


def _fila_notificacion_read(
    notificacion: Notificacion,
    intento: int,
    ejecucion_started_at: datetime,
    regla_id: uuid.UUID,
    regla_nombre: str,
) -> NotificacionRead:
    return NotificacionRead(
        id=notificacion.id,
        destinatario_tipo=notificacion.destinatario_tipo,
        canal=notificacion.canal,
        destinatario_snapshot=notificacion.destinatario_snapshot,
        asunto_snapshot=notificacion.asunto_snapshot,
        estado_envio=notificacion.estado_envio,
        sent_at=notificacion.sent_at,
        familia_id=notificacion.familia_id,
        usuario_id=notificacion.usuario_id,
        workflow_execution_id=notificacion.workflow_execution_id,
        intento=intento,
        ejecucion_started_at=ejecucion_started_at,
        workflow_rule_id=regla_id,
        workflow_rule_nombre=regla_nombre,
    )
