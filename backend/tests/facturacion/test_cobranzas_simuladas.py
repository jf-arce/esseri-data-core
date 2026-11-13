"""End-to-end demo collections: generation, durable review, confirmation and payment effects."""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from decimal import Decimal
from threading import Barrier

import pytest

from src.database import get_db
from src.facturacion import facturas_service
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    FacturaCobranzaDemo,
    LoteCobranza,
    MetodoPago,
    Movimiento,
    Pago,
)
from src.familias_alumnos.models import Familia
from src.main import app
from src.models import AuditLog, EventLog
from tests.facturacion.test_cobranzas_importacion import confirmar, preview
from tests.facturacion.test_cobranzas_lotes import BASE, METODO_DEMO, exportar
from tests.facturacion.test_pagos import _crear_factura_pendiente

PERIODO = "2027-03"


@pytest.fixture()
def factura_demo(db_session):
    factura, _, usuario, _ = _crear_factura_pendiente(db_session)
    db_session.add_all(
        [
            MetodoPago(
                id=METODO_DEMO,
                nombre="Débito por archivo",
                activo=True,
                requiere_comprobante=False,
            ),
            FacturaCobranzaDemo(
                factura_id=factura.id,
                numero="F-DEMO-0001",
                periodo=PERIODO,
                medio="cbu",
            ),
        ]
    )
    db_session.commit()
    return factura, usuario


def crear_lote(client, factura):
    respuesta = exportar(client, [factura.id], periodo=PERIODO)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def respuesta_demo(client, lote, *, rechazar=False):
    respuesta = client.post(
        f"{BASE}/{lote['id']}/respuesta",
        json={
            "rechazar_referencias": [lote["items"][0]["referencia"]] if rechazar else []
        },
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["contenido"]


def test_generar_previsualizar_confirmar_y_reintentar(client_autenticado, db_session, factura_demo):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    assert len(lote["solicitudes"]) == 1
    archivo_solicitud = lote["solicitudes"][0]
    assert archivo_solicitud["nombre"].startswith("ESSERI_")
    assert lote["items"][0]["referencia"] in archivo_solicitud["contenido"]
    assert archivo_solicitud["contenido"].startswith("referencia;factura;alumno;")
    texto = respuesta_demo(client_autenticado, lote)
    previo_pagos = db_session.query(Pago).count()
    previo_eventos = db_session.query(EventLog).count()
    previo_auditoria = db_session.query(AuditLog).filter_by(entidad="PAGO").count()
    previo_movimientos = db_session.query(Movimiento).count()

    revision = preview(client_autenticado, texto)
    assert revision.status_code == 200
    cuerpo = revision.json()
    assert cuerpo["estado"] == "en_revision"
    assert cuerpo["items"][0]["estado"] == "listo"
    assert db_session.query(Pago).count() == previo_pagos
    assert db_session.get(Factura, factura.id).estado == "pendiente"

    confirmado = confirmar(client_autenticado, cuerpo["id"])
    assert confirmado.status_code == 200, confirmado.text
    assert confirmado.json()["estado"] == "confirmada"
    pago = db_session.query(Pago).one()
    assert pago.monto == Decimal("100.00")
    assert pago.estado == "aprobado"
    assert "SIMULADO" in pago.referencia_transaccion
    assert pago.usuario_registro_id is not None
    assert db_session.get(Factura, factura.id).estado == "pagada"
    assert db_session.query(EventLog).count() == previo_eventos + 1
    assert db_session.query(AuditLog).filter_by(entidad="PAGO").count() == previo_auditoria + 1
    assert db_session.query(Movimiento).count() == previo_movimientos + 1
    assert db_session.query(Movimiento).filter_by(pago_id=pago.id).one().monto == pago.monto

    repetido = confirmar(client_autenticado, cuerpo["id"])
    assert repetido.status_code == 200
    assert repetido.json()["estado"] == "confirmada"
    assert db_session.query(Pago).count() == previo_pagos + 1
    assert db_session.query(Movimiento).count() == previo_movimientos + 1


def test_rechazo_no_genera_pago_y_no_se_puede_cambiar(client_autenticado, db_session, factura_demo):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote, rechazar=True)
    revision = preview(client_autenticado, texto).json()
    assert revision["items"][0]["estado"] == "rechazado"
    resultado = confirmar(client_autenticado, revision["id"])
    assert resultado.status_code == 200
    assert resultado.json()["estado"] == "confirmada"
    assert db_session.query(Pago).count() == 0
    assert db_session.query(Movimiento).filter_by(tipo="haber").count() == 0
    assert db_session.get(Factura, factura.id).estado == "pendiente"

    cobrado = respuesta_demo(client_autenticado, lote)
    conflicto = preview(client_autenticado, cobrado)
    assert conflicto.status_code == 200
    assert conflicto.json()["id"] is None
    assert conflicto.json()["errores"]
    assert db_session.query(Pago).count() == 0


