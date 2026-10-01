import uuid

import pytest
from sqlalchemy import select

from src.models import EventLog
from src.workflows import despacho_service
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.eventos_service import emit_event
from src.workflows.models import WorkflowExecution, WorkflowRule


def _regla(db, tipo, **extra):
    regla = WorkflowRule(
        nombre=extra.pop("nombre", "Avisar mora"),
        condicion=extra.pop("condicion", {}),
        tipo_accion=extra.pop("tipo_accion", "notificar"),
        accion_config=extra.pop("accion_config", None),
        criticidad="media",
        requiere_aprobacion_humana=extra.pop("requiere_aprobacion_humana", False),
        activo=extra.pop("activo", True),
        tipo_evento_id=tipo.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _evento(db, payload=None):
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 10} if payload is None else payload,
    )
    db.commit()
    return evento


@pytest.fixture()
def acciones(monkeypatch):
    registro = {}
    monkeypatch.setattr(despacho_service, "ACCIONES", registro)
    return registro


def test_evento_sin_reglas_queda_procesado(db_session, tipo_factura_vencida):
    evento = _evento(db_session)

    resumen = procesar_eventos_pendientes(db_session)

    assert resumen.eventos_procesados == 1
    assert resumen.ejecuciones_creadas == 0
    assert db_session.get(EventLog, evento.id).estado == "procesado"


def test_regla_activa_genera_ejecucion_exitosa(db_session, tipo_factura_vencida, acciones):
    acciones["notificar"] = lambda db, regla, evento: "enviado"
    regla = _regla(db_session, tipo_factura_vencida)
    evento = _evento(db_session)

    resumen = procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert resumen.ejecuciones_creadas == 1
    assert ejecucion.workflow_rule_id == regla.id
    assert ejecucion.event_log_id == evento.id
    assert ejecucion.estado == "exitoso"
    assert ejecucion.detalle == "enviado"
    assert ejecucion.intento == 1
    assert ejecucion.finished_at is not None


def test_regla_inactiva_se_ignora(db_session, tipo_factura_vencida):
    _regla(db_session, tipo_factura_vencida, activo=False)
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    assert db_session.scalars(select(WorkflowExecution)).all() == []


def test_accion_sin_implementar_falla_la_ejecucion_no_el_evento(
    db_session, tipo_factura_vencida, acciones
):
    _regla(db_session, tipo_factura_vencida)
    evento = _evento(db_session)

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert "no está implementada" in ejecucion.error_detail
    assert db_session.get(EventLog, evento.id).estado == "procesado"


def test_accion_que_lanza_queda_fallida_y_no_corta_las_demas(
    db_session, tipo_factura_vencida, acciones
):
    def rota(db, regla, evento):
        raise RuntimeError("n8n no responde")

    acciones["notificar"] = rota
    acciones["alerta_interna"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida, nombre="A", tipo_accion="notificar")
    _regla(db_session, tipo_factura_vencida, nombre="B", tipo_accion="alerta_interna")
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    estados = {e.estado: e for e in db_session.scalars(select(WorkflowExecution))}
    assert set(estados) == {"fallido", "exitoso"}
    assert estados["fallido"].error_detail == despacho_service.ERROR_ACCION
    assert "n8n no responde" not in estados["fallido"].error_detail


def test_aprobacion_humana_deja_la_ejecucion_pendiente_sin_ejecutar(
    db_session, tipo_factura_vencida, acciones
):
    llamadas = []
    acciones["aplicar_penalidad"] = lambda db, regla, evento: llamadas.append(regla.id)
    _regla(
        db_session,
        tipo_factura_vencida,
        tipo_accion="aplicar_penalidad",
        requiere_aprobacion_humana=True,
    )
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "pendiente"
    assert llamadas == []


def test_no_reprocesa_eventos_ya_despachados(db_session, tipo_factura_vencida, acciones):
    acciones["notificar"] = lambda db, regla, evento: None
    _regla(db_session, tipo_factura_vencida)
    _evento(db_session)

    procesar_eventos_pendientes(db_session)
    segunda = procesar_eventos_pendientes(db_session)

    assert segunda.eventos_procesados == 0
    assert len(db_session.scalars(select(WorkflowExecution)).all()) == 1


def test_error_inesperado_marca_el_evento_fallido_y_sigue(
    db_session, tipo_factura_vencida, monkeypatch
):
    primero = _evento(db_session)
    segundo = _evento(db_session)
    original = despacho_service._despachar_evento

    def despachar(db, evento):
        if evento.id == primero.id:
            raise RuntimeError("boom")
        return original(db, evento)

    monkeypatch.setattr(despacho_service, "_despachar_evento", despachar)

    resumen = procesar_eventos_pendientes(db_session)

    assert resumen.eventos_fallidos == 1
    assert resumen.eventos_procesados == 1
    assert db_session.get(EventLog, primero.id).estado == "fallido"
    assert db_session.get(EventLog, segundo.id).estado == "procesado"


def test_respeta_el_limite_por_pasada(db_session, tipo_factura_vencida):
    for _ in range(3):
        _evento(db_session)

    resumen = procesar_eventos_pendientes(db_session, limite=2)

    assert resumen.eventos_procesados == 2
    pendientes = db_session.scalars(select(EventLog).where(EventLog.estado == "pendiente")).all()
    assert len(pendientes) == 1


def test_endpoint_procesar_devuelve_resumen(client_autenticado, db_session, tipo_factura_vencida):
    _evento(db_session)

    respuesta = client_autenticado.post("/workflows/procesar")

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "eventos_procesados": 1,
        "eventos_fallidos": 0,
        "ejecuciones_creadas": 0,
    }


