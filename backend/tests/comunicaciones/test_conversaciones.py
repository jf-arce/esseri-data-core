from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, date, datetime
from decimal import Decimal
from io import BytesIO
from threading import Barrier
from uuid import uuid4

import pytest
from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from src.academico.models import (
    JustificacionInasistencia,
    MotivoJustificacion,
    SolicitudAusenciaPeriodo,
)
from src.auth import config, sesion_service
from src.auth.models import Permiso, Rol, RolPermiso, Usuario, UsuarioRol
from src.comunicaciones import adjuntos_escaner, adjuntos_service
from src.comunicaciones.models import ConversacionContextual, MensajeConversacion
from src.facturacion.models import DebitoCobranza, Factura, LoteCobranza, ResponsableEconomico
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia
from src.workflows import manuales_service, n8n_client
from src.workflows.models import EnvioNotificacion

BASE = "/comunicaciones/conversaciones"


@pytest.fixture()
def escenario(db_session, escenario_dos_familias):
    ids = escenario_dos_familias
    motivo = MotivoJustificacion(nombre="Motivo de prueba")
    admin = Usuario(email="admin.hilos@example.test", estado="activo", auth_provider="local")
    ajeno = Usuario(
        email="familia.ajena@example.test",
        estado="activo",
        auth_provider="local",
        persona_id=db_session.get(Familia, ids["familia_c"]).persona_id,
    )
    familia = Rol(nombre="familia")
    administracion = Rol(nombre="administración")
    permiso = Permiso(modulo="Académico", accion="actualizar", tipo_informacion="justificaciones")
    facturacion = Permiso(modulo="Facturación", accion="leer")
    db_session.add_all([motivo, admin, ajeno, familia, administracion, permiso, facturacion])
    db_session.flush()
    db_session.add_all(
        [
            UsuarioRol(usuario_id=ids["usuario_a"], rol_id=familia.id),
            UsuarioRol(usuario_id=ajeno.id, rol_id=familia.id),
            UsuarioRol(usuario_id=admin.id, rol_id=administracion.id),
            RolPermiso(rol_id=administracion.id, permiso_id=permiso.id),
            RolPermiso(rol_id=administracion.id, permiso_id=facturacion.id),
        ]
    )
    solicitud = SolicitudAusenciaPeriodo(
        fecha_inicio=date(2026, 11, 24),
        fecha_fin=date(2026, 11, 26),
        familia_id=ids["familia_a"],
        alumno_id=ids["alumno_a"],
        usuario_id=ids["usuario_a"],
        motivo_justificacion_id=motivo.id,
    )
    db_session.add(solicitud)
    db_session.commit()
    return solicitud, ids["usuario_a"], admin.id, ajeno.id


def autenticar(client, usuario_id, rol):
    token = sesion_service.crear_access_token(usuario_id, rol_activo=rol)
    client.cookies.set(config.COOKIE_SESION, token)


@pytest.mark.parametrize("inicia_admin", [False, True])
def test_hilo_de_periodo_bidireccional_y_reapertura(client, db_session, escenario, inicia_admin):
    solicitud, familiar, admin, ajeno = escenario
    contexto = f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}"
    autenticar(client, *((admin, "administracion") if inicia_admin else (familiar, "familia")))
    consulta = client.get(contexto)
    assert consulta.status_code == 200
    assert consulta.json()["conversacion"] is None

    inicial = {"texto": "Consulta sobre el período", "clave": str(uuid4())}
    apertura = client.post(contexto, json=inicial)
    assert apertura.status_code == 201
    hilo = apertura.json()
    assert hilo["estado"] == ("pendiente_familia" if inicia_admin else "pendiente_administracion")
    assert client.post(contexto, json=inicial).json()["id"] == hilo["id"]
    assert client.post(contexto, json={**inicial, "clave": str(uuid4())}).status_code == 409
    ruta = f"{BASE}/{hilo['id']}"

    autenticar(client, ajeno, "familia")
    assert client.get(contexto).status_code == 404
    assert client.get(ruta).status_code == 404
    assert client.get(f"{ruta}/mensajes").status_code == 404
    respuesta = {"texto": "Respuesta registrada", "clave": str(uuid4())}
    assert client.post(f"{ruta}/mensajes", json=respuesta).status_code == 404

    autenticar(client, *((familiar, "familia") if inicia_admin else (admin, "administracion")))
    assert client.post(f"{ruta}/mensajes", json=respuesta).status_code == 201
    assert client.post(f"{ruta}/mensajes", json=respuesta).status_code == 201
    assert client.post(f"{ruta}/mensajes", json={**respuesta, "texto": "Otro"}).status_code == 409
    autenticar(client, admin, "administracion")
    assert client.post(f"{ruta}/resolver").json()["estado"] == "resuelta"
    autenticar(client, familiar, "familia")
    assert client.post(f"{ruta}/reabrir").status_code == 403
    autenticar(client, admin, "administracion")
    assert (
        client.post(f"{ruta}/mensajes", json={**respuesta, "clave": str(uuid4())}).status_code
        == 409
    )
    assert client.post(f"{ruta}/reabrir").json()["id"] == hilo["id"]
    mensajes = client.get(f"{ruta}/mensajes").json()["items"]
    assert [mensaje["texto"] for mensaje in mensajes] == [inicial["texto"], respuesta["texto"]]
    pagina = client.get(f"{ruta}/mensajes", params={"limite": 1}).json()
    assert pagina["siguiente"] == mensajes[-1]["id"]
    anterior = client.get(
        f"{ruta}/mensajes", params={"limite": 1, "antes": pagina["siguiente"]}
    ).json()
    assert anterior == {"items": [mensajes[0]], "siguiente": None}
    db_session.refresh(solicitud)
    assert solicitud.estado == "pendiente"


