"""Segunda entrega: Facturación, Pagos y recordatorios de vencimiento."""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from src.facturacion.facturas_service import crear_factura, registrar_pago
from src.facturacion.models import Factura, MetodoPago, ResponsableEconomico
from src.facturacion.schemas import DetalleFacturaCreate, FacturaCreate
from src.notificaciones.facturacion_service import detectar_proximos_vencimientos
from src.notificaciones.models import NotificacionInterna
from src.notificaciones.service import AlcanceBandeja, listar
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado

HOY = date(2027, 3, 10)


def _responsable(db_session, escenario, familia="familia_a"):
    responsable = ResponsableEconomico(
        vigencia_desde=date(2027, 1, 1),
        alumno_id=escenario["alumno"].id,
        familia_id=escenario[familia].id,
    )
    db_session.add(responsable)
    db_session.commit()
    return responsable


def _factura(
    db_session, escenario, responsable, *, vencimiento, monto="100.00", estado="pendiente"
):
    factura = Factura(
        fecha_emision=HOY,
        fecha_vencimiento=vencimiento,
        monto_total=Decimal(monto),
        estado=estado,
        inscripcion_id=escenario["inscripcion"].id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.commit()
    return factura


def _avisos(db_session, tipo):
    return list(
        db_session.scalars(
            select(NotificacionInterna).where(NotificacionInterna.tipo == tipo)
        ).all()
    )


def test_factura_emitida_avisa_a_la_familia_responsable(db_session, escenario_notificaciones):
    from src.facturacion.models import ConceptoCobro

    escenario = escenario_notificaciones
    _responsable(db_session, escenario)
    concepto = ConceptoCobro(nombre="Matrícula", activo=True)
    db_session.add(concepto)
    db_session.commit()

    factura = crear_factura(
        db_session,
        FacturaCreate(
            fecha_emision=HOY,
            fecha_vencimiento=HOY + timedelta(days=10),
            inscripcion_id=escenario["inscripcion"].id,
            detalles=[
                DetalleFacturaCreate(
                    descripcion="Matrícula marzo",
                    monto=Decimal("100.00"),
                    concepto_cobro_id=concepto.id,
                )
            ],
        ),
    )

    avisos = _avisos(db_session, "facturacion.factura_emitida")
    assert {aviso.usuario_id for aviso in avisos} == {
        escenario["usuario_a"].id,
        escenario["usuario_a2"].id,
    }
    assert all(aviso.alumno_id == escenario["alumno"].id for aviso in avisos)
    assert all(str(factura.id) in aviso.contexto["factura_id"] for aviso in avisos)


def test_pago_aprobado_avisa_sin_afirmar_acreditacion(db_session, escenario_notificaciones):
    escenario = escenario_notificaciones
    responsable = _responsable(db_session, escenario)
    crear_catalogo_evento_pago_registrado(db_session)
    metodo = MetodoPago(nombre="Efectivo", activo=True, requiere_comprobante=False)
    db_session.add(metodo)
    db_session.commit()
    factura = _factura(db_session, escenario, responsable, vencimiento=HOY)

    pago = registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=escenario["usuario_admin"].id,
        fecha=HOY,
        monto=Decimal("50.00"),
        metodo_pago_id=metodo.id,
        referencia_transaccion=None,
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )

    avisos = _avisos(db_session, "facturacion.pago_registrado")
    assert {aviso.usuario_id for aviso in avisos} == {
        escenario["usuario_a"].id,
        escenario["usuario_a2"].id,
    }
    assert all("aprobado por Administración" in aviso.mensaje for aviso in avisos)
    assert all("acredit" not in aviso.mensaje.lower() for aviso in avisos)
    assert all(str(pago.id) in aviso.contexto["pago_id"] for aviso in avisos)