def test_endpoint_procesar_exige_permiso(client_solo_lectura):
    assert client_solo_lectura.post("/workflows/procesar").status_code == 403


# --- Condición y revalidación de la regla ------------------------------------------------


def _condicion(operador, valor, campo="dias_vencido"):
    return {"campo": campo, "operador": operador, "valor": valor}


def _ejecuciones(db):
    return db.scalars(select(WorkflowExecution)).all()


@pytest.mark.parametrize(
    ("operador", "valor", "se_ejecuta"),
    [
        (">", 5, True),
        (">", 6, False),
        (">=", 6, True),
        ("<", 7, True),
        ("<=", 5, False),
        ("==", 6, True),
        ("!=", 6, False),
        ("==", 6.0, True),
    ],
)
def test_condicion_decide_si_la_regla_se_ejecuta(
    db_session, tipo_factura_vencida, acciones, operador, valor, se_ejecuta
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida, condicion=_condicion(operador, valor))
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    assert len(_ejecuciones(db_session)) == (1 if se_ejecuta else 0)


def test_condicion_no_cumplida_no_cuenta_como_ejecucion_y_el_evento_queda_procesado(
    db_session, tipo_factura_vencida, acciones
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida, condicion=_condicion(">", 30))
    evento = _evento(db_session)

    resumen = procesar_eventos_pendientes(db_session)

    assert resumen.ejecuciones_creadas == 0
    assert db_session.get(EventLog, evento.id).estado == "procesado"


def test_condicion_de_texto_con_contiene_ignora_mayusculas(
    db_session, tipo_factura_vencida, acciones
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    _regla(
        db_session,
        tipo_factura_vencida,
        condicion=_condicion("contiene", "PÉREZ", "nombre_familia"),
    )
    _evento(db_session, {"dias_vencido": 6, "monto_deuda": 10, "nombre_familia": "Familia Pérez"})

    procesar_eventos_pendientes(db_session)

    assert len(_ejecuciones(db_session)) == 1


@pytest.mark.parametrize(
    "payload",
    [
        {"monto_deuda": 10},
        {"dias_vencido": None, "monto_deuda": 10},
        {"dias_vencido": True, "monto_deuda": 10},
        {"dias_vencido": "seis", "monto_deuda": 10},
        {"dias_vencido": [6], "monto_deuda": 10},
    ],
)
def test_payload_no_evaluable_deja_la_ejecucion_fallida(
    db_session, tipo_factura_vencida, acciones, payload
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida, condicion=_condicion(">", 5))
    evento = _evento(db_session, payload)

    procesar_eventos_pendientes(db_session)

    ejecucion = _ejecuciones(db_session)[0]
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == despacho_service.ERROR_EVALUACION
    assert db_session.get(EventLog, evento.id).estado == "procesado"


def test_regla_que_no_se_puede_evaluar_no_corta_a_las_demas(
    db_session, tipo_factura_vencida, acciones
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    acciones["alerta_interna"] = lambda db, regla, evento: "ok"
    _regla(
        db_session,
        tipo_factura_vencida,
        nombre="A rota",
        tipo_accion="notificar",
        condicion=_condicion(">", 5, "campo_que_no_existe"),
    )
    _regla(db_session, tipo_factura_vencida, nombre="B sana", tipo_accion="alerta_interna")
    evento = _evento(db_session)

    resumen = procesar_eventos_pendientes(db_session)

    estados = {e.workflow_rule_id: e.estado for e in _ejecuciones(db_session)}
    assert sorted(estados.values()) == ["exitoso", "fallido"]
    assert resumen.eventos_procesados == 1
    assert db_session.get(EventLog, evento.id).estado == "procesado"


def test_config_invalida_guardada_directo_en_la_base_deja_fallido(
    db_session, tipo_factura_vencida, acciones
):
    llamadas = []
    acciones["notificar"] = lambda db, regla, evento: llamadas.append(regla.id)
    _regla(db_session, tipo_factura_vencida, accion_config={"tabla": "usuario"})
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    ejecucion = _ejecuciones(db_session)[0]
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == despacho_service.ERROR_CONFIGURACION
    assert llamadas == []


def test_config_invalida_falla_tambien_con_aprobacion_humana(db_session, tipo_factura_vencida):
    _regla(
        db_session,
        tipo_factura_vencida,
        tipo_accion="generar_cargo",
        requiere_aprobacion_humana=True,
    )
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    assert _ejecuciones(db_session)[0].estado == "fallido"


def test_accion_con_config_null_que_no_tiene_obligatorios_se_ejecuta(
    db_session, tipo_factura_vencida, acciones
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    acciones["aplicar_vencimiento"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida, nombre="A", tipo_accion="notificar")
    _regla(db_session, tipo_factura_vencida, nombre="B", tipo_accion="aplicar_vencimiento")
    _evento(db_session)

    procesar_eventos_pendientes(db_session)

    assert [e.estado for e in _ejecuciones(db_session)] == ["exitoso", "exitoso"]


def test_evento_con_entidad_no_canonica_deja_las_ejecuciones_fallidas(
    db_session, tipo_factura_vencida, acciones
):
    acciones["notificar"] = lambda db, regla, evento: "ok"
    _regla(db_session, tipo_factura_vencida)
    evento = EventLog(
        actor_tipo="sistema",
        estado="pendiente",
        entidad="tarea",
        entidad_id=uuid.uuid4(),
        tipo_evento_id=tipo_factura_vencida.id,
        payload={},
    )
    db_session.add(evento)
    db_session.commit()

    procesar_eventos_pendientes(db_session)

    ejecucion = _ejecuciones(db_session)[0]
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == despacho_service.ERROR_EVALUACION
