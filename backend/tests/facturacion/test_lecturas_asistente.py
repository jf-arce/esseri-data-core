"""Funciones de solo lectura que alimentan al Asistente: facturas con saldo, pagos y débitos."""

from datetime import date
from decimal import Decimal

from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.cobranzas_service import resumen_debitos_por_periodo
from src.facturacion.cuenta_corriente_service import listar_facturas_con_saldo
from src.facturacion.facturas_service import listar_pagos_aprobados, registrar_pago
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.facturacion.test_cobranzas_importacion import (
    _lote_con_facturas,
    confirmar,
    preview,
    respuesta,
)
from tests.facturacion.test_deuda_familias import (
    _crear_escenario_con_deuda,
    _crear_factura,
)


def _pagar(db_session, factura, usuario, metodo, monto, fecha):
    registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=usuario.id,
        fecha=fecha,
        monto=Decimal(monto),
        metodo_pago_id=metodo.id,
        referencia_transaccion=None,
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )


def test_facturas_con_saldo_clasifican_por_el_libro(db_session):
    inscripcion, concepto, metodo, usuario = _crear_escenario_con_deuda(db_session)
    vencida = _crear_factura(
        db_session,
        inscripcion.id,
        concepto.id,
        emision=date(2027, 3, 1),
        vencimiento=date(2027, 3, 5),
        monto=Decimal("100.00"),
    )
    _crear_factura(
        db_session,
        inscripcion.id,
        concepto.id,
        emision=date(2027, 3, 1),
        vencimiento=date(2027, 3, 20),
        monto=Decimal("50.00"),
    )
    pagada = _crear_factura(
        db_session,
        inscripcion.id,
        concepto.id,
        emision=date(2027, 3, 1),
        vencimiento=date(2027, 3, 8),
        monto=Decimal("30.00"),
    )
    _pagar(db_session, pagada, usuario, metodo, "30.00", date(2027, 3, 6))
    _pagar(db_session, vencida, usuario, metodo, "40.00", date(2027, 3, 10))

    todas = listar_facturas_con_saldo(db_session, fecha_referencia=date(2027, 3, 15))
    assert [f.estado for f in todas] == ["vencida", "pagada", "pendiente"]
    assert [f.saldo for f in todas] == [Decimal("60.00"), Decimal("0.00"), Decimal("50.00")]
    assert all(f.conceptos == ("Cuota",) for f in todas)

    vencidas = listar_facturas_con_saldo(
        db_session, fecha_referencia=date(2027, 3, 15), estado="vencida"
    )
    assert len(vencidas) == 1 and vencidas[0].monto_total == Decimal("100.00")

    esta_semana = listar_facturas_con_saldo(
        db_session,
        fecha_referencia=date(2027, 3, 15),
        vencimiento_desde=date(2027, 3, 15),
        vencimiento_hasta=date(2027, 3, 22),
    )
    assert [f.monto_total for f in esta_semana] == [Decimal("50.00")]


def test_pagos_aprobados_separan_debito_de_manual(db_session, client_autenticado):
    crear_catalogo_evento_pago_registrado(db_session)
    _, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    texto = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    revision = preview(client_autenticado, texto).json()
    assert confirmar(client_autenticado, revision["id"]).status_code == 200

    pagos = listar_pagos_aprobados(db_session, desde=date(2020, 1, 1), hasta=date(2100, 1, 1))
    assert len(pagos) == 2
    assert all(p.por_debito for p in pagos)
    assert sum(p.monto for p in pagos) == Decimal("200.00")
    assert listar_pagos_aprobados(db_session, desde=date(2020, 1, 1), hasta=date(2020, 1, 2)) == []


def test_resumen_debitos_cuenta_cobrados_rechazados_y_motivos(db_session, client_autenticado):
    crear_catalogo_evento_pago_registrado(db_session)
    _, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    # Sin respuesta importada: los tres débitos quedan sin resultado.
    previo, motivos_previos = resumen_debitos_por_periodo(
        db_session, desde="2026-11", hasta="2026-11"
    )
    assert previo[0].enviados == 3 and previo[0].sin_respuesta == 3
    assert motivos_previos == {}

    texto = respuesta(client_autenticado, lote, rechazos_cantidad=1)
    revision = preview(client_autenticado, texto).json()
    assert confirmar(client_autenticado, revision["id"]).status_code == 200

    (fila,), motivos = resumen_debitos_por_periodo(db_session, desde="2026-11", hasta="2026-11")
    assert (fila.lotes, fila.enviados, fila.cobrados, fila.rechazados) == (1, 3, 2, 1)
    assert fila.sin_respuesta == 0
    assert fila.importe_cobrado == Decimal("200.00")
    assert fila.importe_rechazado == Decimal("100.00")
    assert sum(motivos.values()) == 1
    assert set(motivos) <= {codigo for codigo, _ in formato.MOTIVOS_RECHAZO_SIMULADOS}

    vacio, sin_motivos = resumen_debitos_por_periodo(db_session, desde="2025-01", hasta="2025-12")
    assert vacio == [] and sin_motivos == {}
