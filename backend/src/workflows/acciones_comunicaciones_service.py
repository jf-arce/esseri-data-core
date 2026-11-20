"""Publishes debit results to the economic family through Communications."""

import hashlib
import uuid

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.comunicaciones import service as comunicaciones
from src.comunicaciones.models import Comunicacion
from src.comunicaciones.schemas import Audiencia, PublicableInput
from src.facturacion.models import DebitoCobranza, Factura, ResponsableEconomico
from src.inscripciones.models import Inscripcion
from src.models import EventLog
from src.workflows.accion_contexto import AccionContexto
from src.workflows.models import WorkflowExecution
from src.workflows.notificaciones_service import (
    ComunicacionNoPreparada,
    _emails_de_familia,
    preparar_contenido_comunicacion,
)
from src.workflows.schemas import ConfigPublicarComunicacion, ResultadoAccion

_CLAVE_DEBITO = uuid.UUID("dbadd711-e72d-4ebf-a93f-225ab754da61")
_ERROR_DESTINO = "La factura no tiene un responsable económico habilitado para comunicaciones."
_ERROR_AUTOR = "No se pudo identificar quién confirmó el débito."
_ERROR_CONTENIDO = "El asunto o el mensaje no es válido para publicar una comunicación."


def _autor(db: Session, evento: EventLog) -> Usuario | None:
    return db.get(Usuario, evento.usuario_id) if evento.usuario_id else None


def _clave(evento: EventLog) -> uuid.UUID:
    return uuid.uuid5(_CLAVE_DEBITO, str(evento.id))


def _preparar(
    db: Session, accion: AccionContexto, evento: EventLog
) -> tuple[PublicableInput, dict[uuid.UUID, list[str]]]:
    fila = db.execute(
        select(ResponsableEconomico.familia_id, Inscripcion.alumno_id)
        .select_from(DebitoCobranza)
        .join(Factura, Factura.id == DebitoCobranza.factura_id)
        .join(ResponsableEconomico, ResponsableEconomico.id == Factura.responsable_economico_id)
        .join(Inscripcion, Inscripcion.id == Factura.inscripcion_id)
        .where(DebitoCobranza.id == evento.entidad_id)
    ).one_or_none()
    if evento.entidad != "debito_cobranza" or fila is None:
        raise ComunicacionNoPreparada(_ERROR_DESTINO)
    familia_id, alumno_id = fila
    audiencia = Audiencia(tipo="responsables", ids=[familia_id])
    habilitados = comunicaciones.resolver(db, audiencia)
    if str(alumno_id) not in habilitados.get(familia_id, []):
        raise ComunicacionNoPreparada(_ERROR_DESTINO)
    asunto, cuerpo = preparar_contenido_comunicacion(db, accion, evento)
    try:
        config = ConfigPublicarComunicacion.model_validate(accion.accion_config or {})
        datos = PublicableInput(
            clave=_clave(evento),
            asunto=asunto,
            cuerpo=cuerpo,
            audiencia=audiencia,
            tipo="administrativa",
            canal=config.canal,
        )
    except ValidationError:
        raise ComunicacionNoPreparada(_ERROR_CONTENIDO) from None
    return datos, {familia_id: [str(alumno_id)]}


def emails_cubiertos(db: Session, accion: AccionContexto, evento: EventLog) -> set[str]:
    if (accion.accion_config or {}).get("canal") not in ("email", "ambos") or not _autor(
        db, evento
    ):
        return set()
    try:
        _, destinatarios = _preparar(db, accion, evento)
    except ComunicacionNoPreparada:
        return set()
    return {
        email.strip().lower()
        for familia_id in destinatarios
        for email in _emails_de_familia(db, familia_id)
        if email.strip()
    }


def ejecutar_publicar_comunicacion(
    db: Session, accion: AccionContexto, evento: EventLog, _ejecucion: WorkflowExecution
) -> ResultadoAccion:
    autor = _autor(db, evento)
    if autor is None:
        return ResultadoAccion(detalle=_ERROR_AUTOR, error=_ERROR_AUTOR)

    # PostgreSQL: FOR NO KEY UPDATE serializes publishers without blocking FK key shares.
    db.execute(
        select(EventLog.id).where(EventLog.id == evento.id).with_for_update(key_share=True)
    ).scalar_one()
    clave = _clave(evento)
    existente = db.scalar(
        select(Comunicacion).where(Comunicacion.autor_id == autor.id, Comunicacion.clave == clave)
    )
    if existente is not None:
        solicitado = ConfigPublicarComunicacion.model_validate(accion.accion_config or {}).canal
        if existente.canal != solicitado:
            conflicto = (
                f"El resultado ya se publicó con el canal «{existente.canal}»; "
                f"esta regla pidió «{solicitado}»."
            )
            return ResultadoAccion(detalle=conflicto, error=conflicto)
        return ResultadoAccion(detalle="La comunicación del resultado ya está publicada.")
    try:
        datos, destinatarios = _preparar(db, accion, evento)
    except ComunicacionNoPreparada as error:
        return ResultadoAccion(detalle=error.error, error=error.error)
    comunicacion = Comunicacion(
        autor_id=autor.id,
        clave=clave,
        solicitud_hash=hashlib.sha256(datos.model_dump_json().encode()).hexdigest(),
        asunto=datos.asunto,
        cuerpo=datos.cuerpo,
        audiencia=datos.audiencia.model_dump(mode="json"),
        tipo=datos.tipo,
        canal=datos.canal,
    )
    db.add(comunicacion)
    db.flush()
    comunicaciones.publicar_en_transaccion(db, comunicacion, autor, destinatarios)
    return ResultadoAccion(detalle="Comunicación del resultado publicada.")
