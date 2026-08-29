"""Tests para la generación de órdenes de compra (RF-21)."""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import (
    OrdenCompraNoCancelable,
    ProductoServicioInactivo,
    ProveedorInexistente,
    SolicitudNoAprobada,
    SolicitudYaEnOrden,
)
from src.proveedores_compras.models import OrdenCompraSolicitud, Proveedor, SolicitudCompra
from src.proveedores_compras.schemas import (
    OrdenCompraCreate,
    OrdenCompraDetalleCreate,
    ProductoServicioCreate,
    ProductoServicioUpdate,
    ProveedorCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    actualizar_producto_servicio,
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_solicitud,
    listar_ordenes_compra,
    obtener_detalles_de_orden,
    obtener_solicitudes_de_orden,
)


def _proveedor(db: Session, nombre: str = "Papelera del Sur") -> Proveedor:
    return crear_proveedor(db, ProveedorCreate(nombre=nombre))


def _producto(db: Session, nombre: str = "Resma A4"):
    return crear_producto_servicio(db, ProductoServicioCreate(nombre=nombre, tipo="producto"))


def _solicitud_aprobada(db: Session, articulo: str = "Resmas A4") -> SolicitudCompra:
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(articulo=articulo, cantidad=10), uuid.uuid4()
    )
    return cambiar_estado_solicitud(db, solicitud, "aprobada")


class TestOrdenCompraService:
    """Tests para la lógica de negocio de OrdenCompra."""

    def test_crear_orden_queda_emitida_y_con_fecha_de_hoy(self, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)

        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )

        assert orden.estado == "emitida"
        assert orden.fecha == date.today()
        assert orden.proveedor_id == proveedor.id

    def test_orden_agrupa_varias_solicitudes_y_cada_una_conserva_su_id(self, db_session: Session):
        """Respuesta 12 del cliente: una orden agrupa varias solicitudes, con trazabilidad."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        primera = _solicitud_aprobada(db_session, "Resmas A4")
        segunda = _solicitud_aprobada(db_session, "Resmas oficio")

        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[primera.id, segunda.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=15)
                ],
            ),
        )

        vinculadas = obtener_solicitudes_de_orden(db_session, orden.id)
        assert sorted(vinculadas) == sorted([primera.id, segunda.id])

    def test_el_detalle_puede_consolidar_lo_pedido_en_una_sola_linea(self, db_session: Session):
        """Dos solicitudes del mismo ítem se piden en una línea con la cantidad sumada."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        primera = _solicitud_aprobada(db_session, "Resmas A4")
        segunda = _solicitud_aprobada(db_session, "Más resmas A4")

        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[primera.id, segunda.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=20)
                ],
            ),
        )

        detalles = obtener_detalles_de_orden(db_session, orden.id)
        assert len(detalles) == 1
        assert detalles[0].cantidad_pedida == 20

    def test_solicitud_pendiente_no_puede_entrar_en_una_orden(self, db_session: Session):
        """RF-21 es explícito: solo aprobadas. Comprar contra un pendiente saltea la
        autorización."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        pendiente = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        with pytest.raises(SolicitudNoAprobada):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[pendiente.id],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

    def test_solicitud_rechazada_tampoco(self, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )
        cambiar_estado_solicitud(db_session, solicitud, "rechazada")

        with pytest.raises(SolicitudNoAprobada):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[solicitud.id],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

    def test_solicitud_inexistente_rechaza(self, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)

        with pytest.raises(SolicitudNoAprobada):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[uuid.uuid4()],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

    def test_una_solicitud_no_puede_estar_en_dos_ordenes(self, db_session: Session):
        """Sin esto, el mismo pedido se compraría dos veces sin que nada avise."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        datos = OrdenCompraCreate(
            proveedor_id=proveedor.id,
            solicitud_ids=[solicitud.id],
            detalles=[
                OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
            ],
        )
        crear_orden_compra(db_session, datos)

        with pytest.raises(SolicitudYaEnOrden):
            crear_orden_compra(db_session, datos)

    def test_proveedor_inexistente_rechaza(self, db_session: Session):
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)

        with pytest.raises(ProveedorInexistente):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=uuid.uuid4(),
                    solicitud_ids=[solicitud.id],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

    def test_no_se_puede_pedir_un_item_inactivo(self, db_session: Session):
        """Un ítem dado de baja del catálogo no entra en compras nuevas."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        actualizar_producto_servicio(db_session, producto, ProductoServicioUpdate(activo=False))
        solicitud = _solicitud_aprobada(db_session)

        with pytest.raises(ProductoServicioInactivo):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[solicitud.id],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=producto.id, cantidad_pedida=10
                        )
                    ],
                ),
            )

    def test_una_orden_fallida_no_deja_nada_a_medias(self, db_session: Session):
        """El ítem inactivo se valida antes de escribir: no puede quedar una orden huérfana."""
        proveedor = _proveedor(db_session)
        activo = _producto(db_session, "Resma A4")
        inactivo = _producto(db_session, "Toner viejo")
        actualizar_producto_servicio(db_session, inactivo, ProductoServicioUpdate(activo=False))
        solicitud = _solicitud_aprobada(db_session)

        with pytest.raises(ProductoServicioInactivo):
            crear_orden_compra(
                db_session,
                OrdenCompraCreate(
                    proveedor_id=proveedor.id,
                    solicitud_ids=[solicitud.id],
                    detalles=[
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=activo.id, cantidad_pedida=10
                        ),
                        OrdenCompraDetalleCreate(
                            producto_servicio_id=inactivo.id, cantidad_pedida=5
                        ),
                    ],
                ),
            )

        assert listar_ordenes_compra(db_session) == []
        assert db_session.query(OrdenCompraSolicitud).count() == 0

    def test_cancelar_orden_emitida(self, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )

        cancelada = cancelar_orden_compra(db_session, orden)

        assert cancelada.estado == "cancelada"

    def test_no_se_puede_cancelar_una_orden_recibida(self, db_session: Session):
        """Una orden recibida ya tiene mercadería asociada."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )
        orden.estado = "recibida"
        db_session.commit()

        with pytest.raises(OrdenCompraNoCancelable):
            cancelar_orden_compra(db_session, orden)


