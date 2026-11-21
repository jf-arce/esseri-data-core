"""Herramientas de débitos automáticos del Asistente: acceso por rol, privacidad y cálculos."""

import json
from datetime import date

import pytest
from sqlalchemy import select

from src.auth.constants import MODULO_ASISTENTE, MODULO_FACTURACION, MODULO_FAMILIAS_ALUMNOS
from src.auth.models import Usuario
from src.facturacion import formato_cobranza_simulada as formato
from src.facturacion.models import (
    DebitoCobranza,
    ImportacionCobranza,
    ImportacionCobranzaDetalle,
    LoteCobranza,
)
from tests.asistente.conftest import (
    crear_cuenta,
    enviar,
    eventos,
    iniciar_sesion,
    nueva_conversacion,
    respuesta_herramientas,
    respuesta_texto,
)
from tests.asistente.test_herramientas_facturacion import cuenta_con_crear
from tests.facturacion.test_cobranzas_lotes import crear_factura_demo

MODULOS = [MODULO_ASISTENTE, MODULO_FACTURACION, MODULO_FAMILIAS_ALUMNOS]


def resultado(proveedor, ronda: int = 1) -> dict:
    return json.loads(proveedor.peticiones[ronda]["messages"][-1]["content"])


def correr(cliente, proveedor, *llamadas: tuple[str, dict]):
    proveedor.respuestas = [respuesta_herramientas(llamada) for llamada in llamadas] + [
        respuesta_texto("ok")
    ]
    return eventos(enviar(cliente, nueva_conversacion(cliente), "consulta"))


@pytest.fixture()
def direccion_deb(client, db_session):
    crear_cuenta(db_session, "dir-deb@esseri.test", MODULOS, rol="dirección")
    return iniciar_sesion("dir-deb@esseri.test")


@pytest.fixture()
def administracion_deb(client, db_session):
    cuenta_con_crear(db_session, "adm-deb@esseri.test", MODULOS, "administración")
    return iniciar_sesion("adm-deb@esseri.test")


@pytest.fixture()
def lote_rendido(db_session, administracion_deb):
    """Lote LD-2026-11 con 4 débitos: 2 cobrados, 1 rechazado por saldo y 1 sin respuesta."""
    usuario = db_session.scalar(select(Usuario).where(Usuario.email == "adm-deb@esseri.test"))
    lote = LoteCobranza(
        codigo="LD-2026-11-001",
        periodo="2026-11",
        fecha=date(2026, 11, 5),
        estado="pagos_registrados",
        usuario_id=usuario.id,
    )
    db_session.add(lote)
    db_session.flush()
    resultados = [formato.COBRADO, formato.COBRADO, formato.RECHAZADO, None]
    debitos = []
    for indice, res in enumerate(resultados, start=1):
        factura = crear_factura_demo(db_session, indice)
        debito = DebitoCobranza(
            lote_id=lote.id,
            factura_id=factura.id,
            importe=factura.monto_total,
            vencimiento=factura.fecha_vencimiento,
            concepto="Cuota",
            resultado=res,
        )
        db_session.add(debito)
        debitos.append(debito)
    db_session.flush()
    importacion = ImportacionCobranza(
        lote_id=lote.id, archivo_hash="h" * 64, estado="confirmada", usuario_id=usuario.id
    )
    db_session.add(importacion)
    db_session.flush()
    db_session.add(
        ImportacionCobranzaDetalle(
            importacion_id=importacion.id,
            linea=1,
            resultado=formato.RECHAZADO,
            codigo="SALDO_INSUF",
            descripcion="Saldo insuficiente",
            debito_id=debitos[2].id,
            estado="rechazado",
        )
    )
    db_session.commit()
    return lote


