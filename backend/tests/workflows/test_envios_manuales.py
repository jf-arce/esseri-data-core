"""Transporte durable de emails manuales: intenciones, claims, reintentos y callbacks de n8n."""

import uuid
from datetime import timedelta

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import select

from src.comunicaciones.models import Comunicacion, ComunicacionAdjunto, ReciboComunicacion
from src.config import settings
from src.database import get_db
from src.familias_alumnos.models import FamiliaAlumno
from src.fechas import ahora_utc
from src.workflows import manuales_service, n8n_client
from src.workflows.manuales_router import router as envios_router
from src.workflows.models import EnvioNotificacion, Notificacion


@pytest.fixture()
def manual_habilitado(monkeypatch):
    monkeypatch.setattr(settings, "N8N_MANUAL_HABILITADO", True)
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "secreto")
    monkeypatch.setattr(settings, "N8N_CALLBACK_BASE_URL", "http://backend:8000")


@pytest.fixture()
def comunicacion(db_session, escenario_dos_familias):
    c = Comunicacion(
        clave=uuid.uuid4(),
        solicitud_hash="a" * 64,
        autor_id=escenario_dos_familias["usuario_a"],
        asunto="Aviso de prueba",
        cuerpo="Hola familia",
        audiencia={"tipo": "todos", "ids": []},
        estado="publicada",
        canal="email",
    )
    db_session.add(c)
    db_session.commit()
    return c


def _recibo(db, comunicacion, familia_id, alumnos):
    db.add(
        ReciboComunicacion(
            comunicacion_id=comunicacion.id,
            familia_id=familia_id,
            alumnos=[str(alumno) for alumno in alumnos],
        )
    )
    db.commit()


def _ack(estado, referencia=None, error=None):
    return n8n_client.ResultadoEnvioManual(
        estado=estado, referencia_proveedor=referencia, error_codigo=error
    )


def _envios(db, comunicacion):
    return db.scalars(
        select(EnvioNotificacion).where(EnvioNotificacion.comunicacion_id == comunicacion.id)
    ).all()


@pytest.fixture()
def envio_reclamado(db_session, comunicacion, escenario_dos_familias):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    envio = manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})[0]
    db_session.commit()
    intento_id = manuales_service._reclamar(db_session, envio.id)
    assert manuales_service.reclamar_intento(db_session, envio.id, intento_id)["reclamado"]
    return envio.id, intento_id


def test_error_reintentable_no_reencola_si_proveedor_ya_reclamo(db_session, envio_reclamado):
    envio_id, intento_id = envio_reclamado
    estado = manuales_service._finalizar(db_session, envio_id, intento_id, _ack("reintentable"))
    assert estado == "incierto"
    with pytest.raises(manuales_service.EnvioNoReintentable):
        manuales_service.reintentar(
            db_session, db_session.get(EnvioNotificacion, envio_id).comunicacion_id, envio_id
        )


def test_callback_fallo_tras_claim_no_habilita_reenvio(db_session, envio_reclamado):
    envio_id, intento_id = envio_reclamado
    manuales_service.registrar_resultado(
        db_session,
        envio_id,
        intento_id,
        estado="fallido",
        referencia_proveedor=None,
        error_codigo="gmail_error",
    )
    assert db_session.get(EnvioNotificacion, envio_id).estado == "incierto"


def test_preparar_envios_crea_intencion_por_familia_y_email_sin_commit(
    db_session, comunicacion, escenario_dos_familias
):
    familia_a = escenario_dos_familias["familia_a"]
    familia_b = escenario_dos_familias["familia_b"]
    creados = manuales_service.preparar_envios(
        db_session,
        comunicacion,
        {
            familia_a: [str(escenario_dos_familias["alumno_a"])],
            familia_b: [str(escenario_dos_familias["alumno_b"])],
        },
    )

    assert len(creados) == 2
    assert {envio.email for envio in creados} == {
        "familia.a@esseri.edu.ar",
        "familia.b@esseri.edu.ar",
    }
    assert all(envio.estado == "pendiente" for envio in creados)

    db_session.rollback()
    assert _envios(db_session, comunicacion) == []


