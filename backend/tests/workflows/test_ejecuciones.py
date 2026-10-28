import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from src.models import AuditLog
from src.workflows import despacho_service, ejecuciones_service
from src.workflows.models import WorkflowExecution
from src.workflows.schemas import ResultadoAccion
from tests.workflows.conftest import ahora_utc_naive, crear_ejecucion


def test_listado_filtra_pagina_y_expone_trazabilidad_sin_payload(
    client_autenticado, db_session, tipo_factura_vencida
):
    ahora = ahora_utc_naive()
    _, _, fallida = crear_ejecucion(
        db_session,
        tipo_factura_vencida,
        estado="fallido",
        started_at=ahora,
        nombre="Primera",
    )
    crear_ejecucion(
        db_session,
        tipo_factura_vencida,
        estado="exitoso",
        started_at=ahora + timedelta(minutes=1),
        nombre="Segunda",
    )

    respuesta = client_autenticado.get(
        "/workflows/ejecuciones",
        params={"estado": "fallido", "pagina": 1, "tamanio_pagina": 1},
    )

    assert respuesta.status_code == 200
    pagina = respuesta.json()
    assert pagina["total"] == 1
    assert pagina["total_paginas"] == 1
    assert pagina["pagina"] == 1
    assert pagina["tamanio_pagina"] == 1
    assert len(pagina["items"]) == 1
    item = pagina["items"][0]
    assert item["id"] == str(fallida.id)
    assert item["workflow_rule_nombre"] == "Primera"
    assert item["tipo_accion"] == "notificar"
    assert item["tipo_evento"] == "factura.vencida"
    assert item["entidad"] == "factura"
    assert item["error_detail"] == despacho_service.ERROR_ACCION
    assert "falló el envío" not in item["error_detail"]
    assert "payload" not in item


def test_listado_ordenado_por_inicio_descendente(
    client_autenticado, db_session, tipo_factura_vencida
):
    ahora = ahora_utc_naive()
    _, _, antigua = crear_ejecucion(
        db_session, tipo_factura_vencida, started_at=ahora, nombre="Antigua"
    )
    _, _, nueva = crear_ejecucion(
        db_session,
        tipo_factura_vencida,
        started_at=ahora + timedelta(minutes=1),
        nombre="Nueva",
    )

    items = client_autenticado.get("/workflows/ejecuciones").json()["items"]

    assert [item["id"] for item in items] == [str(nueva.id), str(antigua.id)]


def test_detalle_inexistente_es_404(client_autenticado):
    respuesta = client_autenticado.get(f"/workflows/ejecuciones/{uuid.uuid4()}")

    assert respuesta.status_code == 404


def test_reintento_crea_fila_nueva_y_audita_usuario(
    client_autenticado,
    db_session,
    tipo_factura_vencida,
    usuario_workflows,
    monkeypatch,
):
    _, evento, anterior = crear_ejecucion(db_session, tipo_factura_vencida)
    monkeypatch.setattr(
        despacho_service,
        "ACCIONES",
        {
            "notificar": lambda db, regla, evento, ejecucion: ResultadoAccion(
                detalle="Envío completado"
            )
        },
    )

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{anterior.id}/reintentar")

    assert respuesta.status_code == 201
    nueva = respuesta.json()
    assert nueva["intento"] == 2
    assert nueva["estado"] == "exitoso"
    assert nueva["detalle"] == "Envío completado"
    assert nueva["event_log_id"] == str(evento.id)
    db_session.refresh(anterior)
    assert anterior.estado == "fallido"
    ejecuciones = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.event_log_id == evento.id)
    ).all()
    assert len(ejecuciones) == 2
    auditoria = db_session.scalars(
        select(AuditLog).where(
            AuditLog.entidad == "WORKFLOW_EXECUTION",
            AuditLog.entidad_id == uuid.UUID(nueva["id"]),
        )
    ).one()
    assert auditoria.campo == "__reintento__"
    assert auditoria.usuario_id == usuario_workflows.id


def test_no_reintenta_un_intento_anterior(client_autenticado, db_session, tipo_factura_vencida):
    regla, evento, anterior = crear_ejecucion(db_session, tipo_factura_vencida)
    db_session.add(
        WorkflowExecution(
            intento=2,
            started_at=ahora_utc_naive() + timedelta(minutes=1),
            finished_at=ahora_utc_naive() + timedelta(minutes=1, seconds=1),
            estado="fallido",
            error_detail="segundo fallo",
            workflow_rule_id=regla.id,
            event_log_id=evento.id,
        )
    )
    db_session.commit()

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{anterior.id}/reintentar")

    assert respuesta.status_code == 409
    assert "intento posterior" in respuesta.json()["detail"]


def test_no_reintenta_regla_modificada(client_autenticado, db_session, tipo_factura_vencida):
    regla, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    regla.updated_at = ejecucion.started_at + timedelta(minutes=1)
    db_session.commit()

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert respuesta.status_code == 409
    assert "modificada" in respuesta.json()["detail"]


def test_no_reintenta_regla_inactiva(client_autenticado, db_session, tipo_factura_vencida):
    regla, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    regla.activo = False
    db_session.commit()

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert respuesta.status_code == 409
    assert "inactiva" in respuesta.json()["detail"]