class TestResumenDebitos:
    def test_cuenta_resultados_tasa_y_motivos(self, direccion_deb, proveedor, lote_rendido):
        correr(direccion_deb, proveedor, ("resumen_debitos", {"desde": "2026-11"}))
        datos = resultado(proveedor)
        assert datos["periodo"] == "11/2026"
        assert datos["debitos_enviados"] == 4
        assert (datos["cobrados"], datos["rechazados"], datos["sin_respuesta"]) == (2, 1, 1)
        assert datos["importe_cobrado"] == 200
        assert datos["tasa_de_rechazo_porcentaje"] == 33.3
        assert datos["motivos_de_rechazo"] == [{"motivo": "Saldo insuficiente", "cantidad": 1}]

    def test_direccion_lo_ve_sin_botones_a_cobranzas(self, direccion_deb, proveedor, lote_rendido):
        lista = correr(direccion_deb, proveedor, ("resumen_debitos", {"desde": "2026-11"}))
        assert not [datos for nombre, datos in lista if nombre == "destino"]
        assert "Demo" not in proveedor.texto_enviado()

    def test_sin_datos_no_inventa_una_tasa(self, direccion_deb, proveedor):
        correr(direccion_deb, proveedor, ("resumen_debitos", {"desde": "2026-01"}))
        datos = resultado(proveedor)
        assert datos["debitos_enviados"] == 0
        assert datos["tasa_de_rechazo_porcentaje"] is None
        assert datos["motivos_de_rechazo"] == []

    def test_agrupa_por_mes_y_compara(self, direccion_deb, proveedor, lote_rendido):
        lista = correr(
            direccion_deb,
            proveedor,
            (
                "resumen_debitos",
                {
                    "desde": "2026-11",
                    "hasta": "2026-11",
                    "agrupar_por": "mes",
                    "comparar_con_anterior": True,
                },
            ),
        )
        datos = resultado(proveedor)
        assert [m["mes"] for m in datos["meses"]] == ["11/2026"]
        assert datos["comparacion"]["periodo_anterior"] == "10/2026"
        assert datos["comparacion"]["variacion_importe_cobrado_porcentual"] is None
        assert any(nombre == "tarjeta" for nombre, _ in lista)

    def test_rechaza_un_rango_invertido(self, direccion_deb, proveedor):
        correr(
            direccion_deb, proveedor, ("resumen_debitos", {"desde": "2026-11", "hasta": "2026-10"})
        )
        assert "error" in resultado(proveedor)


class TestLotesDebito:
    def test_direccion_no_los_ve(self, direccion_deb, proveedor, lote_rendido):
        correr(direccion_deb, proveedor, ("lotes_debito", {}))
        assert "no tiene permiso" in resultado(proveedor)["error"]

    def test_historial_de_lotes(self, administracion_deb, proveedor, lote_rendido):
        correr(administracion_deb, proveedor, ("lotes_debito", {}))
        (lote,) = resultado(proveedor)["lotes"]
        assert lote["codigo"] == "LD-2026-11-001"
        assert lote["debitos"] == 4
        assert lote["importacion"] == "confirmada"

    def test_detalle_con_alias_y_motivo(self, administracion_deb, proveedor, lote_rendido):
        correr(administracion_deb, proveedor, ("lotes_debito", {"codigo": "ld-2026-11-001"}))
        datos = resultado(proveedor)
        assert (datos["cobrados"], datos["rechazados"]) == (2, 1)
        (fila,) = datos["detalle"]
        assert fila["alumno"] == "[ALUMNO:1]" and fila["familia"] == "[FAMILIA:1]"
        assert fila["motivo"] == "Saldo insuficiente"
        enviado = proveedor.texto_enviado()
        assert "Alumno3" not in enviado and "Familia3" not in enviado

    def test_detalle_con_todos_los_debitos(self, administracion_deb, proveedor, lote_rendido):
        correr(
            administracion_deb,
            proveedor,
            ("lotes_debito", {"codigo": "LD-2026-11-001", "todos": True}),
        )
        datos = resultado(proveedor)
        assert datos["devueltos"] == datos["debitos"] == 4
        estados = sorted(fila["estado"] for fila in datos["detalle"])
        assert estados.count("Cobrado") == 2 and estados.count("Rechazado") == 1
        enviado = proveedor.texto_enviado()
        assert "Alumno3" not in enviado and "Familia3" not in enviado

    def test_codigo_inexistente(self, administracion_deb, proveedor, lote_rendido):
        correr(administracion_deb, proveedor, ("lotes_debito", {"codigo": "LD-0000"}))
        assert "error" in resultado(proveedor)

    def test_sin_lotes(self, administracion_deb, proveedor):
        correr(administracion_deb, proveedor, ("lotes_debito", {}))
        assert resultado(proveedor)["lotes"] == []


class TestFacturasParaDebitar:
    def test_direccion_no_la_ve(self, direccion_deb, proveedor):
        correr(direccion_deb, proveedor, ("facturas_para_debitar", {}))
        assert "no tiene permiso" in resultado(proveedor)["error"]

    def test_cuenta_las_disponibles_y_las_ocultas(
        self, administracion_deb, proveedor, db_session, lote_rendido
    ):
        crear_factura_demo(db_session, 20, medio="cbu", importe="150.00")
        db_session.commit()
        correr(administracion_deb, proveedor, ("facturas_para_debitar", {"medio": "cbu"}))
        datos = resultado(proveedor)
        assert datos["facturas_que_se_pueden_debitar"] >= 1
        assert datos["por_medio"]["cbu"]["importe"] >= 150
        assert "ocultas_por_estar_en_otro_lote" in datos