class TestOrdenCompraSchema:
    """Validaciones que se resuelven antes de tocar la base."""

    def test_sin_solicitudes_es_invalida(self):
        with pytest.raises(ValueError):
            OrdenCompraCreate(
                proveedor_id=uuid.uuid4(),
                solicitud_ids=[],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=uuid.uuid4(), cantidad_pedida=1)
                ],
            )

    def test_sin_detalle_es_invalida(self):
        with pytest.raises(ValueError):
            OrdenCompraCreate(proveedor_id=uuid.uuid4(), solicitud_ids=[uuid.uuid4()], detalles=[])

    def test_solicitud_repetida_es_invalida(self):
        solicitud_id = uuid.uuid4()

        with pytest.raises(ValueError, match="repetidas"):
            OrdenCompraCreate(
                proveedor_id=uuid.uuid4(),
                solicitud_ids=[solicitud_id, solicitud_id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=uuid.uuid4(), cantidad_pedida=1)
                ],
            )

    def test_item_repetido_en_el_detalle_es_invalido(self):
        """Dos líneas del mismo producto esconden la cantidad real: se suman en una."""
        producto_id = uuid.uuid4()

        with pytest.raises(ValueError, match="repetidos"):
            OrdenCompraCreate(
                proveedor_id=uuid.uuid4(),
                solicitud_ids=[uuid.uuid4()],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto_id, cantidad_pedida=1),
                    OrdenCompraDetalleCreate(producto_servicio_id=producto_id, cantidad_pedida=2),
                ],
            )

    def test_cantidad_cero_es_invalida(self):
        with pytest.raises(ValueError):
            OrdenCompraDetalleCreate(producto_servicio_id=uuid.uuid4(), cantidad_pedida=0)


class TestOrdenCompraEndpoints:
    """Tests para los endpoints de OrdenCompra."""

    def test_crear_orden_endpoint(self, client_autenticado: TestClient, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)

        response = client_autenticado.post(
            "/proveedores-compras/ordenes",
            json={
                "proveedor_id": str(proveedor.id),
                "solicitud_ids": [str(solicitud.id)],
                "detalles": [
                    {"producto_servicio_id": str(producto.id), "cantidad_pedida": "10.00"}
                ],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["estado"] == "emitida"
        assert len(data["detalles"]) == 1
        assert data["solicitud_ids"] == [str(solicitud.id)]

    def test_crear_con_solicitud_pendiente_da_422(
        self, client_autenticado: TestClient, db_session: Session
    ):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        pendiente = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.post(
            "/proveedores-compras/ordenes",
            json={
                "proveedor_id": str(proveedor.id),
                "solicitud_ids": [str(pendiente.id)],
                "detalles": [
                    {"producto_servicio_id": str(producto.id), "cantidad_pedida": "10.00"}
                ],
            },
        )

        assert response.status_code == 422

    def test_listar_ordenes_endpoint(self, client_autenticado: TestClient, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )

        response = client_autenticado.get("/proveedores-compras/ordenes")

        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_obtener_orden_no_existente_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.get(f"/proveedores-compras/ordenes/{uuid.uuid4()}")

        assert response.status_code == 404

    def test_cancelar_orden_endpoint(self, client_autenticado: TestClient, db_session: Session):
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )

        response = client_autenticado.patch(
            f"/proveedores-compras/ordenes/{orden.id}/estado", json={"estado": "cancelada"}
        )

        assert response.status_code == 200
        assert response.json()["estado"] == "cancelada"

    def test_no_se_puede_marcar_recibida_a_mano(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """`recibida` lo define la recepción de compras (#111), no una edición manual."""
        proveedor = _proveedor(db_session)
        producto = _producto(db_session)
        solicitud = _solicitud_aprobada(db_session)
        orden = crear_orden_compra(
            db_session,
            OrdenCompraCreate(
                proveedor_id=proveedor.id,
                solicitud_ids=[solicitud.id],
                detalles=[
                    OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
                ],
            ),
        )

        response = client_autenticado.patch(
            f"/proveedores-compras/ordenes/{orden.id}/estado", json={"estado": "recibida"}
        )

        assert response.status_code == 422

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        assert client.get("/proveedores-compras/ordenes").status_code == 401
