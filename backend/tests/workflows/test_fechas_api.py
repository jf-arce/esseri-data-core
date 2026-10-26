"""Los instantes de Workflows salen en UTC con zona; se compara el instante, no solo el sufijo."""

from datetime import UTC, datetime, timedelta

from src.models import EventLog
from src.workflows.models import Notificacion, NotificacionTemplate, Tarea
from tests.workflows.conftest import crear_ejecucion

INICIO = datetime(2026, 10, 26, 13, 0, 0, 123456)


def _instante(valor: str) -> datetime:
    parseado = datetime.fromisoformat(valor)
    assert parseado.utcoffset() == timedelta(0)
    return parseado


def _esperado(naive: datetime) -> datetime:
    return naive.replace(tzinfo=UTC)


def _cerca_de_ahora(valor: str) -> bool:
    return abs(_instante(valor) - datetime.now(UTC)) < timedelta(minutes=1)


def test_ejecucion_exitosa_devuelve_inicio_y_fin_como_utc(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, evento, ejecucion = crear_ejecucion(
        db_session, tipo_factura_vencida, estado="exitoso", started_at=INICIO
    )

    datos = client_autenticado.get(f"/workflows/ejecuciones/{ejecucion.id}").json()

    assert _instante(datos["started_at"]) == _esperado(INICIO)
    assert _instante(datos["finished_at"]) == _esperado(INICIO) + timedelta(seconds=1)
    assert _instante(datos["evento_timestamp"]) == _esperado(evento.timestamp)


def test_ejecucion_fallida_devuelve_inicio_y_fin_como_utc(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, _, ejecucion = crear_ejecucion(
        db_session, tipo_factura_vencida, estado="fallido", started_at=INICIO
    )

    item = client_autenticado.get("/workflows/ejecuciones").json()["items"][0]

    assert _instante(item["started_at"]) == _esperado(INICIO)
    assert _instante(item["finished_at"]) == _esperado(INICIO) + timedelta(seconds=1)


def test_ejecucion_rechazada_registra_el_fin_en_utc(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida, estado="pendiente")

    respuesta = client_autenticado.post(
        f"/workflows/ejecuciones/{ejecucion.id}/rechazar", json={"motivo": "No corresponde"}
    )

    datos = respuesta.json()
    assert respuesta.status_code == 200
    assert _cerca_de_ahora(datos["finished_at"])
    assert _instante(datos["finished_at"]) - _instante(datos["started_at"]) < timedelta(minutes=1)


def test_notificacion_devuelve_sus_instantes_como_utc(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, _, ejecucion = crear_ejecucion(
        db_session, tipo_factura_vencida, estado="exitoso", started_at=INICIO
    )
    enviada = INICIO + timedelta(minutes=5)
    notificacion = Notificacion(
        destinatario_tipo="usuario",
        destinatario_snapshot="a@esseri.edu.ar",
        asunto_snapshot="Asunto",
        cuerpo_snapshot="Cuerpo",
        estado_envio="enviado",
        sent_at=enviada,
        workflow_execution_id=ejecucion.id,
    )
    db_session.add(notificacion)
    db_session.commit()

    item = client_autenticado.get("/workflows/notificaciones").json()["items"][0]

    assert _instante(item["sent_at"]) == _esperado(enviada)
    assert _instante(item["ejecucion_started_at"]) == _esperado(INICIO)


def test_tarea_y_su_cadena_devuelven_los_instantes_como_utc(
    client_autenticado, db_session, usuario_workflows, tipo_factura_vencida
):
    evento = EventLog(
        actor_tipo="sistema",
        entidad="factura",
        entidad_id=usuario_workflows.id,
        payload={},
        tipo_evento_id=tipo_factura_vencida.id,
    )
    db_session.add(evento)
    db_session.commit()
    vencimiento = INICIO + timedelta(days=5)
    tarea = Tarea(
        entidad="factura",
        entidad_id=evento.entidad_id,
        titulo="Reclamar deuda",
        estado="pendiente",
        prioridad="media",
        usuario_id=usuario_workflows.id,
        fecha_vencimiento=vencimiento,
    )
    db_session.add(tarea)
    db_session.commit()

    datos = client_autenticado.get(f"/workflows/tareas/{tarea.id}").json()

    assert _instante(datos["fecha_vencimiento"]) == _esperado(vencimiento)
    assert _cerca_de_ahora(datos["created_at"])
    assert _cerca_de_ahora(datos["updated_at"])
    assert _cerca_de_ahora(datos["cadena"][0]["created_at"])


def test_regla_y_plantilla_devuelven_created_y_updated_como_utc(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, _, _ = crear_ejecucion(db_session, tipo_factura_vencida)
    db_session.add(NotificacionTemplate(nombre="Aviso", asunto="Asunto", cuerpo="Cuerpo"))
    db_session.commit()

    regla_api = client_autenticado.get(f"/workflows/reglas/{regla.id}").json()
    plantilla_api = client_autenticado.get("/workflows/plantillas").json()[0]

    for datos in (regla_api, plantilla_api):
        assert _cerca_de_ahora(datos["created_at"])
        assert _cerca_de_ahora(datos["updated_at"])
