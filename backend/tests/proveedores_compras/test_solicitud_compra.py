"""Tests para las solicitudes internas de compra (RF-20)."""

import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import (
    ProductoServicioInexistente,
    SolicitudSinArticuloNiProducto,
)
from src.proveedores_compras.models import ProductoServicio
from src.proveedores_compras.schemas import SolicitudCompraCreate, SolicitudCompraUpdate
from src.proveedores_compras.service import (
    actualizar_solicitud,
    cambiar_estado_solicitud,
    crear_solicitud,
    eliminar_solicitud,
    listar_solicitudes,
    obtener_solicitud_por_id,
)


def _producto(db: Session, nombre: str = "Resma A4") -> ProductoServicio:
    producto = ProductoServicio(nombre=nombre, tipo="producto", categoria="Librería")
    db.add(producto)
    db.commit()
    db.refresh(producto)
    return producto


class TestSolicitudCompraSchema:
    """La regla artículo/producto se valida antes de tocar la base."""

    def test_sin_articulo_ni_producto_es_invalida(self):
        """Regla del modelo: tiene que venir uno de los dos."""
        with pytest.raises(ValueError, match="artículo o un producto"):
            SolicitudCompraCreate(cantidad=5)

    def test_alcanza_con_el_articulo_libre(self):
        solicitud = SolicitudCompraCreate(articulo="Resmas A4", cantidad=5)

        assert solicitud.articulo == "Resmas A4"
        assert solicitud.producto_servicio_id is None

    def test_alcanza_con_el_producto_de_catalogo(self):
        producto_id = uuid.uuid4()

        solicitud = SolicitudCompraCreate(producto_servicio_id=producto_id, cantidad=5)

        assert solicitud.producto_servicio_id == producto_id

    def test_cantidad_cero_o_negativa_es_invalida(self):
        with pytest.raises(ValueError):
            SolicitudCompraCreate(articulo="Resmas A4", cantidad=0)
        with pytest.raises(ValueError):
            SolicitudCompraCreate(articulo="Resmas A4", cantidad=-3)


class TestSolicitudCompraService:
    """Tests para la lógica de negocio de SolicitudCompra."""

    def test_crear_solicitud_queda_pendiente_y_con_fecha_de_hoy(self, db_session: Session):
        usuario_id = uuid.uuid4()

        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), usuario_id
        )

        assert solicitud.estado == "pendiente"
        assert solicitud.fecha == date.today()
        assert solicitud.usuario_id == usuario_id

    def test_crear_solicitud_respeta_la_fecha_informada(self, db_session: Session):
        """Se puede cargar un pedido en diferido."""
        solicitud = crear_solicitud(
            db_session,
            SolicitudCompraCreate(articulo="Resmas A4", cantidad=10, fecha=date(2026, 8, 1)),
            uuid.uuid4(),
        )

        assert solicitud.fecha == date(2026, 8, 1)

    def test_crear_solicitud_con_producto_inexistente_rechaza(self, db_session: Session):
        """Un FK inválido daría IntegrityError (500): se corta antes con un 422."""
        with pytest.raises(ProductoServicioInexistente):
            crear_solicitud(
                db_session,
                SolicitudCompraCreate(producto_servicio_id=uuid.uuid4(), cantidad=1),
                uuid.uuid4(),
            )

    def test_crear_solicitud_con_producto_de_catalogo(self, db_session: Session):
        producto = _producto(db_session)

        solicitud = crear_solicitud(
            db_session,
            SolicitudCompraCreate(producto_servicio_id=producto.id, cantidad=2),
            uuid.uuid4(),
        )

        assert solicitud.producto_servicio_id == producto.id
        assert solicitud.articulo is None

    def test_listar_ordena_de_mas_reciente_a_mas_vieja(self, db_session: Session):
        usuario_id = uuid.uuid4()
        crear_solicitud(
            db_session,
            SolicitudCompraCreate(articulo="Vieja", cantidad=1, fecha=date(2026, 1, 5)),
            usuario_id,
        )
        crear_solicitud(
            db_session,
            SolicitudCompraCreate(articulo="Nueva", cantidad=1, fecha=date(2026, 8, 20)),
            usuario_id,
        )

        assert [s.articulo for s in listar_solicitudes(db_session)] == ["Nueva", "Vieja"]

    def test_actualizar_no_pisa_campos_no_enviados(self, db_session: Session):
        solicitud = crear_solicitud(
            db_session,
            SolicitudCompraCreate(articulo="Resmas A4", cantidad=10, area_solicitante="Secretaría"),
            uuid.uuid4(),
        )

        actualizado = actualizar_solicitud(
            db_session, solicitud, SolicitudCompraUpdate(cantidad=25)
        )

        assert actualizado.cantidad == 25
        assert actualizado.articulo == "Resmas A4"
        assert actualizado.area_solicitante == "Secretaría"

    def test_actualizar_no_puede_dejarla_sin_articulo_ni_producto(self, db_session: Session):
        """El validador del schema no alcanza acá: el otro valor vive en la fila, no en el
        payload."""
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        with pytest.raises(SolicitudSinArticuloNiProducto):
            actualizar_solicitud(db_session, solicitud, SolicitudCompraUpdate(articulo=None))

    def test_actualizar_permite_borrar_el_articulo_si_queda_el_producto(self, db_session: Session):
        """Pasar de texto libre a catálogo en un solo request es válido."""
        producto = _producto(db_session)
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        actualizado = actualizar_solicitud(
            db_session,
            solicitud,
            SolicitudCompraUpdate(articulo=None, producto_servicio_id=producto.id),
        )

        assert actualizado.articulo is None
        assert actualizado.producto_servicio_id == producto.id

    def test_cambiar_estado(self, db_session: Session):
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        aprobada = cambiar_estado_solicitud(db_session, solicitud, "aprobada")

        assert aprobada.estado == "aprobada"

    def test_eliminar_solicitud(self, db_session: Session):
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )
        solicitud_id = solicitud.id

        eliminar_solicitud(db_session, solicitud)

        assert obtener_solicitud_por_id(db_session, solicitud_id) is None


