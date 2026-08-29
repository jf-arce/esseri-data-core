"""Tests para la recepción de compras, total y parcial (issue #111)."""

import decimal
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.exceptions import (
    LineaAjenaALaOrden,
    OrdenNoRecibible,
    RecepcionExcedeLoPedido,
)
from src.proveedores_compras.models import OrdenCompra
from src.proveedores_compras.schemas import (
    OrdenCompraCreate,
    OrdenCompraDetalleCreate,
    ProductoServicioCreate,
    ProveedorCreate,
    RecepcionCompraCreate,
    RecepcionCompraDetalleCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    calcular_pendientes_de_orden,
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_recepcion,
    crear_solicitud,
    listar_recepciones_de_orden,
    obtener_detalles_de_orden,
)


def _orden_de_10(db: Session) -> OrdenCompra:
    """Una orden emitida con una sola línea de 10 unidades."""
    proveedor = crear_proveedor(db, ProveedorCreate(nombre="Papelera del Sur"))
    producto = crear_producto_servicio(
        db, ProductoServicioCreate(nombre="Resma A4", tipo="producto")
    )
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(articulo="Resmas A4", cantidad=10), uuid.uuid4()
    )
    cambiar_estado_solicitud(db, solicitud, "aprobada")
    return crear_orden_compra(
        db,
        OrdenCompraCreate(
            proveedor_id=proveedor.id,
            solicitud_ids=[solicitud.id],
            detalles=[
                OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=10)
            ],
        ),
    )


class TestCalculoDePendientes:
    """`cantidad_pendiente` es un derivado, no una columna."""

    def test_una_orden_sin_recepciones_tiene_todo_pendiente(self, db_session: Session):
        orden = _orden_de_10(db_session)

        pendientes = calcular_pendientes_de_orden(db_session, orden.id)

        assert len(pendientes) == 1
        assert pendientes[0].cantidad_pedida == 10
        assert pendientes[0].cantidad_recibida == 0
        assert pendientes[0].cantidad_pendiente == 10

    def test_una_recepcion_parcial_deja_el_resto_pendiente(self, db_session: Session):
        """Respuesta 13 del cliente: el faltante queda pendiente automáticamente."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=4
                    )
                ]
            ),
            uuid.uuid4(),
        )

        pendientes = calcular_pendientes_de_orden(db_session, orden.id)
        assert pendientes[0].cantidad_recibida == 4
        assert pendientes[0].cantidad_pendiente == 6

    def test_el_pendiente_acumula_varias_recepciones(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        for cantidad in (3, 2):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=cantidad
                        )
                    ]
                ),
                uuid.uuid4(),
            )

        pendientes = calcular_pendientes_de_orden(db_session, orden.id)
        assert pendientes[0].cantidad_recibida == 5
        assert pendientes[0].cantidad_pendiente == 5

    def test_soporta_cantidades_con_decimales(self, db_session: Session):
        """Las cantidades son Numeric(10,2): 2.5 kg de algo es un pedido válido."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=decimal.Decimal("2.50")
                    )
                ]
            ),
            uuid.uuid4(),
        )

        pendientes = calcular_pendientes_de_orden(db_session, orden.id)
        assert pendientes[0].cantidad_pendiente == decimal.Decimal("7.50")


