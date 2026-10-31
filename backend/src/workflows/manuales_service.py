"""Transporte durable de emails manuales, sobre la misma infraestructura de notificaciones.

Una comunicación publicada crea una `EnvioNotificacion` por familia y dirección normalizada.
Ese registro es la clave lógica estable de envío: no cambia entre reintentos. Cada llamada
externa crea una `Notificacion` propia (intento) que se confirma ANTES del HTTP y cuyo
`proveedor_iniciado` marca el claim durable de n8n antes de invocar Gmail.

Reglas centrales:

- Un timeout, un 5xx o un ack malformado dejan el envío en `incierto`: pudo haberse enviado.
  Nunca se reintenta a ciegas.
- Solo un fallo conocido antes de iniciar el proveedor (conexión rechazada) se reintenta, con
  esperas acotadas de 30 s y 120 s y como máximo 3 intentos por ciclo.
- Un lease vencido sin claim de n8n vuelve a `pendiente`; con claim iniciado queda `incierto`.
- El reclamo y el resultado de n8n usan el `intento_id` activo. Un claim duplicado no vuelve a
  llamar a Gmail.
"""

import logging
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from src.comunicaciones.models import Comunicacion, ComunicacionAdjunto, ReciboComunicacion
from src.config import settings
from src.exceptions import AppException
from src.familias_alumnos.models import FamiliaAlumno
from src.fechas import ahora_utc
from src.workflows import n8n_client
from src.workflows.email_html import armar_html
from src.workflows.models import EnvioNotificacion, Notificacion
from src.workflows.notificaciones_service import _emails_de_familia

logger = logging.getLogger(__name__)

MAX_INTENTOS_POR_CICLO = 3
ESPERAS_REINTENTO_SEGUNDOS = (30, 120)
LEASE_SEGUNDOS = 300
ERROR_LEASE_SIN_INICIO = "lease_expirado_sin_inicio"
ERROR_CLIENTE = "error_cliente_envio"
TEXTO_ENLACE_PORTAL = "Ver comunicación en el portal"


class EnvioNoEncontrado(AppException):
    status_code = 404

    def __init__(self, message: str = "El envío indicado no existe."):
        super().__init__(message)


class EnvioNoReintentable(AppException):
    status_code = 409

    def __init__(self, message: str = "El envío no se puede reintentar en su estado actual."):
        super().__init__(message)


@dataclass(frozen=True)
class ResumenEnviosManuales:
    recuperados: int = 0
    procesados: int = 0
    presentados: int = 0
    fallidos: int = 0
    inciertos: int = 0
    reintentados: int = 0


def _normalizar_email(email: str) -> str:
    return email.strip().lower()


def _espera_reintento(reintentos_ciclo: int) -> int:
    indice = max(reintentos_ciclo - 1, 0)
    return ESPERAS_REINTENTO_SEGUNDOS[min(indice, len(ESPERAS_REINTENTO_SEGUNDOS) - 1)]


def preparar_envios(
    db: Session, comunicacion: Comunicacion, destinatarios: dict[uuid.UUID, list[str]]
) -> list[EnvioNotificacion]:
    """Crea las intenciones durables de una publicación. No hace commit.

    `destinatarios` es el mapa familia → alumnos que devuelve el dominio de Comunicaciones.
    Una familia sin email genera una intención explícita `sin_email`, nunca un éxito silencioso.
    Las intenciones ya existentes conservan su snapshot (publicación idempotente).
    """

    adjuntos = list(
        db.scalars(
            select(ComunicacionAdjunto.nombre)
            .where(ComunicacionAdjunto.comunicacion_id == comunicacion.id)
            .order_by(ComunicacionAdjunto.created_at, ComunicacionAdjunto.id)
        )
    )
    cuerpo = comunicacion.cuerpo
    if adjuntos:
        plural = "s" if len(adjuntos) != 1 else ""
        nombres = "\n".join(f"- {' '.join(nombre.splitlines())}" for nombre in adjuntos)
        cuerpo = (
            f"{cuerpo}\n\nEsta comunicación incluye {len(adjuntos)} "
            f"archivo{plural} adjunto{plural}."
            f"\n{nombres}\n\nPodés ver{'los' if plural else 'lo'} en el Portal Familia "
            "o descargar una copia. Para acceder, iniciá sesión con tu cuenta."
        )

    envios: list[EnvioNotificacion] = []
    for familia_id in destinatarios:
        emails = sorted(
            {
                _normalizar_email(email)
                for email in _emails_de_familia(db, familia_id)
                if _normalizar_email(email)
            }
        )
        for email in emails or [""]:
            envio = _crear_intento_si_falta(db, comunicacion, familia_id, email, cuerpo)
            envios.append(envio)
    return envios


