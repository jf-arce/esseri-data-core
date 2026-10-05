"""Tests para proveedores y precios por ítem del catálogo, con histórico (issue #114)."""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.auth.models import Usuario
from src.models import AuditLog
from src.proveedores_compras.exceptions import (
    AsociacionConPrecios,
    AsociacionInexistente,
    ProductoServicioEnUso,
    ProveedorConVinculos,
    ProveedorInexistente,
    ProveedorNoAsociado,
    ProveedorYaAsociado,
    VigenciaFueraDeRango,
    VigenciaNoPosterior,
)
from src.proveedores_compras.models import PrecioProducto, ProductoProveedor
from src.proveedores_compras.precios_service import (
    actualizar_precio,
    asociar_proveedor,
    crear_precio,
    desasociar_proveedor,
    listar_precios_de_producto,
    listar_proveedores_de_producto,
)
from src.proveedores_compras.schemas import (
    PrecioProductoCreate,
    PrecioProductoUpdate,
    ProductoServicioCreate,
    ProveedorCreate,
)
from src.proveedores_compras.service import (
    crear_producto_servicio,
    crear_proveedor,
    eliminar_producto_servicio,
    eliminar_proveedor,
)

HOY = date.today()
ENERO = date(2026, 1, 1)
MARZO = date(2026, 3, 1)
JUNIO = date(2026, 6, 1)


def _resma(db: Session):
    return crear_producto_servicio(db, ProductoServicioCreate(nombre="Resma A4", tipo="producto"))


def _proveedor(db: Session, nombre: str = "Papelera del Sur"):
    return crear_proveedor(db, ProveedorCreate(nombre=nombre))


def _resma_con_proveedor(db: Session):
    """Un ítem con un proveedor ya asociado: el punto de partida para cargar precios."""
    producto = _resma(db)
    proveedor = _proveedor(db)
    asociar_proveedor(db, producto, proveedor.id)
    return producto, proveedor


def _precio(db: Session, producto, proveedor, monto: str, desde: date | None = None, usuario=None):
    return crear_precio(
        db,
        producto,
        PrecioProductoCreate(
            proveedor_id=proveedor.id, precio=Decimal(monto), vigencia_desde=desde
        ),
        usuario,
    )


def _crear_usuario(db_session, email="precios@esseri.edu.ar"):
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


class TestProveedoresDeProducto:
    """CA1: asociar y desasociar un proveedor a un ítem, sin duplicar el par."""

    def test_asociar_proveedor_lo_lista_sin_precio(self, db_session: Session):
        producto = _resma(db_session)
        proveedor = _proveedor(db_session)

        asociado = asociar_proveedor(db_session, producto, proveedor.id)

        assert asociado.proveedor_id == proveedor.id
        assert asociado.proveedor_nombre == "Papelera del Sur"
        assert asociado.precio_vigente is None
        assert [
            fila.proveedor_id for fila in listar_proveedores_de_producto(db_session, producto.id)
        ] == [proveedor.id]

    def test_listar_ordena_por_nombre_de_proveedor(self, db_session: Session):
        producto = _resma(db_session)
        asociar_proveedor(db_session, producto, _proveedor(db_session, "Papelera del Sur").id)
        asociar_proveedor(db_session, producto, _proveedor(db_session, "Distribuidora Andina").id)

        nombres = [
            fila.proveedor_nombre
            for fila in listar_proveedores_de_producto(db_session, producto.id)
        ]

        assert nombres == ["Distribuidora Andina", "Papelera del Sur"]

    def test_asociar_dos_veces_el_mismo_par_rechaza(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)

        with pytest.raises(ProveedorYaAsociado):
            asociar_proveedor(db_session, producto, proveedor.id)

        assert db_session.query(ProductoProveedor).count() == 1

    def test_asociar_proveedor_inexistente_rechaza(self, db_session: Session):
        producto = _resma(db_session)

        with pytest.raises(ProveedorInexistente):
            asociar_proveedor(db_session, producto, uuid.uuid4())

    def test_un_proveedor_puede_ofrecer_varios_items(self, db_session: Session):
        proveedor = _proveedor(db_session)
        resma = _resma(db_session)
        toner = crear_producto_servicio(
            db_session, ProductoServicioCreate(nombre="Toner negro", tipo="producto")
        )

        asociar_proveedor(db_session, resma, proveedor.id)
        asociar_proveedor(db_session, toner, proveedor.id)

        assert len(listar_proveedores_de_producto(db_session, toner.id)) == 1

    def test_desasociar_proveedor_sin_precios(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)

        desasociar_proveedor(db_session, producto, proveedor.id)

        assert listar_proveedores_de_producto(db_session, producto.id) == []

    def test_desasociar_proveedor_no_asociado_rechaza(self, db_session: Session):
        producto = _resma(db_session)
        proveedor = _proveedor(db_session)

        with pytest.raises(AsociacionInexistente):
            desasociar_proveedor(db_session, producto, proveedor.id)

    def test_desasociar_proveedor_con_precios_rechaza(self, db_session: Session):
        """Quitar la asociación dejaría el histórico de precios sin dueño visible."""
        producto, proveedor = _resma_con_proveedor(db_session)
        _precio(db_session, producto, proveedor, "1500")

        with pytest.raises(AsociacionConPrecios):
            desasociar_proveedor(db_session, producto, proveedor.id)

        assert len(listar_proveedores_de_producto(db_session, producto.id)) == 1


