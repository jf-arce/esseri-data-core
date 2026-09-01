"""Tests de reglas y generación recurrente de facturación."""

import uuid
from datetime import UTC, date, datetime, time
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.facturacion.calendario_facturacion import (
    fecha_operativa_argentina,
    fecha_programada,
    proxima_corrida_diaria_argentina,
)
from src.facturacion.exceptions import ConceptoCobroEnUso, ReglaFacturacionIncompatible
from src.facturacion.facturacion_job import (
    ejecutar_facturacion_automatica,
    periodos_pendientes_de_regla,
)
from src.facturacion.models import (
    ConceptoCobro,
    EjecucionFacturacion,
    EjecucionFacturacionRegla,
    Factura,
    ResponsableEconomico,
)
from src.facturacion.reglas_facturacion_service import (
    crear_regla_facturacion,
    generar_facturacion,
    listar_reglas_facturacion_read,
    planificar_generacion_facturacion,
)
from src.facturacion.schemas import EjecucionFacturacionRead, ReglaFacturacionCreate
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


def test_calendario_usa_argentina_y_respeta_el_ultimo_dia_del_mes():
    assert fecha_operativa_argentina(datetime(2027, 3, 1, 2, 30, tzinfo=UTC)) == date(2027, 2, 28)
    assert fecha_programada(31, date(2027, 2, 1)) == date(2027, 2, 28)
    assert proxima_corrida_diaria_argentina(
        time(0, 5), datetime(2027, 3, 1, 2, 0, tzinfo=UTC)
    ) == datetime(2027, 3, 1, 3, 5, tzinfo=UTC)


def test_proxima_corrida_pasa_al_dia_siguiente_luego_de_la_hora_configurada():
    assert proxima_corrida_diaria_argentina(
        time(0, 5), datetime(2027, 3, 1, 3, 6, tzinfo=UTC)
    ) == datetime(2027, 3, 2, 3, 5, tzinfo=UTC)


def test_respuesta_de_ejecucion_normaliza_timestamps_historicos_a_utc():
    lectura = EjecucionFacturacionRead(
        id=uuid.uuid4(),
        periodo=date(2027, 3, 1),
        fecha_ejecucion=datetime(2027, 3, 1, 3, 5),
        facturas_generadas=0,
        cargos_generados=0,
        cargos_omitidos=0,
        cargos_bloqueados=0,
        monto_total=Decimal("0.00"),
        origen="automatica",
        estado="exitosa",
        error_detalle=None,
        regla_ids=[],
        reglas_aplicables=0,
        alumnos_alcanzados=0,
        cargos_aptos=0,
        monto_estimado=Decimal("0.00"),
    )

    assert lectura.fecha_ejecucion.tzinfo == UTC


def test_job_omite_reglas_pausadas_y_finalizadas(db_session):
    _, cuota, transporte = _escenario_facturable(db_session)
    crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3, estado="pausada"),
    )
    crear_regla_facturacion(
        db_session,
        _regla(
            transporte.id,
            nombre="Transporte",
            modo_generacion="automatica",
            dia_generacion=3,
            estado="finalizada",
        ),
    )

    assert ejecutar_facturacion_automatica(db_session, date(2027, 3, 4)) == []


def test_job_registra_un_intento_fallido_y_lo_deja_recuperable(db_session, monkeypatch):
    _, cuota, _ = _escenario_facturable(db_session)
    regla = crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3),
    )

    def fallar_generacion(*_args, **_kwargs):
        raise RuntimeError("servicio temporalmente no disponible")

    monkeypatch.setattr("src.facturacion.facturacion_job.generar_facturacion", fallar_generacion)

    ejecuciones = ejecutar_facturacion_automatica(db_session, date(2027, 3, 4))

    assert ejecuciones[0].estado == "fallida"
    assert ejecuciones[0].regla_ids == [regla.id]
    assert periodos_pendientes_de_regla(db_session, regla, date(2027, 3, 5)) == [date(2027, 3, 1)]


def test_job_ejecuta_una_regla_anual_en_su_mes_y_no_en_otro(db_session):
    _, cuota, _ = _escenario_facturable(db_session)
    regla = crear_regla_facturacion(
        db_session,
        _regla(
            cuota.id,
            periodicidad="anual",
            mes_aplicacion=4,
            modo_generacion="automatica",
            dia_generacion=2,
        ),
    )

    assert periodos_pendientes_de_regla(db_session, regla, date(2027, 3, 31)) == []
    assert periodos_pendientes_de_regla(db_session, regla, date(2027, 4, 2)) == [date(2027, 4, 1)]


def test_listado_de_reglas_expone_proxima_y_ultima_ejecucion_por_regla(db_session):
    _, cuota, transporte = _escenario_facturable(db_session)
    primera = crear_regla_facturacion(
        db_session,
        _regla(cuota.id, modo_generacion="automatica", dia_generacion=3),
    )
    segunda = crear_regla_facturacion(
        db_session,
        _regla(
            transporte.id,
            nombre="Transporte",
            modo_generacion="automatica",
            dia_generacion=3,
        ),
    )
    ejecucion_vieja = EjecucionFacturacion(
        periodo=date(2027, 3, 1),
        estado="exitosa",
        origen="automatica",
        fecha_ejecucion=datetime(2027, 3, 3, 3, 5, tzinfo=UTC),
    )
    ejecucion_reciente = EjecucionFacturacion(
        periodo=date(2027, 3, 1),
        estado="parcial",
        origen="manual",
        fecha_ejecucion=datetime(2027, 3, 4, 3, 5, tzinfo=UTC),
    )
    db_session.add_all([ejecucion_vieja, ejecucion_reciente])
    db_session.flush()
    db_session.add_all(
        [
            EjecucionFacturacionRegla(
                ejecucion_facturacion_id=ejecucion_vieja.id,
                regla_facturacion_id=primera.id,
            ),
            EjecucionFacturacionRegla(
                ejecucion_facturacion_id=ejecucion_reciente.id,
                regla_facturacion_id=segunda.id,
            ),
        ]
    )
    db_session.commit()

    lecturas = {regla.id: regla for regla in listar_reglas_facturacion_read(db_session)}

    assert lecturas[primera.id].ultima_ejecucion is not None
    assert lecturas[primera.id].ultima_ejecucion.estado == "exitosa"
    assert lecturas[primera.id].proxima_generacion == date(2027, 4, 3)
    assert lecturas[segunda.id].ultima_ejecucion is not None
    assert lecturas[segunda.id].ultima_ejecucion.estado == "parcial"
    assert lecturas[segunda.id].proxima_generacion == date(2027, 3, 3)
