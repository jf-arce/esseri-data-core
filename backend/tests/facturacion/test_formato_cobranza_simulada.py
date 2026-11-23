import uuid
from datetime import date
from decimal import Decimal

import pytest

from src.facturacion import formato_cobranza_simulada as formato

LOTE = "LD-2026-11-001"
FECHA = date(2026, 11, 23)


def _solicitud(orden=1, importe="110000.00", **extra):
    datos = {
        "orden": orden,
        "factura": f"F-202611-{orden:04d}",
        "alumno": "Acuña Alma",
        "concepto": "Cuota educativa; 11/2026",
        "importe": Decimal(importe),
        "vencimiento": FECHA,
        "medio_dato": formato.cbu_sintetico(uuid.UUID(int=orden)),
    }
    return formato.SolicitudFila(**(datos | extra))


def _detalle(orden=1, resultado=formato.COBRADO, importe="10.00", codigo="", descripcion=""):
    return formato.RespuestaDetalle(
        orden,
        formato.referencia_corta(LOTE, orden),
        f"F-202611-{orden:04d}",
        "ACUNA ALMA",
        resultado,
        Decimal(importe),
        FECHA,
        codigo,
        descripcion,
    )


def test_solicitud_cbu_tiene_cabecera_detalle_y_cierre():
    filas = [_solicitud(1), _solicitud(2, "125.50")]
    lineas = formato.generar_solicitud(LOTE, FECHA, filas, "cbu").splitlines()
    cbu = formato.cbu_sintetico(uuid.UUID(int=1))
    assert lineas[0] == "H;ESSERI;DEBITO DIRECTO;LD202611001;20261123;2;000000011012550"
    assert lineas[1] == (
        f"D;0001;LD2026110010001;F-202611-0001;ACUNA ALMA;{cbu};000000011000000;"
        "20261123;CUOTA EDUCATIVA, 11/2026"
    )
    assert lineas[-1] == "T;2;000000011012550"
    assert len(lineas) == 4


def test_solicitud_tarjeta_usa_token_y_tipo_propio():
    fila = _solicitud(medio_dato=formato.token_tarjeta_sintetico(uuid.uuid4()))
    lineas = formato.generar_solicitud(LOTE, FECHA, [fila], "tarjeta").splitlines()
    assert lineas[0].startswith("H;ESSERI;TARJETA;")
    assert len(lineas[1].split(";")) == 9


def test_solicitud_ida_y_vuelta_con_texto_ascii():
    filas = [_solicitud(1), _solicitud(2)]
    texto = formato.generar_solicitud(LOTE, FECHA, filas, "cbu")
    codigo, fecha, leidas = formato.leer_solicitud(texto)
    assert (codigo, fecha) == (LOTE, FECHA)
    assert [f.alumno for f in leidas] == ["ACUNA ALMA", "ACUNA ALMA"]
    assert [f.orden for f in leidas] == [1, 2]
    assert texto.isascii()


def test_datos_sinteticos_son_deterministas_y_ficticios():
    factura_id = uuid.uuid4()
    cbu = formato.cbu_sintetico(factura_id)
    token = formato.token_tarjeta_sintetico(factura_id)
    assert cbu == formato.cbu_sintetico(factura_id)
    assert token == formato.token_tarjeta_sintetico(factura_id)
    assert len(cbu) == 22 and cbu.isdigit() and cbu.startswith("00799999")
    assert len(token) == 16 and token.isdigit()
    for codigo, descripcion in formato.MOTIVOS_RECHAZO_SIMULADOS:
        assert 0 < len(codigo) <= 30
        assert 0 < len(descripcion) <= 250


def test_solicitud_rechaza_vacia_medio_desconocido_y_admite_mas_de_quinientos():
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_solicitud(LOTE, FECHA, [], "cbu")
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_solicitud(LOTE, FECHA, [_solicitud()], "efectivo")
    filas = [_solicitud(i, "1.00") for i in range(1, 502)]
    texto = formato.generar_solicitud(LOTE, FECHA, filas, "cbu")
    assert len(texto.splitlines()) == 503
    assert len(formato.leer_solicitud(texto)[2]) == 501