def test_no_reintenta_ejecucion_exitosa(client_autenticado, db_session, tipo_factura_vencida):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida, estado="exitoso")

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert respuesta.status_code == 409
    assert "fallidas" in respuesta.json()["detail"]


def _reintentable(client, ejecucion):
    respuesta = client.get(f"/workflows/ejecuciones/{ejecucion.id}")
    assert respuesta.status_code == 200
    return respuesta.json()["reintentable"]


def test_reintentable_solo_en_el_ultimo_intento_fallido(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, evento, anterior = crear_ejecucion(db_session, tipo_factura_vencida)
    assert _reintentable(client_autenticado, anterior) is True

    posterior = WorkflowExecution(
        intento=2,
        started_at=ahora_utc_naive() + timedelta(minutes=1),
        estado="fallido",
        workflow_rule_id=regla.id,
        event_log_id=evento.id,
    )
    db_session.add(posterior)
    db_session.commit()

    assert _reintentable(client_autenticado, anterior) is False
    assert _reintentable(client_autenticado, posterior) is True


def test_no_reintentable_si_la_regla_esta_inactiva(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    regla.activo = False
    db_session.commit()

    assert _reintentable(client_autenticado, ejecucion) is False


def test_no_reintentable_si_la_regla_fue_modificada(
    client_autenticado, db_session, tipo_factura_vencida
):
    regla, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    regla.updated_at = ejecucion.started_at + timedelta(minutes=1)
    db_session.commit()

    assert _reintentable(client_autenticado, ejecucion) is False


def test_no_reintentable_si_la_ejecucion_no_fallo(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida, estado="exitoso")

    assert _reintentable(client_autenticado, ejecucion) is False


def test_no_permite_repetir_numero_de_intento(db_session, tipo_factura_vencida):
    regla, evento, _ = crear_ejecucion(db_session, tipo_factura_vencida)
    db_session.add(
        WorkflowExecution(
            intento=1,
            estado="fallido",
            workflow_rule_id=regla.id,
            event_log_id=evento.id,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_conflicto_concurrente_de_reintento_es_409(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)

    def simular_conflicto(*args, **kwargs):
        raise IntegrityError("intento duplicado", {}, Exception())

    monkeypatch.setattr(despacho_service, "_procesar_regla", simular_conflicto)

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar")

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == "Otro reintento de esta ejecución ya fue registrado."


def test_historial_exige_autenticacion(client):
    assert client.get("/workflows/ejecuciones").status_code == 401


def test_reintento_exige_actualizacion(client_solo_lectura, db_session, tipo_factura_vencida):
    _, _, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)

    assert client_solo_lectura.get("/workflows/ejecuciones").status_code == 200
    assert (
        client_solo_lectura.post(f"/workflows/ejecuciones/{ejecucion.id}/reintentar").status_code
        == 403
    )


def test_servicio_lista_y_reintenta_sin_reescribir_el_intento_anterior(
    db_session,
    tipo_factura_vencida,
    usuario_workflows,
    monkeypatch,
):
    _, evento, anterior = crear_ejecucion(db_session, tipo_factura_vencida)
    monkeypatch.setattr(
        despacho_service,
        "ACCIONES",
        {
            "notificar": lambda db, regla, evento, ejecucion: ResultadoAccion(
                detalle="Envío completado"
            )
        },
    )

    pagina = ejecuciones_service.listar_ejecuciones(
        db_session,
        estado="fallido",
        pagina=1,
        tamanio_pagina=20,
    )
    nueva = ejecuciones_service.reintentar_ejecucion(db_session, anterior.id, usuario_workflows.id)

    assert pagina.total == 1
    assert pagina.items[0].id == anterior.id
    assert nueva.intento == 2
    assert nueva.estado == "exitoso"
    assert nueva.event_log_id == evento.id
    db_session.refresh(anterior)
    assert anterior.estado == "fallido"


def test_resumen_del_evento_sigue_el_catalogo_y_omite_nulos_y_faltantes(
    client_autenticado, db_session, tipo_factura_vencida
):
    _, evento, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    evento.payload = {"monto_deuda": 120000.0, "dias_vencido": 16, "nombre_familia": None}
    db_session.commit()

    detalle = client_autenticado.get(f"/workflows/ejecuciones/{ejecucion.id}").json()
    listado = client_autenticado.get("/workflows/ejecuciones").json()["items"][0]

    esperado = [
        {"nombre_interno": "dias_vencido", "etiqueta": "Días", "valor": "16"},
        {"nombre_interno": "monto_deuda", "etiqueta": "Monto", "valor": "120.000,00"},
    ]
    assert detalle["resumen_evento"] == esperado
    assert listado["resumen_evento"] == esperado


def test_resumen_del_evento_no_expone_campos_reservados(
    client_autenticado, db_session, tipo_factura_vencida, monkeypatch
):
    monkeypatch.setattr(
        ejecuciones_service,
        "CAMPOS_RESERVADOS_RESUMEN",
        frozenset({("factura.vencida", "nombre_familia")}),
    )
    _, evento, ejecucion = crear_ejecucion(db_session, tipo_factura_vencida)
    evento.payload = {"dias_vencido": 6, "nombre_familia": "Cabral"}
    db_session.commit()

    detalle = client_autenticado.get(f"/workflows/ejecuciones/{ejecucion.id}").json()

    assert [c["nombre_interno"] for c in detalle["resumen_evento"]] == ["dias_vencido"]
