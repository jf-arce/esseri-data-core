import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from src.models import AuditLog
from src.workflows import despacho_service
from src.workflows.models import WorkflowExecution
from src.workflows.schemas import ResultadoAccion
from tests.workflows.conftest import crear_ejecucion

PENDIENTE = "Esperando aprobación humana."


def _pendiente(db, tipo_evento, **kwargs):
    return crear_ejecucion(
        db, tipo_evento, estado="pendiente", requiere_aprobacion_humana=True, **kwargs
    )


def _aprobar(client, ejecucion):
    return client.post(f"/workflows/ejecuciones/{ejecucion.id}/aprobar")


def _rechazar(client, ejecucion, motivo="No corresponde"):
    return client.post(f"/workflows/ejecuciones/{ejecucion.id}/rechazar", json={"motivo": motivo})


def _auditoria(db, ejecucion_id):
    return db.scalars(
        select(AuditLog).where(
            AuditLog.entidad == "WORKFLOW_EXECUTION", AuditLog.entidad_id == ejecucion_id
        )
    ).all()


@pytest.fixture()
def handler_ok(monkeypatch):
    llamadas = []

    def handler(db, regla, evento, ejecucion):
        llamadas.append(ejecucion.id)
        return ResultadoAccion(detalle="Envío completado")

    monkeypatch.setitem(despacho_service.ACCIONES, "notificar", handler)
    return llamadas


def test_aprobar_ejecuta_la_accion_y_audita(
    client_autenticado, db_session, tipo_factura_vencida, usuario_workflows, handler_ok
):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    respuesta = _aprobar(client_autenticado, ejecucion)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "exitoso"
    assert cuerpo["detalle"] == "Envío completado"
    assert cuerpo["aprobable"] is False
    assert handler_ok == [ejecucion.id]
    auditoria = _auditoria(db_session, ejecucion.id)
    assert [(a.campo, a.valor_anterior, a.valor_nuevo) for a in auditoria] == [
        ("__aprobacion__", "pendiente", "exitoso")
    ]
    assert auditoria[0].usuario_id == usuario_workflows.id


def test_aprobar_con_handler_que_devuelve_error_queda_fallido_y_reintentable(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)
    monkeypatch.setitem(
        despacho_service.ACCIONES,
        "notificar",
        lambda db, regla, evento, ejecucion: ResultadoAccion(error="No se pudo enviar"),
    )

    cuerpo = _aprobar(client_autenticado, ejecucion).json()

    assert cuerpo["estado"] == "fallido"
    assert cuerpo["reintentable"] is True
    assert cuerpo["aprobable"] is False
    assert PENDIENTE not in (cuerpo["detalle"] or "")


def test_aprobar_con_handler_que_lanza_queda_fallido_y_reintentable(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    def falla(*args):
        raise RuntimeError("boom")

    monkeypatch.setitem(despacho_service.ACCIONES, "notificar", falla)

    cuerpo = _aprobar(client_autenticado, ejecucion).json()

    assert cuerpo["estado"] == "fallido"
    assert cuerpo["error_detail"] == despacho_service.ERROR_ACCION
    assert cuerpo["reintentable"] is True
    assert PENDIENTE not in (cuerpo["detalle"] or "")


def test_ciclo_aprobar_falla_reintentar_pide_otra_aprobacion(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)
    llamadas = []

    def handler(db, regla, evento, ejecucion):
        llamadas.append(ejecucion.id)
        if len(llamadas) == 1:
            return ResultadoAccion(error="No se pudo enviar")
        return ResultadoAccion(detalle="Envío completado")

    monkeypatch.setitem(despacho_service.ACCIONES, "notificar", handler)

    assert _aprobar(client_autenticado, ejecucion).json()["estado"] == "fallido"
    reintento = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")
    assert reintento.status_code == 201
    nueva = reintento.json()
    assert nueva["estado"] == "pendiente"
    assert nueva["intento"] == 2
    assert nueva["aprobable"] is True
    assert len(llamadas) == 1

    aprobada = client_autenticado.post(f"/workflows/ejecuciones/{nueva['id']}/aprobar")

    assert aprobada.status_code == 200
    assert aprobada.json()["estado"] == "exitoso"
    assert len(llamadas) == 2


@pytest.mark.parametrize("estado", ["exitoso", "fallido", "rechazado"])
def test_aprobar_una_ejecucion_no_pendiente_es_409(
    client_autenticado, db_session, tipo_factura_vencida, handler_ok, estado
):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida, estado=estado)

    assert _aprobar(client_autenticado, ejecucion).status_code == 409
    assert handler_ok == []