@pytest.mark.parametrize("caso", ["referencia", "lote", "importe", "pagada", "total", "duplicado"])
def test_invalido_no_aplica_ni_cambia_factura(client_autenticado, db_session, factura_demo, caso):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    lote_id, filas = formato.leer_respuesta(texto)
    fila = filas[0]
    if caso == "referencia":
        fila = formato.RespuestaDetalle(
            uuid.uuid4(), fila.resultado, fila.importe, fila.fecha, "", ""
        )
    elif caso == "lote":
        lote_id = uuid.uuid4()
    elif caso == "importe":
        fila = formato.RespuestaDetalle(
            fila.referencia, fila.resultado, Decimal("99.00"), fila.fecha, "", ""
        )
    elif caso == "pagada":
        factura.estado = "pagada"
        db_session.commit()
    texto = formato.generar_respuesta(lote_id, date.today(), [fila])
    if caso == "total":
        texto = texto.replace("T;1;100.00", "T;1;99.00")
    elif caso == "duplicado":
        texto = formato.generar_respuesta(lote_id, date.today(), [fila, fila])
    estado_anterior = db_session.get(Factura, factura.id).estado

    revision = preview(client_autenticado, texto)

    assert revision.status_code == 200
    cuerpo = revision.json()
    assert cuerpo["errores"] or cuerpo["resumen"]["errores"]["cantidad"] > 0
    assert cuerpo["puede_confirmar"] is False
    if cuerpo["id"] is not None:
        confirmado = confirmar(client_autenticado, cuerpo["id"])
        assert confirmado.status_code == 200
        assert confirmado.json()["estado"] == "en_revision"
    assert db_session.query(Pago).count() == 0
    assert db_session.get(Factura, factura.id).estado == estado_anterior


def test_confirmacion_revalida_y_revierte_fallos(
    client_autenticado, db_session, factura_demo, monkeypatch
):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()

    def fallar(*args, **kwargs):
        raise RuntimeError("fallo antes de commit")

    with monkeypatch.context() as parche:
        parche.setattr(facturas_service, "log_audit", fallar)
        with pytest.raises(RuntimeError, match="fallo antes de commit"):
            confirmar(client_autenticado, revision["id"])
    db_session.rollback()
    assert db_session.query(Pago).count() == 0
    assert db_session.query(EventLog).count() == 0
    assert db_session.get(Factura, factura.id).estado == "pendiente"
    assert db_session.query(DebitoCobranza).one().resultado_hash is None
    reintento = confirmar(client_autenticado, revision["id"])
    assert reintento.json()["estado"] == "confirmada"
    assert db_session.query(Pago).count() == 1


