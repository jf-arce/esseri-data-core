"""RF-13/RF-14: cada operación de escritura de este módulo tiene que dejar su rastro en
AUDIT_LOG vía `log_audit()` (src/auditoria/service.py) -- mismo criterio ya aplicado en
familias_alumnos (ver tests/familias_alumnos/test_auditoria.py)."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import AuditLog
from src.proveedores_compras.schemas import (
    OrdenCompraCreate,
    OrdenCompraDetalleCreate,
    ProductoServicioCreate,
    ProductoServicioUpdate,
    ProveedorCreate,
    ProveedorUpdate,
    RecepcionCompraCreate,
    RecepcionCompraDetalleCreate,
    SolicitudCompraCreate,
    SolicitudCompraUpdate,
)
from src.proveedores_compras.service import (
    actualizar_producto_servicio,
    actualizar_proveedor,
    actualizar_solicitud,
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_recepcion,
    crear_solicitud,
    eliminar_producto_servicio,
    eliminar_proveedor,
    eliminar_solicitud,
    obtener_detalles_de_orden,
)


def _crear_usuario(db_session, email="auditor@esseri.edu.ar"):
    usuario = Usuario(
        email=email, password_hash="hash-de-prueba", auth_provider="local", estado="activo"
    )
    db_session.add(usuario)
    db_session.flush()
    return usuario


def _historial(db_session, entidad: str, entidad_id: uuid.UUID) -> list[AuditLog]:
    return list(
        db_session.scalars(
            select(AuditLog)
            .where(AuditLog.entidad == entidad, AuditLog.entidad_id == entidad_id)
            .order_by(AuditLog.fecha)
        )
    )


class TestAuditoriaProveedor:
    def test_crear_proveedor_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        proveedor = crear_proveedor(
            db_session, ProveedorCreate(nombre="Papelera del Sur"), usuario.id
        )

        registros = _historial(db_session, "PROVEEDOR", proveedor.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Papelera del Sur"
        assert registros[0].usuario_id == usuario.id

    def test_actualizar_proveedor_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))

        actualizar_proveedor(
            db_session, proveedor, ProveedorUpdate(telefono="221-555-0100"), usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "PROVEEDOR", proveedor.id)}
        assert registros["telefono"].valor_anterior is None
        assert registros["telefono"].valor_nuevo == "221-555-0100"

    def test_eliminar_proveedor_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))
        proveedor_id = proveedor.id

        eliminar_proveedor(db_session, proveedor, usuario.id)

        registros = _historial(db_session, "PROVEEDOR", proveedor_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"
        assert registros[0].valor_anterior == "Papelera del Sur"


class TestAuditoriaSolicitudCompra:
    def test_crear_solicitud_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), usuario.id
        )

        registros = _historial(db_session, "SOLICITUD_COMPRA", solicitud.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Resmas A4"

    def test_cambiar_estado_solicitud_audita_el_campo_estado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        cambiar_estado_solicitud(db_session, solicitud, "aprobada", usuario.id)

        registros = _historial(db_session, "SOLICITUD_COMPRA", solicitud.id)
        cambio = next(r for r in registros if r.campo == "estado")
        assert cambio.valor_anterior == "pendiente"
        assert cambio.valor_nuevo == "aprobada"
        assert cambio.usuario_id == usuario.id

    def test_actualizar_solicitud_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        actualizar_solicitud(db_session, solicitud, SolicitudCompraUpdate(cantidad=20), usuario.id)

        registros = {r.campo: r for r in _historial(db_session, "SOLICITUD_COMPRA", solicitud.id)}
        assert registros["cantidad"].valor_anterior == "10"
        assert registros["cantidad"].valor_nuevo == "20"

    def test_eliminar_solicitud_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), usuario.id
        )
        solicitud_id = solicitud.id

        eliminar_solicitud(db_session, solicitud, usuario.id)

        registros = {r.campo: r for r in _historial(db_session, "SOLICITUD_COMPRA", solicitud_id)}
        assert registros["__eliminacion__"].valor_anterior == "Resmas A4"


class TestAuditoriaProductoServicio:
    def test_crear_producto_servicio_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        producto = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto"), usuario.id
        )

        registros = _historial(db_session, "PRODUCTO_SERVICIO", producto.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].valor_nuevo == "Resma A4"

    def test_actualizar_producto_servicio_audita_campo_cambiado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
        )

        actualizar_producto_servicio(
            db_session, producto, ProductoServicioUpdate(activo=False), usuario.id
        )

        registros = {r.campo: r for r in _historial(db_session, "PRODUCTO_SERVICIO", producto.id)}
        assert registros["activo"].valor_anterior == "True"
        assert registros["activo"].valor_nuevo == "False"

    def test_eliminar_producto_servicio_audita_baja(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
        )
        producto_id = producto.id

        eliminar_producto_servicio(db_session, producto, usuario.id)

        registros = _historial(db_session, "PRODUCTO_SERVICIO", producto_id)
        assert len(registros) == 1
        assert registros[0].campo == "__eliminacion__"


class TestAuditoriaOrdenYRecepcion:
    def _orden_emitida(self, db_session, usuario_id=None):
        proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))
        producto = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
        )
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )
        cambiar_estado_solicitud(db_session, solicitud, "aprobada")
        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
            usuario_id,
        )
        return orden, producto

    def test_crear_orden_compra_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)

        orden, _ = self._orden_emitida(db_session, usuario.id)

        registros = _historial(db_session, "ORDEN_COMPRA", orden.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id

    def test_cancelar_orden_compra_audita_cambio_de_estado(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden, _ = self._orden_emitida(db_session)

        cancelar_orden_compra(db_session, orden, usuario.id)

        registros = _historial(db_session, "ORDEN_COMPRA", orden.id)
        cambio = next(r for r in registros if r.campo == "estado")
        assert cambio.valor_anterior == "emitida"
        assert cambio.valor_nuevo == "cancelada"

    def test_crear_recepcion_audita_alta(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        orden, _producto = self._orden_emitida(db_session)
        (detalle_orden,) = obtener_detalles_de_orden(db_session, orden.id)

        recepcion = crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=detalle_orden.id, cantidad_recibida=10
                    )
                ]
            ),
            usuario.id,
        )

        registros = _historial(db_session, "RECEPCION_COMPRA", recepcion.id)
        assert len(registros) == 1
        assert registros[0].campo == "__alta__"
        assert registros[0].usuario_id == usuario.id