def _crear_intento_si_falta(
    db: Session, comunicacion: Comunicacion, familia_id: uuid.UUID, email: str, cuerpo: str
) -> EnvioNotificacion:
    consulta = select(EnvioNotificacion).where(
        EnvioNotificacion.comunicacion_id == comunicacion.id,
        EnvioNotificacion.familia_id == familia_id,
        EnvioNotificacion.email == email,
    )
    existente = db.scalar(consulta)
    if existente is not None:
        return existente

    envio = EnvioNotificacion(
        comunicacion_id=comunicacion.id,
        familia_id=familia_id,
        email=email,
        asunto=comunicacion.asunto,
        cuerpo=cuerpo,
        estado="sin_email" if not email else "pendiente",
        intentos=0,
        reintentos_ciclo=0,
        disponible_at=ahora_utc(),
    )
    # La publicación bloquea la comunicación y es idempotente; la clave única es la última
    # defensa contra duplicados. No se usan savepoints: en SQLite liberar uno confirma la
    # transacción externa y rompería el contrato de "no commit" que espera Comunicaciones.
    db.add(envio)
    db.flush()
    return envio


def historial(db: Session, comunicacion_id: uuid.UUID) -> list[dict]:
    """Historial de envíos manuales, apto para administración/docencia autorizada.

    No incluye cuerpo, dirección del alumno ni datos de familias ajenas al alcance que el
    router debe validar antes de llamar a esta función.
    """

    envios = db.scalars(
        select(EnvioNotificacion)
        .where(EnvioNotificacion.comunicacion_id == comunicacion_id)
        .order_by(EnvioNotificacion.familia_id, EnvioNotificacion.email)
    ).all()
    intentos = _intentos_por_envio(db, [envio.id for envio in envios])
    return [
        {
            "id": envio.id,
            "email": envio.email or None,
            "estado": envio.estado,
            "intentos": [
                {
                    "id": intento.id,
                    "estado": intento.estado_envio,
                    "error_codigo": intento.error_codigo,
                    "started_at": intento.started_at,
                    "finished_at": intento.finished_at,
                }
                for intento in intentos.get(envio.id, [])
            ],
        }
        for envio in envios
    ]


def _intentos_por_envio(
    db: Session, envio_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[Notificacion]]:
    if not envio_ids:
        return {}
    filas = db.scalars(
        select(Notificacion)
        .where(Notificacion.envio_id.in_(envio_ids))
        .order_by(Notificacion.envio_id, Notificacion.numero_intento)
    ).all()
    agrupados: dict[uuid.UUID, list[Notificacion]] = {}
    for intento in filas:
        agrupados.setdefault(intento.envio_id, []).append(intento)
    return agrupados


def reintentar(db: Session, comunicacion_id: uuid.UUID, envio_id: uuid.UUID) -> dict:
    """Reintento manual autorizado de un envío con fallo conocido.

    Solo se acepta `fallido`: presentado, en proceso o incierto quedan fuera para no duplicar
    un email que pudo haberse enviado. Mantiene el mismo `envio_id`, el historial completo y la
    numeración de intentos; abre un ciclo nuevo de hasta 3 reintentos automáticos.
    """

    envio = db.scalar(
        select(EnvioNotificacion)
        .where(
            EnvioNotificacion.id == envio_id,
            EnvioNotificacion.comunicacion_id == comunicacion_id,
        )
        .with_for_update()
    )
    if envio is None:
        raise EnvioNoEncontrado()
    if envio.estado != "fallido":
        raise EnvioNoReintentable()

    ahora = ahora_utc()
    envio.estado = "pendiente"
    envio.reintentos_ciclo = 0
    envio.disponible_at = ahora
    envio.lease_at = None
    envio.intento_actual_id = None
    db.commit()
    return _historial_de_envio(db, envio)