def test_justificacion_individual_y_revocacion(
    client, db_session, escenario, escenario_dos_familias
):
    solicitud, usuario, admin, _ = escenario
    ids = escenario_dos_familias
    asistencia = Asistencia(
        fecha=solicitud.fecha_inicio,
        tipo="ausente_pendiente",
        inscripcion_id=ids["inscripcion_a"],
    )
    db_session.add(asistencia)
    db_session.flush()
    justificacion = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=solicitud.familia_id,
        usuario_id=usuario,
        motivo_justificacion_id=solicitud.motivo_justificacion_id,
    )
    db_session.add(justificacion)
    db_session.commit()
    autenticar(client, usuario, "familia")
    datos = {"texto": "Consulta individual", "clave": str(uuid4())}
    url = f"{BASE}/contextos/justificacion_inasistencia/{justificacion.id}"
    apertura = client.post(url, json=datos)
    assert apertura.status_code == 201
    assert apertura.json()["contexto"]["id"] == str(justificacion.id)
    assert (
        client.get(f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}").json()[
            "conversacion"
        ]
        is None
    )
    assert client.get(BASE).status_code == 403
    db_session.delete(db_session.get(FamiliaAlumno, ids["vinculo_a"]))
    db_session.commit()
    assert client.get(url).status_code == 404
    autenticar(client, admin, "administracion")
    bandeja = client.get(BASE, params={"estado": "pendiente_administracion"})
    assert [h["id"] for h in bandeja.json()["items"]] == [apertura.json()["id"]]
    db_session.refresh(asistencia)
    db_session.refresh(justificacion)
    assert (asistencia.tipo, justificacion.estado) == ("ausente_pendiente", "pendiente")


def test_debito_rechazado_sin_pago(client, db_session, escenario, escenario_dos_familias):
    solicitud, usuario, admin, _ = escenario
    responsable = ResponsableEconomico(
        familia_id=solicitud.familia_id,
        alumno_id=solicitud.alumno_id,
        vigencia_desde=solicitud.fecha_inicio,
    )
    lote = LoteCobranza(fecha=solicitud.fecha_inicio, usuario_id=admin)
    db_session.add_all([responsable, lote])
    db_session.flush()
    factura = Factura(
        responsable_economico_id=responsable.id,
        inscripcion_id=escenario_dos_familias["inscripcion_a"],
        fecha_emision=solicitud.fecha_inicio,
        fecha_vencimiento=solicitud.fecha_fin,
        monto_total=Decimal("120"),
    )
    db_session.add(factura)
    db_session.flush()
    debito = DebitoCobranza(
        lote_id=lote.id,
        factura_id=factura.id,
        vencimiento=factura.fecha_vencimiento,
        importe=factura.monto_total,
        concepto="Cuota",
    )
    db_session.add(debito)
    db_session.commit()
    autenticar(client, usuario, "familia")
    url = f"{BASE}/contextos/debito_cobranza/{debito.id}"
    datos = {"texto": "¿Puedo presentar un comprobante?", "clave": str(uuid4())}
    assert client.post(url, json=datos).status_code == 404
    debito.resultado = "RECHAZADO_SIM"
    db_session.commit()
    apertura = client.post(url, json=datos)
    assert apertura.status_code == 201
    autenticar(client, admin, "administracion")
    hilo = apertura.json()["id"]
    respuesta = client.post(
        f"{BASE}/{hilo}/mensajes", json={"texto": "Sí, adjuntalo.", "clave": str(uuid4())}
    )
    assert respuesta.status_code == 201
    db_session.refresh(debito)
    db_session.refresh(factura)
    assert (debito.resultado, debito.pago_id, factura.estado) == (
        "RECHAZADO_SIM",
        None,
        "pendiente",
    )


