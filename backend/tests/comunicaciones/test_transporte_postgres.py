"""Transporte durable de emails manuales sobre PostgreSQL real.

Cubre lo que SQLite no puede probar: el claim atómico con workers paralelos usando sesiones
independientes, el callback duplicado de n8n, el intento viejo que no puede reclamar, el
resultado que llega aunque se pierda la respuesta HTTP del worker y el lease vencido que no
duplica un envío ya reclamado.

Solo se ejecuta con `COMUNICACIONES_TEST_DATABASE_URL` apuntando a una base aislada; usa el
esquema efímero de `escenario_concurrente` y nunca despacha a n8n.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.config import settings
from src.fechas import ahora_utc
from src.workflows import manuales_service, n8n_client
from src.workflows.models import EnvioNotificacion, Notificacion

TOKEN_PRUEBA = "token-de-prueba-n8n"


@pytest.fixture()
def manual_habilitado(monkeypatch):
    monkeypatch.setattr(settings, "N8N_MANUAL_HABILITADO", True)
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", TOKEN_PRUEBA)
    monkeypatch.setattr(settings, "N8N_CALLBACK_BASE_URL", "http://backend:8000")


@pytest.fixture()
def escenario_transporte(escenario_concurrente):
    """Comunicación publicada, recibo vigente e intención pendiente creadas por el camino real."""
    _, engine, ids = escenario_concurrente
    familia_id = ids["familia_a"]
    alumno_id = ids["alumno_a"]
    with Session(engine) as db:
        comunicacion = Comunicacion(
            clave=uuid.uuid4(),
            solicitud_hash="b" * 64,
            autor_id=ids["usuario_a"],
            asunto="Aviso de transporte",
            cuerpo="Hola familia",
            audiencia={"tipo": "todos", "ids": []},
            estado="publicada",
            canal="email",
        )
        db.add(comunicacion)
        db.flush()
        db.add(
            ReciboComunicacion(
                comunicacion_id=comunicacion.id,
                familia_id=familia_id,
                alumnos=[str(alumno_id)],
            )
        )
        (envio,) = manuales_service.preparar_envios(
            db, comunicacion, {familia_id: [str(alumno_id)]}
        )
        db.commit()
        assert envio.estado == "pendiente"
        assert envio.email
        return {
            "engine": engine,
            "ids": ids,
            "comunicacion_id": comunicacion.id,
            "familia_id": familia_id,
            "envio_id": envio.id,
        }


def _envio_procesando(escenario, *, proveedor_iniciado=False, lease_vencido=False):
    """Envío ya reclamado por un worker, con un único intento durable."""

    intento_id = uuid.uuid4()
    lease = ahora_utc()
    if lease_vencido:
        lease -= timedelta(seconds=manuales_service.LEASE_SEGUNDOS + 1)
    with Session(escenario["engine"]) as db:
        envio = db.get(EnvioNotificacion, escenario["envio_id"])
        envio.estado = "procesando"
        envio.intentos = 1
        envio.reintentos_ciclo = 1
        envio.disponible_at = ahora_utc()
        envio.lease_at = lease
        envio.intento_actual_id = intento_id
        db.flush()
        db.add(
            Notificacion(
                id=intento_id,
                destinatario_tipo="familia",
                destinatario_snapshot=envio.email,
                asunto_snapshot=envio.asunto,
                cuerpo_snapshot=envio.cuerpo,
                estado_envio="pendiente",
                envio_id=envio.id,
                numero_intento=1,
                started_at=ahora_utc(),
                proveedor_iniciado=proveedor_iniciado,
                familia_id=escenario["familia_id"],
            )
        )
        db.commit()
        return envio.id, intento_id


def _intentos(engine, envio_id):
    with Session(engine) as db:
        return list(
            db.scalars(
                select(Notificacion)
                .where(Notificacion.envio_id == envio_id)
                .order_by(Notificacion.numero_intento)
            )
        )


def _envio(engine, envio_id):
    with Session(engine) as db:
        return db.get(EnvioNotificacion, envio_id)


def test_reclamo_paralelo_tiene_un_solo_ganador(escenario_transporte):
    """Cuatro workers con sesiones independientes compiten por el mismo envío pendiente."""

    engine = escenario_transporte["engine"]
    envio_id = escenario_transporte["envio_id"]
    barrera = Barrier(4, timeout=20)

    def reclamar():
        with Session(engine) as db:
            barrera.wait()
            return manuales_service._reclamar(db, envio_id)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futuros = [pool.submit(reclamar) for _ in range(4)]
        resultados = [futuro.result(timeout=60) for futuro in futuros]

    ganadores = [intento_id for intento_id in resultados if intento_id is not None]
    assert len(ganadores) == 1, "el update condicional debe dejar un único claim"

    envio = _envio(engine, envio_id)
    assert envio.estado == "procesando"
    assert envio.intentos == 1
    assert envio.intento_actual_id == ganadores[0]
    assert envio.lease_at is not None

    intentos = _intentos(engine, envio_id)
    assert [intento.id for intento in intentos] == [ganadores[0]]
    assert intentos[0].numero_intento == 1
    assert intentos[0].proveedor_iniciado is False


def test_callback_reclamar_intento_duplicado_tiene_un_solo_claim(escenario_transporte):
    """n8n reintenta el claim: solo la primera llamada avanza, el resto ve `duplicado`."""

    engine = escenario_transporte["engine"]
    envio_id, intento_id = _envio_procesando(escenario_transporte)
    barrera = Barrier(4, timeout=20)

    def reclamar():
        with Session(engine) as db:
            barrera.wait()
            return manuales_service.reclamar_intento(db, envio_id, intento_id)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futuros = [pool.submit(reclamar) for _ in range(4)]
        respuestas = [futuro.result(timeout=60) for futuro in futuros]

    reclamados = [respuesta for respuesta in respuestas if respuesta["reclamado"]]
    assert len(reclamados) == 1
    assert {respuesta["motivo"] for respuesta in respuestas if not respuesta["reclamado"]} == {
        "duplicado"
    }
    assert {str(respuesta["intento_id"]) for respuesta in respuestas} == {str(intento_id)}

    intentos = _intentos(engine, envio_id)
    assert len(intentos) == 1
    assert intentos[0].proveedor_iniciado is True
    assert _envio(engine, envio_id).estado == "procesando"


def test_intento_anterior_no_puede_reclamar_tras_recuperar_lease(escenario_transporte):
    """El lease vencido libera el envío, pero el intento viejo ya no es el activo."""

    engine = escenario_transporte["engine"]
    envio_id, intento_viejo = _envio_procesando(escenario_transporte, lease_vencido=True)

    with Session(engine) as db:
        assert manuales_service._recuperar_leases(db) == 1

    with Session(engine) as db:
        respuesta = manuales_service.reclamar_intento(db, envio_id, intento_viejo)

    assert respuesta["reclamado"] is False
    assert respuesta["motivo"] == "intento_no_activo"
    assert respuesta["estado"] == "pendiente"
    assert respuesta["intento_id"] is None

    envio = _envio(engine, envio_id)
    assert envio.estado == "pendiente"
    assert envio.intento_actual_id is None
    assert envio.lease_at is None

    intentos = _intentos(engine, envio_id)
    assert [intento.id for intento in intentos] == [intento_viejo]
    assert intentos[0].error_codigo == manuales_service.ERROR_LEASE_SIN_INICIO
    assert intentos[0].proveedor_iniciado is False


def test_callback_de_resultado_sobrevive_a_respuesta_perdida_del_worker(
    escenario_transporte, manual_habilitado, monkeypatch
):
    """n8n reclama, envía, registra el resultado y recién después se pierde la respuesta."""

    engine = escenario_transporte["engine"]
    envio_id = escenario_transporte["envio_id"]

    def enviar_y_perder_respuesta(*args, intento_id, **kwargs):
        with Session(engine) as callback_db:
            claim = manuales_service.reclamar_intento(callback_db, envio_id, intento_id)
            assert claim["reclamado"] is True
            aplicado = manuales_service.registrar_resultado(
                callback_db,
                envio_id,
                intento_id,
                estado="presentado",
                referencia_proveedor="gmail-pg-1",
                error_codigo=None,
            )
            assert aplicado["aplicado"] is True
        # El worker solo ve el timeout: el ack HTTP nunca llegó.
        return n8n_client.ResultadoEnvioManual(estado="incierto", error_codigo="n8n_timeout")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", enviar_y_perder_respuesta)

    with Session(engine) as db:
        intento_id = manuales_service._reclamar(db, envio_id)
        assert intento_id is not None
        estado_final = manuales_service._procesar_uno(db, envio_id, intento_id)

    assert estado_final == "presentado"

    envio = _envio(engine, envio_id)
    assert envio.estado == "presentado"
    assert envio.lease_at is None

    intentos = _intentos(engine, envio_id)
    assert len(intentos) == 1
    assert intentos[0].estado_envio == "presentado"
    assert intentos[0].referencia_proveedor == "gmail-pg-1"
    assert intentos[0].proveedor_iniciado is True
    assert intentos[0].error_codigo is None, "el timeout del worker no debe degradar el resultado"


def test_lease_vencido_con_claim_previo_no_duplica_el_envio(
    escenario_transporte, manual_habilitado, monkeypatch
):
    """n8n ya reclamó el intento: el lease vencido queda incierto y no se despacha de nuevo."""

    engine = escenario_transporte["engine"]
    envio_id, intento_id = _envio_procesando(
        escenario_transporte, proveedor_iniciado=True, lease_vencido=True
    )
    llamadas = []

    def no_llamar(*args, **kwargs):
        llamadas.append(1)
        raise AssertionError("un envío con claim iniciado no se reintenta automáticamente")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", no_llamar)

    with Session(engine) as db:
        resumen = manuales_service.procesar_envios_pendientes(db)
        assert resumen.recuperados == 1
        assert resumen.procesados == 0

    envio = _envio(engine, envio_id)
    assert envio.estado == "incierto"
    assert envio.lease_at is None
    assert envio.intento_actual_id == intento_id

    intentos = _intentos(engine, envio_id)
    assert len(intentos) == 1
    assert intentos[0].estado_envio == "incierto"
    assert intentos[0].error_codigo == "lease_expirado_iniciado"

    with Session(engine) as db:
        segundo = manuales_service.procesar_envios_pendientes(db)
        assert segundo.procesados == 0

    assert llamadas == []
    assert len(_intentos(engine, envio_id)) == 1
    assert _envio(engine, envio_id).intentos == 1
