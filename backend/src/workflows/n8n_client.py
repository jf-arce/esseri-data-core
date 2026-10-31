"""Cliente que dispara la automatización externa (motor de workflows vía n8n).

n8n solo ejecuta el envío: el backend ya resolvió destinatario y contenido, y es quien registra
`WORKFLOW_EXECUTION` y `NOTIFICACION`. El webhook del workflow de n8n recibe un JSON con
`destinatario`, `asunto`, `cuerpo` (texto plano) y, si hay, `cuerpo_html`.
"""

import re
import uuid
from dataclasses import dataclass

import httpx

from src.config import settings
from src.workflows.exceptions import N8nEnvioFallido, N8nNoConfigurado, N8nNoDisponible

TIMEOUT_SEGUNDOS = 10.0
_ESTADOS_MANUALES = frozenset({"presentado", "fallido", "incierto"})


def enviar_email(
    destinatario: str,
    asunto: str,
    cuerpo: str,
    cuerpo_html: str | None = None,
    transport: httpx.BaseTransport | None = None,
) -> None:
    """Pide a n8n que envíe un email. Lanza `N8nNoConfigurado`, `N8nNoDisponible` (sin respuesta) o
    `N8nEnvioFallido` (n8n respondió con error)."""
    if not settings.N8N_WEBHOOK_URL:
        raise N8nNoConfigurado()

    headers: dict[str, str] = {}
    if settings.N8N_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {settings.N8N_WEBHOOK_TOKEN}"

    datos = {"destinatario": destinatario, "asunto": asunto, "cuerpo": cuerpo}
    if cuerpo_html is not None:
        datos["cuerpo_html"] = cuerpo_html

    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS, transport=transport) as cliente:
            respuesta = cliente.post(
                settings.N8N_WEBHOOK_URL,
                json=datos,
                headers=headers,
            )
            respuesta.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise N8nEnvioFallido(f"n8n respondió {error.response.status_code}.") from error
    except httpx.HTTPError as error:
        raise N8nNoDisponible() from error


@dataclass(frozen=True)
class ResultadoEnvioManual:
    """Resultado clasificado de un envío manual correlacionado.

    `presentado` significa que n8n confirmó la entrega a Gmail con un identificador del
    proveedor; nunca se infiere de un HTTP 200. `reintentable` es un fallo conocido antes de
    iniciar el proveedor (por ejemplo, conexión rechazada).
    """

    estado: str
    referencia_proveedor: str | None = None
    error_codigo: str | None = None


def _codigo_error(valor: object, por_defecto: str) -> str:
    if not isinstance(valor, str):
        return por_defecto
    limpio = re.sub(r"[^a-z0-9_]+", "_", valor.lower()).strip("_")[:50]
    return limpio or por_defecto


def _ack_invalido() -> ResultadoEnvioManual:
    return ResultadoEnvioManual(estado="incierto", error_codigo="ack_invalido")


def _interpretar_ack(
    respuesta: httpx.Response, envio_id: uuid.UUID, intento_id: uuid.UUID
) -> ResultadoEnvioManual:
    try:
        ack = respuesta.json()
    except ValueError:
        return _ack_invalido()
    if not isinstance(ack, dict):
        return _ack_invalido()
    if str(ack.get("envio_id")) != str(envio_id):
        return _ack_invalido()
    if str(ack.get("intento_id")) != str(intento_id):
        return _ack_invalido()

    estado = ack.get("estado")
    if estado == "presentado":
        referencia = ack.get("referencia_proveedor")
        if not isinstance(referencia, str) or not referencia.strip():
            return _ack_invalido()
        return ResultadoEnvioManual(
            estado="presentado", referencia_proveedor=referencia.strip()[:200]
        )
    if estado in _ESTADOS_MANUALES:
        return ResultadoEnvioManual(
            estado=estado,
            error_codigo=_codigo_error(ack.get("error_codigo"), f"n8n_{estado}"),
        )
    # `procesando`, un ack legacy (`{"enviado": true}`) o cualquier forma desconocida no
    # prueban que Gmail haya aceptado el mensaje.
    return _ack_invalido()


def enviar_email_manual(
    destinatario: str,
    asunto: str,
    cuerpo: str,
    cuerpo_html: str | None = None,
    *,
    envio_id: uuid.UUID,
    intento_id: uuid.UUID,
    callback_base_url: str,
    transport: httpx.BaseTransport | None = None,
) -> ResultadoEnvioManual:
    """Envía un email manual por el contrato correlacionado de n8n.

    n8n reclama el `intento_id` en el backend antes de invocar Gmail y devuelve un ack
    estructurado con los mismos identificadores. Un 2xx sin ese ack se trata como incierto:
    el mensaje pudo haberse enviado. No lanza por fallos de transporte.
    """
    if not settings.N8N_WEBHOOK_URL:
        return ResultadoEnvioManual(estado="fallido", error_codigo="n8n_no_configurado")

    headers: dict[str, str] = {}
    if settings.N8N_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {settings.N8N_WEBHOOK_TOKEN}"

    datos = {
        "destinatario": destinatario,
        "asunto": asunto,
        "cuerpo": cuerpo,
        "envio_id": str(envio_id),
        "intento_id": str(intento_id),
        "callback_base_url": callback_base_url.rstrip("/"),
    }
    if cuerpo_html is not None:
        datos["cuerpo_html"] = cuerpo_html

    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS, transport=transport) as cliente:
            respuesta = cliente.post(settings.N8N_WEBHOOK_URL, json=datos, headers=headers)
            respuesta.raise_for_status()
    except httpx.ConnectError:
        # La conexión no llegó a establecerse: no hay efecto externo conocido.
        return ResultadoEnvioManual(estado="reintentable", error_codigo="n8n_no_disponible")
    except httpx.ConnectTimeout:
        return ResultadoEnvioManual(estado="reintentable", error_codigo="n8n_no_disponible")
    except httpx.TimeoutException:
        # Se leyó/escribió a medias: n8n pudo haber reclamado y llamado a Gmail.
        return ResultadoEnvioManual(estado="incierto", error_codigo="n8n_timeout")
    except httpx.HTTPStatusError as error:
        codigo = error.response.status_code
        if codigo >= 500:
            # n8n pudo haber enviado antes de fallar al responder; nunca se reintenta a ciegas.
            return ResultadoEnvioManual(estado="incierto", error_codigo="n8n_5xx")
        return ResultadoEnvioManual(estado="fallido", error_codigo="n8n_rechazo")
    except httpx.HTTPError:
        return ResultadoEnvioManual(estado="incierto", error_codigo="n8n_error_red")

    return _interpretar_ack(respuesta, envio_id, intento_id)