class TestCargaDePrecios:
    """CA2 y CA3: cargar un precio y que el nuevo cierre al anterior, sin solaparse."""

    def test_primer_precio_queda_abierto_desde_hoy(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)

        precio = _precio(db_session, producto, proveedor, "1500.50")

        assert precio.precio == Decimal("1500.50")
        assert precio.vigencia_desde == HOY
        assert precio.vigencia_hasta is None

    def test_precio_para_proveedor_no_asociado_rechaza(self, db_session: Session):
        producto = _resma(db_session)
        proveedor = _proveedor(db_session)

        with pytest.raises(ProveedorNoAsociado):
            _precio(db_session, producto, proveedor, "1500")

        assert db_session.query(PrecioProducto).count() == 0

    def test_precio_nuevo_cierra_el_anterior_el_dia_previo(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        viejo = _precio(db_session, producto, proveedor, "1500", ENERO)

        nuevo = _precio(db_session, producto, proveedor, "1800", MARZO)

        db_session.refresh(viejo)
        assert viejo.vigencia_hasta == date(2026, 2, 28)
        assert viejo.precio == Decimal("1500")
        assert nuevo.vigencia_hasta is None

    def test_nunca_quedan_dos_precios_abiertos_para_el_mismo_par(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        for monto, desde in (("1500", ENERO), ("1800", MARZO), ("2100", JUNIO)):
            _precio(db_session, producto, proveedor, monto, desde)

        precios = listar_precios_de_producto(db_session, producto.id, proveedor.id)

        assert [precio.vigencia_hasta for precio in precios] == [
            None,
            JUNIO - timedelta(days=1),
            MARZO - timedelta(days=1),
        ]

    @pytest.mark.parametrize("desde", [ENERO, MARZO])
    def test_precio_que_no_empieza_despues_del_ultimo_rechaza(self, db_session: Session, desde):
        producto, proveedor = _resma_con_proveedor(db_session)
        vigente = _precio(db_session, producto, proveedor, "1500", MARZO)

        with pytest.raises(VigenciaNoPosterior):
            _precio(db_session, producto, proveedor, "1800", desde)

        db_session.refresh(vigente)
        assert vigente.vigencia_hasta is None
        assert db_session.query(PrecioProducto).count() == 1

    def test_el_precio_de_un_proveedor_no_cierra_el_de_otro(self, db_session: Session):
        producto, papelera = _resma_con_proveedor(db_session)
        andina = _proveedor(db_session, "Distribuidora Andina")
        asociar_proveedor(db_session, producto, andina.id)
        de_papelera = _precio(db_session, producto, papelera, "1500", ENERO)

        _precio(db_session, producto, andina, "1400", MARZO)

        db_session.refresh(de_papelera)
        assert de_papelera.vigencia_hasta is None


class TestConsultaDePrecios:
    """CA5: precio vigente por proveedor e histórico ordenado."""

    def test_historico_va_del_mas_reciente_al_mas_viejo(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        _precio(db_session, producto, proveedor, "1500", ENERO)
        _precio(db_session, producto, proveedor, "1800", MARZO)

        precios = listar_precios_de_producto(db_session, producto.id)

        assert [precio.precio for precio in precios] == [Decimal("1800"), Decimal("1500")]

    def test_historico_se_puede_acotar_a_un_proveedor(self, db_session: Session):
        producto, papelera = _resma_con_proveedor(db_session)
        andina = _proveedor(db_session, "Distribuidora Andina")
        asociar_proveedor(db_session, producto, andina.id)
        _precio(db_session, producto, papelera, "1500", ENERO)
        _precio(db_session, producto, andina, "1400", ENERO)

        precios = listar_precios_de_producto(db_session, producto.id, andina.id)

        assert [precio.precio for precio in precios] == [Decimal("1400")]

    def test_el_listado_trae_el_precio_que_rige_hoy(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        _precio(db_session, producto, proveedor, "1500", ENERO)
        _precio(db_session, producto, proveedor, "1800", MARZO)

        fila = listar_proveedores_de_producto(db_session, producto.id)[0]

        assert fila.precio_vigente is not None
        assert fila.precio_vigente.precio == Decimal("1800")

    def test_un_precio_con_vigencia_futura_todavia_no_es_el_vigente(self, db_session: Session):
        """Cargar por adelantado la lista del mes que viene no cambia el precio de hoy."""
        producto, proveedor = _resma_con_proveedor(db_session)
        _precio(db_session, producto, proveedor, "1500", ENERO)
        _precio(db_session, producto, proveedor, "1800", HOY + timedelta(days=30))

        fila = listar_proveedores_de_producto(db_session, producto.id)[0]

        assert fila.precio_vigente is not None
        assert fila.precio_vigente.precio == Decimal("1500")


class TestCorreccionDePrecios:
    """CA4: un precio mal cargado se corrige, sin romper la cadena de vigencias."""

    def test_corregir_el_monto_no_toca_las_fechas(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        precio = _precio(db_session, producto, proveedor, "15000", ENERO)

        corregido = actualizar_precio(
            db_session, precio, PrecioProductoUpdate(precio=Decimal("1500"))
        )

        assert corregido.precio == Decimal("1500")
        assert corregido.vigencia_desde == ENERO
        assert corregido.vigencia_hasta is None

    def test_corregir_la_fecha_arrastra_el_cierre_del_precio_anterior(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        anterior = _precio(db_session, producto, proveedor, "1500", ENERO)
        vigente = _precio(db_session, producto, proveedor, "1800", JUNIO)

        actualizar_precio(db_session, vigente, PrecioProductoUpdate(vigencia_desde=MARZO))

        db_session.refresh(anterior)
        assert vigente.vigencia_desde == MARZO
        assert anterior.vigencia_hasta == MARZO - timedelta(days=1)

    def test_corregir_la_fecha_no_puede_pisar_al_precio_anterior(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        anterior = _precio(db_session, producto, proveedor, "1500", MARZO)
        vigente = _precio(db_session, producto, proveedor, "1800", JUNIO)

        with pytest.raises(VigenciaFueraDeRango):
            actualizar_precio(db_session, vigente, PrecioProductoUpdate(vigencia_desde=MARZO))

        db_session.refresh(anterior)
        assert vigente.vigencia_desde == JUNIO
        assert anterior.vigencia_hasta == JUNIO - timedelta(days=1)

    def test_un_precio_cerrado_no_puede_empezar_despues_de_su_propio_fin(self, db_session: Session):
        producto, proveedor = _resma_con_proveedor(db_session)
        cerrado = _precio(db_session, producto, proveedor, "1500", ENERO)
        _precio(db_session, producto, proveedor, "1800", MARZO)

        with pytest.raises(VigenciaFueraDeRango):
            actualizar_precio(db_session, cerrado, PrecioProductoUpdate(vigencia_desde=JUNIO))


class TestAuditoriaDePrecios:
    """CA7: cada escritura deja su rastro en AUDIT_LOG, incluidas las correcciones."""

    def test_asociar_y_desasociar_auditan(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto = _resma(db_session)
        proveedor = _proveedor(db_session)

        asociar_proveedor(db_session, producto, proveedor.id, usuario.id)
        asociacion_id = db_session.query(ProductoProveedor).one().id
        desasociar_proveedor(db_session, producto, proveedor.id, usuario.id)

        campos = [
            registro.campo
            for registro in _historial(db_session, "PRODUCTO_PROVEEDOR", asociacion_id)
        ]
        assert campos == ["__alta__", "__eliminacion__"]

    def test_cargar_precio_audita_el_alta_y_el_cierre_del_anterior(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto, proveedor = _resma_con_proveedor(db_session)
        viejo = _precio(db_session, producto, proveedor, "1500", ENERO, usuario.id)

        nuevo = _precio(db_session, producto, proveedor, "1800", MARZO, usuario.id)

        alta = _historial(db_session, "PRECIO_PRODUCTO", nuevo.id)
        assert [registro.campo for registro in alta] == ["__alta__"]
        assert alta[0].valor_nuevo == "precio=1800.00 desde=2026-03-01"
        cierre = _historial(db_session, "PRECIO_PRODUCTO", viejo.id)[-1]
        assert (cierre.campo, cierre.valor_anterior, cierre.valor_nuevo) == (
            "vigencia_hasta",
            None,
            "2026-02-28",
        )

    def test_corregir_el_monto_deja_el_valor_anterior_y_el_nuevo(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto, proveedor = _resma_con_proveedor(db_session)
        precio = _precio(db_session, producto, proveedor, "15000", ENERO, usuario.id)

        actualizar_precio(
            db_session, precio, PrecioProductoUpdate(precio=Decimal("1500")), usuario.id
        )

        correccion = _historial(db_session, "PRECIO_PRODUCTO", precio.id)[-1]
        assert correccion.campo == "precio"
        assert correccion.valor_anterior == "15000.00"
        assert correccion.valor_nuevo == "1500.00"
        assert correccion.usuario_id == usuario.id

    def test_guardar_sin_cambios_no_ensucia_la_bitacora(self, db_session: Session):
        usuario = _crear_usuario(db_session)
        producto, proveedor = _resma_con_proveedor(db_session)
        precio = _precio(db_session, producto, proveedor, "1500", ENERO, usuario.id)

        actualizar_precio(
            db_session,
            precio,
            PrecioProductoUpdate(precio=Decimal("1500.00"), vigencia_desde=ENERO),
            usuario.id,
        )

        assert [r.campo for r in _historial(db_session, "PRECIO_PRODUCTO", precio.id)] == [
            "__alta__"
        ]


class TestVinculosConElRestoDelCatalogo:
    """Las bajas que ya miraban estas tablas ahora tienen datos reales contra los que probarse."""

    def test_no_se_puede_eliminar_un_proveedor_asociado_a_un_item(self, db_session: Session):
        _, proveedor = _resma_con_proveedor(db_session)

        with pytest.raises(ProveedorConVinculos):
            eliminar_proveedor(db_session, proveedor)

    def test_no_se_puede_eliminar_un_item_con_proveedores(self, db_session: Session):
        producto, _ = _resma_con_proveedor(db_session)

        with pytest.raises(ProductoServicioEnUso):
            eliminar_producto_servicio(db_session, producto)


class TestPreciosEndpoints:
    """Los mismos criterios, por HTTP: códigos de estado, validación y permisos."""

    def _alta_basica(self, client: TestClient) -> tuple[str, str]:
        producto = client.post(
            "/proveedores-compras/productos", json={"nombre": "Resma A4", "tipo": "producto"}
        ).json()
        proveedor = client.post(
            "/proveedores-compras/proveedores", json={"nombre": "Papelera del Sur"}
        ).json()
        return producto["id"], proveedor["id"]

    def test_flujo_completo_asociar_cargar_y_consultar(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        base = f"/proveedores-compras/productos/{producto_id}"

        asociar = client_autenticado.post(
            f"{base}/proveedores", json={"proveedor_id": proveedor_id}
        )
        primero = client_autenticado.post(
            f"{base}/precios",
            json={
                "proveedor_id": proveedor_id,
                "precio": "1500.00",
                "vigencia_desde": "2026-01-01",
            },
        )
        segundo = client_autenticado.post(
            f"{base}/precios",
            json={
                "proveedor_id": proveedor_id,
                "precio": "1800.00",
                "vigencia_desde": "2026-03-01",
            },
        )

        assert asociar.status_code == 201
        assert primero.status_code == 201
        assert segundo.status_code == 201
        proveedores = client_autenticado.get(f"{base}/proveedores").json()
        assert proveedores[0]["proveedor_nombre"] == "Papelera del Sur"
        assert proveedores[0]["precio_vigente"]["precio"] == "1800.00"
        historico = client_autenticado.get(f"{base}/precios").json()
        assert [(p["precio"], p["vigencia_hasta"]) for p in historico] == [
            ("1800.00", None),
            ("1500.00", "2026-02-28"),
        ]

    def test_corregir_precio_endpoint(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        base = f"/proveedores-compras/productos/{producto_id}"
        client_autenticado.post(f"{base}/proveedores", json={"proveedor_id": proveedor_id})
        precio = client_autenticado.post(
            f"{base}/precios", json={"proveedor_id": proveedor_id, "precio": "15000"}
        ).json()

        respuesta = client_autenticado.put(
            f"/proveedores-compras/precios/{precio['id']}", json={"precio": "1500"}
        )

        assert respuesta.status_code == 200
        assert respuesta.json()["precio"] == "1500.00"

    @pytest.mark.parametrize("precio", ["0", "-10", "10.999"])
    def test_precio_invalido_da_422(self, client_autenticado: TestClient, precio):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        base = f"/proveedores-compras/productos/{producto_id}"
        client_autenticado.post(f"{base}/proveedores", json={"proveedor_id": proveedor_id})

        respuesta = client_autenticado.post(
            f"{base}/precios", json={"proveedor_id": proveedor_id, "precio": precio}
        )

        assert respuesta.status_code == 422

    def test_asociar_repetido_da_409(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        url = f"/proveedores-compras/productos/{producto_id}/proveedores"
        client_autenticado.post(url, json={"proveedor_id": proveedor_id})

        assert client_autenticado.post(url, json={"proveedor_id": proveedor_id}).status_code == 409

    def test_precio_sin_asociacion_da_422(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)

        respuesta = client_autenticado.post(
            f"/proveedores-compras/productos/{producto_id}/precios",
            json={"proveedor_id": proveedor_id, "precio": "1500"},
        )

        assert respuesta.status_code == 422

    def test_desasociar_endpoint(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        base = f"/proveedores-compras/productos/{producto_id}/proveedores"
        client_autenticado.post(base, json={"proveedor_id": proveedor_id})

        assert client_autenticado.delete(f"{base}/{proveedor_id}").status_code == 204
        assert client_autenticado.delete(f"{base}/{proveedor_id}").status_code == 404
        assert client_autenticado.get(base).json() == []

    def test_desasociar_con_precios_da_409(self, client_autenticado: TestClient):
        producto_id, proveedor_id = self._alta_basica(client_autenticado)
        base = f"/proveedores-compras/productos/{producto_id}"
        client_autenticado.post(f"{base}/proveedores", json={"proveedor_id": proveedor_id})
        client_autenticado.post(
            f"{base}/precios", json={"proveedor_id": proveedor_id, "precio": "1500"}
        )

        respuesta = client_autenticado.delete(f"{base}/proveedores/{proveedor_id}")

        assert respuesta.status_code == 409

    def test_producto_o_precio_inexistente_da_404(self, client_autenticado: TestClient):
        inexistente = uuid.uuid4()

        assert (
            client_autenticado.get(
                f"/proveedores-compras/productos/{inexistente}/proveedores"
            ).status_code
            == 404
        )
        assert (
            client_autenticado.put(
                f"/proveedores-compras/precios/{inexistente}", json={"precio": "1500"}
            ).status_code
            == 404
        )

    def test_endpoints_sin_sesion_rechazan(self, client: TestClient):
        producto_id = uuid.uuid4()

        assert (
            client.get(f"/proveedores-compras/productos/{producto_id}/proveedores").status_code
            == 401
        )
        assert (
            client.post(
                f"/proveedores-compras/productos/{producto_id}/precios",
                json={"proveedor_id": str(uuid.uuid4()), "precio": "1500"},
            ).status_code
            == 401
        )
        assert (
            client.put(
                f"/proveedores-compras/precios/{uuid.uuid4()}", json={"precio": "1500"}
            ).status_code
            == 401
        )