class TestRecepcionService:
    """Tests para la lógica de negocio de RecepcionCompra."""

    def test_recepcion_parcial_se_marca_parcial_y_la_orden_sigue_emitida(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        recepcion = crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=4
                    )
                ]
            ),
            uuid.uuid4(),
        )

        assert recepcion.tipo == "parcial"
        assert orden.estado == "emitida"

    def test_recepcion_completa_se_marca_total_y_cierra_la_orden(self, db_session: Session):
        """Es el único lugar que pone la orden en `recibida`."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        recepcion = crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=10
                    )
                ]
            ),
            uuid.uuid4(),
        )

        assert recepcion.tipo == "total"
        assert orden.estado == "recibida"

    def test_la_segunda_entrega_que_completa_cierra_la_orden(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=6
                    )
                ]
            ),
            uuid.uuid4(),
        )

        segunda = crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=4
                    )
                ]
            ),
            uuid.uuid4(),
        )

        assert segunda.tipo == "total"
        assert orden.estado == "recibida"

    def test_no_se_puede_recibir_mas_de_lo_pedido(self, db_session: Session):
        """Recibir de más no es un ajuste silencioso: o hubo error de carga, o va otra orden."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        with pytest.raises(RecepcionExcedeLoPedido):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=11
                        )
                    ]
                ),
                uuid.uuid4(),
            )

    def test_tampoco_sumando_entre_varias_recepciones(self, db_session: Session):
        """El tope es acumulado, no por entrega."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=8
                    )
                ]
            ),
            uuid.uuid4(),
        )

        with pytest.raises(RecepcionExcedeLoPedido):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=3
                        )
                    ]
                ),
                uuid.uuid4(),
            )

    def test_no_se_puede_recibir_contra_una_orden_cancelada(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        cancelar_orden_compra(db_session, orden)

        with pytest.raises(OrdenNoRecibible):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=1
                        )
                    ]
                ),
                uuid.uuid4(),
            )

    def test_no_se_puede_recibir_contra_una_orden_ya_recibida(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=10
                    )
                ]
            ),
            uuid.uuid4(),
        )

        with pytest.raises(OrdenNoRecibible):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=1
                        )
                    ]
                ),
                uuid.uuid4(),
            )

    def test_no_se_puede_recibir_una_linea_de_otra_orden(self, db_session: Session):
        primera = _orden_de_10(db_session)
        segunda = _orden_de_10(db_session)
        linea_ajena = obtener_detalles_de_orden(db_session, segunda.id)[0]

        with pytest.raises(LineaAjenaALaOrden):
            crear_recepcion(
                db_session,
                primera,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea_ajena.id, cantidad_recibida=1
                        )
                    ]
                ),
                uuid.uuid4(),
            )

    def test_guarda_remito_observaciones_y_responsable(self, db_session: Session):
        """Todo lo que pidió el cliente en la respuesta 13."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        usuario_id = uuid.uuid4()

        recepcion = crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                fecha=date(2026, 8, 20),
                remito="R-0001-00012345",
                observaciones="Llegaron 4 de 10, el resto queda pendiente.",
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=4
                    )
                ],
            ),
            usuario_id,
        )

        assert recepcion.fecha == date(2026, 8, 20)
        assert recepcion.remito == "R-0001-00012345"
        assert recepcion.observaciones.startswith("Llegaron 4")
        assert recepcion.usuario_id == usuario_id

    def test_listar_recepciones_de_la_orden(self, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        for cantidad in (3, 2):
            crear_recepcion(
                db_session,
                orden,
                RecepcionCompraCreate(
                    detalles=[
                        RecepcionCompraDetalleCreate(
                            orden_compra_detalle_id=linea.id, cantidad_recibida=cantidad
                        )
                    ]
                ),
                uuid.uuid4(),
            )

        assert len(listar_recepciones_de_orden(db_session, orden.id)) == 2


class TestRecepcionSchema:
    """Validaciones previas a tocar la base."""

    def test_sin_detalle_es_invalida(self):
        with pytest.raises(ValueError):
            RecepcionCompraCreate(detalles=[])

    def test_cantidad_cero_es_invalida(self):
        with pytest.raises(ValueError):
            RecepcionCompraDetalleCreate(orden_compra_detalle_id=uuid.uuid4(), cantidad_recibida=0)

    def test_linea_repetida_es_invalida(self):
        linea_id = uuid.uuid4()

        with pytest.raises(ValueError, match="repetidas"):
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea_id, cantidad_recibida=1
                    ),
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea_id, cantidad_recibida=2
                    ),
                ]
            )


class TestRecepcionEndpoints:
    """Tests para los endpoints de recepción."""

    def test_pendientes_endpoint(self, client_autenticado: TestClient, db_session: Session):
        orden = _orden_de_10(db_session)

        response = client_autenticado.get(f"/proveedores-compras/ordenes/{orden.id}/pendientes")

        assert response.status_code == 200
        data = response.json()
        assert data[0]["cantidad_pendiente"] == "10.00"

    def test_crear_recepcion_endpoint(self, client_autenticado: TestClient, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        response = client_autenticado.post(
            f"/proveedores-compras/ordenes/{orden.id}/recepciones",
            json={
                "remito": "R-0001-00012345",
                "detalles": [
                    {"orden_compra_detalle_id": str(linea.id), "cantidad_recibida": "4.00"}
                ],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["tipo"] == "parcial"
        assert data["remito"] == "R-0001-00012345"

    def test_el_responsable_sale_de_la_sesion(
        self, client_autenticado: TestClient, db_session: Session
    ):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        usuario_falso = str(uuid.uuid4())

        response = client_autenticado.post(
            f"/proveedores-compras/ordenes/{orden.id}/recepciones",
            json={
                "usuario_id": usuario_falso,
                "detalles": [
                    {"orden_compra_detalle_id": str(linea.id), "cantidad_recibida": "4.00"}
                ],
            },
        )

        assert response.status_code == 201
        assert response.json()["usuario_id"] != usuario_falso

    def test_no_se_puede_declarar_el_tipo_a_mano(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """Aunque manden `tipo: total` recibiendo 4 de 10, se guarda parcial."""
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        response = client_autenticado.post(
            f"/proveedores-compras/ordenes/{orden.id}/recepciones",
            json={
                "tipo": "total",
                "detalles": [
                    {"orden_compra_detalle_id": str(linea.id), "cantidad_recibida": "4.00"}
                ],
            },
        )

        assert response.status_code == 201
        assert response.json()["tipo"] == "parcial"

    def test_recibir_de_mas_da_422(self, client_autenticado: TestClient, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]

        response = client_autenticado.post(
            f"/proveedores-compras/ordenes/{orden.id}/recepciones",
            json={
                "detalles": [
                    {"orden_compra_detalle_id": str(linea.id), "cantidad_recibida": "11.00"}
                ]
            },
        )

        assert response.status_code == 422

    def test_listar_recepciones_endpoint(self, client_autenticado: TestClient, db_session: Session):
        orden = _orden_de_10(db_session)
        linea = obtener_detalles_de_orden(db_session, orden.id)[0]
        crear_recepcion(
            db_session,
            orden,
            RecepcionCompraCreate(
                detalles=[
                    RecepcionCompraDetalleCreate(
                        orden_compra_detalle_id=linea.id, cantidad_recibida=4
                    )
                ]
            ),
            uuid.uuid4(),
        )

        response = client_autenticado.get(f"/proveedores-compras/ordenes/{orden.id}/recepciones")

        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        orden_id = uuid.uuid4()
        assert client.get(f"/proveedores-compras/ordenes/{orden_id}/pendientes").status_code == 401
        assert client.get(f"/proveedores-compras/ordenes/{orden_id}/recepciones").status_code == 401
