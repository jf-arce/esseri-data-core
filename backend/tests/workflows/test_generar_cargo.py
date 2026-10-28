"""generar_cargo (#208): la matrícula de un alta nueva, desde `inscripcion.confirmada`."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.academico.models import NivelEducativo
from src.facturacion.models import ConceptoCobro, Factura, Movimiento, ReglaFacturacion
from src.models import EventLog
from src.workflows import acciones_admision_service
from src.workflows.acciones_admision_service import ejecutar_generar_cargo
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from tests.inscripciones.conftest import catalogo_evento_inscripcion_confirmada  # noqa: F401
from tests.inscripciones.test_alta_integrada_admision import (
    _crear_admision_documentada,
    _finalizar,
)

HOY = date(2026, 8, 28)


@pytest.fixture(autouse=True)
def _fijar_hoy(monkeypatch):
    monkeypatch.setattr(acciones_admision_service, "fecha_operativa_argentina", lambda: HOY)


@pytest.fixture()
def matricula(db_session):
    concepto = ConceptoCobro(nombre="Matrícula", activo=True)
    db_session.add(concepto)
    db_session.commit()
    return concepto


@pytest.fixture()
def escenario(db_session):
    return _crear_admision_documentada(db_session)


def _regla_facturacion(db, concepto, *, nivel=None, importe="120000.00", dia=10):
    regla = ReglaFacturacion(
        nombre="Matrícula anual",
        ciclo_lectivo="2027",
        importe=Decimal(importe),
        periodicidad="anual",
        vigencia_desde=date(2026, 8, 1),
        vigencia_hasta=date(2027, 12, 31),
        mes_aplicacion=8,
        modo_generacion="manual",
        dia_vencimiento=dia,
        criterio_aplicacion="nivel" if nivel else "todas_inscripciones",
        nivel_educativo_id=nivel.id if nivel else None,
        estado="activa",
        concepto_cobro_id=concepto.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _regla(db, concepto, monto=None, aprobacion=False):
    tipo = db.scalar(select(TipoEvento).where(TipoEvento.nombre == "inscripcion.confirmada"))
    config = {"concepto_cobro_id": str(concepto.id)}
    if monto is not None:
        config["monto"] = monto
    regla = WorkflowRule(
        nombre="Cargo de matrícula",
        condicion={},
        tipo_accion="generar_cargo",
        accion_config=config,
        criticidad="media",
        requiere_aprobacion_humana=aprobacion,
        activo=True,
        tipo_evento_id=tipo.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _ejecutar(db, regla):
    evento = db.scalars(select(EventLog)).one()
    return ejecutar_generar_cargo(db, regla, evento, WorkflowExecution())


def _facturas(db):
    return db.scalars(select(Factura)).all()


def test_emite_la_matricula_con_la_regla_de_facturacion_del_nivel(db_session, escenario, matricula):
    _regla_facturacion(db_session, matricula, nivel=escenario["nivel"])
    regla = _regla(db_session, matricula)
    respuesta = _finalizar(db_session, escenario)

    resultado = _ejecutar(db_session, regla)

    assert resultado.error is None
    [factura] = _facturas(db_session)
    assert factura.inscripcion_id == respuesta.inscripcion.id
    assert factura.monto_total == Decimal("120000.00")
    assert factura.fecha_emision == HOY
    # El día 10 ya pasó en agosto: vence el 10 del mes siguiente.
    assert factura.fecha_vencimiento == date(2026, 9, 10)
    # Se le cobra a la familia que lo inscribió, aunque su vigencia arranque más adelante.
    assert factura.responsable_economico_id == respuesta.responsable_economico_id
    [movimiento] = db_session.scalars(select(Movimiento)).all()
    assert (movimiento.tipo, movimiento.monto) == ("debe", Decimal("120000.00"))


def test_no_cobra_dos_veces_la_matricula_del_ciclo(db_session, escenario, matricula):
    _regla_facturacion(db_session, matricula)
    regla = _regla(db_session, matricula)
    _finalizar(db_session, escenario)
    _ejecutar(db_session, regla)

    resultado = _ejecutar(db_session, regla)

    assert resultado.error is None
    assert "ya tiene un cargo de Matrícula" in resultado.detalle
    assert len(_facturas(db_session)) == 1


def test_monto_fijo_en_la_regla_sin_regla_de_facturacion(db_session, escenario, matricula):
    regla = _regla(db_session, matricula, monto="95000.00")
    _finalizar(db_session, escenario)

    assert _ejecutar(db_session, regla).error is None

    [factura] = _facturas(db_session)
    assert factura.monto_total == Decimal("95000.00")
    assert factura.fecha_vencimiento == date(2026, 9, 7)


def test_monto_de_la_regla_pisa_el_importe_de_facturacion(db_session, escenario, matricula):
    _regla_facturacion(db_session, matricula, dia=31)
    regla = _regla(db_session, matricula, monto="50000.00")
    _finalizar(db_session, escenario)

    _ejecutar(db_session, regla)

    [factura] = _facturas(db_session)
    assert factura.monto_total == Decimal("50000.00")
    assert factura.fecha_vencimiento == date(2026, 8, 31)


def test_sin_regla_de_facturacion_ni_monto_falla_con_motivo(db_session, escenario, matricula):
    otro_nivel = NivelEducativo(nombre="Nivel de otra regla")
    db_session.add(otro_nivel)
    db_session.commit()
    _regla_facturacion(db_session, matricula, nivel=otro_nivel)
    regla = _regla(db_session, matricula)
    _finalizar(db_session, escenario)

    resultado = _ejecutar(db_session, regla)

    assert "No hay una regla de facturación activa" in resultado.error
    assert _facturas(db_session) == []


def test_no_confirma_la_transaccion_del_llamador(db_session, escenario, matricula):
    regla = _regla(db_session, matricula, monto="95000.00")
    _finalizar(db_session, escenario)
    _ejecutar(db_session, regla)

    db_session.rollback()

    assert _facturas(db_session) == []


def test_nace_con_aprobacion_y_cobra_al_aprobar(client, db_session, escenario, matricula):
    from src.workflows.ejecuciones_service import aprobar_ejecucion

    _regla_facturacion(db_session, matricula)
    _regla(db_session, matricula, aprobacion=True)
    _finalizar(db_session, escenario)

    procesar_eventos_pendientes(db_session)
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "pendiente"
    assert _facturas(db_session) == []

    aprobada = aprobar_ejecucion(db_session, ejecucion.id, escenario["usuario"].id)

    assert aprobada.estado == "exitoso"
    assert len(_facturas(db_session)) == 1