def _historial_de_envio(db: Session, envio: EnvioNotificacion) -> dict:
    return next(item for item in historial(db, envio.comunicacion_id) if item["id"] == envio.id)


def procesar_envios_pendientes(db: Session, limite: int = 50) -> ResumenEnviosManuales:
    """Recupera leases vencidos y despacha los envíos manuales disponibles."""

    recuperados = _recuperar_leases(db)
    resumen = ResumenEnviosManuales(recuperados=recuperados)
    if not _despacho_manual_habilitado():
        return resumen

    ahora = ahora_utc()
    ids = list(
        db.scalars(
            select(EnvioNotificacion.id)
            .where(
                EnvioNotificacion.estado == "pendiente",
                EnvioNotificacion.disponible_at <= ahora,
            )
            .order_by(EnvioNotificacion.disponible_at)
            .limit(limite)
        )
    )
    for envio_id in ids:
        if not _revalidar_vinculo(db, envio_id):
            resumen = _acumular(resumen, "fallido")
            continue
        intento_id = _reclamar(db, envio_id)
        if intento_id is None:
            continue
        resumen = _acumular(resumen, _procesar_uno(db, envio_id, intento_id))
    return resumen


def _vinculo_vigente(db: Session, envio: EnvioNotificacion) -> bool:
    """El recibo congelado sigue autorizando: vínculo original y todavía habilitado.

    Un vínculo nuevo con otro alumno no reautoriza una publicación vieja.
    """

    alumnos_congelados = db.scalar(
        select(ReciboComunicacion.alumnos).where(
            ReciboComunicacion.comunicacion_id == envio.comunicacion_id,
            ReciboComunicacion.familia_id == envio.familia_id,
        )
    )
    if not alumnos_congelados:
        return False
    vigentes = {
        str(alumno_id)
        for alumno_id in db.scalars(
            select(FamiliaAlumno.alumno_id).where(
                FamiliaAlumno.familia_id == envio.familia_id,
                FamiliaAlumno.recibe_comunicaciones.is_(True),
            )
        )
    }
    return bool(vigentes.intersection(str(alumno) for alumno in alumnos_congelados))


