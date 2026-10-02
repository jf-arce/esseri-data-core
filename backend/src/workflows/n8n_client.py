"""Cliente que dispara la automatización externa (motor de workflows vía n8n).

n8n solo ejecuta el envío: el backend ya resolvió destinatario y contenido, y es quien registra
`WORKFLOW_EXECUTION` y `NOTIFICACION`. El webhook del workflow de n8n recibe un JSON con
`destinatario`, `asunto` y `cuerpo`.
"""

import httpx

from src.config import settings
from src.workflows.exceptions import N8nEnvioFallido, N8nNoConfigurado, N8nNoDisponible

TIMEOUT_SEGUNDOS = 10.0


def enviar_email(
    destinatario: str,
    asunto: str,
    cuerpo: str,
    transport: httpx.BaseTransport | None = None,
) -> None:
    """Pide a n8n que envíe un email. Lanza `N8nNoConfigurado`, `N8nNoDisponible` (sin respuesta) o
    `N8nEnvioFallido` (n8n respondió con error)."""
    if not settings.N8N_WEBHOOK_URL:
        raise N8nNoConfigurado()

    headers: dict[str, str] = {}
    if settings.N8N_WEBHOOK_TOKEN:
        headers["Authorization"] = f"Bearer {settings.N8N_WEBHOOK_TOKEN}"

    try:
        with httpx.Client(timeout=TIMEOUT_SEGUNDOS, transport=transport) as cliente:
            respuesta = cliente.post(
                settings.N8N_WEBHOOK_URL,
                json={"destinatario": destinatario, "asunto": asunto, "cuerpo": cuerpo},
                headers=headers,
            )
            respuesta.raise_for_status()
    except httpx.HTTPStatusError as error:
        raise N8nEnvioFallido(f"n8n respondió {error.response.status_code}.") from error
    except httpx.HTTPError as error:
        raise N8nNoDisponible() from error
