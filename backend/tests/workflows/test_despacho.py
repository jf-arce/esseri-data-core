import uuid

import pytest
from sqlalchemy import select

from src.models import EventLog
from src.workflows import service
from src.workflows.models import WorkflowExecution, WorkflowRule
from src.workflows.service import emit_event, procesar_eventos_pendientes


def _regla(db, tipo, **extra):
    regla = WorkflowRule(
        nombre=extra.pop("nombre", "Avisar mora"),
        condicion={},
        tipo_accion=extra.pop("tipo_accion", "notificar"),
        criticidad="media",
        requiere_aprobacion_humana=extra.pop("requiere_aprobacion_humana", False),
        activo=extra.pop("activo", True),
        tipo_evento_id=tipo.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _evento(db):
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=uuid.uuid4(),
        payload={"dias_vencido": 6, "monto_deuda": 10},
    )
    db.commit()
    return evento


@pytest.fixture()
def acciones(monkeypatch):
    registro = {}
    monkeypatch.setattr(service, "ACCIONES", registro)
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
    assert estados["fallido"].error_detail == "n8n no responde"


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
    original = service._despachar_evento

    def despachar(db, evento):
        if evento.id == primero.id:
            raise RuntimeError("boom")
        return original(db, evento)

    monkeypatch.setattr(service, "_despachar_evento", despachar)

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