@pytest.mark.parametrize(
    "ruta,body",
    [
        ("", {"factura_ids": [str(uuid.uuid4())]}),
        ("/previsualizar", {"contenido": "invalido"}),
        ("/confirmar", {"contenido": "invalido"}),
        (f"/{uuid.uuid4()}/respuesta", {"rechazar_referencias": []}),
        (f"/{uuid.uuid4()}/liberar", {"motivo": "x", "confirmacion_no_procesado": True}),
    ],
)
def test_lector_no_puede_operar(client_solo_lectura, db_session, ruta, body):
    resultado = client_solo_lectura.post(BASE + ruta, json=body)
    assert resultado.status_code == 403
    assert db_session.query(Pago).count() == 0


def test_sin_sesion_no_puede_operar(client):
    assert client.post(BASE + "/confirmar", json={"contenido": "invalido"}).status_code == 401


def test_cobro_se_refleja_en_portal_familia(client_autenticado, db_session, factura_demo):
    factura, _ = factura_demo
    responsable = factura.responsable_economico_id
    from src.facturacion.models import ResponsableEconomico

    familia_id = db_session.get(ResponsableEconomico, responsable).familia_id
    familia = db_session.get(Familia, familia_id)
    from src.auth.models import Usuario

    operador = db_session.query(Usuario).filter_by(email="facturacion@esseri.edu.ar").one()
    operador.persona_id = familia.persona_id
    db_session.commit()
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    confirmar(client_autenticado, revision["id"])
    portal = client_autenticado.get("/facturacion/familia/me")
    assert portal.status_code == 200
    cuenta = portal.json()
    assert Decimal(cuenta["saldo"]) == 0
    assert Decimal(cuenta["total_haber"]) == 100
    assert cuenta["facturas"][0]["estado"] == "pagada"
    assert len(cuenta["facturas"][0]["pagos"]) == 1
    assert Decimal(cuenta["facturas"][0]["pagos"][0]["monto"]) == 100


def test_estado_cambia_entre_preview_y_confirmacion(client_autenticado, db_session, factura_demo):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    assert revision["items"][0]["estado"] == "listo"
    factura.estado = "pagada"
    db_session.commit()
    confirmado = confirmar(client_autenticado, revision["id"])
    assert confirmado.json()["estado"] == "en_revision"
    assert confirmado.json()["resumen"]["errores"]["cantidad"] == 1
    assert db_session.query(Pago).count() == 0
    assert db_session.query(DebitoCobranza).one().resultado_hash is None


@pytest.mark.parametrize("caso", ["pagada", "repetida", "desconocida"])
def test_solicitud_invalida_no_se_persiste(client_autenticado, db_session, factura_demo, caso):
    factura, _ = factura_demo
    ids = [str(factura.id)]
    if caso == "pagada":
        factura.estado = "pagada"
        db_session.commit()
    elif caso == "repetida":
        ids *= 2
    else:
        ids = [str(uuid.uuid4())]
    resultado = client_autenticado.post(BASE, json={"factura_ids": ids})
    assert resultado.status_code == 400
    assert db_session.query(DebitoCobranza).count() == 0
    assert db_session.query(LoteCobranza).count() == 0


def test_lector_no_puede_descargar_lotes(client_solo_lectura):
    assert client_solo_lectura.get(BASE).status_code == 403
    assert client_solo_lectura.get(f"{BASE}/{uuid.uuid4()}").status_code == 403


