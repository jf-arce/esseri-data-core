from datetime import date
from decimal import Decimal

from sqlalchemy import select

from src.auth.models import Usuario
from src.facturacion.models import Factura, MetodoPago, Pago, ResponsableEconomico
from src.inscripciones.models import Asistencia
from src.panel_admin.service import obtener_indicadores_direccion
from src.proveedores_compras.models import SolicitudCompra
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def test_indicadores_calculan_deuda_con_pagos_parciales_y_solo_aprobados(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo_pago = MetodoPago(nombre="Transferencia", activo=True, requiere_comprobante=False)
    db_session.add_all([responsable, metodo_pago])
    db_session.flush()
    factura = Factura(
        fecha_emision=date(2026, 9, 1),
        fecha_vencimiento=date(2026, 9, 10),
        monto_total=Decimal("100.00"),
        estado="pagada",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    pago_aprobado = Pago(
        fecha=date(2026, 9, 1),
        monto=Decimal("40.00"),
        estado="aprobado",
        factura=factura,
        metodo_pago_id=metodo_pago.id,
    )
    pago_pendiente = Pago(
        fecha=date(2026, 9, 1),
        monto=Decimal("20.00"),
        estado="pendiente",
        factura=factura,
        metodo_pago_id=metodo_pago.id,
    )
    db_session.add_all(
        [
            responsable,
            factura,
            pago_aprobado,
            pago_pendiente,
            Asistencia(
                fecha=date(2026, 9, 1), tipo="ausente_injustificado", inscripcion_id=inscripcion.id
            ),
            Asistencia(fecha=date(2026, 9, 1), tipo="presente", inscripcion_id=inscripcion.id),
            SolicitudCompra(
                articulo="Resmas",
                cantidad=2,
                estado="pendiente",
                fecha=date(2026, 9, 1),
                usuario_id=db_session.scalar(select(Usuario.id)),
            ),
        ]
    )
    db_session.commit()

    indicadores = obtener_indicadores_direccion(db_session, fecha_hoy=date(2026, 9, 1))

    assert indicadores == {
        "alumnos_activos": 1,
        "deuda_pendiente_total": Decimal("60.00"),
        "inasistencias_hoy": 1,
        "solicitudes_compra_pendientes": 1,
    }
