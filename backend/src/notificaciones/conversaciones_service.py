"""Private inbox notices and durable mail intentions for staff messages."""

from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.comunicaciones.contextos_conversacion import contexto_de_hilo, resolver_contexto
from src.comunicaciones.models import ConversacionContextual, MensajeConversacion
from src.familias_alumnos.models import FamiliaAlumno
from src.notificaciones.constants import (
    AMBITO_COMUNICACIONES,
    DESTINO_CONVERSACION,
    TIPO_RESPUESTA_CONVERSACION,
)
from src.notificaciones.destinatarios import cuentas_de_familia
from src.workflows.models import EnvioNotificacion

TITULO = "Nuevo mensaje de Administración"
AVISO = "Tenés un nuevo mensaje en una conversación del Portal Familia."


def _cuentas_autorizadas(db: Session, hilo: ConversacionContextual) -> dict[UUID, UUID]:
    autorizadas = {}
    for usuario_id in cuentas_de_familia(db, hilo.familia_id):
        usuario = db.get(Usuario, usuario_id)
        try:
            contexto, familia = resolver_contexto(db, usuario, "familia", *contexto_de_hilo(hilo))
        except HTTPException as error:
            if error.status_code != 404:
                raise
            continue
        if familia == hilo.familia_id:
            autorizadas[usuario_id] = contexto.alumno_id
    return autorizadas


def _emails_autorizados(
    db: Session, familia_id: UUID, cuentas_autorizadas: dict[UUID, UUID]
) -> set[str]:
    emails = set()
    for usuario_id, alumno_id in cuentas_autorizadas.items():
        habilitado = db.scalar(
            select(FamiliaAlumno.id).where(
                FamiliaAlumno.familia_id == familia_id,
                FamiliaAlumno.alumno_id == alumno_id,
                FamiliaAlumno.recibe_comunicaciones.is_(True),
            )
        )
        usuario = db.get(Usuario, usuario_id)
        if habilitado and usuario.email and usuario.email.strip():
            emails.add(usuario.email.strip().lower())
    return emails


def registrar_respuesta(db: Session, hilo: ConversacionContextual, mensaje: MensajeConversacion):
    from src.notificaciones.service import publicar

    if mensaje.lado != "administracion":
        return
    cuentas = _cuentas_autorizadas(db, hilo)
    for usuario_id, alumno_id in cuentas.items():
        publicar(
            db,
            usuario_id=usuario_id,
            familia_id=hilo.familia_id,
            alumno_id=alumno_id,
            ambito=AMBITO_COMUNICACIONES,
            clave_hecho=f"conversacion:mensaje:{mensaje.id}",
            tipo=TIPO_RESPUESTA_CONVERSACION,
            titulo=TITULO,
            mensaje=AVISO,
            contexto={
                "conversacion_id": str(hilo.id),
                "mensaje_id": str(mensaje.id),
                "familia_id": str(hilo.familia_id),
                "alumno_id": str(alumno_id),
            },
            destino_tipo=DESTINO_CONVERSACION,
            destino_id=hilo.id,
        )
    for email in sorted(_emails_autorizados(db, hilo.familia_id, cuentas)):
        db.add(
            EnvioNotificacion(
                mensaje_conversacion_id=mensaje.id,
                familia_id=hilo.familia_id,
                email=email,
                asunto=TITULO,
                cuerpo=AVISO,
            )
        )


def hilo_de_envio(db: Session, envio: EnvioNotificacion) -> ConversacionContextual | None:
    return db.scalar(
        select(ConversacionContextual)
        .join(MensajeConversacion, MensajeConversacion.conversacion_id == ConversacionContextual.id)
        .where(
            MensajeConversacion.id == envio.mensaje_conversacion_id,
            MensajeConversacion.lado == "administracion",
            ConversacionContextual.familia_id == envio.familia_id,
        )
    )


def envio_autorizado(db: Session, envio: EnvioNotificacion) -> bool:
    hilo = hilo_de_envio(db, envio)
    if hilo is None:
        return False
    return envio.email in _emails_autorizados(db, hilo.familia_id, _cuentas_autorizadas(db, hilo))
