"""Tests para el ABM de Proveedor (RF-19)."""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import ProveedorConVinculos
from src.proveedores_compras.models import OrdenCompra
from src.proveedores_compras.schemas import ProveedorCreate, ProveedorUpdate
from src.proveedores_compras.service import (
    actualizar_proveedor,
    crear_proveedor,
    eliminar_proveedor,
    listar_proveedores,
    obtener_proveedor_por_id,
)


def _proveedor_de_prueba(nombre: str = "Librería Central") -> ProveedorCreate:
    return ProveedorCreate(
        nombre=nombre,
        categoria="Librería",
        telefono="221-555-0100",
        email="ventas@libreriacentral.com.ar",
    )


class TestProveedorService:
    """Tests para la lógica de negocio de Proveedor."""

    def test_crear_proveedor(self, db_session: Session):
        """Un proveedor nuevo queda activo por defecto."""
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        assert proveedor.id is not None
        assert proveedor.nombre == "Librería Central"
        assert proveedor.categoria == "Librería"
        assert proveedor.estado == "activo"

    def test_obtener_proveedor_por_id(self, db_session: Session):
        creado = crear_proveedor(db_session, _proveedor_de_prueba())

        obtenido = obtener_proveedor_por_id(db_session, creado.id)

        assert obtenido is not None
        assert obtenido.id == creado.id

    def test_obtener_proveedor_por_id_no_existente(self, db_session: Session):
        assert obtener_proveedor_por_id(db_session, uuid.uuid4()) is None

    def test_listar_proveedores_ordena_por_nombre(self, db_session: Session):
        """El listado sale alfabético, no por orden de inserción."""
        crear_proveedor(db_session, _proveedor_de_prueba("Zapatería Sur"))
        crear_proveedor(db_session, _proveedor_de_prueba("Alimentos del Río"))

        nombres = [p.nombre for p in listar_proveedores(db_session)]

        assert nombres == ["Alimentos del Río", "Zapatería Sur"]

    def test_actualizar_proveedor_no_pisa_campos_no_enviados(self, db_session: Session):
        """`exclude_unset`: mandar solo `telefono` no debe blanquear `categoria` ni `email`.

        Es el punto que más fácil se rompe si alguien cambia el service por un
        `model_dump()` sin `exclude_unset`.
        """
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        actualizado = actualizar_proveedor(
            db_session, proveedor, ProveedorUpdate(telefono="221-555-0999")
        )

        assert actualizado.telefono == "221-555-0999"
        assert actualizado.categoria == "Librería"
        assert actualizado.email == "ventas@libreriacentral.com.ar"
        assert actualizado.nombre == "Librería Central"

    def test_actualizar_proveedor_permite_dar_de_baja(self, db_session: Session):
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        actualizado = actualizar_proveedor(
            db_session, proveedor, ProveedorUpdate(estado="inactivo")
        )

        assert actualizado.estado == "inactivo"

    def test_eliminar_proveedor(self, db_session: Session):
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())
        proveedor_id = proveedor.id

        eliminar_proveedor(db_session, proveedor)

        assert obtener_proveedor_por_id(db_session, proveedor_id) is None

    def test_eliminar_proveedor_con_orden_asociada_rechaza(self, db_session: Session):
        """Borrar un proveedor con una orden de compra dejaría la orden colgada."""
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())
        db_session.add(
            OrdenCompra(fecha=date(2026, 8, 29), estado="emitida", proveedor_id=proveedor.id)
        )
        db_session.commit()

        with pytest.raises(ProveedorConVinculos):
            eliminar_proveedor(db_session, proveedor)

        assert obtener_proveedor_por_id(db_session, proveedor.id) is not None


class TestProveedorEndpoints:
    """Tests para los endpoints de Proveedor."""

    def test_crear_proveedor_endpoint(self, client_autenticado: TestClient):
        """POST /proveedores-compras/proveedores."""
        response = client_autenticado.post(
            "/proveedores-compras/proveedores",
            json={"nombre": "Papelera del Sur", "categoria": "Papelería"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["id"] is not None
        assert data["nombre"] == "Papelera del Sur"
        assert data["estado"] == "activo"

    def test_crear_proveedor_estado_invalido_rechaza(self, client_autenticado: TestClient):
        """El `Literal` del schema corta el estado inválido con 422, no con un 500 de la base."""
        response = client_autenticado.post(
            "/proveedores-compras/proveedores",
            json={"nombre": "Papelera del Sur", "estado": "suspendido"},
        )

        assert response.status_code == 422

    def test_crear_proveedor_sin_nombre_rechaza(self, client_autenticado: TestClient):
        response = client_autenticado.post(
            "/proveedores-compras/proveedores", json={"categoria": "Papelería"}
        )

        assert response.status_code == 422

    def test_listar_proveedores_endpoint(self, client_autenticado: TestClient, db_session: Session):
        """GET /proveedores-compras/proveedores."""
        crear_proveedor(db_session, _proveedor_de_prueba("Alimentos del Río"))
        crear_proveedor(db_session, _proveedor_de_prueba("Zapatería Sur"))

        response = client_autenticado.get("/proveedores-compras/proveedores")

        assert response.status_code == 200
        nombres = [p["nombre"] for p in response.json()]
        assert nombres == ["Alimentos del Río", "Zapatería Sur"]

    def test_obtener_proveedor_endpoint(self, client_autenticado: TestClient, db_session: Session):
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        response = client_autenticado.get(f"/proveedores-compras/proveedores/{proveedor.id}")

        assert response.status_code == 200
        assert response.json()["id"] == str(proveedor.id)

    def test_obtener_proveedor_no_existente_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.get(f"/proveedores-compras/proveedores/{uuid.uuid4()}")
        assert response.status_code == 404

    def test_actualizar_proveedor_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        response = client_autenticado.put(
            f"/proveedores-compras/proveedores/{proveedor.id}",
            json={"estado": "inactivo"},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["estado"] == "inactivo"
        assert data["nombre"] == "Librería Central"

    def test_eliminar_proveedor_endpoint(self, client_autenticado: TestClient, db_session: Session):
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())

        response = client_autenticado.delete(f"/proveedores-compras/proveedores/{proveedor.id}")

        assert response.status_code == 204
        assert (
            client_autenticado.get(f"/proveedores-compras/proveedores/{proveedor.id}").status_code
            == 404
        )

    def test_eliminar_proveedor_con_orden_asociada_rechaza(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """Tiene que dar 409, no un 500 crudo por la FK."""
        proveedor = crear_proveedor(db_session, _proveedor_de_prueba())
        db_session.add(
            OrdenCompra(fecha=date(2026, 8, 29), estado="emitida", proveedor_id=proveedor.id)
        )
        db_session.commit()

        response = client_autenticado.delete(f"/proveedores-compras/proveedores/{proveedor.id}")

        assert response.status_code == 409

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        """Todo el ABM exige sesión y permiso (RF-27 + RF-30)."""
        assert client.get("/proveedores-compras/proveedores").status_code == 401
        assert (
            client.post(
                "/proveedores-compras/proveedores", json={"nombre": "Papelera del Sur"}
            ).status_code
            == 401
        )