def test_referencia_corta_ida_y_vuelta_y_limites():
    assert formato.referencia_corta(LOTE, 7) == "LD2026110010007"
    assert formato.codigo_lote_desde_archivo("LD202611001") == LOTE
    assert formato.codigo_lote_desde_archivo("LD202611ABCD1234") == "LD-2026-11-ABCD1234"
    for invalido in ("LD-2026-11-001", "XX202611001", "LD20261100"):
        with pytest.raises(formato.FormatoInvalido):
            formato.codigo_lote_desde_archivo(invalido)
    with pytest.raises(formato.FormatoInvalido):
        formato.referencia_corta(LOTE, 10000)


def test_respuesta_con_cobro_y_rechazo_traduce_estados_y_codigos():
    filas = [
        _detalle(1, importe="100.50"),
        _detalle(2, formato.RECHAZADO, "20.00", "SALDO_INSUF", "Saldo insuficiente"),
    ]
    texto = formato.generar_respuesta(LOTE, FECHA, filas)
    lineas = texto.splitlines()
    assert lineas[0] == "H;BANCO DEMO;RESPUESTA;LD202611001;20261123;2"
    assert (
        lineas[1] == "D;0001;LD2026110010001;F-202611-0001;ACUNA ALMA;000000000010050;COBRADO;000;"
    )
    assert lineas[2].endswith(";000000000002000;RECHAZADO;R01;SALDO INSUFICIENTE")
    assert lineas[3] == "T;2;1;1;000000000010050;000000000002000"
    assert formato.leer_respuesta(texto) == (LOTE, filas)
    assert "COBRADO_SIM" not in texto and texto.isascii()


def test_codigo_de_rechazo_desconocido_se_conserva_con_la_descripcion_del_archivo():
    fila = _detalle(1, formato.RECHAZADO, "5.00", "ZZ9", "Motivo propio")
    texto = formato.generar_respuesta(LOTE, FECHA, [fila])
    _, (leida,) = formato.leer_respuesta(texto)
    assert (leida.codigo, leida.descripcion) == ("ZZ9", "MOTIVO PROPIO")


@pytest.mark.parametrize(
    "cambio",
    [
        "total",
        "cantidad",
        "estado",
        "importe",
        "fecha",
        "entidad",
        "tipo",
        "columna",
        "cierre",
        "duplicado",
        "referencia",
        "codigo_cobrado",
    ],
)
def test_archivo_invalido_se_rechaza_completo(cambio):
    texto = formato.generar_respuesta(LOTE, FECHA, [_detalle()])
    detalle = "D;0001;LD2026110010001;F-202611-0001;ACUNA ALMA;000000000001000;COBRADO;000;\n"
    assert detalle in texto
    cambios = {
        "total": ("T;1;1;0;000000000001000", "T;1;1;0;000000000002000"),
        "cantidad": ("T;1;1;0", "T;2;1;0"),
        "estado": (";COBRADO;", ";COBRADO_SIM;"),
        "importe": (";000000000001000;", ";10.00;"),
        "fecha": (";20261123;", ";2026-11-23;"),
        "entidad": ("BANCO DEMO", "BANCO REAL"),
        "tipo": (";RESPUESTA;", ";SOLICITUD;"),
        "columna": (";COBRADO;", ";EXTRA;COBRADO;"),
        "cierre": ("T;1;1;0;000000000001000;000000000000000\n", ""),
        "duplicado": ("T;1;", detalle + "T;2;"),
        "referencia": ("LD2026110010001", "LD2026110010002"),
        "codigo_cobrado": (";COBRADO;000;", ";COBRADO;R01;"),
    }
    with pytest.raises(formato.FormatoInvalido):
        formato.leer_respuesta(texto.replace(*cambios[cambio]))


def test_total_admite_la_suma_de_cien_importes_validos():
    filas = [_detalle(i, importe="9999999999.99") for i in range(1, 101)]
    texto = formato.generar_respuesta(LOTE, FECHA, filas)
    assert formato.leer_respuesta(texto) == (LOTE, filas)


def test_importe_fuera_de_rango_no_se_escribe():
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_respuesta(LOTE, FECHA, [_detalle(importe="1.005")])
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_respuesta(LOTE, FECHA, [_detalle(importe="10000000000000.00")])


def test_respuesta_admite_mas_de_quinientos_registros():
    filas = [_detalle(i) for i in range(1, 502)]
    texto = formato.generar_respuesta(LOTE, FECHA, filas)
    assert formato.leer_respuesta(texto) == (LOTE, filas)
