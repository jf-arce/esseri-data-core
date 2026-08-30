"""Tests para el ABM del catálogo de productos y servicios."""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import ProductoServicioEnUso
from src.proveedores_compras.models import OrdenCompra, OrdenCompraDetalle
from src.proveedores_compras.schemas import (
    ProductoServicioCreate,
    ProductoServicioUpdate,
    ProveedorCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    actualizar_producto_servicio,
    crear_producto_servicio,
    crear_proveedor,
    crear_solicitud,
    eliminar_producto_servicio,
    listar_productos_servicios,
    obtener_producto_servicio_por_id,
)


def _resma() -> ProductoServicioCreate:
    return ProductoServicioCreate(
        nombre="Resma A4", categoria="Librería", unidad="unidad", tipo="producto"
    )


class TestProductoServicioService:
    """Tests para la lógica de negocio del catálogo."""

    def test_crear_producto_queda_activo(self, db_session: Session):
        producto = crear_producto_servicio(db_session, _resma())

        assert producto.id is not None
        assert producto.nombre == "Resma A4"
        assert producto.tipo == "producto"
        assert producto.activo is True

    def test_crear_servicio(self, db_session: Session):
        """El catálogo cubre servicios además de productos."""
        servicio = crear_producto_servicio(
            db_session,
            ProductoServicioCreate(nombre="Mantenimiento de aire", tipo="servicio", unidad="hora"),
        )

        assert servicio.tipo == "servicio"

    def test_listar_ordena_por_nombre(self, db_session: Session):
        crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Toner negro", tipo="producto")
        )
        crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Alcohol en gel", tipo="producto")
        )

        nombres = [p.nombre for p in listar_productos_servicios(db_session)]

        assert nombres == ["Alcohol en gel", "Toner negro"]

    def test_listar_incluye_los_inactivos(self, db_session: Session):
        """Quien administra el catálogo tiene que poder ver un inactivo para reactivarlo."""
        producto = crear_producto_servicio(db_session, _resma())
        actualizar_producto_servicio(db_session, producto, ProductoServicioUpdate(activo=False))

        assert len(listar_productos_servicios(db_session)) == 1

    def test_actualizar_no_pisa_campos_no_enviados(self, db_session: Session):
        producto = crear_producto_servicio(db_session, _resma())

        actualizado = actualizar_producto_servicio(
            db_session, producto, ProductoServicioUpdate(activo=False)
        )

        assert actualizado.activo is False
        assert actualizado.nombre == "Resma A4"
        assert actualizado.categoria == "Librería"
        assert actualizado.unidad == "unidad"

    def test_eliminar_producto_sin_uso(self, db_session: Session):
        producto = crear_producto_servicio(db_session, _resma())
        producto_id = producto.id

        eliminar_producto_servicio(db_session, producto)

        assert obtener_producto_servicio_por_id(db_session, producto_id) is None

    def test_eliminar_producto_usado_en_una_solicitud_rechaza(self, db_session: Session):
        """Borrarlo dejaría la solicitud apuntando a nada."""
        producto = crear_producto_servicio(db_session, _resma())
        crear_solicitud(
            db_session,
            SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=5),
            uuid.uuid4(),
        )

        with pytest.raises(ProductoServicioEnUso):
            eliminar_producto_servicio(db_session, producto)

        assert obtener_producto_servicio_por_id(db_session, producto.id) is not None

    def test_eliminar_producto_usado_en_una_orden_rechaza(self, db_session: Session):
        """Mismo criterio para el detalle de una orden ya emitida."""
        producto = crear_producto_servicio(db_session, _resma())
        proveedor = crear_proveedor(db_session, ProveedorCreate(nombre="Papelera del Sur"))
        orden = OrdenCompra(fecha=date(2026, 8, 29), estado="emitida", proveedor_id=proveedor.id)
        db_session.add(orden)
        db_session.commit()
        db_session.refresh(orden)
        db_session.add(
            OrdenCompraDetalle(
                cantidad_pedida=10, orden_compra_id=orden.id, producto_servicio_id=producto.id
            )
        )
        db_session.commit()

        with pytest.raises(ProductoServicioEnUso):
            eliminar_producto_servicio(db_session, producto)


class TestProductoServicioEndpoints:
    """Tests para los endpoints del catálogo."""

    def test_crear_producto_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.post(
            "/proveedores-compras/productos",
            json={"nombre": "Resma A4", "tipo": "producto", "categoria": "Librería"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["nombre"] == "Resma A4"
        assert data["activo"] is True

    def test_crear_con_tipo_invalido_rechaza(self, client_autenticado: TestClient):
        """El `Literal` corta el tipo inventado con 422, no con un 500 de la base."""
        response = client_autenticado.post(
            "/proveedores-compras/productos", json={"nombre": "Resma A4", "tipo": "insumo"}
        )

        assert response.status_code == 422

    def test_crear_sin_tipo_rechaza(self, client_autenticado: TestClient):
        response = client_autenticado.post(
            "/proveedores-compras/productos", json={"nombre": "Resma A4"}
        )

        assert response.status_code == 422

    def test_listar_productos_endpoint(self, client_autenticado: TestClient, db_session: Session):
        crear_producto_servicio(db_session, _resma())

        response = client_autenticado.get("/proveedores-compras/productos")

        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_obtener_producto_no_existente_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.get(f"/proveedores-compras/productos/{uuid.uuid4()}")

        assert response.status_code == 404

    def test_dar_de_baja_con_activo_false(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """La baja del catálogo es soft-delete, no borrado."""
        producto = crear_producto_servicio(db_session, _resma())

        response = client_autenticado.put(
            f"/proveedores-compras/productos/{producto.id}", json={"activo": False}
        )

        assert response.status_code == 200
        assert response.json()["activo"] is False

    def test_eliminar_producto_endpoint(self, client_autenticado: TestClient, db_session: Session):
        producto = crear_producto_servicio(db_session, _resma())

        response = client_autenticado.delete(f"/proveedores-compras/productos/{producto.id}")

        assert response.status_code == 204

    def test_eliminar_producto_en_uso_da_409(
        self, client_autenticado: TestClient, db_session: Session
    ):
        producto = crear_producto_servicio(db_session, _resma())
        crear_solicitud(
            db_session,
            SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=5),
            uuid.uuid4(),
        )

        response = client_autenticado.delete(f"/proveedores-compras/productos/{producto.id}")

        assert response.status_code == 409

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        assert client.get("/proveedores-compras/productos").status_code == 401
        assert (
            client.post(
                "/proveedores-compras/productos", json={"nombre": "Resma A4", "tipo": "producto"}
            ).status_code
            == 401
        )
