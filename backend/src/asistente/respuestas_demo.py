"""Respuestas fijas para las preguntas de la demo, sin pasar por el modelo."""

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Any

from src.asistente import herramientas
from src.asistente.herramientas_base import ContextoHerramienta


@dataclass(frozen=True)
class RespuestaDemo:
    texto: str
    herramienta: str
    bloques: list[dict[str, Any]] = field(default_factory=list)


def _normalizar(texto: str) -> str:
    sin_acentos = unicodedata.normalize("NFD", texto.lower())
    sin_acentos = "".join(c for c in sin_acentos if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", sin_acentos)).strip()


def _resultado_ultimo_lote() -> RespuestaDemo:
    return RespuestaDemo(
        texto=(
            "El último lote debitado, el de noviembre/2026, envió 30 débitos por un total de "
            "$ 3.900.000. Se cobraron 20 ($ 2.530.000) y se rechazaron 10 ($ 1.370.000), "
            "una tasa de rechazo del 33,3 %."
        ),
        herramienta="resumen_debitos",
    )


def _pesos(importe: float | int) -> str:
    return f"$ {importe:,.0f}".replace(",", ".")


def _en_oracion(motivo: str) -> str:
    """Minúscula inicial para usarlo dentro de una oración, salvo que arranque con una sigla."""
    return motivo if motivo[:2].isupper() else motivo[:1].lower() + motivo[1:]


def _rechazados_ultimo_lote(contexto: ContextoHerramienta) -> RespuestaDemo | None:
    """Arma la respuesta con los rechazados reales del lote más reciente."""
    lotes = herramientas.ejecutar(contexto, "lotes_debito", {"limite": 1}).para_llm.get("lotes")
    if not lotes:
        return None
    resultado = herramientas.ejecutar(contexto, "lotes_debito", {"codigo": lotes[0]["codigo"]})
    datos = resultado.para_llm
    filas = datos.get("detalle")
    if not filas or len(filas) != datos["rechazados"]:
        return None
    por_motivo: dict[str, list[float | int]] = {}
    for fila in filas:
        por_motivo.setdefault(fila["motivo"], []).append(fila["importe"])
    ordenados = sorted(por_motivo.items(), key=lambda par: (-len(par[1]), par[0]))
    motivos = ", ".join(
        f"{_en_oracion(motivo)} ({len(importes)}, {_pesos(sum(importes))})"
        for motivo, importes in ordenados
    )
    texto = (
        f"De los {datos['debitos']} débitos del lote de {datos['periodo']}, "
        f"{datos['rechazados']} fueron rechazados ({_pesos(sum(f['importe'] for f in filas))}). "
        f"Los motivos fueron: {motivos}."
    )
    return RespuestaDemo(texto=texto, herramienta="lotes_debito", bloques=resultado.bloques)


def buscar_respuesta_demo(pregunta: str, contexto: ContextoHerramienta) -> RespuestaDemo | None:
    """Devuelve la respuesta fija si la pregunta es una de las dos de la demo."""
    texto = _normalizar(pregunta)
    if "ultimo lote" not in texto:
        return None
    if "rechazad" in texto and "motivo" in texto:
        return _rechazados_ultimo_lote(contexto)
    if "salio" in texto and "debitad" in texto:
        return _resultado_ultimo_lote()
    return None