def test_confirmaciones_concurrentes_no_duplican(
    client_autenticado, db_session, factura_demo, tmp_path
):
    """Two real HTTP requests with separate DB sessions, not the shared fixture session."""
    import sqlite3

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    db_session.rollback()
    archivo = tmp_path / "concurrent.sqlite"
    with sqlite3.connect(archivo) as destino:
        db_session.connection().connection.driver_connection.backup(destino)
    motor = create_engine(
        f"sqlite:///{archivo}", connect_args={"timeout": 10, "check_same_thread": False}
    )
    sesiones = sessionmaker(bind=motor, autoflush=False)
    original = app.dependency_overrides[get_db]

    def db_independiente():
        with sesiones() as sesion:
            yield sesion

    app.dependency_overrides[get_db] = db_independiente
    barrera = Barrier(2)

    def confirmar_http():
        barrera.wait(timeout=10)
        return confirmar(client_autenticado, revision["id"])

    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            respuestas = list(pool.map(lambda _: confirmar_http(), range(2)))
        assert all(respuesta.status_code == 200 for respuesta in respuestas)
        assert all(
            respuesta.json()["estado"] == "confirmada" for respuesta in respuestas
        )
        with sesiones() as sesion:
            assert sesion.query(Pago).count() == 1
            assert sesion.query(Movimiento).filter_by(tipo="haber").count() == 1
            assert sesion.query(EventLog).count() == 1
            assert sesion.query(AuditLog).filter_by(entidad="PAGO").count() == 1
            assert sesion.query(DebitoCobranza).one().pago_id == sesion.query(Pago).one().id
            assert sesion.get(Factura, factura.id).estado == "pagada"
    finally:
        app.dependency_overrides[get_db] = original
        motor.dispose()


def test_resultado_distinto_que_gana_reserva_es_conflicto(
    client_autenticado, db_session, factura_demo, monkeypatch
):
    """Force a losing CAS deterministically; the concurrent HTTP test covers real sessions."""
    from sqlalchemy import update
    from sqlalchemy.sql.dml import Update

    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    revision = preview(client_autenticado, texto).json()
    ejecutar = db_session.execute
    gano_otro = False

    def ejecutar_con_ganador(statement, *args, **kwargs):
        nonlocal gano_otro
        if (
            isinstance(statement, Update)
            and statement.table.name == "debito_cobranza"
            and not gano_otro
        ):
            gano_otro = True
            ejecutar(
                update(DebitoCobranza)
                .values(resultado_hash="a" * 64, resultado=formato.RECHAZADO)
                .execution_options(synchronize_session=False)
            )
        return ejecutar(statement, *args, **kwargs)

    monkeypatch.setattr(db_session, "execute", ejecutar_con_ganador)
    resultado = confirmar(client_autenticado, revision["id"])
    assert resultado.status_code == 200
    assert gano_otro
    assert db_session.query(Pago).count() == 0
    assert db_session.get(Factura, factura.id).estado == "pendiente"


def test_preview_no_escribe_ni_cambia_facturas(client_autenticado, db_session, factura_demo):
    factura, _ = factura_demo
    lote = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, lote)
    antes = (db_session.query(Pago).count(), db_session.query(Movimiento).count())
    preview(client_autenticado, texto)
    assert (db_session.query(Pago).count(), db_session.query(Movimiento).count()) == antes
    assert db_session.get(Factura, factura.id).estado == "pendiente"
    assert db_session.query(DebitoCobranza).one().resultado_hash is None


def test_saldo_parcial_y_lote_congelado(client_autenticado, db_session, factura_demo):
    factura, usuario = factura_demo
    congelado = crear_lote(client_autenticado, factura)
    texto = respuesta_demo(client_autenticado, congelado)
    facturas_service.registrar_pago(
        db_session,
        factura=db_session.get(Factura, factura.id),
        usuario_registro_id=usuario.id,
        fecha=date.today(),
        monto=Decimal("40.00"),
        metodo_pago_id=METODO_DEMO,
        referencia_transaccion="MANUAL-40",
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )
    revision = preview(client_autenticado, texto).json()
    assert revision["resumen"]["errores"]["cantidad"] == 1
    confirmado = confirmar(client_autenticado, revision["id"])
    assert confirmado.json()["estado"] == "en_revision"
    assert db_session.query(Pago).count() == 1
    assert db_session.query(DebitoCobranza).one().resultado_hash is None
    # The batch stays in review and keeps the invoice reserved; a new batch cannot take it.
    assert exportar(client_autenticado, [factura.id], periodo=PERIODO).status_code == 409
