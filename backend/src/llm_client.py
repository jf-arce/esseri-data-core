"""Cliente del modelo de lenguaje, compartido por IA/Sugerencias y el Asistente.

Habla el protocolo de Chat Completions de OpenAI. La URL base y el modelo salen de la
configuración (`OPENAI_BASE_URL`, `OPENAI_MODEL`), así que el mismo código sirve contra cualquier
proveedor compatible con ese protocolo sin tocar una línea.

Cada módulo decide qué le manda al modelo. IA/Sugerencias solo manda plantillas (nunca datos de
familias ni de alumnos, RNF-15) y el Asistente solo manda texto seudonimizado (ver
`src/asistente/seudonimos_service.py`).
"""

import json
import time
from dataclasses import dataclass
from typing import Any

import httpx

from src.config import settings
from src.exceptions import AppException


class IaNoConfigurada(AppException):
    """Falta `OPENAI_API_KEY`: no se puede redactar nada."""

    status_code = 503

    def __init__(self, message: str = "La integración con el proveedor de IA no está configurada."):
        super().__init__(message)


class IaNoDisponible(AppException):
    """El proveedor no respondió (conexión o timeout) o respondió con un error."""

    status_code = 502

    def __init__(
        self,
        message: str = "No se pudo contactar al proveedor de IA.",
        status_proveedor: int | None = None,
    ):
        super().__init__(message)
        # Código HTTP con el que respondió el proveedor; `None` si ni siquiera hubo respuesta.
        self.status_proveedor = status_proveedor


class IaRespuestaInvalida(AppException):
    """El proveedor respondió, pero el borrador no se puede usar.

    No tiene la forma pedida, se pasa de los límites de una plantilla o usa marcadores que el
    evento no tiene. Se rechaza en vez de guardarlo: una plantilla con un marcador inexistente
    fallaría recién al enviarse.
    """

    status_code = 502

    def __init__(
        self,
        message: str = "El proveedor de IA devolvió un borrador inutilizable. Probá de nuevo.",
    ):
        super().__init__(message)


@dataclass(frozen=True)
class LlamadaHerramienta:
    """Una `tool_call` pedida por el modelo: los argumentos ya vienen parseados."""

    id: str
    nombre: str
    argumentos: dict[str, Any]
    # Si el modelo mandó argumentos que no son un JSON objeto, la herramienta los rechaza.
    argumentos_validos: bool = True
    # Datos propios del proveedor que hay que devolverle tal cual en el historial (Gemini 3
    # exige el `thought_signature` de cada llamada, y responde 400 si falta).
    extra_content: dict[str, Any] | None = None


@dataclass(frozen=True)
class RespuestaConHerramientas:
    """Un paso del modelo: texto, llamadas a herramientas, o ambos."""

    contenido: str
    llamadas: list[LlamadaHerramienta]


_CODIGOS_REINTENTABLES = {429, 503}


def _espera_de(respuesta: httpx.Response, intento: int) -> float:
    """Respeta `Retry-After` si el proveedor lo manda; si no, espera 1x, 2x, 4x la base."""
    base = settings.OPENAI_ESPERA_REINTENTO_SEGUNDOS * (2**intento)
    try:
        pedida = float(respuesta.headers.get("Retry-After", ""))
    except ValueError:
        return base
    return min(max(pedida, 0.0), 30.0)


def _post_chat(cuerpo: dict[str, Any], transport: httpx.BaseTransport | None) -> dict[str, Any]:
    if not settings.OPENAI_API_KEY:
        raise IaNoConfigurada()

    respuesta: httpx.Response | None = None
    for intento in range(settings.OPENAI_REINTENTOS + 1):
        try:
            with httpx.Client(
                timeout=settings.OPENAI_TIMEOUT_SEGUNDOS, transport=transport
            ) as cliente:
                respuesta = cliente.post(
                    f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions",
                    json={"model": settings.OPENAI_MODEL, **cuerpo},
                    headers={"Authorization": f"Bearer {settings.OPENAI_API_KEY}"},
                )
        except httpx.HTTPError as error:
            raise IaNoDisponible() from error
        if respuesta.status_code in _CODIGOS_REINTENTABLES and intento < settings.OPENAI_REINTENTOS:
            time.sleep(_espera_de(respuesta, intento))
            continue
        break

    try:
        respuesta.raise_for_status()
    except httpx.HTTPStatusError as error:
        # Solo el código: el cuerpo del error puede traer detalles de la cuenta del proveedor.
        raise IaNoDisponible(
            f"El proveedor de IA respondió {error.response.status_code}.",
            status_proveedor=error.response.status_code,
        ) from error

    try:
        datos = respuesta.json()
    except ValueError as error:
        raise IaRespuestaInvalida() from error
    if not isinstance(datos, dict):
        raise IaRespuestaInvalida()
    return datos


