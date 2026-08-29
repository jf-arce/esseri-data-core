"""Tests para la búsqueda de órdenes (RF-34/35) y la exportación a CSV (RF-38)."""

import uuid
from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from src.proveedores_compras.models import OrdenCompra
from src.proveedores_compras.schemas import (
    OrdenCompraCreate,
    OrdenCompraDetalleCreate,
    ProductoServicioCreate,
    ProveedorCreate,
    SolicitudCompraCreate,
)
from src.proveedores_compras.service import (
    buscar_ordenes_compra,
    cambiar_estado_solicitud,
    cancelar_orden_compra,
    crear_orden_compra,
    crear_producto_servicio,
    crear_proveedor,
    crear_solicitud,
)


def _orden(db: Session, proveedor_nombre: str, fecha: date, cantidad: int = 10) -> OrdenCompra:
    proveedor = crear_proveedor(db, ProveedorCreate(nombre=proveedor_nombre))
    producto = crear_producto_servicio(
        db, ProductoServicioCreate(nombre=f"Item {proveedor_nombre}", tipo="producto")
    )
    solicitud = crear_solicitud(
        db, SolicitudCompraCreate(articulo="Algo", cantidad=cantidad), uuid.uuid4()
    )
    cambiar_estado_solicitud(db, solicitud, "aprobada")
    return crear_orden_compra(
        db,
        OrdenCompraCreate(
            proveedor_id=proveedor.id,
            fecha=fecha,
            solicitud_ids=[solicitud.id],
            detalles=[
                OrdenCompraDetalleCreate(producto_servicio_id=producto.id, cantidad_pedida=cantidad)
            ],
        ),
    )


class TestBusquedaDeOrdenes:
    """RF-34/35: búsqueda por proveedor y filtro por estado, contra la base."""

    def test_sin_filtros_devuelve_todo_paginado(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))
        _orden(db_session, "Librería Central", date(2026, 8, 25))

        resultado = buscar_ordenes_compra(db_session)

        assert resultado.total == 2
        assert resultado.pagina == 1
        assert resultado.total_paginas == 1
        assert len(resultado.items) == 2

    def test_trae_el_nombre_del_proveedor_resuelto(self, db_session: Session):
        """El listado hace el join: el frontend no debería necesitar todos los proveedores."""
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))

        resultado = buscar_ordenes_compra(db_session)

        assert resultado.items[0].proveedor_nombre == "Papelera del Sur"
        assert resultado.items[0].cantidad_items == 1

    def test_ordena_de_mas_reciente_a_mas_vieja(self, db_session: Session):
        _orden(db_session, "Vieja", date(2026, 1, 10))
        _orden(db_session, "Nueva", date(2026, 8, 25))

        resultado = buscar_ordenes_compra(db_session)

        assert [item.proveedor_nombre for item in resultado.items] == ["Nueva", "Vieja"]

    def test_busca_por_proveedor_sin_depender_de_las_tildes(self, db_session: Session):
        """Mismo comportamiento que la búsqueda de inscripciones, ahora con el helper común."""
        _orden(db_session, "Librería Central", date(2026, 8, 20))
        _orden(db_session, "Papelera del Sur", date(2026, 8, 21))

        resultado = buscar_ordenes_compra(db_session, buscar="libreria")

        assert resultado.total == 1
        assert resultado.items[0].proveedor_nombre == "Librería Central"

    def test_busca_por_coincidencia_parcial(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))

        assert buscar_ordenes_compra(db_session, buscar="sur").total == 1

    def test_filtra_por_estado(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))
        cancelada = _orden(db_session, "Librería Central", date(2026, 8, 21))
        cancelar_orden_compra(db_session, cancelada)

        resultado = buscar_ordenes_compra(db_session, estado="cancelada")

        assert resultado.total == 1
        assert resultado.items[0].estado == "cancelada"

    def test_combina_busqueda_y_estado(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))
        cancelada = _orden(db_session, "Papelera del Norte", date(2026, 8, 21))
        cancelar_orden_compra(db_session, cancelada)

        resultado = buscar_ordenes_compra(db_session, buscar="papelera", estado="cancelada")

        assert resultado.total == 1
        assert resultado.items[0].proveedor_nombre == "Papelera del Norte"

    def test_pagina_los_resultados(self, db_session: Session):
        for numero in range(5):
            _orden(db_session, f"Proveedor {numero}", date(2026, 8, 10 + numero))

        primera = buscar_ordenes_compra(db_session, pagina=1, tamanio_pagina=2)
        tercera = buscar_ordenes_compra(db_session, pagina=3, tamanio_pagina=2)

        assert primera.total == 5
        assert primera.total_paginas == 3
        assert len(primera.items) == 2
        assert len(tercera.items) == 1

    def test_una_pagina_fuera_de_rango_devuelve_vacio_sin_romper(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))

        resultado = buscar_ordenes_compra(db_session, pagina=99, tamanio_pagina=10)

        assert resultado.items == []
        assert resultado.total == 1

    def test_busqueda_sin_resultados(self, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))

        resultado = buscar_ordenes_compra(db_session, buscar="ferreteria")

        assert resultado.total == 0
        assert resultado.total_paginas == 0


