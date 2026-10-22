"""Penalidad por tramos de mora desde `factura.vencida` (#82 y #204)."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.facturacion.models import Factura, Movimiento, ReglaPenalidad, ResponsableEconomico
from src.facturacion.penalidades_service import resolver_tramo
from src.workflows.acciones_penalidad_service import ejecutar_aplicar_penalidad
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.eventos_service import emit_event
from src.workflows.models import WorkflowExecution, WorkflowRule
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


@pytest.fixture()
def tramos(db_session, concepto_cobro):
    """Los tres tramos de la precarga (`grupo-a.yaml`)."""
    reglas = [
        ReglaPenalidad(
            desde_dia_vencido=desde,
            hasta_dia_vencido=hasta,
            porcentaje=porcentaje,
            activo=True,
            concepto_cobro_id=concepto_cobro.id,
        )
        for desde, hasta, porcentaje in [(0, 5, 0), (6, 15, 20), (16, 30, 30)]
    ]
    db_session.add_all(reglas)
    db_session.commit()
    return reglas


@pytest.fixture()
def caso(db_session, tipo_factura_vencida, tramos):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=date.today() - timedelta(days=90),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    db_session.add(responsable)
    db_session.flush()
    factura = Factura(
        fecha_emision=date.today() - timedelta(days=40),
        fecha_vencimiento=date.today() - timedelta(days=10),
        monto_total=1500,
        estado="vencida",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.flush()
    regla = WorkflowRule(
        nombre="Aplicar penalidad",
        condicion={},
        tipo_accion="aplicar_penalidad",
        accion_config={},
        criticidad="alta",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo_factura_vencida.id,
    )
    db_session.add(regla)
    db_session.commit()
    return factura, regla


def _evento(db, factura_id, dias=10):
    evento = emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=factura_id,
        payload={"dias_vencido": dias, "monto_deuda": 1500, "nombre_familia": "Cabral"},
    )
    db.commit()
    return evento


def _ejecutar(db, factura, regla, dias=10):
    return ejecutar_aplicar_penalidad(db, regla, _evento(db, factura.id, dias), WorkflowExecution())


def _penalidades(db, factura):
    return db.scalars(
        select(Movimiento).where(Movimiento.factura_id == factura.id).order_by(Movimiento.monto)
    ).all()


@pytest.mark.parametrize(("dias", "desde"), [(1, 0), (5, 0), (6, 6), (15, 6), (16, 16), (45, 16)])
def test_resolver_tramo_por_dias_de_atraso(db_session, tramos, dias, desde):
    assert resolver_tramo(db_session, dias).desde_dia_vencido == desde


def test_resolver_tramo_ignora_los_inactivos(db_session, tramos):
    tramos[2].activo = False
    db_session.commit()

    assert resolver_tramo(db_session, 20).desde_dia_vencido == 6


def test_registra_el_20_por_ciento_como_movimiento_del_evento(db_session, caso, concepto_cobro):
    factura, regla = caso

    resultado = _ejecutar(db_session, factura, regla)

    assert resultado.error is None
    [movimiento] = _penalidades(db_session, factura)
    assert movimiento.tipo == "debe"
    assert movimiento.monto == Decimal("300.00")
    assert movimiento.concepto_cobro_id == concepto_cobro.id
    assert movimiento.event_log_id is not None
    assert "6–15 días" in resultado.detalle


def test_el_mismo_tramo_no_se_cobra_dos_veces(db_session, caso):
    factura, regla = caso
    _ejecutar(db_session, factura, regla)

    resultado = _ejecutar(db_session, factura, regla, dias=12)

    assert resultado.error is None
    assert "ya tiene la penalidad" in resultado.detalle
    assert len(_penalidades(db_session, factura)) == 1


def test_el_tramo_siguiente_completa_hasta_el_30_por_ciento(db_session, caso):
    factura, regla = caso
    _ejecutar(db_session, factura, regla, dias=10)

    _ejecutar(db_session, factura, regla, dias=20)

    montos = [m.monto for m in _penalidades(db_session, factura)]
    assert montos == [Decimal("150.00"), Decimal("300.00")]


def test_tramo_sin_porcentaje_no_genera_movimiento(db_session, caso):
    factura, regla = caso

    resultado = _ejecutar(db_session, factura, regla, dias=3)

    assert "no genera penalidad" in resultado.detalle
    assert _penalidades(db_session, factura) == []


@pytest.mark.parametrize("estado", ["pendiente", "pagada"])
def test_solo_penaliza_facturas_vencidas(db_session, caso, estado):
    factura, regla = caso
    factura.estado = estado
    db_session.commit()

    resultado = _ejecutar(db_session, factura, regla)

    assert resultado.error is None
    assert "Sin cambios" in resultado.detalle
    assert _penalidades(db_session, factura) == []


def test_regla_de_penalidad_fijada_en_la_config(db_session, caso, tramos):
    factura, regla = caso
    regla.accion_config = {"regla_penalidad_id": str(tramos[2].id)}
    db_session.commit()

    _ejecutar(db_session, factura, regla, dias=7)

    assert [m.monto for m in _penalidades(db_session, factura)] == [Decimal("450.00")]


def test_factura_inexistente_deja_error_controlado(db_session, caso):
    _, regla = caso
    evento = _evento(db_session, uuid.uuid4())

    resultado = ejecutar_aplicar_penalidad(db_session, regla, evento, WorkflowExecution())

    assert resultado.error == "La factura del evento no existe."


def test_ejecutor_no_confirma_la_transaccion_del_llamador(db_session, caso):
    factura, regla = caso
    _ejecutar(db_session, factura, regla)

    db_session.rollback()

    assert _penalidades(db_session, factura) == []


def test_con_aprobacion_queda_pendiente_y_al_aprobar_registra(client_autenticado, db_session, caso):
    factura, regla = caso
    regla.requiere_aprobacion_humana = True
    db_session.commit()
    _evento(db_session, factura.id)

    procesar_eventos_pendientes(db_session)
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "pendiente"
    assert _penalidades(db_session, factura) == []

    respuesta = client_autenticado.post(f"/workflows/ejecuciones/{ejecucion.id}/aprobar")

    assert respuesta.status_code == 200
    assert respuesta.json()["estado"] == "exitoso"
    assert [m.monto for m in _penalidades(db_session, factura)] == [Decimal("300.00")]
