"""generar_orden_compra: de la solicitud de compra aprobada a la orden emitida (#212)."""

import uuid
from decimal import Decimal

import pytest
from sqlalchemy import select

from src.auth.models import Usuario
from src.models import EventLog
from src.proveedores_compras.models import (
    OrdenCompra,
    OrdenCompraDetalle,
    OrdenCompraSolicitud,
    ProductoProveedor,
)
from src.proveedores_compras.schemas import (
    ProductoServicioCreate,
    ProveedorCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    cambiar_estado_solicitud,
    crear_producto_servicio,
    crear_proveedor,
    crear_solicitud,
)
from src.workflows.acciones_compras_service import ejecutar_generar_orden_compra
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.models import TipoEvento, WorkflowExecution, WorkflowRule
from tests.proveedores_compras.conftest import catalogo_eventos_compras  # noqa: F401


@pytest.fixture()
def usuario(db_session):
    usuario = Usuario(
        email="compras@esseri.edu.ar", password_hash="x", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.commit()
    return usuario


@pytest.fixture()
def producto(db_session):
    return crear_producto_servicio(
        db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
    )


def _proveedor(db, producto, nombre="Papelera del Sur", estado="activo"):
    proveedor = crear_proveedor(db, ProveedorCreate(nombre=nombre))
    proveedor.estado = estado
    db.add(ProductoProveedor(producto_servicio_id=producto.id, proveedor_id=proveedor.id))
    db.commit()
    return proveedor


@pytest.fixture()
def regla(db_session):
    tipo = db_session.scalar(
        select(TipoEvento).where(TipoEvento.nombre == "solicitud_compra.aprobada")
    )
    regla = WorkflowRule(
        nombre="Generar orden de compra",
        condicion={},
        tipo_accion="generar_orden_compra",
        accion_config={},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo.id,
    )
    db_session.add(regla)
    db_session.commit()
    return regla


def _aprobar(db, usuario, *, producto=None, articulo=None, cantidad=10):
    datos = (
        SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=cantidad)
        if producto
        else SolicitudCompraCreate(articulo=articulo, cantidad=cantidad)
    )
    solicitud = crear_solicitud(db, datos, usuario.id)
    cambiar_estado_solicitud(db, solicitud, "aprobada", usuario.id)
    evento = db.scalar(select(EventLog).where(EventLog.entidad_id == solicitud.id))
    return solicitud, evento


def _ejecutar(db, regla, evento):
    return ejecutar_generar_orden_compra(db, regla, evento, WorkflowExecution())


def _ordenes(db):
    return db.scalars(select(OrdenCompra)).all()


def test_emite_la_orden_con_el_unico_proveedor_activo(db_session, usuario, producto, regla):
    proveedor = _proveedor(db_session, producto)
    solicitud, evento = _aprobar(db_session, usuario, producto=producto, cantidad=12)

    resultado = _ejecutar(db_session, regla, evento)

    assert resultado.error is None
    assert "Papelera del Sur" in resultado.detalle
    [orden] = _ordenes(db_session)
    assert orden.proveedor_id == proveedor.id
    assert orden.estado == "emitida"
    [detalle] = db_session.scalars(select(OrdenCompraDetalle)).all()
    assert (detalle.producto_servicio_id, detalle.cantidad_pedida) == (producto.id, Decimal("12"))
    vinculo = db_session.scalars(select(OrdenCompraSolicitud)).one()
    assert vinculo.solicitud_compra_id == solicitud.id
    # La orden emitida dispara su propio evento, con el usuario que aprobó la solicitud.
    emitida = db_session.scalar(select(EventLog).where(EventLog.entidad_id == orden.id))
    assert emitida.usuario_id == usuario.id


def test_ignora_proveedores_inactivos(db_session, usuario, producto, regla):
    _proveedor(db_session, producto)
    _proveedor(db_session, producto, nombre="Librería Vieja", estado="inactivo")
    _, evento = _aprobar(db_session, usuario, producto=producto)

    assert _ejecutar(db_session, regla, evento).error is None
    assert len(_ordenes(db_session)) == 1


def test_es_idempotente(db_session, usuario, producto, regla):
    _proveedor(db_session, producto)
    _, evento = _aprobar(db_session, usuario, producto=producto)
    _ejecutar(db_session, regla, evento)

    resultado = _ejecutar(db_session, regla, evento)

    assert resultado.error is None
    assert "ya está en una orden" in resultado.detalle
    assert len(_ordenes(db_session)) == 1


def test_articulo_fuera_de_catalogo_falla_con_motivo(db_session, usuario, regla):
    _, evento = _aprobar(db_session, usuario, articulo="Tóner HP")

    resultado = _ejecutar(db_session, regla, evento)

    assert "fuera del catálogo" in resultado.error
    assert _ordenes(db_session) == []


@pytest.mark.parametrize(
    ("proveedores", "mensaje"), [(0, "no tiene un proveedor"), (2, "2 proveedores")]
)
def test_sin_proveedor_o_con_varios_falla_con_motivo(
    db_session, usuario, producto, regla, proveedores, mensaje
):
    for indice in range(proveedores):
        _proveedor(db_session, producto, nombre=f"Proveedor {indice}")
    _, evento = _aprobar(db_session, usuario, producto=producto)

    resultado = _ejecutar(db_session, regla, evento)

    assert mensaje in resultado.error
    assert _ordenes(db_session) == []


def test_producto_inactivo_falla_con_el_error_de_compras(db_session, usuario, producto, regla):
    _proveedor(db_session, producto)
    _, evento = _aprobar(db_session, usuario, producto=producto)
    producto.activo = False
    db_session.commit()

    resultado = _ejecutar(db_session, regla, evento)

    assert resultado.error is not None
    assert _ordenes(db_session) == []


def test_solicitud_rechazada_despues_no_genera_orden(db_session, usuario, producto, regla):
    _proveedor(db_session, producto)
    solicitud, evento = _aprobar(db_session, usuario, producto=producto)
    cambiar_estado_solicitud(db_session, solicitud, "rechazada")

    resultado = _ejecutar(db_session, regla, evento)

    assert "Sin cambios" in resultado.detalle
    assert _ordenes(db_session) == []


def test_solicitud_inexistente(db_session, usuario, producto, regla):
    _, evento = _aprobar(db_session, usuario, producto=producto)
    evento.entidad_id = uuid.uuid4()

    assert _ejecutar(db_session, regla, evento).error == "La solicitud del evento no existe."


def test_no_confirma_la_transaccion_del_llamador(db_session, usuario, producto, regla):
    _proveedor(db_session, producto)
    _, evento = _aprobar(db_session, usuario, producto=producto)
    _ejecutar(db_session, regla, evento)

    db_session.rollback()

    assert _ordenes(db_session) == []


def test_con_aprobacion_humana_queda_pendiente_hasta_aprobar(
    client, db_session, usuario, producto, regla
):
    _proveedor(db_session, producto)
    regla.requiere_aprobacion_humana = True
    db_session.commit()
    _aprobar(db_session, usuario, producto=producto)

    procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.workflow_rule_id == regla.id)
    ).one()
    assert ejecucion.estado == "pendiente"
    assert _ordenes(db_session) == []
