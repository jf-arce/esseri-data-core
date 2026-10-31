"""Channel selection is independent of transport availability and portal visibility."""

import uuid

import pytest
from sqlalchemy import func, select

from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.workflows.models import EnvioNotificacion, Notificacion
from tests.comunicaciones.test_publicacion import crear, datos
from tests.comunicaciones.test_publicacion import escenario as escenario_publicacion

escenario = escenario_publicacion


@pytest.mark.parametrize("canal,visible", [("portal", True), ("email", False), ("ambos", True)])
def test_canales_bandeja_enlace_y_envios(client, escenario, db_session, canal, visible):
    ids, entrar = escenario
    c = crear(client, ids, canal=canal)
    published = client.post(f"/comunicaciones/{c['id']}/publicar")
    assert published.status_code == 200, published.text
    assert published.json()["canal"] == canal
    count = db_session.scalar(select(func.count()).select_from(EnvioNotificacion))
    assert (count > 0) == (canal != "portal")
    assert db_session.scalar(select(func.count()).select_from(Notificacion)) == 0
    client.post(f"/comunicaciones/{c['id']}/publicar")
    assert db_session.scalar(select(func.count()).select_from(EnvioNotificacion)) == count
    assert db_session.scalar(select(func.count()).select_from(ReciboComunicacion)) == 1
    entrar(ids["usuario_a"], "familia")
    inbox = client.get("/comunicaciones/familia").json()
    assert inbox["total"] == int(visible)
    assert client.get(f"/comunicaciones/familia/{c['id']}").status_code == 200
    read = client.put(f"/comunicaciones/familia/{c['id']}/lectura").json()
    assert (read["leida_at"] is not None) == visible
    assert client.get(f"/comunicaciones/{c['id']}/envios").status_code == 403
    assert client.get(f"/comunicaciones/familia/{uuid.uuid4()}").status_code == 404


def test_canal_default_preserva_hash_y_conflicto(client, escenario, db_session):
    import hashlib
    import json

    ids, _ = escenario
    body = datos(ids)
    c = client.post("/comunicaciones", json=body).json()
    stored = db_session.get(Comunicacion, uuid.UUID(c["id"]))
    old_hash = hashlib.sha256(
        json.dumps(
            {**body, "audiencia": {**body["audiencia"], "ciclo_lectivo": None}}, sort_keys=True
        ).encode()
    ).hexdigest()
    assert stored.solicitud_hash == old_hash
    assert client.post("/comunicaciones", json={**body, "canal": "portal"}).status_code == 201
    assert client.post("/comunicaciones", json={**body, "canal": "email"}).status_code == 409


def test_canal_invalido_y_publicacion_inmutable(client, escenario):
    ids, _ = escenario
    assert client.post("/comunicaciones", json=datos(ids, canal="sms")).status_code == 422
    body = datos(ids, canal="email")
    c = client.post("/comunicaciones", json=body).json()
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    assert (
        client.put(f"/comunicaciones/{c['id']}", json={**body, "canal": "ambos"}).status_code == 409
    )