def test_recordatorio_proximo_vencimiento_ventana_saldo_y_dedup(
    db_session, escenario_notificaciones
):
    escenario = escenario_notificaciones
    responsable = _responsable(db_session, escenario)
    cercana = _factura(db_session, escenario, responsable, vencimiento=HOY + timedelta(days=2))
    _factura(
        db_session,
        escenario,
        responsable,
        vencimiento=HOY + timedelta(days=2),
        estado="pagada",
    )
    _factura(db_session, escenario, responsable, vencimiento=HOY + timedelta(days=4))
    _factura(db_session, escenario, responsable, vencimiento=HOY - timedelta(days=1))

    assert detectar_proximos_vencimientos(db_session, HOY) == 2
    db_session.commit()
    avisos = _avisos(db_session, "facturacion.proximo_vencimiento")
    assert {aviso.usuario_id for aviso in avisos} == {
        escenario["usuario_a"].id,
        escenario["usuario_a2"].id,
    }
    assert all(str(cercana.id) in aviso.contexto["factura_id"] for aviso in avisos)

    assert detectar_proximos_vencimientos(db_session, HOY) == 0
    db_session.commit()
    assert len(_avisos(db_session, "facturacion.proximo_vencimiento")) == 2


def test_recordatorio_respeta_prorroga(db_session, escenario_notificaciones):
    from datetime import UTC, datetime

    from src.facturacion.models import ExcepcionVencimiento

    escenario = escenario_notificaciones
    responsable = _responsable(db_session, escenario)
    _factura(db_session, escenario, responsable, vencimiento=HOY + timedelta(days=1))
    excepcion = ExcepcionVencimiento(
        fecha_vencimiento_excepcional=HOY + timedelta(days=10),
        familia_id=escenario["familia_a"].id,
        usuario_id=escenario["usuario_admin"].id,
    )
    db_session.add(excepcion)
    db_session.commit()

    assert detectar_proximos_vencimientos(db_session, HOY) == 0
    db_session.commit()

    excepcion.anulada_at = datetime.now(UTC).replace(tzinfo=None)
    db_session.commit()
    assert detectar_proximos_vencimientos(db_session, HOY) == 2
    db_session.commit()
    assert detectar_proximos_vencimientos(db_session, HOY) == 0


def test_aviso_de_factura_no_se_expone_a_otra_familia(db_session, escenario_notificaciones):
    escenario = escenario_notificaciones
    responsable = _responsable(db_session, escenario)
    factura = _factura(db_session, escenario, responsable, vencimiento=HOY)
    db_session.add(
        NotificacionInterna(
            usuario_id=escenario["usuario_a"].id,
            familia_id=escenario["familia_a"].id,
            alumno_id=escenario["alumno"].id,
            ambito="facturacion",
            clave_hecho=f"facturacion:factura_emitida:{factura.id}",
            tipo="facturacion.factura_emitida",
            titulo="Nueva factura emitida",
            mensaje="Se emitió una factura.",
            contexto={
                "familia_id": str(escenario["familia_a"].id),
                "alumno_id": str(escenario["alumno"].id),
                "factura_id": str(factura.id),
                "fecha_emision": HOY.isoformat(),
                "fecha_vencimiento": HOY.isoformat(),
                "monto_total": "100.00",
            },
            destino_tipo="factura",
            destino_id=factura.id,
        )
    )
    db_session.commit()

    visibles_a = listar(
        db_session,
        escenario["usuario_a"].id,
        AlcanceBandeja(rol="familia", familia_id=escenario["familia_a"].id),
        no_leidas=False,
        limite=50,
        cursor=None,
    )
    visibles_b = listar(
        db_session,
        escenario["usuario_b"].id,
        AlcanceBandeja(rol="familia", familia_id=escenario["familia_b"].id),
        no_leidas=False,
        limite=50,
        cursor=None,
    )
    assert any(item.destino and item.destino.id == factura.id for item in visibles_a.items)
    assert not any(item.destino and item.destino.id == factura.id for item in visibles_b.items)