def completar_json(
    sistema: str, pedido: str, transport: httpx.BaseTransport | None = None
) -> dict[str, object]:
    """Pide una respuesta en JSON y la devuelve ya parseada.

    Lanza `IaNoConfigurada` (falta la clave), `IaNoDisponible` (sin respuesta, o el proveedor
    respondió con error) o `IaRespuestaInvalida` (respondió, pero no con el JSON pedido).
    """
    datos = _post_chat(
        {
            "messages": [
                {"role": "system", "content": sistema},
                {"role": "user", "content": pedido},
            ],
            "response_format": {"type": "json_object"},
        },
        transport,
    )

    try:
        contenido = datos["choices"][0]["message"]["content"]
        resultado = json.loads(_sin_cerca_de_codigo(contenido))
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise IaRespuestaInvalida() from error
    if not isinstance(resultado, dict):
        raise IaRespuestaInvalida()
    return resultado


def completar_con_herramientas(
    mensajes: list[dict[str, Any]],
    herramientas: list[dict[str, Any]],
    transport: httpx.BaseTransport | None = None,
) -> RespuestaConHerramientas:
    """Un paso de la conversación con tool calling.

    `mensajes` y `herramientas` siguen el formato de Chat Completions. No hay streaming con el
    proveedor: cada paso es una llamada completa y el llamador decide cómo emitir el texto.
    """
    cuerpo: dict[str, Any] = {"messages": mensajes}
    if herramientas:
        cuerpo["tools"] = herramientas
        cuerpo["tool_choice"] = "auto"
    datos = _post_chat(cuerpo, transport)

    try:
        mensaje = datos["choices"][0]["message"]
    except (KeyError, IndexError, TypeError) as error:
        raise IaRespuestaInvalida(
            "El proveedor de IA devolvió una respuesta inutilizable."
        ) from error
    if not isinstance(mensaje, dict):
        raise IaRespuestaInvalida("El proveedor de IA devolvió una respuesta inutilizable.")

    contenido = mensaje.get("content")
    llamadas_crudas = mensaje.get("tool_calls") or []
    if not isinstance(llamadas_crudas, list):
        raise IaRespuestaInvalida("El proveedor de IA devolvió una respuesta inutilizable.")

    llamadas: list[LlamadaHerramienta] = []
    for cruda in llamadas_crudas:
        llamadas.append(_parsear_llamada(cruda))
    return RespuestaConHerramientas(
        contenido=contenido if isinstance(contenido, str) else "", llamadas=llamadas
    )


def _parsear_llamada(cruda: object) -> LlamadaHerramienta:
    if not isinstance(cruda, dict):
        raise IaRespuestaInvalida("El proveedor de IA devolvió una respuesta inutilizable.")
    funcion = cruda.get("function")
    llamada_id = cruda.get("id")
    if not isinstance(funcion, dict) or not isinstance(llamada_id, str):
        raise IaRespuestaInvalida("El proveedor de IA devolvió una respuesta inutilizable.")
    nombre = funcion.get("name")
    if not isinstance(nombre, str):
        raise IaRespuestaInvalida("El proveedor de IA devolvió una respuesta inutilizable.")

    crudos = funcion.get("arguments")
    argumentos: dict[str, Any] = {}
    validos = True
    if isinstance(crudos, str) and crudos.strip():
        try:
            parseado = json.loads(crudos)
        except ValueError:
            validos = False
        else:
            if isinstance(parseado, dict):
                argumentos = parseado
            else:
                validos = False
    extra = cruda.get("extra_content")
    return LlamadaHerramienta(
        id=llamada_id,
        nombre=nombre,
        argumentos=argumentos,
        argumentos_validos=validos,
        extra_content=extra if isinstance(extra, dict) else None,
    )


def _sin_cerca_de_codigo(contenido: str) -> str:
    """Algunos proveedores envuelven el JSON en ```json ... ``` aunque se pida JSON puro."""
    texto = contenido.strip()
    if not texto.startswith("```"):
        return texto
    texto = texto.removeprefix("```json").removeprefix("```")
    return texto.removesuffix("```").strip()