class TestExportacion:
    """RF-38: exportación a CSV."""

    def test_exportar_proveedores_endpoint(
        self, client_autenticado: TestClient, db_session: Session
    ):
        crear_proveedor(
            db_session,
            ProveedorCreate(nombre="Librería Central", categoria="Librería", email="a@b.com"),
        )

        response = client_autenticado.get("/proveedores-compras/proveedores-exportar")

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/csv")
        assert "attachment" in response.headers["content-disposition"]
        assert ".csv" in response.headers["content-disposition"]

    def test_el_csv_arranca_con_bom_para_que_excel_lea_los_acentos(
        self, client_autenticado: TestClient, db_session: Session
    ):
        """Sin el BOM, Excel en Windows muestra "LibrerÃ­a" en vez de "Librería"."""
        crear_proveedor(db_session, ProveedorCreate(nombre="Librería Central"))

        response = client_autenticado.get("/proveedores-compras/proveedores-exportar")

        assert response.content.startswith(b"\xef\xbb\xbf")

    def test_el_csv_tiene_encabezados_en_espaniol_y_los_datos(
        self, client_autenticado: TestClient, db_session: Session
    ):
        crear_proveedor(
            db_session, ProveedorCreate(nombre="Librería Central", categoria="Librería")
        )

        texto = client_autenticado.get("/proveedores-compras/proveedores-exportar").content.decode(
            "utf-8-sig"
        )

        lineas = texto.strip().split("\n")
        assert lineas[0] == "Nombre,Categoría,Teléfono,Email,Estado"
        assert "Librería Central" in lineas[1]
        assert "Activo" in lineas[1]

    def test_los_nulos_salen_como_celda_vacia_y_no_como_none(
        self, client_autenticado: TestClient, db_session: Session
    ):
        crear_proveedor(db_session, ProveedorCreate(nombre="Sin datos de contacto"))

        texto = client_autenticado.get("/proveedores-compras/proveedores-exportar").content.decode(
            "utf-8-sig"
        )

        assert "None" not in texto

    def test_exportar_ordenes_endpoint(self, client_autenticado: TestClient, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20), cantidad=7)

        texto = client_autenticado.get("/proveedores-compras/ordenes-exportar").content.decode(
            "utf-8-sig"
        )

        lineas = texto.strip().split("\n")
        assert lineas[0] == "Fecha,Proveedor,Estado,Ítems,Unidades pedidas,Solicitudes"
        assert "Papelera del Sur" in lineas[1]
        assert "2026-08-20" in lineas[1]

    def test_exportar_sin_datos_devuelve_solo_los_encabezados(self, client_autenticado: TestClient):
        """Un CSV vacío tiene que abrirse igual, con las columnas visibles."""
        texto = client_autenticado.get("/proveedores-compras/proveedores-exportar").content.decode(
            "utf-8-sig"
        )

        assert texto.strip() == "Nombre,Categoría,Teléfono,Email,Estado"

    def test_exportar_sin_sesion_rechaza(self, client: TestClient):
        assert client.get("/proveedores-compras/proveedores-exportar").status_code == 401
        assert client.get("/proveedores-compras/ordenes-exportar").status_code == 401


class TestBusquedaEndpoints:
    """La búsqueda expuesta por HTTP."""

    def test_buscar_ordenes_endpoint(self, client_autenticado: TestClient, db_session: Session):
        _orden(db_session, "Papelera del Sur", date(2026, 8, 20))

        response = client_autenticado.get(
            "/proveedores-compras/ordenes-buscar", params={"buscar": "papelera"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["proveedor_nombre"] == "Papelera del Sur"

    def test_pagina_invalida_rechaza(self, client_autenticado: TestClient):
        """`ge=1` corta una página cero antes de que llegue a la consulta."""
        response = client_autenticado.get(
            "/proveedores-compras/ordenes-buscar", params={"pagina": 0}
        )

        assert response.status_code == 422

    def test_tamanio_de_pagina_tiene_tope(self, client_autenticado: TestClient):
        """Sin tope, un `tamanio_pagina=100000` traería la tabla entera."""
        response = client_autenticado.get(
            "/proveedores-compras/ordenes-buscar", params={"tamanio_pagina": 500}
        )

        assert response.status_code == 422

    def test_buscar_sin_sesion_rechaza(self, client: TestClient):
        assert client.get("/proveedores-compras/ordenes-buscar").status_code == 401