class TestSolicitudCompraEndpoints:
    """Tests para los endpoints de SolicitudCompra."""

    def test_crear_solicitud_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.post(
            "/proveedores-compras/solicitudes",
            json={"articulo": "Resmas A4", "cantidad": 10, "area_solicitante": "Secretaría"},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["estado"] == "pendiente"
        assert data["cantidad"] == 10

    def test_crear_solicitud_toma_el_solicitante_de_la_sesion(self, client_autenticado: TestClient):
        """`usuario_id` no se acepta del payload: lo pone el backend desde la sesión."""
        usuario_falso = str(uuid.uuid4())

        response = client_autenticado.post(
            "/proveedores-compras/solicitudes",
            json={"articulo": "Resmas A4", "cantidad": 1, "usuario_id": usuario_falso},
        )

        assert response.status_code == 201
        assert response.json()["usuario_id"] != usuario_falso

    def test_crear_sin_articulo_ni_producto_rechaza(self, client_autenticado: TestClient):
        response = client_autenticado.post("/proveedores-compras/solicitudes", json={"cantidad": 5})

        assert response.status_code == 422

    def test_crear_con_cantidad_invalida_rechaza(self, client_autenticado: TestClient):
        response = client_autenticado.post(
            "/proveedores-compras/solicitudes", json={"articulo": "Resmas A4", "cantidad": 0}
        )

        assert response.status_code == 422

    def test_listar_solicitudes_endpoint(self, client_autenticado: TestClient, db_session: Session):
        crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.get("/proveedores-compras/solicitudes")

        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_obtener_solicitud_no_existente_endpoint(self, client_autenticado: TestClient):
        response = client_autenticado.get(f"/proveedores-compras/solicitudes/{uuid.uuid4()}")

        assert response.status_code == 404

    def test_cambiar_estado_endpoint(self, client_autenticado: TestClient, db_session: Session):
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.patch(
            f"/proveedores-compras/solicitudes/{solicitud.id}/estado",
            json={"estado": "aprobada"},
        )

        assert response.status_code == 200
        assert response.json()["estado"] == "aprobada"

    def test_cambiar_estado_invalido_rechaza(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """El `Literal` corta el estado inventado con 422, no con un 500 de la base."""
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.patch(
            f"/proveedores-compras/solicitudes/{solicitud.id}/estado",
            json={"estado": "en_camino"},
        )

        assert response.status_code == 422

    def test_actualizar_que_la_deja_sin_articulo_da_422(
        self, client_autenticado: TestClient, db_session: Session
    ):
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.put(
            f"/proveedores-compras/solicitudes/{solicitud.id}", json={"articulo": None}
        )

        assert response.status_code == 422

    def test_eliminar_solicitud_endpoint(self, client_autenticado: TestClient, db_session: Session):
        solicitud = crear_solicitud(
            db_session, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
        )

        response = client_autenticado.delete(f"/proveedores-compras/solicitudes/{solicitud.id}")

        assert response.status_code == 204

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        assert client.get("/proveedores-compras/solicitudes").status_code == 401
        assert (
            client.post(
                "/proveedores-compras/solicitudes", json={"articulo": "Resmas A4", "cantidad": 1}
            ).status_code
            == 401
        )
