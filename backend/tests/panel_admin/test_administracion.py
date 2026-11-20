from datetime import UTC, date, datetime
from decimal import Decimal

from src.auth.models import Usuario
from src.facturacion.models import (
    CuentaCorriente,
    Factura,
    MetodoPago,
    Movimiento,
    Pago,
    ResponsableEconomico,
)
from src.panel_admin.service import obtener_indicadores_administracion
from src.proveedores_compras.models import SolicitudCompra
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa


def _escenario(db_session):
    escenario = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, escenario, ciclo="2026", estado="activa")
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        alumno_id=escenario["alumno_id"],
        familia_id=escenario["familia_id"],
    )
    metodo = MetodoPago(nombre="Transferencia admin", activo=True, requiere_comprobante=False)
    db_session.add_all([responsable, metodo])
    db_session.flush()
    cuenta = CuentaCorriente(alumno_id=escenario["alumno_id"])
    db_session.add(cuenta)
    db_session.flush()
    return escenario, inscripcion, responsable, metodo, cuenta


def test_indicadores_administracion_usan_saldo_y_fecha_no_la_columna_estado(db_session):
    _, inscripcion, responsable, metodo, cuenta = _escenario(db_session)
    usuario = Usuario(
        email="admin-indicadores@esseri.edu.ar",
        password_hash="x",
        auth_provider="local",
        estado="activo",
    )
    db_session.add(usuario)
    db_session.flush()
    # Estado desactualizado a propósito: la consulta debe mirar el saldo y el vencimiento.
    vencida = Factura(
        fecha_emision=date(2026, 8, 1),
        fecha_vencimiento=date(2026, 8, 10),
        monto_total=Decimal("100.00"),
        estado="pendiente",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    saldada = Factura(
        fecha_emision=date(2026, 8, 1),
        fecha_vencimiento=date(2026, 8, 12),
        monto_total=Decimal("50.00"),
        estado="vencida",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add_all([vencida, saldada])
    db_session.flush()
    db_session.add_all(
        [
            Movimiento(
                fecha=datetime(2026, 8, 1, tzinfo=UTC),
                tipo="debe",
                monto=Decimal("100.00"),
                cuenta_corriente_id=cuenta.id,
                factura_id=vencida.id,
            ),
            Movimiento(
                fecha=datetime(2026, 8, 1, tzinfo=UTC),
                tipo="debe",
                monto=Decimal("50.00"),
                cuenta_corriente_id=cuenta.id,
                factura_id=saldada.id,
            ),
            Movimiento(
                fecha=datetime(2026, 8, 1, tzinfo=UTC),
                tipo="haber",
                monto=Decimal("50.00"),
                cuenta_corriente_id=cuenta.id,
                factura_id=saldada.id,
            ),
            Movimiento(
                fecha=datetime(2026, 9, 15, tzinfo=UTC),
                tipo="haber",
                monto=Decimal("25.00"),
                cuenta_corriente_id=cuenta.id,
                factura_id=vencida.id,
            ),
        ]
    )
    db_session.add(
        Pago(
            fecha=date(2026, 9, 15),
            monto=Decimal("25.00"),
            estado="aprobado",
            factura_id=vencida.id,
            metodo_pago_id=metodo.id,
        )
    )
    db_session.add(
        SolicitudCompra(
            articulo="Resmas",
            cantidad=2,
            estado="pendiente",
            fecha=date(2026, 9, 1),
            usuario_id=usuario.id,
        )
    )
    db_session.commit()

    indicadores = obtener_indicadores_administracion(db_session, fecha_hoy=date(2026, 9, 20))

    assert indicadores == {
        "facturas_vencidas": 1,
        "cobrado_mes": Decimal("25.00"),
        "solicitudes_compra_pendientes": 1,
    }


def test_el_bloque_de_facturacion_se_omite_sin_permiso(db_session):
    indicadores = obtener_indicadores_administracion(
        db_session, fecha_hoy=date(2026, 9, 20), incluir_facturacion=False
    )

    assert indicadores["facturas_vencidas"] is None
    assert indicadores["cobrado_mes"] is None


def test_el_bloque_de_compras_se_omite_sin_permiso(db_session):
    indicadores = obtener_indicadores_administracion(db_session, incluir_compras=False)

    assert indicadores["solicitudes_compra_pendientes"] is None


def test_administracion_entra_a_sus_indicadores(client_administracion):
    respuesta = client_administracion.get("/panel-admin/indicadores-administracion")

    assert respuesta.status_code == 200
    assert set(respuesta.json()) == {
        "facturas_vencidas",
        "cobrado_mes",
        "solicitudes_compra_pendientes",
    }


def test_direccion_no_entra_a_los_indicadores_de_administracion(client_direccion):
    assert client_direccion.get("/panel-admin/indicadores-administracion").status_code == 403


def test_sin_permisos_de_modulo_los_bloques_llegan_vacios(client_administracion_sin_modulos):
    cuerpo = client_administracion_sin_modulos.get("/panel-admin/indicadores-administracion").json()

    assert cuerpo == {
        "facturas_vencidas": None,
        "cobrado_mes": None,
        "solicitudes_compra_pendientes": None,
    }
