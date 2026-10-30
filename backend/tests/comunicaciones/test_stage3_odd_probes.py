"""Durable independent verifier probes for channel isolation, atomicity and blob-free reads."""

import uuid

from sqlalchemy import event, select, update

from src.comunicaciones import adjuntos_escaner
from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.familias_alumnos.models import FamiliaAlumno
from src.workflows.models import EnvioNotificacion
from tests.comunicaciones.test_adjuntos import escenario as escenario_adjuntos
from tests.comunicaciones.test_adjuntos import png_bytes, subir

escenario = escenario_adjuntos


def test_email_only_attachment_link_rechecks_original_link(client, escenario, db_session):
    ids, entrar, crear_borrador, _ = escenario
    c = crear_borrador(canal="email")
    adjunto = subir(client, c["id"], png_bytes()).json()
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    entrar(ids["usuario_a"], "familia")
    assert client.get("/comunicaciones/familia").json()["total"] == 0
    assert client.get(f"/comunicaciones/familia/{c['id']}").status_code == 200
    ruta = f"/comunicaciones/familia/{c['id']}/adjuntos/{adjunto['id']}/archivo"
    respuesta = client.get(ruta)
    assert respuesta.status_code == 200 and respuesta.content == png_bytes()
    db_session.execute(
        update(FamiliaAlumno)
        .where(FamiliaAlumno.familia_id == ids["familia_a"])
        .values(recibe_comunicaciones=False)
    )
    db_session.commit()
    assert client.get(f"/comunicaciones/familia/{c['id']}").status_code == 404
    assert client.get(ruta).status_code == 404


def test_blocked_publication_has_no_partial_receipts_or_intentions(
    client, escenario, db_session, monkeypatch
):
    _, _, crear_borrador, _ = escenario
    c = crear_borrador(canal="email")

    def caido(contenido):
        raise adjuntos_escaner.EscanerNoDisponible("isolated test")

    monkeypatch.setattr(adjuntos_escaner, "escanear", caido)
    adjunto = subir(client, c["id"], png_bytes()).json()
    assert adjunto["estado"] == "cuarentena"
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 409
    comunicacion_id = uuid.UUID(c["id"])
    db_session.expire_all()
    assert db_session.get(Comunicacion, comunicacion_id).estado == "borrador"
    for model in (ReciboComunicacion, EnvioNotificacion):
        assert (
            db_session.scalar(select(model).where(model.comunicacion_id == comunicacion_id)) is None
        )
    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda contenido: None)
    assert (
        client.post(f"/comunicaciones/{c['id']}/adjuntos/{adjunto['id']}/analizar").json()["estado"]
        == "limpio"
    )
    assert client.post(f"/comunicaciones/{c['id']}/publicar").status_code == 200
    assert (
        len(
            list(
                db_session.scalars(
                    select(EnvioNotificacion).where(
                        EnvioNotificacion.comunicacion_id == comunicacion_id
                    )
                )
            )
        )
        == 1
    )


def test_attachment_id_does_not_authorize_another_parent(client, escenario):
    _, _, crear_borrador, _ = escenario
    a, b = crear_borrador(), crear_borrador()
    adjunto = subir(client, a["id"], png_bytes()).json()
    subir(client, b["id"], png_bytes())
    assert (
        client.get(f"/comunicaciones/{b['id']}/adjuntos/{adjunto['id']}/archivo").status_code == 404
    )


def test_detail_and_metadata_queries_never_load_blob_bytes(client, escenario, db_session):
    _, _, crear_borrador, _ = escenario
    c = crear_borrador()
    subir(client, c["id"], png_bytes())
    consultas = []
    connection = db_session.connection()

    def registrar(conn, cursor, statement, params, context, many):
        consultas.append(statement)

    event.listen(connection, "before_cursor_execute", registrar)
    try:
        detalle = client.get(f"/comunicaciones/{c['id']}")
        listado = client.get(f"/comunicaciones/{c['id']}/adjuntos")
    finally:
        event.remove(connection, "before_cursor_execute", registrar)
    assert detalle.status_code == 200 and listado.status_code == 200
    assert "comunicacion_adjunto_contenido" not in " ".join(consultas).lower()
    assert b'"contenido"' not in detalle.content
