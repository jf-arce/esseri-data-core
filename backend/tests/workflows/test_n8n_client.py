import httpx
import pytest

from src.config import settings
from src.workflows import n8n_client
from src.workflows.exceptions import N8nEnvioFallido, N8nNoConfigurado, N8nNoDisponible


@pytest.fixture()
def webhook(monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "secreto")


def test_envia_el_payload_con_token(webhook):
    recibidas: list[httpx.Request] = []

    def responder(request: httpx.Request) -> httpx.Response:
        recibidas.append(request)
        return httpx.Response(200)

    n8n_client.enviar_email(
        "familia@mail.com", "Aviso", "Hola", transport=httpx.MockTransport(responder)
    )

    (request,) = recibidas
    assert str(request.url) == "http://n8n.test/webhook/email"
    assert request.headers["authorization"] == "Bearer secreto"
    assert request.read() == b'{"destinatario":"familia@mail.com","asunto":"Aviso","cuerpo":"Hola"}'


def test_sin_token_no_manda_authorization(webhook, monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "")
    recibidas: list[httpx.Request] = []

    def responder(request: httpx.Request) -> httpx.Response:
        recibidas.append(request)
        return httpx.Response(200)

    n8n_client.enviar_email("a@b.c", "x", "y", transport=httpx.MockTransport(responder))

    assert "authorization" not in recibidas[0].headers


def test_url_sin_configurar(monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "")

    with pytest.raises(N8nNoConfigurado):
        n8n_client.enviar_email("a@b.c", "x", "y")


def test_respuesta_de_error_de_n8n(webhook):
    transport = httpx.MockTransport(lambda request: httpx.Response(500))

    with pytest.raises(N8nEnvioFallido, match="500") as error:
        n8n_client.enviar_email("a@b.c", "x", "y", transport=transport)

    assert not isinstance(error.value, N8nNoDisponible)


def test_n8n_inalcanzable(webhook):
    def caido(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("sin conexión")

    with pytest.raises(N8nNoDisponible, match="contactar"):
        n8n_client.enviar_email("a@b.c", "x", "y", transport=httpx.MockTransport(caido))
