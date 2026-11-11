"""Concurrent HTTP operations must not duplicate batches, previews, payments or releases."""

import sqlite3
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from src.database import get_db
from src.facturacion.models import (
    DebitoCobranza,
    ImportacionCobranza,
    LoteCobranza,
    Pago,
)
from src.main import app
from src.models import AuditLog
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.facturacion.test_cobranzas_importacion import confirmar, preview, respuesta
from tests.facturacion.test_cobranzas_lotes import BASE, crear_factura_demo, exportar


def _copiar_base(db_session, tmp_path):
    db_session.rollback()
    archivo = tmp_path / "concurrente.sqlite"
    with sqlite3.connect(archivo) as destino:
        db_session.connection().connection.driver_connection.backup(destino)
    motor = create_engine(
        f"sqlite:///{archivo}", connect_args={"timeout": 10, "check_same_thread": False}
    )
    sesiones = sessionmaker(bind=motor, autoflush=False)
    return motor, sesiones


def _override(motor, sesiones):
    original = app.dependency_overrides[get_db]

    def db_independiente():
        with sesiones() as sesion:
            yield sesion

    app.dependency_overrides[get_db] = db_independiente
    return original


def _en_paralelo(funcion):
    barrera = Barrier(2)

    def ejecutar():
        barrera.wait(timeout=10)
        return funcion()

    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(lambda _: ejecutar(), range(2)))


def test_exportar_la_misma_factura_a_la_vez_reserva_una_sola(
    client_autenticado, db_session, tmp_path
):
    factura = crear_factura_demo(db_session, 1)
    motor, sesiones = _copiar_base(db_session, tmp_path)
    original = _override(motor, sesiones)
    try:
        respuestas = _en_paralelo(
            lambda: exportar(client_autenticado, [factura.id])
        )
        assert sorted(respuesta.status_code for respuesta in respuestas) == [201, 409]
        with sesiones() as sesion:
            assert sesion.query(LoteCobranza).count() == 1
            assert sesion.query(DebitoCobranza).count() == 1
            assert sesion.scalar(select(DebitoCobranza)).reserva_activa is True
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_previsualizar_el_mismo_archivo_a_la_vez_crea_una_revision(
    client_autenticado, db_session, tmp_path
):
    _, lote = _crear_lote_una_factura(client_autenticado, db_session)
    texto = respuesta(client_autenticado, lote)
    motor, sesiones = _copiar_base(db_session, tmp_path)
    original = _override(motor, sesiones)
    try:
        respuestas = _en_paralelo(lambda: preview(client_autenticado, texto))
        assert all(respuesta.status_code == 200 for respuesta in respuestas)
        ids = {respuesta.json()["id"] for respuesta in respuestas}
        assert len(ids) == 1 and None not in ids
        with sesiones() as sesion:
            assert sesion.query(ImportacionCobranza).count() == 1
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_confirmar_a_la_vez_registra_un_solo_pago(client_autenticado, db_session, tmp_path):
    crear_catalogo_evento_pago_registrado(db_session)
    _, lote = _crear_lote_una_factura(client_autenticado, db_session)
    revision = preview(client_autenticado, respuesta(client_autenticado, lote)).json()
    motor, sesiones = _copiar_base(db_session, tmp_path)
    original = _override(motor, sesiones)
    try:
        respuestas = _en_paralelo(lambda: confirmar(client_autenticado, revision["id"]))
        assert all(respuesta.status_code == 200 for respuesta in respuestas)
        with sesiones() as sesion:
            assert sesion.query(Pago).count() == 1
            assert sesion.query(ImportacionCobranza).one().estado == "confirmada"
            assert sesion.query(DebitoCobranza).one().pago_id == sesion.query(Pago).one().id
            assert (
                sesion.query(AuditLog).filter_by(entidad="PAGO").count() == 1
            )
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_liberar_a_la_vez_registra_una_sola_liberacion(client_autenticado, db_session, tmp_path):
    factura = crear_factura_demo(db_session, 1)
    lote = exportar(client_autenticado, [factura.id]).json()
    motor, sesiones = _copiar_base(db_session, tmp_path)
    original = _override(motor, sesiones)

    def liberar():
        return client_autenticado.post(
            f"{BASE}/{lote['id']}/liberar",
            json={"motivo": "No procesado", "confirmacion_no_procesado": True},
        )

    try:
        respuestas = _en_paralelo(liberar)
        assert all(respuesta.status_code == 200 for respuesta in respuestas)
        with sesiones() as sesion:
            assert sesion.query(LoteCobranza).one().estado == "liberado"
            assert (
                sesion.query(AuditLog)
                .filter_by(entidad="LOTE_COBRANZA", campo="__liberacion__")
                .count()
                == 1
            )
            assert sesion.query(DebitoCobranza).one().reserva_activa is False
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def _crear_lote_una_factura(client, db_session):
    factura = crear_factura_demo(db_session, 1)
    respuesta_lote = exportar(client, [factura.id])
    assert respuesta_lote.status_code == 201
    return factura, respuesta_lote.json()
