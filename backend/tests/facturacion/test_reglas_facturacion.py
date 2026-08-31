"""Tests de reglas y generación recurrente de facturación."""

from datetime import date
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.facturacion.exceptions import ConceptoCobroEnUso, ReglaFacturacionIncompatible
from src.facturacion.facturacion_job import ejecutar_facturacion_automatica
from src.facturacion.models import (
    ConceptoCobro,
    EjecucionFacturacion,
    Factura,
    ResponsableEconomico,
)
from src.facturacion.reglas_facturacion_service import (
    crear_regla_facturacion,
    generar_facturacion,
    planificar_generacion_facturacion,
)
from src.facturacion.schemas import ReglaFacturacionCreate
from src.facturacion.service import eliminar_concepto_cobro
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _regla(concepto_id, **cambios):
    datos = {
        "nombre": "Cuota educativa",
        "ciclo_lectivo": "2027",
        "concepto_cobro_id": concepto_id,
        "importe": Decimal("125000.00"),
        "periodicidad": "mensual",
        "vigencia_desde": date(2027, 3, 1),
        "vigencia_hasta": date(2027, 12, 31),
        "dia_vencimiento": 5,
        "criterio_aplicacion": "todas_inscripciones",
        "estado": "activa",
    }
    datos.update(cambios)
    return ReglaFacturacionCreate(**datos)


def _escenario_facturable(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    cuota = ConceptoCobro(nombre="Cuota educativa", activo=True)
    transporte = ConceptoCobro(nombre="Transporte", activo=True)
    responsable = ResponsableEconomico(
        vigencia_desde=date(2027, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    db_session.add_all([cuota, transporte, responsable])
    db_session.commit()
    return inscripcion, cuota, transporte


def test_generar_facturacion_agrupa_conceptos_en_una_factura(db_session):
    inscripcion, cuota, transporte = _escenario_facturable(db_session)
    crear_regla_facturacion(db_session, _regla(cuota.id))
    crear_regla_facturacion(
        db_session,
        _regla(transporte.id, nombre="Transporte", importe=Decimal("60000.00")),
    )

    ejecucion = generar_facturacion(db_session, date(2027, 3, 1), None)

    assert ejecucion.facturas_generadas == 1
    assert ejecucion.cargos_generados == 2
    assert ejecucion.monto_total == Decimal("185000.00")
    factura = db_session.get(Factura, db_session.scalar(select(Factura.id)))
    assert factura is not None
    assert factura.inscripcion_id == inscripcion.id
    assert len(factura.detalles) == 2


def test_reintentar_generacion_no_duplica_cargos(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    crear_regla_facturacion(db_session, _regla(cuota.id))

    primera = generar_facturacion(db_session, date(2027, 3, 1), None)
    segunda = generar_facturacion(db_session, date(2027, 3, 1), None)

    assert primera.cargos_generados == 1
    assert segunda.cargos_generados == 0
    assert segunda.cargos_omitidos == 1


def test_no_permite_reglas_activas_superpuestas_para_mismo_concepto(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    crear_regla_facturacion(db_session, _regla(cuota.id))

    with pytest.raises(ReglaFacturacionIncompatible):
        crear_regla_facturacion(
            db_session,
            _regla(cuota.id, nombre="Cuota alternativa", vigencia_desde=date(2027, 6, 1)),
        )


def test_no_elimina_un_concepto_referenciado_por_regla_recurrente(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    crear_regla_facturacion(db_session, _regla(cuota.id))

    with pytest.raises(ConceptoCobroEnUso):
        eliminar_concepto_cobro(db_session, cuota)


def test_previsualizacion_informa_cargos_bloqueados_sin_responsable(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    db_session.query(ResponsableEconomico).delete()
    db_session.commit()
    crear_regla_facturacion(db_session, _regla(cuota.id))

    plan = planificar_generacion_facturacion(db_session, date(2027, 3, 1))

    assert len(plan.cargos_aptos) == 0
    assert len(plan.cargos_bloqueados) == 1


def test_job_ejecuta_solo_reglas_automaticas_vencidas(db_session):
    _, cuota, transporte = _escenario_facturable(db_session)
    automatica = crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3),
    )
    crear_regla_facturacion(
        db_session,
        _regla(transporte.id, nombre="Transporte", modo_generacion="manual"),
    )

    ejecuciones = ejecutar_facturacion_automatica(db_session, date(2027, 3, 4))

    assert len(ejecuciones) == 1
    assert ejecuciones[0].origen == "automatica"
    assert ejecuciones[0].estado == "exitosa"
    assert ejecuciones[0].regla_ids == [automatica.id]
    assert ejecuciones[0].cargos_generados == 1


def test_job_recupera_periodo_atrasado_y_no_lo_repite(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3),
    )

    primera = ejecutar_facturacion_automatica(db_session, date(2027, 3, 10))
    segunda = ejecutar_facturacion_automatica(db_session, date(2027, 3, 11))

    assert len(primera) == 1
    assert primera[0].cargos_generados == 1
    assert segunda == []


def test_job_reintenta_ejecucion_parcial_cuando_se_resuelve_el_bloqueo(db_session):
    inscripcion, cuota, _ = _escenario_facturable(db_session)
    familia_id = db_session.scalar(select(ResponsableEconomico.familia_id))
    db_session.query(ResponsableEconomico).delete()
    db_session.commit()
    crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3),
    )

    bloqueada = ejecutar_facturacion_automatica(db_session, date(2027, 3, 3))
    db_session.add(
        ResponsableEconomico(
            vigencia_desde=date(2027, 1, 1),
            alumno_id=inscripcion.alumno_id,
            familia_id=familia_id,
        )
    )
    db_session.commit()
    recuperada = ejecutar_facturacion_automatica(db_session, date(2027, 3, 4))

    assert bloqueada[0].estado == "parcial"
    assert bloqueada[0].cargos_bloqueados == 1
    assert recuperada[0].estado == "exitosa"
    assert db_session.query(EjecucionFacturacion).count() == 2