def test_preparar_envios_es_idempotente_y_marca_sin_email(
    db_session, comunicacion, escenario_dos_familias
):
    familia_a = escenario_dos_familias["familia_a"]
    familia_c = escenario_dos_familias["familia_c"]
    destinatarios = {
        familia_a: [str(escenario_dos_familias["alumno_a"])],
        familia_c: [str(escenario_dos_familias["alumno_a"])],
    }

    primeros = manuales_service.preparar_envios(db_session, comunicacion, destinatarios)
    db_session.commit()
    segundos = manuales_service.preparar_envios(db_session, comunicacion, destinatarios)
    db_session.commit()

    assert [envio.id for envio in primeros] == [envio.id for envio in segundos]
    assert all(envio.cuerpo == comunicacion.cuerpo for envio in segundos)
    envios = _envios(db_session, comunicacion)
    assert len(envios) == 2
    sin_email = next(envio for envio in envios if envio.familia_id == familia_c)
    assert sin_email.email == ""
    assert sin_email.estado == "sin_email"


@pytest.mark.parametrize("nombres", [["documento.pdf"], ["documento.pdf", "<imagen>.png"]])
def test_preparar_envios_avisa_cuando_hay_adjuntos(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch, nombres
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    adjuntos = [
        ComunicacionAdjunto(
            comunicacion_id=comunicacion.id,
            nombre=nombre,
            tipo_contenido="application/pdf",
            tamanio=123,
            checksum="a" * 64,
            estado="limpio",
        )
        for nombre in nombres
    ]
    db_session.add_all(adjuntos)
    db_session.commit()

    envio = manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})[0]

    assert f"{len(nombres)} archivo" in envio.cuerpo
    assert "Portal Familia" in envio.cuerpo
    assert "iniciá sesión" in envio.cuerpo
    for nombre in nombres:
        assert nombre in envio.cuerpo
    snapshot = envio.cuerpo
    db_session.commit()
    adjuntos[0].nombre = "renombrado.pdf"
    db_session.commit()
    assert (
        manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})[
            0
        ].cuerpo
        == snapshot
    )
    db_session.commit()
    enviados = []

    def enviar(*args, **kwargs):
        enviados.append(args)
        return _ack("presentado", referencia="gmail-test")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", enviar)
    manuales_service.procesar_envios_pendientes(db_session)
    html = enviados[0][3]
    assert (
        "Ver adjunto en el portal" if len(nombres) == 1 else "Ver adjuntos en el portal"
    ) in html
    assert "/familia/comunicaciones/" in html
    assert "<imagen>.png" not in html
    if len(nombres) > 1:
        assert "&lt;imagen&gt;.png" in html


