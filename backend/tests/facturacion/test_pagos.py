"""Casos principales del registro de pagos y sus bloqueos."""

from datetime import date
from decimal import Decimal

import pytest

from src.auth.models import Usuario
from src.facturacion.cuenta_corriente_service import obtener_resumen_cuenta
from src.facturacion.exceptions import ComprobantePagoInvalido, PagoExcedeSaldo
from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import ConceptoCobro, MetodoPago, Movimiento, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _crear_factura_pendiente(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    concepto = ConceptoCobro(nombre="Cuota", categoria="Escolar", activo=True)
    responsable = ResponsableEconomico(
        vigencia_desde=date(2027, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo = MetodoPago(nombre="Transferencia", activo=True, requiere_comprobante=True)
    usuario = Usuario(
        email="cobranzas@esseri.edu.ar",
        password_hash="hash-de-prueba",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([concepto, responsable, metodo, usuario])
    db_session.commit()
    factura = crear_factura(
        db_session,
        FacturaCreate(
            fecha_emision=date(2027, 3, 1),
            fecha_vencimiento=date(2027, 3, 10),
            inscripcion_id=inscripcion.id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Cuota marzo",
                    monto=Decimal("100.00"),
                    concepto_cobro_id=concepto.id,
                )
            ],
        ),
    )
    return factura, metodo, usuario, escenario["alumno_id"]


def test_registrar_pago_total_guarda_comprobante_y_paga_factura(db_session):
    factura, metodo, usuario, alumno_id = _crear_factura_pendiente(db_session)

    pago = registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=usuario.id,
        fecha=date(2027, 3, 5),
        monto=Decimal("100.00"),
        metodo_pago_id=metodo.id,
        referencia_transaccion="TRX-123",
        comprobante_nombre="transferencia.pdf",
        comprobante_tipo_contenido="application/pdf",
        comprobante_contenido=b"%PDF-1.7 comprobante",
    )

    db_session.refresh(factura)
    assert pago.estado == "aprobado"
    assert pago.archivo_comprobante is not None
    assert pago.archivo_comprobante.nombre == "transferencia.pdf"
    assert pago.registrado_por == "cobranzas@esseri.edu.ar"
    assert factura.estado == "pagada"
    movimientos = db_session.query(Movimiento).order_by(Movimiento.tipo).all()
    assert [(movimiento.tipo, movimiento.monto) for movimiento in movimientos] == [
        ("debe", Decimal("100.00")),
        ("haber", Decimal("100.00")),
    ]
    _, total_debe, total_haber, saldo = obtener_resumen_cuenta(db_session, alumno_id)
    assert (total_debe, total_haber, saldo) == (
        Decimal("100.00"),
        Decimal("100.00"),
        Decimal("0.00"),
    )


def test_no_registra_pago_por_encima_del_saldo(db_session):
    factura, metodo, usuario, _ = _crear_factura_pendiente(db_session)

    with pytest.raises(PagoExcedeSaldo):
        registrar_pago(
            db_session,
            factura=factura,
            usuario_registro_id=usuario.id,
            fecha=date(2027, 3, 5),
            monto=Decimal("100.01"),
            metodo_pago_id=metodo.id,
            referencia_transaccion=None,
            comprobante_nombre="transferencia.pdf",
            comprobante_tipo_contenido="application/pdf",
            comprobante_contenido=b"%PDF-1.7 comprobante",
        )


def test_exige_comprobante_para_metodo_que_lo_requiere(db_session):
    factura, metodo, usuario, _ = _crear_factura_pendiente(db_session)

    with pytest.raises(ComprobantePagoInvalido):
        registrar_pago(
            db_session,
            factura=factura,
            usuario_registro_id=usuario.id,
            fecha=date(2027, 3, 5),
            monto=Decimal("50.00"),
            metodo_pago_id=metodo.id,
            referencia_transaccion=None,
            comprobante_nombre=None,
            comprobante_tipo_contenido=None,
            comprobante_contenido=None,
        )
