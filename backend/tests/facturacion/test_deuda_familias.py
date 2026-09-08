"""Estado de deuda por familia derivado de la cuenta corriente."""

from datetime import date
from decimal import Decimal

from src.auth.models import Usuario
from src.facturacion.cuenta_corriente_service import listar_deuda_por_familia
from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import ConceptoCobro, MetodoPago, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _crear_escenario_con_deuda(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    concepto = ConceptoCobro(nombre="Cuota", activo=True)
    responsable = ResponsableEconomico(
        vigencia_desde=date(2027, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo = MetodoPago(nombre="Efectivo", activo=True, requiere_comprobante=False)
    usuario = Usuario(
        email="cobranzas@esseri.edu.ar",
        password_hash="hash-de-prueba",
        auth_provider="local",
        estado="activo",
    )
    db_session.add_all([concepto, responsable, metodo, usuario])
    db_session.commit()
    return inscripcion, concepto, metodo, usuario


def _crear_factura(db_session, inscripcion_id, concepto_id, *, emision, vencimiento, monto):
    return crear_factura(
        db_session,
        FacturaCreate(
            fecha_emision=emision,
            fecha_vencimiento=vencimiento,
            inscripcion_id=inscripcion_id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Cuota", monto=monto, concepto_cobro_id=concepto_id
                )
            ],
        ),
    )


def test_deuda_familiar_separa_pendientes_vencidas_y_pagos_parciales(db_session):
    inscripcion, concepto, metodo, usuario = _crear_escenario_con_deuda(db_session)
    factura_vencida = _crear_factura(
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
    registrar_pago(
        db_session,
        factura=factura_vencida,
        usuario_registro_id=usuario.id,
        fecha=date(2027, 3, 10),
        monto=Decimal("40.00"),
        metodo_pago_id=metodo.id,
        referencia_transaccion=None,
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )

    items, total = listar_deuda_por_familia(
        db_session,
        fecha_referencia=date(2027, 3, 15),
        pagina=1,
        tamanio=20,
    )

    assert total == 1
    assert items[0]["monto_vencido"] == Decimal("60.00")
    assert items[0]["monto_pendiente"] == Decimal("50.00")
    assert items[0]["monto_pagado"] == Decimal("40.00")
    assert items[0]["deuda_total"] == Decimal("110.00")
    assert items[0]["facturas_pendientes"] == 2
    assert items[0]["facturas_pagadas"] == 0
    assert items[0]["estado"] == "vencida"


def test_deuda_familiar_filtra_familias_al_dia(db_session):
    inscripcion, concepto, metodo, usuario = _crear_escenario_con_deuda(db_session)
    factura = _crear_factura(
        db_session,
        inscripcion.id,
        concepto.id,
        emision=date(2027, 3, 1),
        vencimiento=date(2027, 3, 20),
        monto=Decimal("100.00"),
    )
    registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=usuario.id,
        fecha=date(2027, 3, 10),
        monto=Decimal("100.00"),
        metodo_pago_id=metodo.id,
        referencia_transaccion=None,
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )

    items, total = listar_deuda_por_familia(
        db_session,
        fecha_referencia=date(2027, 3, 15),
        pagina=1,
        tamanio=20,
        estado="pagada",
    )

    assert total == 1
    assert items[0]["deuda_total"] == Decimal("0.00")
    assert items[0]["monto_pagado"] == Decimal("100.00")
    assert items[0]["estado"] == "pagada"
