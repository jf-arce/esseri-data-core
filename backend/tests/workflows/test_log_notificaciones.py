import uuid
from datetime import datetime, timedelta

from src.auth.constants import ACCION_CREAR
from src.auth.models import Usuario
from src.models import EventLog
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    WorkflowExecution,
    WorkflowRule,
)
from tests.workflows.conftest import _crear_usuario_con_permisos, _login

URL = "/workflows/notificaciones"
INICIO = datetime(2026, 5, 1, 10, 0, 0)


def _regla(db, tipo, nombre="Avisar mora"):
    regla = WorkflowRule(
        nombre=nombre,
        condicion={},
        tipo_accion="notificar",
        accion_config={"destinatario": "destinatarios_regla"},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _evento(db, tipo):
    evento = EventLog(
        actor_tipo="sistema",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={},
        tipo_evento_id=tipo.id,
    )
    db.add(evento)
    db.commit()
    return evento


def _ejecucion(db, regla, evento, *, started_at=INICIO, intento=1):
    ejecucion = WorkflowExecution(
        workflow_rule_id=regla.id,
        event_log_id=evento.id,
        intento=intento,
        started_at=started_at,
    )
    db.add(ejecucion)
    db.commit()
    return ejecucion


def _notificacion(
    db,
    ejecucion,
    destinatario="a@esseri.edu.ar",
    *,
    estado="enviado",
    tipo="usuario",
    asunto="Asunto",
    cuerpo="Cuerpo con datos",
):
    notificacion = Notificacion(
        destinatario_tipo=tipo,
        destinatario_snapshot=destinatario,
        asunto_snapshot=asunto,
        cuerpo_snapshot=cuerpo,
        estado_envio=estado,
        sent_at=INICIO if estado == "enviado" else None,
        workflow_execution_id=ejecucion.id,
    )
    db.add(notificacion)
    db.commit()
    return notificacion


def _escenario(db, tipo, *, started_at=INICIO, nombre="Avisar mora"):
    regla = _regla(db, tipo, nombre)
    ejecucion = _ejecucion(db, regla, _evento(db, tipo), started_at=started_at)
    return regla, ejecucion


def _destinatarios(client, **params):
    items = client.get(URL, params=params).json()["items"]
    return [item["destinatario_snapshot"] for item in items]


def test_listado_pagina_y_no_incluye_el_cuerpo(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, ejecucion = _escenario(db_session, tipo_factura_vencida)
    for i in range(5):
        _notificacion(db_session, ejecucion, f"u{i}@esseri.edu.ar")

    respuesta = client_autenticado.get(URL, params={"pagina": 2, "tamanio_pagina": 2})

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert (datos["total"], datos["pagina"], datos["tamanio_pagina"], datos["total_paginas"]) == (
        5,
        2,
        2,
        3,
    )
    assert [item["destinatario_snapshot"] for item in datos["items"]] == [
        "u2@esseri.edu.ar",
        "u3@esseri.edu.ar",
    ]
    assert all("cuerpo_snapshot" not in item for item in datos["items"])
    item = datos["items"][0]
    assert item["workflow_rule_nombre"] == "Avisar mora"
    assert item["intento"] == 1
    assert item["ejecucion_started_at"] == INICIO.isoformat()


def test_listado_vacio(client_autenticado):
    datos = client_autenticado.get(URL).json()

    assert datos["items"] == []
    assert datos["total"] == 0
    assert datos["total_paginas"] == 0


def test_filtra_por_estado_tipo_y_ejecucion(client_autenticado, db_session, tipo_factura_vencida):
    _, primera = _escenario(db_session, tipo_factura_vencida)
    _, segunda = _escenario(
        db_session, tipo_factura_vencida, started_at=INICIO + timedelta(hours=1)
    )
    _notificacion(db_session, primera, "ok@esseri.edu.ar", estado="enviado")
    _notificacion(db_session, primera, "mal@esseri.edu.ar", estado="fallido")
    _notificacion(db_session, segunda, "fam@esseri.edu.ar", tipo="familia", estado="pendiente")

    assert _destinatarios(client_autenticado, estado_envio="fallido") == ["mal@esseri.edu.ar"]
    assert _destinatarios(client_autenticado, destinatario_tipo="familia") == ["fam@esseri.edu.ar"]
    assert _destinatarios(client_autenticado, workflow_execution_id=str(primera.id)) == [
        "mal@esseri.edu.ar",
        "ok@esseri.edu.ar",
    ]


def test_ordena_la_ejecucion_mas_reciente_primero(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, vieja = _escenario(db_session, tipo_factura_vencida)
    _, nueva = _escenario(db_session, tipo_factura_vencida, started_at=INICIO + timedelta(days=1))
    _notificacion(db_session, vieja, "vieja@esseri.edu.ar")
    _notificacion(db_session, nueva, "nueva@esseri.edu.ar")

    assert _destinatarios(client_autenticado) == ["nueva@esseri.edu.ar", "vieja@esseri.edu.ar"]


def test_con_inicios_iguales_las_filas_de_cada_ejecucion_quedan_juntas(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, primera = _escenario(db_session, tipo_factura_vencida)
    _, segunda = _escenario(db_session, tipo_factura_vencida)
    for ejecucion in (primera, segunda):
        _notificacion(db_session, ejecucion, "a@esseri.edu.ar")
        _notificacion(db_session, ejecucion, "b@esseri.edu.ar")

    items = client_autenticado.get(URL).json()["items"]

    ejecuciones = [item["workflow_execution_id"] for item in items]
    assert ejecuciones[0] == ejecuciones[1]
    assert ejecuciones[2] == ejecuciones[3]
    assert ejecuciones[0] != ejecuciones[2]


def test_las_fallidas_sin_sent_at_no_se_pierden(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, ejecucion = _escenario(db_session, tipo_factura_vencida)
    _notificacion(db_session, ejecucion, "a@esseri.edu.ar", estado="fallido")
    _notificacion(db_session, ejecucion, "b@esseri.edu.ar", estado="enviado")

    items = client_autenticado.get(URL).json()["items"]

    assert [(i["destinatario_snapshot"], i["sent_at"]) for i in items] == [
        ("a@esseri.edu.ar", None),
        ("b@esseri.edu.ar", INICIO.isoformat()),
    ]


def test_un_reintento_suma_filas_y_conserva_las_del_intento_anterior(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla = _regla(db_session, tipo_factura_vencida)
    evento = _evento(db_session, tipo_factura_vencida)
    primero = _ejecucion(db_session, regla, evento)
    segundo = _ejecucion(
        db_session, regla, evento, started_at=INICIO + timedelta(minutes=5), intento=2
    )
    _notificacion(db_session, primero, "a@esseri.edu.ar", estado="fallido")
    _notificacion(db_session, segundo, "a@esseri.edu.ar", estado="enviado")

    items = client_autenticado.get(URL).json()["items"]

    assert [(i["intento"], i["estado_envio"]) for i in items] == [(2, "enviado"), (1, "fallido")]


def test_detalle_incluye_el_cuerpo(client_autenticado, db_session, tipo_factura_vencida):
    _, ejecucion = _escenario(db_session, tipo_factura_vencida)
    notificacion = _notificacion(db_session, ejecucion, cuerpo="Debe 1500")

    respuesta = client_autenticado.get(f"{URL}/{notificacion.id}")

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["cuerpo_snapshot"] == "Debe 1500"
    assert datos["workflow_rule_nombre"] == "Avisar mora"


def test_detalle_inexistente_es_404(client_autenticado):
    assert client_autenticado.get(f"{URL}/{uuid.uuid4()}").status_code == 404


def test_el_log_no_cambia_si_se_edita_la_plantilla_o_el_usuario(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, ejecucion = _escenario(db_session, tipo_factura_vencida)
    usuario = Usuario(
        email="dest@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    plantilla = NotificacionTemplate(nombre="Mora", asunto="Asunto viejo", cuerpo="Cuerpo viejo")
    db_session.add_all([usuario, plantilla])
    db_session.flush()
    regla.notificacion_template_id = plantilla.id
    notificacion = _notificacion(
        db_session,
        ejecucion,
        "dest@esseri.edu.ar",
        asunto="Asunto viejo",
        cuerpo="Cuerpo viejo",
    )
    notificacion.usuario_id = usuario.id
    db_session.commit()

    plantilla.asunto = "Asunto nuevo"
    plantilla.cuerpo = "Cuerpo nuevo"
    usuario.email = "otro@esseri.edu.ar"
    db_session.commit()

    datos = client_autenticado.get(f"{URL}/{notificacion.id}").json()
    assert datos["destinatario_snapshot"] == "dest@esseri.edu.ar"
    assert datos["asunto_snapshot"] == "Asunto viejo"
    assert datos["cuerpo_snapshot"] == "Cuerpo viejo"


def test_sin_sesion_es_401(client):
    assert client.get(URL).status_code == 401
    assert client.get(f"{URL}/{uuid.uuid4()}").status_code == 401


def test_sin_permiso_de_lectura_es_403(client, db_session):
    usuario = _crear_usuario_con_permisos(db_session, "sin-leer@esseri.edu.ar", (ACCION_CREAR,))
    _login(client, usuario)

    assert client.get(URL).status_code == 403
    assert client.get(f"{URL}/{uuid.uuid4()}").status_code == 403


def test_solo_lectura_puede_consultar_el_log(client_solo_lectura, db_session, tipo_factura_vencida):
    _, ejecucion = _escenario(db_session, tipo_factura_vencida)
    notificacion = _notificacion(db_session, ejecucion)

    assert client_solo_lectura.get(URL).status_code == 200
    assert client_solo_lectura.get(f"{URL}/{notificacion.id}").status_code == 200


def test_filtros_y_paginacion_invalidos_son_422(client_autenticado):
    for params in (
        {"estado_envio": "inventado"},
        {"destinatario_tipo": "robot"},
        {"workflow_execution_id": "no-es-uuid"},
        {"pagina": 0},
        {"tamanio_pagina": 0},
        {"tamanio_pagina": 101},
    ):
        assert client_autenticado.get(URL, params=params).status_code == 422, params


def test_el_log_es_de_solo_lectura(client_autenticado, db_session, tipo_factura_vencida):
    _, ejecucion = _escenario(db_session, tipo_factura_vencida)
    notificacion = _notificacion(db_session, ejecucion)

    assert client_autenticado.post(URL, json={}).status_code == 405
    for metodo in ("patch", "put", "delete"):
        respuesta = getattr(client_autenticado, metodo)(f"{URL}/{notificacion.id}")
        assert respuesta.status_code == 405, metodo
