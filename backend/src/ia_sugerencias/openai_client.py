"""Cliente del modelo de lenguaje que redacta comunicaciones (issue #50).

Habla el protocolo de Chat Completions de OpenAI. La URL base y el modelo salen de la
configuración (`OPENAI_BASE_URL`, `OPENAI_MODEL`), así que el mismo código sirve contra cualquier
proveedor compatible con ese protocolo sin tocar una línea.

El modelo solo redacta: recibe el nombre del evento, sus marcadores y el pedido de quien lo usa.
Nunca recibe datos de familias ni de alumnos (RNF-15), porque el texto es una plantilla y los
datos reales los completa Workflows recién al enviar.
"""

import json

import httpx

from src.config import settings
from src.ia_sugerencias.exceptions import IaNoConfigurada, IaNoDisponible, IaRespuestaInvalida


def completar_json(
    sistema: str, pedido: str, transport: httpx.BaseTransport | None = None
) -> dict[str, object]:
    """Pide una respuesta en JSON y la devuelve ya parseada.

    Lanza `IaNoConfigurada` (falta la clave), `IaNoDisponible` (sin respuesta, o el proveedor
    respondió con error) o `IaRespuestaInvalida` (respondió, pero no con el JSON pedido).
    """
    if not settings.OPENAI_API_KEY:
        raise IaNoConfigurada()

    try:
        with httpx.Client(timeout=settings.OPENAI_TIMEOUT_SEGUNDOS, transport=transport) as cliente:
            respuesta = cliente.post(
                f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                json={
                    "model": settings.OPENAI_MODEL,
                    "messages": [
                        {"role": "system", "content": sistema},
                        {"role": "user", "content": pedido},
                    ],
                    "response_format": {"type": "json_object"},
                },
                headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
            )
            respuesta.raise_for_status()
    except httpx.HTTPStatusError as error:
        # Solo el código: el cuerpo del error puede traer detalles de la cuenta del proveedor.
        raise IaNoDisponible(
            f"El proveedor de IA respondió {error.response.status_code}."
        ) from error
    except httpx.HTTPError as error:
        raise IaNoDisponible() from error

    try:
        contenido = respuesta.json()["choices"][0]["message"]["content"]
        datos = json.loads(_sin_cerca_de_codigo(contenido))
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise IaRespuestaInvalida() from error
    if not isinstance(datos, dict):
        raise IaRespuestaInvalida()
    return datos


def _sin_cerca_de_codigo(contenido: str) -> str:
    """Algunos proveedores envuelven el JSON en ```json ... ``` aunque se pida JSON puro."""
    texto = contenido.strip()
    if not texto.startswith("```"):
        return texto
    texto = texto.removeprefix("```json").removeprefix("```")
    return texto.removesuffix("```").strip()
