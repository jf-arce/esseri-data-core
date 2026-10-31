"""Minimal ClamAV client (INSTREAM) for communication attachments.

Talks the documented in-stream protocol over a bounded socket instead of depending on an SDK
or a paid service: `zINSTREAM\\0`, then length-prefixed chunks, then a zero-length chunk, then
one `stream: OK` / `stream: <signature> FOUND` reply.

Failure is always explicit and never means "clean": callers persist the attachment in
quarantine when the scanner is missing, unreachable or misbehaves. Configuration comes from
`src.config.settings` (`CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_SEGUNDOS`), falling back
to the same environment variables so the module works before the settings fields land.
"""

import os
import socket

from src.config import settings

TAMANIO_BLOQUE = 64 * 1024
MAX_RESPUESTA = 4096
PUERTO_POR_DEFECTO = 3310
TIMEOUT_POR_DEFECTO = 10.0


class EscanerNoDisponible(Exception):
    """The scanner is not configured, unreachable or timed out. Nothing was scanned."""


class EscanerError(Exception):
    """The scanner answered something that is not a verdict."""


def _texto(campo: str, defecto: str = "") -> str:
    valor = getattr(settings, campo, None)
    if valor in (None, ""):
        valor = os.environ.get(campo, defecto)
    return str(valor or defecto).strip()


def _numero(campo: str, defecto: float) -> float:
    valor = getattr(settings, campo, None)
    if valor in (None, ""):
        valor = os.environ.get(campo, "")
    try:
        numero = float(valor)
    except (TypeError, ValueError):
        return defecto
    return numero if numero > 0 else defecto


def configuracion() -> tuple[str, int, float]:
    host = _texto("CLAMAV_HOST")
    puerto = int(_numero("CLAMAV_PORT", PUERTO_POR_DEFECTO))
    timeout = _numero("CLAMAV_TIMEOUT_SEGUNDOS", TIMEOUT_POR_DEFECTO)
    return host, puerto, timeout


def _leer_respuesta(conexion: socket.socket) -> bytes:
    datos = b""
    while b"\x00" not in datos and len(datos) < MAX_RESPUESTA:
        bloque = conexion.recv(MAX_RESPUESTA - len(datos))
        if not bloque:
            break
        datos += bloque
    return datos.split(b"\x00", 1)[0]


def _interpretar(datos: bytes) -> str | None:
    """Return the signature for infected content, `None` only for an explicit clean verdict."""
    texto = datos.decode("utf-8", "replace").strip()
    if not texto:
        raise EscanerError("El analizador no devolvió un veredicto")
    if texto == "stream: OK":
        return None
    if texto.startswith("stream: ") and texto.endswith(" FOUND"):
        return texto[len("stream: ") : -len(" FOUND")].strip() or "desconocida"
    raise EscanerError(f"Respuesta inesperada del analizador: {texto[:200]}")


def escanear(contenido: bytes) -> str | None:
    """Scan bytes with ClamAV. Returns a signature on malware, `None` only on `stream: OK`."""
    host, puerto, timeout = configuracion()
    if not host:
        raise EscanerNoDisponible("CLAMAV_HOST no está configurado")
    try:
        with socket.create_connection((host, puerto), timeout=timeout) as conexion:
            conexion.settimeout(timeout)
            conexion.sendall(b"zINSTREAM\x00")
            for inicio in range(0, len(contenido), TAMANIO_BLOQUE):
                bloque = contenido[inicio : inicio + TAMANIO_BLOQUE]
                conexion.sendall(len(bloque).to_bytes(4, "big") + bloque)
            conexion.sendall(b"\x00\x00\x00\x00")
            return _interpretar(_leer_respuesta(conexion))
    except (OSError, TimeoutError) as exc:
        raise EscanerNoDisponible("El analizador antivirus no respondió") from exc
