"""Respuestas fijas de la demo: mismas preguntas, mismo resultado, sin llamar al modelo."""

import pytest

from src.asistente.respuestas_demo import _en_oracion
from tests.asistente.conftest import enviar, eventos, nueva_conversacion
from tests.asistente.test_herramientas_debitos import (  # noqa: F401
    administracion_deb,
    lote_rendido,
)


def _texto_de(cliente, pregunta: str) -> str:
    lista = eventos(enviar(cliente, nueva_conversacion(cliente), pregunta))
    return next(datos["texto"] for nombre, datos in lista if nombre == "texto" and datos["texto"])


@pytest.mark.parametrize(
    "pregunta",
    ["Como salio el ultimo lote debitado?", "¿Cómo salió el último lote debitado?"],
)
def test_resultado_del_ultimo_lote(administracion_deb, proveedor, pregunta) -> None:  # noqa: F811
    texto = _texto_de(administracion_deb, pregunta)
    assert "33,3 %" in texto
    assert "20 ($ 2.530.000)" in texto
    assert proveedor.peticiones == []


def test_rechazados_salen_del_lote_real_y_son_siempre_iguales(
    administracion_deb,  # noqa: F811
    proveedor,
    lote_rendido,  # noqa: F811
) -> None:
    pregunta = "Mostrame los rechazados y los motivos del ultimo lote"
    textos = [_texto_de(administracion_deb, pregunta) for _ in range(2)]
    assert textos[0] == textos[1]
    assert "1 fueron rechazados" in textos[0]
    assert "saldo insuficiente (1, $ 100)" in textos[0]
    assert proveedor.peticiones == []


def test_en_oracion_respeta_las_siglas() -> None:
    assert _en_oracion("CBU no encontrado") == "CBU no encontrado"
    assert _en_oracion("Saldo insuficiente") == "saldo insuficiente"