def test_una_apertura_concurrente_por_periodo(escenario_concurrente):
    client, engine, ids = escenario_concurrente
    with Session(engine) as db:
        motivo = MotivoJustificacion(nombre="Enfermedad")
        db.add(motivo)
        db.flush()
        solicitud = SolicitudAusenciaPeriodo(
            fecha_inicio=date(2026, 11, 24),
            fecha_fin=date(2026, 11, 26),
            familia_id=ids["familia_a"],
            alumno_id=ids["alumno_a"],
            usuario_id=ids["usuario_a"],
            motivo_justificacion_id=motivo.id,
        )
        db.add(solicitud)
        db.flush()
        url = f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}"
        db.commit()
    autenticar(client, ids["usuario_a"], "familia")
    barrera = Barrier(2)

    def abrir():
        barrera.wait(timeout=5)
        return client.post(url, json={"texto": "Consulta", "clave": str(uuid4())}).status_code

    with ThreadPoolExecutor(2) as pool:
        operaciones = [pool.submit(abrir) for _ in range(2)]
        assert sorted(op.result(timeout=10) for op in operaciones) == [201, 409]
    with Session(engine) as db:
        assert db.scalar(select(func.count()).select_from(ConversacionContextual)) == 1
        assert db.scalar(select(func.count()).select_from(MensajeConversacion)) == 1


def test_restricciones_persistentes_de_ambito(db_session, escenario):
    solicitud, familiar, _, _ = escenario
    base = {
        "familia_id": solicitud.familia_id,
        "autor_id": familiar,
        "updated_at": datetime.now(UTC),
    }
    for campos in (
        {"estado": "pendiente_administracion"},
        {"estado": "inventado", "solicitud_periodo_id": solicitud.id},
    ):
        with pytest.raises(IntegrityError), db_session.begin_nested():
            db_session.add(ConversacionContextual(**base, **campos))
            db_session.flush()
    campos = {"estado": "pendiente_administracion", "solicitud_periodo_id": solicitud.id}
    db_session.add(ConversacionContextual(**base, **campos))
    db_session.flush()
    with pytest.raises(IntegrityError), db_session.begin_nested():
        db_session.add(ConversacionContextual(**base, **campos))
        db_session.flush()


def test_permiso_facturacion_no_otorga_acceso_a_justificaciones(client, db_session, escenario):
    solicitud, familiar, admin, _ = escenario
    url = f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}"
    autenticar(client, familiar, "familia")
    assert client.post(url, json={"texto": "Consulta", "clave": str(uuid4())}).status_code == 201
    asignacion = db_session.scalar(
        select(RolPermiso)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(Permiso.codigo == "academico.actualizar:justificaciones")
    )
    db_session.delete(asignacion)
    db_session.commit()
    autenticar(client, admin, "administracion")
    assert client.get(url).status_code == 404
    assert client.get(BASE).json()["items"] == []