def test_aprobar_con_regla_inactiva_es_409(
    client_autenticado, db_session, tipo_factura_vencida, handler_ok
):
    regla, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)
    regla.activo = False
    db_session.commit()

    respuesta = _aprobar(client_autenticado, ejecucion)

    assert respuesta.status_code == 409
    assert "inactiva" in respuesta.json()["detail"]
    assert handler_ok == []


def test_aprobar_con_regla_editada_despues_es_409(
    client_autenticado, db_session, tipo_factura_vencida, handler_ok
):
    regla, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)
    regla.updated_at = ejecucion.started_at + timedelta(minutes=1)
    db_session.commit()

    respuesta = _aprobar(client_autenticado, ejecucion)

    assert respuesta.status_code == 409
    assert "cambió" in respuesta.json()["detail"]
    assert handler_ok == []


def test_aprobar_inexistente_es_404(client_autenticado):
    assert (
        client_autenticado.post(f"/workflows/ejecuciones/{uuid.uuid4()}/aprobar").status_code == 404
    )


def test_rechazar_deja_rechazada_y_audita(
    client_autenticado, db_session, tipo_factura_vencida, usuario_workflows, handler_ok
):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    respuesta = _rechazar(client_autenticado, ejecucion, "  Monto incorrecto  ")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "rechazado"
    assert cuerpo["detalle"] == "Rechazada: Monto incorrecto"
    assert cuerpo["finished_at"] is not None
    assert cuerpo["reintentable"] is False
    assert cuerpo["aprobable"] is False
    assert handler_ok == []
    auditoria = _auditoria(db_session, ejecucion.id)
    assert [(a.campo, a.valor_nuevo) for a in auditoria] == [("__rechazo__", "Monto incorrecto")]
    assert auditoria[0].usuario_id == usuario_workflows.id


def test_rechazar_funciona_con_regla_inactiva_o_editada(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, _, inactiva = _pendiente(db_session, tipo_factura_vencida, nombre="Inactiva")
    regla.activo = False
    regla_2, _, editada = _pendiente(db_session, tipo_factura_vencida, nombre="Editada")
    regla_2.updated_at = editada.started_at + timedelta(minutes=1)
    db_session.commit()

    assert _rechazar(client_autenticado, inactiva).json()["estado"] == "rechazado"
    assert _rechazar(client_autenticado, editada).json()["estado"] == "rechazado"


@pytest.mark.parametrize("cuerpo", [{}, {"motivo": ""}, {"motivo": "   "}])
def test_rechazar_sin_motivo_es_422(client_autenticado, db_session, tipo_factura_vencida, cuerpo):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    respuesta = client_autenticado.post(
        f"/workflows/ejecuciones/{ejecucion.id}/rechazar", json=cuerpo
    )

    assert respuesta.status_code == 422
    db_session.refresh(ejecucion)
    assert ejecucion.estado == "pendiente"


def test_rechazar_dos_veces_es_409(client_autenticado, db_session, tipo_factura_vencida):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    assert _rechazar(client_autenticado, ejecucion).status_code == 200
    assert _rechazar(client_autenticado, ejecucion).status_code == 409
    assert len(_auditoria(db_session, ejecucion.id)) == 1


def test_una_rechazada_no_se_puede_reintentar(client_autenticado, db_session, tipo_factura_vencida):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)
    _rechazar(client_autenticado, ejecucion)

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert respuesta.status_code == 409


def test_listado_expone_aprobable_y_filtra_rechazadas(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, _, pendiente = _pendiente(db_session, tipo_factura_vencida, nombre="Pendiente")
    regla, _, inactiva = _pendiente(db_session, tipo_factura_vencida, nombre="Inactiva")
    regla.activo = False
    _, _, rechazada = _pendiente(db_session, tipo_factura_vencida, nombre="Rechazada")
    rechazada.estado = "rechazado"
    db_session.commit()

    items = client_autenticado.get("/workflows/ejecuciones").json()["items"]
    aprobables = {item["id"]: item["aprobable"] for item in items}
    assert aprobables == {
        str(pendiente.id): True,
        str(inactiva.id): False,
        str(rechazada.id): False,
    }

    filtradas = client_autenticado.get("/workflows/ejecuciones", params={"estado": "rechazado"})
    assert [item["id"] for item in filtradas.json()["items"]] == [str(rechazada.id)]


def test_decidir_exige_actualizacion(client_solo_lectura, db_session, tipo_factura_vencida):
    _, _, ejecucion = _pendiente(db_session, tipo_factura_vencida)

    assert _aprobar(client_solo_lectura, ejecucion).status_code == 403
    assert _rechazar(client_solo_lectura, ejecucion).status_code == 403
    estado = db_session.scalar(
        select(WorkflowExecution.estado).where(WorkflowExecution.id == ejecucion.id)
    )
    assert estado == "pendiente"
