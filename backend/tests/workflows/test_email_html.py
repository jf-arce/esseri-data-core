"""Layout HTML del mail institucional (`email_html.py`) y su contrato con n8n."""

import json

import httpx
import pytest

from src.config import settings
from src.workflows import n8n_client
from src.workflows.email_html import armar_html


@pytest.fixture(autouse=True)
def identidad(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_INSTITUCION_NOMBRE", "Colegio ESSERI")
    monkeypatch.setattr(settings, "EMAIL_INSTITUCION_PIE", "Calle 1 · Tel 123")
    monkeypatch.setattr(settings, "EMAIL_LOGO_URL", "")


def test_lleva_titulo_parrafos_firma_y_pie():
    html = armar_html("Factura vencida", "Primero.\n\nSegundo\ncon salto.")

    assert "<h1" in html and "Factura vencida" in html
    assert html.count("<p ") >= 3
    assert "Segundo<br>con salto." in html
    assert "Administración · Colegio ESSERI" in html
    assert "Calle 1 · Tel 123" in html
    assert "no respondas a este correo" in html


def test_escapa_el_html_del_cuerpo_y_del_asunto():
    html = armar_html("<b>x</b>", 'Hola <script>alert("x")</script> Cabral')

    assert "<script>" not in html
    assert "&lt;script&gt;" in html
    assert "<b>x</b>" not in html


def test_el_boton_aparece_solo_con_enlace():
    sin = armar_html("Asunto", "Texto")
    con = armar_html("Asunto", "Texto", ("http://app.test/workflows/tareas", "Ver mis tareas"))

    assert "Ver mis tareas" not in sin
    assert 'href="http://app.test/workflows/tareas"' in con
    assert "Ver mis tareas" in con
    assert "copiá este link" in con


def test_sin_logo_no_hay_imagen_y_con_logo_si():
    assert "<img" not in armar_html("A", "B")

    settings.EMAIL_LOGO_URL = "https://cdn.test/logo.png"
    html = armar_html("A", "B")

    assert 'src="https://cdn.test/logo.png"' in html
    assert 'width="40"' in html and 'height="40"' in html


def test_un_logo_que_no_es_http_se_ignora():
    settings.EMAIL_LOGO_URL = 'javascript:alert("x")'

    assert "<img" not in armar_html("A", "B")


def test_n8n_recibe_el_html_junto_al_texto_plano(monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/email")
    recibidas: list[httpx.Request] = []

    def responder(request: httpx.Request) -> httpx.Response:
        recibidas.append(request)
        return httpx.Response(200)

    n8n_client.enviar_email(
        "a@b.c", "Asunto", "Texto", "<p>Texto</p>", transport=httpx.MockTransport(responder)
    )

    assert json.loads(recibidas[0].read()) == {
        "destinatario": "a@b.c",
        "asunto": "Asunto",
        "cuerpo": "Texto",
        "cuerpo_html": "<p>Texto</p>",
    }