def test_adjunto_privado_y_envio_atomico(client, escenario, monkeypatch):
    solicitud, familiar, admin, ajeno = escenario
    monkeypatch.setattr(adjuntos_service, "adjuntos_habilitados", lambda: True)
    monkeypatch.setattr(adjuntos_escaner, "escanear", lambda _: None)
    autenticar(client, familiar, "familia")
    contexto = f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}"
    url = f"{contexto}/con-adjuntos"
    datos = {"texto": "Adjunto documentación", "clave": str(uuid4())}
    incorrecto = client.post(url, data=datos, files={"archivos": ("fake.png", b"no", "image/png")})
    assert incorrecto.status_code == 422
    assert client.get(contexto).json()["conversacion"] is None
    salida = BytesIO()
    Image.new("RGB", (4, 4)).save(salida, format="PNG")
    archivo = salida.getvalue()
    files = {"archivos": ("comprobante.png", archivo, "image/png")}
    creado = client.post(url, data=datos, files=files)
    assert creado.status_code == 201, creado.text
    hilo = creado.json()["id"]
    assert client.post(url, data=datos, files=files).json()["id"] == hilo
    otra_imagen = BytesIO()
    Image.new("RGB", (5, 5)).save(otra_imagen, format="PNG")
    otro = {"archivos": ("comprobante.png", otra_imagen.getvalue(), "image/png")}
    assert client.post(url, data=datos, files=otro).status_code == 409
    assert client.post(contexto, json=datos).status_code == 409
    historial = client.get(f"{BASE}/{hilo}/mensajes").json()["items"]
    assert len(historial) == len(historial[0]["adjuntos"]) == 1
    mensaje = historial[0]
    descarga = f"{BASE}/{hilo}/mensajes/{mensaje['id']}/adjuntos/{mensaje['adjuntos'][0]['id']}"
    autenticar(client, ajeno, "familia")
    assert client.get(descarga).status_code == 404
    autenticar(client, admin, "administracion")
    respuesta = client.get(descarga)
    assert respuesta.content == archivo
    assert respuesta.headers["content-type"] == "image/png"
    assert respuesta.headers["cache-control"] == "private, no-store"
    assert respuesta.headers["x-content-type-options"] == "nosniff"
    assert client.get(descarga.replace(mensaje["id"], str(uuid4()))).status_code == 404

    def sin_escaner(_):
        raise adjuntos_escaner.EscanerNoDisponible()

    monkeypatch.setattr(adjuntos_escaner, "escanear", sin_escaner)
    envio = client.post(
        f"{BASE}/{hilo}/mensajes/con-adjuntos",
        data={"texto": "Otra evidencia", "clave": str(uuid4())},
        files=files,
    )
    assert envio.status_code == 503
    assert client.get(f"{BASE}/{hilo}/mensajes").json()["items"] == historial


def test_aviso_y_email_duradero_sin_divulgar_el_mensaje(
    client, db_session, escenario, escenario_dos_familias, monkeypatch
):
    solicitud, familiar, admin, ajeno = escenario
    vinculo = db_session.get(FamiliaAlumno, escenario_dos_familias["vinculo_a"])
    vinculo.recibe_comunicaciones = True
    db_session.commit()
    autenticar(client, admin, "administracion")
    contexto = f"{BASE}/contextos/solicitud_ausencia_periodo/{solicitud.id}"
    datos = {"texto": "Información privada del trámite", "clave": str(uuid4())}
    hilo = client.post(contexto, json=datos).json()["id"]
    assert client.post(contexto, json=datos).json()["id"] == hilo
    autenticar(client, familiar, "familia")
    avisos = client.get("/notificaciones").json()["items"]
    assert [item["tipo"] for item in avisos] == ["comunicaciones.respuesta_conversacion"]
    assert avisos[0]["destino"]["id"] == hilo
    assert datos["texto"] not in avisos[0]["mensaje"]
    autenticar(client, ajeno, "familia")
    assert not client.get("/notificaciones").json()["items"]
    envio = db_session.scalar(select(EnvioNotificacion))
    assert envio is not None
    assert envio.email == "responsable.a@example.test"
    assert datos["texto"] not in envio.cuerpo

    def rechazar(*_args, **_kwargs):
        assert f"/familia/conversaciones/{hilo}" in _args[3]
        assert datos["texto"] not in _args[3]
        return n8n_client.ResultadoEnvioManual(estado="reintentable", error_codigo="no_conexion")

    monkeypatch.setattr(manuales_service, "_despacho_manual_habilitado", lambda: True)
    monkeypatch.setattr(n8n_client, "enviar_email_manual", rechazar)
    assert manuales_service.procesar_envios_pendientes(db_session).reintentados == 1
    db_session.refresh(envio)
    assert envio.estado == "pendiente"
    autenticar(client, familiar, "familia")
    assert client.get(f"{BASE}/{hilo}/mensajes").json()["items"][0]["texto"] == datos["texto"]
    db_session.delete(vinculo)
    envio.disponible_at = datetime.now(UTC).replace(tzinfo=None)
    db_session.commit()
    assert not client.get("/notificaciones").json()["items"]

    def envio_prohibido(*_args, **_kwargs):
        pytest.fail("una dirección revocada no debe llegar al transporte")

    monkeypatch.setattr(n8n_client, "enviar_email_manual", envio_prohibido)
    assert manuales_service.procesar_envios_pendientes(db_session).fallidos == 1
    db_session.refresh(envio)
    assert envio.estado == "fallido"