def _revalidar_vinculo(db: Session, envio_id: uuid.UUID) -> bool:
    """Antes de cada claim/retry. Si se revocó, cierra el envío sin llamar al transporte."""

    envio = db.scalar(
        select(EnvioNotificacion)
        .where(EnvioNotificacion.id == envio_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if envio is None or envio.estado != "pendiente":
        db.rollback()
        return True
    if _vinculo_vigente(db, envio):
        db.rollback()
        return True

    ahora = ahora_utc()
    envio.intentos += 1
    envio.estado = "fallido"
    envio.lease_at = None
    envio.intento_actual_id = None
    db.add(
        Notificacion(
            destinatario_tipo="familia",
            canal="email",
            destinatario_snapshot=envio.email,
            asunto_snapshot=envio.asunto,
            cuerpo_snapshot=envio.cuerpo,
            estado_envio="fallido",
            workflow_execution_id=None,
            envio_id=envio.id,
            numero_intento=envio.intentos,
            started_at=ahora,
            finished_at=ahora,
            proveedor_iniciado=False,
            error_codigo="vinculo_revocado",
            familia_id=envio.familia_id,
        )
    )
    db.commit()
    return False


def _despacho_manual_habilitado() -> bool:
    """Fail-closed: sin workflow correlacionado, URL, token ni callback no se despacha nada."""

    return bool(
        settings.N8N_MANUAL_HABILITADO
        and settings.N8N_WEBHOOK_URL
        and settings.N8N_WEBHOOK_TOKEN
        and settings.N8N_CALLBACK_BASE_URL
    )


def _reclamar(db: Session, envio_id: uuid.UUID) -> uuid.UUID | None:
    """Claim corto y atómico. Crea el intento durable en la misma transacción."""

    ahora = ahora_utc()
    intento_id = uuid.uuid4()
    resultado = db.execute(
        update(EnvioNotificacion)
        .where(
            EnvioNotificacion.id == envio_id,
            EnvioNotificacion.estado == "pendiente",
            EnvioNotificacion.disponible_at <= ahora,
        )
        .values(
            estado="procesando",
            lease_at=ahora,
            intento_actual_id=intento_id,
            intentos=EnvioNotificacion.intentos + 1,
            reintentos_ciclo=EnvioNotificacion.reintentos_ciclo + 1,
        )
    )
    if resultado.rowcount != 1:
        db.rollback()
        return None

    envio = db.scalar(
        select(EnvioNotificacion)
        .where(EnvioNotificacion.id == envio_id)
        .execution_options(populate_existing=True)
    )
    if envio is None:
        db.rollback()
        return None
    db.add(
        Notificacion(
            id=intento_id,
            destinatario_tipo="familia",
            canal="email",
            destinatario_snapshot=envio.email,
            asunto_snapshot=envio.asunto,
            cuerpo_snapshot=envio.cuerpo,
            estado_envio="pendiente",
            workflow_execution_id=None,
            envio_id=envio.id,
            numero_intento=envio.intentos,
            started_at=ahora,
            proveedor_iniciado=False,
            familia_id=envio.familia_id,
        )
    )
    db.commit()
    return intento_id


def _procesar_uno(db: Session, envio_id: uuid.UUID, intento_id: uuid.UUID) -> str:
    envio = db.get(EnvioNotificacion, envio_id)
    if envio is None or envio.intento_actual_id != intento_id:
        return "omitido"
    try:
        cantidad_adjuntos = (
            db.scalar(
                select(func.count())
                .select_from(ComunicacionAdjunto)
                .where(ComunicacionAdjunto.comunicacion_id == envio.comunicacion_id)
            )
            or 0
        )
        resultado = n8n_client.enviar_email_manual(
            envio.email,
            envio.asunto,
            envio.cuerpo,
            armar_html(
                envio.asunto,
                envio.cuerpo,
                _enlace_portal(envio, cantidad_adjuntos=cantidad_adjuntos),
            ),
            envio_id=envio.id,
            intento_id=intento_id,
            callback_base_url=settings.N8N_CALLBACK_BASE_URL,
        )
    except Exception as error:
        logger.warning("Manual email client failed (type=%s)", type(error).__name__)
        resultado = n8n_client.ResultadoEnvioManual(estado="incierto", error_codigo=ERROR_CLIENTE)
    return _finalizar(db, envio_id, intento_id, resultado)


def _enlace_portal(envio: EnvioNotificacion, *, cantidad_adjuntos: int = 0) -> tuple[str, str]:
    url = f"{settings.FRONTEND_URL.rstrip('/')}/familia/comunicaciones/{envio.comunicacion_id}"
    texto = TEXTO_ENLACE_PORTAL
    if cantidad_adjuntos:
        texto = (
            "Ver adjunto en el portal" if cantidad_adjuntos == 1 else "Ver adjuntos en el portal"
        )
    return url, texto


def _finalizar(
    db: Session,
    envio_id: uuid.UUID,
    intento_id: uuid.UUID,
    resultado: n8n_client.ResultadoEnvioManual,
) -> str:
    envio = db.scalar(
        select(EnvioNotificacion)
        .where(EnvioNotificacion.id == envio_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if envio is None or envio.intento_actual_id != intento_id:
        db.rollback()
        return "omitido"
    if envio.estado not in {"procesando", "incierto"}:
        # El callback de n8n ya cerró el intento; el ack HTTP llegó tarde.
        db.rollback()
        return envio.estado

    intento = db.get(Notificacion, intento_id)
    if intento is None:
        db.rollback()
        return "omitido"

    # A durable provider claim outweighs a later transport error classification.
    if intento.proveedor_iniciado and resultado.estado in {"reintentable", "fallido"}:
        resultado = n8n_client.ResultadoEnvioManual(
            estado="incierto", error_codigo="fallo_tras_claim"
        )

    ahora = ahora_utc()
    if resultado.estado == "presentado":
        intento.estado_envio = "presentado"
        intento.proveedor_iniciado = True
        intento.referencia_proveedor = resultado.referencia_proveedor
        intento.finished_at = ahora
        envio.estado = "presentado"
        envio.lease_at = None
    elif resultado.estado == "incierto":
        intento.estado_envio = "incierto"
        intento.proveedor_iniciado = True
        intento.error_codigo = resultado.error_codigo or "resultado_incierto"
        intento.finished_at = ahora
        envio.estado = "incierto"
        envio.lease_at = None
    elif resultado.estado == "reintentable":
        intento.estado_envio = "fallido"
        intento.error_codigo = resultado.error_codigo or "fallo_seguro"
        intento.finished_at = ahora
        envio.lease_at = None
        envio.intento_actual_id = None
        if envio.reintentos_ciclo < MAX_INTENTOS_POR_CICLO:
            envio.estado = "pendiente"
            envio.disponible_at = ahora + timedelta(
                seconds=_espera_reintento(envio.reintentos_ciclo)
            )
        else:
            envio.estado = "fallido"
    else:  # fallido definitivo o rechazo de n8n
        intento.estado_envio = "fallido"
        intento.error_codigo = resultado.error_codigo or "envio_fallido"
        intento.finished_at = ahora
        envio.estado = "fallido"
        envio.lease_at = None
    envio.intento_actual_id = None if envio.estado != "incierto" else intento_id
    db.commit()
    return envio.estado


def _recuperar_leases(db: Session) -> int:
    """Recupera claims abandonados por caída del worker.

    Sin claim de n8n el envío no salió: vuelve a pendiente con backoff. Con claim iniciado pudo
    haber llegado a Gmail: queda incierto y nunca se reenvía automáticamente.
    """

    limite = ahora_utc() - timedelta(seconds=LEASE_SEGUNDOS)
    envios = db.scalars(
        select(EnvioNotificacion)
        .where(
            EnvioNotificacion.estado == "procesando",
            EnvioNotificacion.lease_at.is_not(None),
            EnvioNotificacion.lease_at <= limite,
        )
        .with_for_update(skip_locked=True)
    ).all()
    if not envios:
        return 0

    ahora = ahora_utc()
    for envio in envios:
        intento = (
            db.get(Notificacion, envio.intento_actual_id)
            if envio.intento_actual_id is not None
            else None
        )
        if intento is not None and intento.proveedor_iniciado:
            intento.estado_envio = "incierto"
            intento.error_codigo = intento.error_codigo or "lease_expirado_iniciado"
            intento.finished_at = ahora
            envio.estado = "incierto"
        else:
            if intento is not None:
                intento.estado_envio = "fallido"
                intento.error_codigo = ERROR_LEASE_SIN_INICIO
                intento.finished_at = ahora
            envio.intento_actual_id = None
            if envio.reintentos_ciclo < MAX_INTENTOS_POR_CICLO:
                envio.estado = "pendiente"
                envio.disponible_at = ahora + timedelta(
                    seconds=_espera_reintento(envio.reintentos_ciclo)
                )
            else:
                envio.estado = "fallido"
        envio.lease_at = None
    db.commit()
    return len(envios)


def _acumular(resumen: ResumenEnviosManuales, estado: str) -> ResumenEnviosManuales:
    if estado == "presentado":
        return _reemplazar(resumen, presentados=resumen.presentados + 1)
    if estado == "fallido":
        return _reemplazar(resumen, fallidos=resumen.fallidos + 1)
    if estado == "incierto":
        return _reemplazar(resumen, inciertos=resumen.inciertos + 1)
    if estado == "pendiente":
        return _reemplazar(resumen, reintentados=resumen.reintentados + 1)
    return resumen


def _reemplazar(resumen: ResumenEnviosManuales, **cambios: int) -> ResumenEnviosManuales:
    datos = {
        "recuperados": resumen.recuperados,
        "procesados": resumen.procesados,
        "presentados": resumen.presentados,
        "fallidos": resumen.fallidos,
        "inciertos": resumen.inciertos,
        "reintentados": resumen.reintentados,
    }
    datos.update(cambios)
    if "presentados" in cambios or "fallidos" in cambios or "inciertos" in cambios:
        datos["procesados"] = resumen.procesados + 1
    return ResumenEnviosManuales(**datos)


def reclamar_intento(db: Session, envio_id: uuid.UUID, intento_id: uuid.UUID) -> dict:
    """Claim durable de n8n antes de Gmail. Solo el intento activo y sin claim previo avanza."""

    envio = db.scalar(
        select(EnvioNotificacion).where(EnvioNotificacion.id == envio_id).with_for_update()
    )
    if envio is None:
        raise EnvioNoEncontrado()
    if envio.estado not in {"procesando", "incierto"} or envio.intento_actual_id != intento_id:
        return _respuesta_claim(envio, "intento_no_activo")
    intento = db.get(Notificacion, intento_id)
    if intento is None or intento.envio_id != envio_id:
        raise EnvioNoEncontrado("El intento indicado no existe para ese envío.")
    if intento.proveedor_iniciado:
        return _respuesta_claim(envio, "duplicado", intento)

    intento.proveedor_iniciado = True
    if intento.started_at is None:
        intento.started_at = ahora_utc()
    db.commit()
    return _respuesta_claim(envio, None, intento)


def _respuesta_claim(
    envio: EnvioNotificacion, motivo: str | None, intento: Notificacion | None = None
) -> dict:
    return {
        "reclamado": motivo is None,
        "envio_id": envio.id,
        "intento_id": envio.intento_actual_id,
        "estado": envio.estado,
        "referencia_proveedor": intento.referencia_proveedor if intento else None,
        "error_codigo": intento.error_codigo if intento else None,
        "motivo": motivo,
    }


def registrar_resultado(
    db: Session,
    envio_id: uuid.UUID,
    intento_id: uuid.UUID,
    *,
    estado: str,
    referencia_proveedor: str | None,
    error_codigo: str | None,
) -> dict:
    """Resultado definitivo de n8n. Solo aplica al intento activo ya reclamado.

    `presentado` exige un identificador del proveedor: un callback sin evidencia de envío no se
    convierte en entrega. Un intento `incierto` puede reconciliarse a presentado o fallido.
    """

    envio = db.scalar(
        select(EnvioNotificacion).where(EnvioNotificacion.id == envio_id).with_for_update()
    )
    if envio is None:
        raise EnvioNoEncontrado()
    if envio.intento_actual_id != intento_id:
        return {"aplicado": False, "estado": envio.estado, "motivo": "intento_no_activo"}
    intento = db.get(Notificacion, intento_id)
    if intento is None or intento.envio_id != envio_id:
        raise EnvioNoEncontrado("El intento indicado no existe para ese envío.")
    if not intento.proveedor_iniciado:
        raise EnvioNoReintentable("El intento no fue reclamado antes de registrar el resultado.")
    # A negative callback cannot prove absence of a provider side effect.
    if estado == "fallido":
        estado = "incierto"
    if intento.estado_envio == estado:
        return {"aplicado": False, "estado": intento.estado_envio, "motivo": "duplicado"}
    if intento.estado_envio in {"presentado", "fallido"}:
        raise EnvioNoReintentable("El intento ya tiene un resultado definitivo.")
    if envio.estado not in {"procesando", "incierto"}:
        return {"aplicado": False, "estado": envio.estado, "motivo": "envio_no_activo"}

    ahora = ahora_utc()
    intento.estado_envio = estado
    intento.finished_at = ahora
    if estado == "presentado":
        intento.referencia_proveedor = referencia_proveedor
        envio.estado = "presentado"
        envio.lease_at = None
    elif estado == "incierto":
        intento.error_codigo = error_codigo or "proveedor_incierto"
        envio.estado = "incierto"
        envio.lease_at = None
    else:
        intento.error_codigo = error_codigo or "proveedor_fallo"
        envio.estado = "fallido"
        envio.lease_at = None
        envio.intento_actual_id = None
    db.commit()
    return {"aplicado": True, "estado": estado, "motivo": None}