def test_presentado_exige_referencia_y_no_se_marca_entregado(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()

    monkeypatch.setattr(
        n8n_client,
        "enviar_email_manual",
        lambda *args, **kwargs: _ack("presentado", referencia="gmail-123"),
    )
    manuales_service.procesar_envios_pendientes(db_session)

    envio = _envios(db_session, comunicacion)[0]
    intento = db_session.scalars(
        select(Notificacion).where(Notificacion.envio_id == envio.id)
    ).one()
    assert envio.estado == "presentado"
    assert intento.estado_envio == "presentado"
    assert intento.referencia_proveedor == "gmail-123"
    assert intento.proveedor_iniciado is True
    assert intento.finished_at is not None


def test_timeout_queda_incierto_y_no_se_reenvia(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()

    llamadas = []
    monkeypatch.setattr(
        n8n_client,
        "enviar_email_manual",
        lambda *args, **kwargs: llamadas.append(1) or _ack("incierto", error="n8n_timeout"),
    )
    manuales_service.procesar_envios_pendientes(db_session)
    manuales_service.procesar_envios_pendientes(db_session)

    envio = _envios(db_session, comunicacion)[0]
    intentos = db_session.scalars(
        select(Notificacion).where(Notificacion.envio_id == envio.id)
    ).all()
    assert envio.estado == "incierto"
    assert len(llamadas) == 1
    assert len(intentos) == 1
    assert intentos[0].error_codigo == "n8n_timeout"


def test_fallo_seguro_reintenta_con_backoff_y_tope(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()

    monkeypatch.setattr(
        n8n_client,
        "enviar_email_manual",
        lambda *args, **kwargs: _ack("reintentable", error="n8n_no_disponible"),
    )
    for _ in range(3):
        manuales_service.procesar_envios_pendientes(db_session)
        envio = _envios(db_session, comunicacion)[0]
        envio.disponible_at = ahora_utc() - timedelta(seconds=1)
        db_session.commit()

    envio = _envios(db_session, comunicacion)[0]
    intentos = db_session.scalars(
        select(Notificacion)
        .where(Notificacion.envio_id == envio.id)
        .order_by(Notificacion.numero_intento)
    ).all()
    assert envio.estado == "fallido"
    assert [intento.numero_intento for intento in intentos] == [1, 2, 3]
    assert len({intento.id for intento in intentos}) == 3

    manuales_service.procesar_envios_pendientes(db_session)
    assert (
        len(db_session.scalars(select(Notificacion).where(Notificacion.envio_id == envio.id)).all())
        == 3
    )


def test_vinculo_revocado_falla_sin_llamar_al_transporte(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()

    vinculo = db_session.scalar(
        select(FamiliaAlumno).where(
            FamiliaAlumno.familia_id == familia, FamiliaAlumno.alumno_id == alumno
        )
    )
    vinculo.recibe_comunicaciones = False
    db_session.add(
        FamiliaAlumno(
            familia_id=familia,
            alumno_id=escenario_dos_familias["alumno_b"],
            recibe_comunicaciones=True,
        )
    )
    db_session.commit()

    def no_llamar(*args, **kwargs):
        raise AssertionError("no debe llamar al transporte con el vínculo revocado")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", no_llamar)
    manuales_service.procesar_envios_pendientes(db_session)

    envio = _envios(db_session, comunicacion)[0]
    intentos = db_session.scalars(
        select(Notificacion).where(Notificacion.envio_id == envio.id)
    ).all()
    assert envio.estado == "fallido"
    assert intentos[-1].error_codigo == "vinculo_revocado"


def test_historial_tiene_la_forma_que_consume_el_frontend(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()
    monkeypatch.setattr(
        n8n_client,
        "enviar_email_manual",
        lambda *args, **kwargs: _ack("incierto", error="n8n_timeout"),
    )
    manuales_service.procesar_envios_pendientes(db_session)

    (envio,) = manuales_service.historial(db_session, comunicacion.id)
    assert set(envio) == {"id", "email", "estado", "intentos"}
    assert envio["email"] == "familia.a@esseri.edu.ar"
    assert envio["estado"] == "incierto"
    assert set(envio["intentos"][0]) == {
        "id",
        "estado",
        "error_codigo",
        "started_at",
        "finished_at",
    }


def test_reintentar_solo_fallido_conserva_ids_y_numeracion(
    db_session, comunicacion, escenario_dos_familias, manual_habilitado, monkeypatch
):
    familia = escenario_dos_familias["familia_a"]
    alumno = escenario_dos_familias["alumno_a"]
    _recibo(db_session, comunicacion, familia, [alumno])
    manuales_service.preparar_envios(db_session, comunicacion, {familia: [str(alumno)]})
    db_session.commit()

    monkeypatch.setattr(
        n8n_client,
        "enviar_email_manual",
        lambda *args, **kwargs: _ack("fallido", error="gmail_error"),
    )
    manuales_service.procesar_envios_pendientes(db_session)
    envio = _envios(db_session, comunicacion)[0]
    assert envio.estado == "fallido"

    resultado = manuales_service.reintentar(db_session, comunicacion.id, envio.id)
    assert resultado["id"] == envio.id
    assert resultado["estado"] == "pendiente"
    assert envio.intentos == 1
    assert envio.reintentos_ciclo == 0

    with pytest.raises(manuales_service.EnvioNoReintentable):
        manuales_service.reintentar(db_session, comunicacion.id, envio.id)


def test_reintentar_rechaza_presentado_e_incierto(db_session, comunicacion, escenario_dos_familias):
    familia = escenario_dos_familias["familia_a"]
    envio = EnvioNotificacion(
        comunicacion_id=comunicacion.id,
        familia_id=familia,
        email="a@b.c",
        asunto="A",
        cuerpo="B",
        estado="incierto",
        disponible_at=ahora_utc(),
    )
    db_session.add(envio)
    db_session.commit()

    with pytest.raises(manuales_service.EnvioNoReintentable):
        manuales_service.reintentar(db_session, comunicacion.id, envio.id)
    with pytest.raises(manuales_service.EnvioNoEncontrado):
        manuales_service.reintentar(db_session, comunicacion.id, uuid.uuid4())


def test_lease_expirado_sin_claim_vuelve_a_pendiente(
    db_session, comunicacion, escenario_dos_familias
):
    familia = escenario_dos_familias["familia_a"]
    intento_id = uuid.uuid4()
    envio = EnvioNotificacion(
        comunicacion_id=comunicacion.id,
        familia_id=familia,
        email="a@b.c",
        asunto="A",
        cuerpo="B",
        estado="procesando",
        intentos=1,
        reintentos_ciclo=1,
        disponible_at=ahora_utc(),
        lease_at=ahora_utc() - timedelta(seconds=manuales_service.LEASE_SEGUNDOS + 1),
        intento_actual_id=intento_id,
    )
    db_session.add(envio)
    db_session.flush()
    db_session.add(
        Notificacion(
            id=intento_id,
            destinatario_tipo="familia",
            destinatario_snapshot="a@b.c",
            asunto_snapshot="A",
            cuerpo_snapshot="B",
            estado_envio="pendiente",
            envio_id=envio.id,
            numero_intento=1,
            started_at=ahora_utc(),
            proveedor_iniciado=False,
            familia_id=familia,
        )
    )
    db_session.commit()

    manuales_service.procesar_envios_pendientes(db_session)

    assert envio.estado == "pendiente"
    intento = db_session.get(Notificacion, intento_id)
    assert intento.error_codigo == manuales_service.ERROR_LEASE_SIN_INICIO


def test_lease_expirado_con_claim_queda_incierto(db_session, comunicacion, escenario_dos_familias):
    familia = escenario_dos_familias["familia_a"]
    intento_id = uuid.uuid4()
    envio = EnvioNotificacion(
        comunicacion_id=comunicacion.id,
        familia_id=familia,
        email="a@b.c",
        asunto="A",
        cuerpo="B",
        estado="procesando",
        intentos=1,
        reintentos_ciclo=1,
        disponible_at=ahora_utc(),
        lease_at=ahora_utc() - timedelta(seconds=manuales_service.LEASE_SEGUNDOS + 1),
        intento_actual_id=intento_id,
    )
    db_session.add(envio)
    db_session.flush()
    db_session.add(
        Notificacion(
            id=intento_id,
            destinatario_tipo="familia",
            destinatario_snapshot="a@b.c",
            asunto_snapshot="A",
            cuerpo_snapshot="B",
            estado_envio="pendiente",
            envio_id=envio.id,
            numero_intento=1,
            started_at=ahora_utc(),
            proveedor_iniciado=True,
            familia_id=familia,
        )
    )
    db_session.commit()

    manuales_service.procesar_envios_pendientes(db_session)

    assert envio.estado == "incierto"
    assert db_session.get(Notificacion, intento_id).estado_envio == "incierto"


def _cliente_callbacks(db_session):
    app = FastAPI()
    app.include_router(envios_router)

    def override():
        yield db_session

    app.dependency_overrides[get_db] = override
    return TestClient(app)


def _envio_en_proceso(db_session, comunicacion, escenario):
    familia = escenario["familia_a"]
    intento_id = uuid.uuid4()
    envio = EnvioNotificacion(
        comunicacion_id=comunicacion.id,
        familia_id=familia,
        email="a@b.c",
        asunto="A",
        cuerpo="B",
        estado="procesando",
        intentos=1,
        reintentos_ciclo=1,
        disponible_at=ahora_utc(),
        lease_at=ahora_utc(),
        intento_actual_id=intento_id,
    )
    db_session.add(envio)
    db_session.flush()
    db_session.add(
        Notificacion(
            id=intento_id,
            destinatario_tipo="familia",
            destinatario_snapshot="a@b.c",
            asunto_snapshot="A",
            cuerpo_snapshot="B",
            estado_envio="pendiente",
            envio_id=envio.id,
            numero_intento=1,
            started_at=ahora_utc(),
            proveedor_iniciado=False,
            familia_id=familia,
        )
    )
    db_session.commit()
    return envio, intento_id


def test_callbacks_exigen_token_configurado_y_correcto(
    db_session, comunicacion, escenario_dos_familias, monkeypatch
):
    envio, intento_id = _envio_en_proceso(db_session, comunicacion, escenario_dos_familias)
    cliente = _cliente_callbacks(db_session)

    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "")
    assert (
        cliente.post(
            f"/workflows/envios/{envio.id}/reclamar", json={"intento_id": str(intento_id)}
        ).status_code
        == 503
    )

    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "secreto")
    assert (
        cliente.post(
            f"/workflows/envios/{envio.id}/reclamar", json={"intento_id": str(intento_id)}
        ).status_code
        == 401
    )
    respuesta = cliente.post(
        f"/workflows/envios/{envio.id}/reclamar",
        json={"intento_id": str(intento_id)},
        headers={"Authorization": "Bearer otro"},
    )
    assert respuesta.status_code == 401


def test_claim_duplicado_y_resultado_solo_del_intento_activo(
    db_session, comunicacion, escenario_dos_familias, monkeypatch
):
    envio, intento_id = _envio_en_proceso(db_session, comunicacion, escenario_dos_familias)
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "secreto")
    cliente = _cliente_callbacks(db_session)
    headers = {"Authorization": "Bearer secreto"}

    primero = cliente.post(
        f"/workflows/envios/{envio.id}/reclamar",
        json={"intento_id": str(intento_id)},
        headers=headers,
    )
    assert primero.status_code == 200
    assert primero.json()["reclamado"] is True
    assert db_session.get(Notificacion, intento_id).proveedor_iniciado is True

    duplicado = cliente.post(
        f"/workflows/envios/{envio.id}/reclamar",
        json={"intento_id": str(intento_id)},
        headers=headers,
    )
    assert duplicado.json()["reclamado"] is False
    assert duplicado.json()["motivo"] == "duplicado"

    ajeno = cliente.post(
        f"/workflows/envios/{envio.id}/resultado",
        json={"intento_id": str(uuid.uuid4()), "estado": "presentado", "referencia_proveedor": "x"},
        headers=headers,
    )
    assert ajeno.status_code == 200
    assert ajeno.json()["aplicado"] is False

    sin_referencia = cliente.post(
        f"/workflows/envios/{envio.id}/resultado",
        json={"intento_id": str(intento_id), "estado": "presentado"},
        headers=headers,
    )
    assert sin_referencia.status_code == 422

    aplicado = cliente.post(
        f"/workflows/envios/{envio.id}/resultado",
        json={
            "intento_id": str(intento_id),
            "estado": "presentado",
            "referencia_proveedor": "gmail-123",
        },
        headers=headers,
    )
    assert aplicado.status_code == 200
    assert aplicado.json()["aplicado"] is True
    assert envio.estado == "presentado"

    repetido = cliente.post(
        f"/workflows/envios/{envio.id}/resultado",
        json={
            "intento_id": str(intento_id),
            "estado": "presentado",
            "referencia_proveedor": "gmail-123",
        },
        headers=headers,
    )
    assert repetido.status_code == 200
    assert repetido.json()["aplicado"] is False


def _transport(handler):
    return httpx.MockTransport(handler)


def test_cliente_manual_clasifica_ack_valido(monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "secreto")
    envio_id, intento_id = uuid.uuid4(), uuid.uuid4()
    recibido = {}

    def responder(request):
        recibido["body"] = request.read()
        recibido["auth"] = request.headers.get("authorization")
        return httpx.Response(
            200,
            json={
                "envio_id": str(envio_id),
                "intento_id": str(intento_id),
                "estado": "presentado",
                "referencia_proveedor": "gmail-1",
            },
        )

    resultado = n8n_client.enviar_email_manual(
        "a@b.c",
        "A",
        "B",
        "<p>B</p>",
        envio_id=envio_id,
        intento_id=intento_id,
        callback_base_url="http://backend:8000",
        transport=_transport(responder),
    )

    assert resultado.estado == "presentado"
    assert resultado.referencia_proveedor == "gmail-1"
    assert recibido["auth"] == "Bearer secreto"
    assert str(envio_id).encode() in recibido["body"]


@pytest.mark.parametrize(
    ("handler", "estado", "codigo"),
    [
        (lambda request: httpx.Response(200, json={"enviado": True}), "incierto", "ack_invalido"),
        (
            lambda request: httpx.Response(
                200,
                json={
                    "envio_id": str(uuid.uuid4()),
                    "intento_id": str(uuid.uuid4()),
                    "estado": "presentado",
                    "referencia_proveedor": "x",
                },
            ),
            "incierto",
            "ack_invalido",
        ),
        (lambda request: httpx.Response(500), "incierto", "n8n_5xx"),
        (lambda request: httpx.Response(400), "fallido", "n8n_rechazo"),
        (lambda request: httpx.Response(200, json={}), "incierto", "ack_invalido"),
    ],
)
def test_cliente_manual_no_confunde_http_200_con_entrega(monkeypatch, handler, estado, codigo):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    resultado = n8n_client.enviar_email_manual(
        "a@b.c",
        "A",
        "B",
        envio_id=uuid.uuid4(),
        intento_id=uuid.uuid4(),
        callback_base_url="http://backend:8000",
        transport=_transport(handler),
    )
    assert resultado.estado == estado
    assert resultado.error_codigo == codigo


def test_cliente_manual_distingue_conexion_de_timeout(monkeypatch):
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")

    def rechazada(request):
        raise httpx.ConnectError("sin conexión")

    def timeout(request):
        raise httpx.ReadTimeout("respuesta perdida")

    reintentable = n8n_client.enviar_email_manual(
        "a@b.c",
        "A",
        "B",
        envio_id=uuid.uuid4(),
        intento_id=uuid.uuid4(),
        callback_base_url="http://backend:8000",
        transport=_transport(rechazada),
    )
    incierto = n8n_client.enviar_email_manual(
        "a@b.c",
        "A",
        "B",
        envio_id=uuid.uuid4(),
        intento_id=uuid.uuid4(),
        callback_base_url="http://backend:8000",
        transport=_transport(timeout),
    )

    assert reintentable.estado == "reintentable"
    assert incierto.estado == "incierto"
