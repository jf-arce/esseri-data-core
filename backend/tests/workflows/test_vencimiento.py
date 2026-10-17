"""Vencimiento y cambio explícito de estado desde eventos de facturación."""

import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import ExcepcionVencimiento, Factura, ResponsableEconomico
from src.familias_alumnos.models import Familia
from src.models import Persona
from src.workflows.acciones_vencimiento_service import (
    ejecutar_aplicar_vencimiento,
    ejecutar_cambiar_estado,
)
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.eventos_service import emit_event
from src.workflows.models import WorkflowExecution, WorkflowRule
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _hoy():
    return datetime.now(ZoneInfo("America/Argentina/Buenos_Aires")).date()


@pytest.fixture()
def caso(db_session, tipo_factura_vencida):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=_hoy() - timedelta(days=90),
        vigencia_hasta=_hoy() - timedelta(days=1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    db_session.add(responsable)
    db_session.flush()
    factura = Factura(
        fecha_emision=_hoy() - timedelta(days=40),
        fecha_vencimiento=_hoy() - timedelta(days=10),
        monto_total=100,
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.flush()
    regla = WorkflowRule(
        nombre="Vencer factura",
        condicion={},
        tipo_accion="aplicar_vencimiento",
        accion_config={},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo_factura_vencida.id,
    )
    db_session.add(regla)
    db_session.commit()
    return factura, responsable, regla


def _evento(db, factura_id):
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=factura_id,
        payload={"dias_vencido": 6, "monto_deuda": 100, "nombre_familia": "Cabral"},
    )
    db.commit()
    return evento


def _ejecutar(db, factura, regla, handler=ejecutar_aplicar_vencimiento):
    evento = _evento(db, factura.id)
    return handler(db, regla, evento, WorkflowExecution())


def _excepcion(db, familia_id, fecha):
    usuario_id = db.scalar(select(Usuario.id))
    db.add(
        ExcepcionVencimiento(
            fecha_vencimiento_excepcional=fecha,
            familia_id=familia_id,
            usuario_id=usuario_id,
        )
    )
    db.commit()


@pytest.mark.parametrize("dias", [-1, 0, 1])
def test_aplicar_vencimiento_respeta_dia_exacto(db_session, caso, dias):
    factura, _, regla = caso
    factura.fecha_vencimiento = _hoy() + timedelta(days=dias)
    db_session.commit()

    resultado = _ejecutar(db_session, factura, regla)

    assert resultado.error is None
    assert factura.estado == ("vencida" if dias < 0 else "pendiente")


def test_excepcion_mas_lejana_de_la_familia_posterga_vencimiento(db_session, caso):
    factura, responsable, regla = caso
    _excepcion(db_session, responsable.familia_id, _hoy() - timedelta(days=1))
    _excepcion(db_session, responsable.familia_id, _hoy() + timedelta(days=5))

    resultado = _ejecutar(db_session, factura, regla)

    assert factura.estado == "pendiente"
    assert (_hoy() + timedelta(days=5)).isoformat() in resultado.detalle


def test_excepcion_vencida_y_otra_familia_no_impiden_vencimiento(db_session, caso):
    factura, responsable, regla = caso
    _excepcion(db_session, responsable.familia_id, _hoy() - timedelta(days=1))
    persona = Persona(nombre="Otra", apellido="Familia", dni="49999999")
    db_session.add(persona)
    db_session.flush()
    otra_familia = Familia(estado_deuda="al_dia", persona_id=persona.id)
    db_session.add(otra_familia)
    db_session.flush()
    _excepcion(db_session, otra_familia.id, _hoy() + timedelta(days=30))

    assert _ejecutar(db_session, factura, regla).error is None
    assert factura.estado == "vencida"


def test_cambiar_estado_omite_politica_de_excepciones(db_session, caso):
    factura, responsable, regla = caso
    _excepcion(db_session, responsable.familia_id, _hoy() + timedelta(days=10))
    regla.accion_config = {"estado_nuevo": "vencida"}
    db_session.commit()

    assert _ejecutar(db_session, factura, regla, ejecutar_cambiar_estado).error is None
    assert factura.estado == "vencida"
    assert "Sin cambios" in _ejecutar(db_session, factura, regla, ejecutar_cambiar_estado).detalle


@pytest.mark.parametrize("estado", ["pagada", "vencida"])
def test_no_modifica_factura_pagada_o_vencida(db_session, caso, estado):
    factura, _, regla = caso
    factura.estado = estado
    db_session.commit()

    resultado = _ejecutar(db_session, factura, regla)

    assert resultado.error is None
    assert "Sin cambios" in resultado.detalle
    assert factura.estado == estado


def test_factura_inexistente_deja_error_controlado(db_session, caso):
    _, _, regla = caso
    evento = _evento(db_session, uuid.uuid4())

    resultado = ejecutar_aplicar_vencimiento(db_session, regla, evento, WorkflowExecution())

    assert resultado.error == "La factura del evento no existe."
    assert resultado.detalle == resultado.error


def test_cambiar_estado_rechaza_destino_no_permitido(db_session, caso):
    factura, _, regla = caso
    regla.accion_config = {"estado_nuevo": "pagada"}
    db_session.commit()

    resultado = _ejecutar(db_session, factura, regla, ejecutar_cambiar_estado)

    assert resultado.error == "El cambio de estado no está permitido."
    assert factura.estado == "pendiente"


def test_ejecutor_no_confirma_la_transaccion_del_llamador(db_session, caso):
    factura, _, regla = caso

    assert _ejecutar(db_session, factura, regla).error is None
    assert factura.estado == "vencida"
    db_session.rollback()
    db_session.refresh(factura)

    assert factura.estado == "pendiente"


def test_despacho_revalida_excepcion_creada_despues_del_evento(db_session, caso):
    factura, responsable, _ = caso
    _evento(db_session, factura.id)
    _excepcion(db_session, responsable.familia_id, _hoy() + timedelta(days=10))

    resumen = procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert resumen.eventos_procesados == 1
    assert ejecucion.estado == "exitoso"
    assert "Sin cambios" in ejecucion.detalle
    assert factura.estado == "pendiente"


def test_despacho_revalida_pago_creado_despues_del_evento(db_session, caso):
    factura, _, _ = caso
    _evento(db_session, factura.id)
    factura.estado = "pagada"
    db_session.commit()

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "exitoso"
    assert "pagada" in ejecucion.detalle
    assert factura.estado == "pagada"


def test_endpoint_procesar_y_consultar_historial(client_autenticado, db_session, caso):
    factura, _, _ = caso
    _evento(db_session, factura.id)

    respuesta = client_autenticado.post("/workflows/procesar")

    assert respuesta.status_code == 200
    assert respuesta.json()["eventos_procesados"] == 1
    historial = client_autenticado.get("/workflows/ejecuciones")
    assert historial.status_code == 200
    assert historial.json()["items"][0]["estado"] == "exitoso"
    assert factura.estado == "vencida"


def test_error_del_ejecutor_conserva_detalle_en_historial(client_autenticado, db_session, caso):
    _, _, regla = caso
    _evento(db_session, uuid.uuid4())

    assert client_autenticado.post("/workflows/procesar").status_code == 200
    historial = client_autenticado.get("/workflows/ejecuciones")

    assert historial.status_code == 200
    item = historial.json()["items"][0]
    assert item["estado"] == "fallido"
    assert item["detalle"] == "La factura del evento no existe."
    assert item["tipo_accion"] == regla.tipo_accion


def test_config_invalida_se_rechaza_antes_del_ejecutor(db_session, caso):
    factura, _, regla = caso
    regla.tipo_accion = "cambiar_estado"
    regla.accion_config = {"estado_nuevo": "pagada"}
    db_session.commit()
    _evento(db_session, factura.id)

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert factura.estado == "pendiente"


def test_aprobacion_revalida_prorroga(client_autenticado, db_session, caso):
    factura, responsable, regla = caso
    regla.requiere_aprobacion_humana = True
    db_session.commit()
    _evento(db_session, factura.id)
    assert client_autenticado.post("/workflows/procesar").status_code == 200
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "pendiente"
    _excepcion(db_session, responsable.familia_id, _hoy() + timedelta(days=10))

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/aprobar")

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "exitoso"
    assert "Sin cambios" in respuesta.json()["detalle"]
    assert factura.estado == "pendiente"
