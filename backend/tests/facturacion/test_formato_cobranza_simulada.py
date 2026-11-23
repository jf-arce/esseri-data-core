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
        "Acuña Alma",
        resultado,
        Decimal(importe),
        FECHA,
        codigo,
        descripcion,
    )


def test_solicitud_cbu_tiene_titulos_y_valores_legibles():
    filas = [_solicitud(1), _solicitud(2, "125.50")]
    texto = formato.generar_solicitud(LOTE, filas, "cbu")
    lineas = texto.removeprefix(formato.BOM).splitlines()
    cbu = formato.cbu_sintetico(uuid.UUID(int=1))
    assert texto.startswith(formato.BOM)
    assert lineas[0] == "Orden;Referencia;Factura;Alumno;CBU;Importe;Vencimiento;Concepto"
    assert lineas[1] == (
        f"1;LD2026110010001;F-202611-0001;Acuña Alma;{cbu};110000,00;23/11/2026;"
        "Cuota educativa, 11/2026"
    )
    assert lineas[2].split(";")[5] == "125,50"
    assert len(lineas) == 3


def test_solicitud_tarjeta_usa_token_y_titulo_propio():
    fila = _solicitud(medio_dato=formato.token_tarjeta_sintetico(uuid.uuid4()))
    lineas = formato.generar_solicitud(LOTE, [fila], "tarjeta").splitlines()
    assert "Token de tarjeta" in lineas[0] and "CBU" not in lineas[0]
    assert len(lineas[1].split(";")) == 8


def test_solicitud_ida_y_vuelta():
    filas = [_solicitud(1), _solicitud(2)]
    texto = formato.generar_solicitud(LOTE, filas, "cbu")
    codigo, leidas = formato.leer_solicitud(texto)
    assert codigo == LOTE
    assert [(f.orden, f.alumno, f.importe) for f in leidas] == [
        (1, "Acuña Alma", Decimal("110000.00")),
        (2, "Acuña Alma", Decimal("110000.00")),
    ]


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
        formato.generar_solicitud(LOTE, [], "cbu")
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_solicitud(LOTE, [_solicitud()], "efectivo")
    filas = [_solicitud(i, "1.00") for i in range(1, 502)]
    texto = formato.generar_solicitud(LOTE, filas, "cbu")
    assert len(texto.splitlines()) == 502
    assert len(formato.leer_solicitud(texto)[1]) == 501


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
    texto = formato.generar_respuesta(LOTE, filas)
    lineas = texto.removeprefix(formato.BOM).splitlines()
    assert lineas[0] == "Orden;Referencia;Factura;Alumno;Importe;Fecha;Estado;Código;Motivo"
    assert lineas[1] == "1;LD2026110010001;F-202611-0001;Acuña Alma;100,50;23/11/2026;Cobrado;;"
    assert lineas[2].endswith(";20,00;23/11/2026;Rechazado;R01;Saldo insuficiente")
    assert formato.leer_respuesta(texto) == (LOTE, filas)
    assert "COBRADO_SIM" not in texto


def test_codigo_de_rechazo_desconocido_se_conserva_con_el_motivo_del_archivo():
    fila = _detalle(1, formato.RECHAZADO, "5.00", "ZZ9", "Motivo propio")
    _, (leida,) = formato.leer_respuesta(formato.generar_respuesta(LOTE, [fila]))
    assert (leida.codigo, leida.descripcion) == ("ZZ9", "Motivo propio")


@pytest.mark.parametrize(
    "cambio",
    [
        "estado",
        "importe",
        "fecha",
        "titulos",
        "columna",
        "vacio",
        "duplicado",
        "referencia",
        "cobrado_con_codigo",
        "otro_lote",
    ],
)
def test_archivo_invalido_se_rechaza_completo(cambio):
    texto = formato.generar_respuesta(LOTE, [_detalle(1), _detalle(2)])
    detalle = "1;LD2026110010001;F-202611-0001;Acuña Alma;10,00;23/11/2026;Cobrado;;"
    assert detalle in texto
    cambios = {
        "estado": (";Cobrado;", ";COBRADO_SIM;"),
        "importe": (";10,00;", ";10.00;"),
        "fecha": (";23/11/2026;Cobrado;;\r\n2", ";2026-11-23;Cobrado;;\r\n2"),
        "titulos": ("Orden;Referencia", "Nro;Referencia"),
        "columna": (";Cobrado;", ";Extra;Cobrado;"),
        "vacio": (texto.split("\r\n", 1)[1], ""),
        "duplicado": ("\r\n2;LD2026110010002", f"\r\n{detalle}\r\n2;LD2026110010002"),
        "referencia": ("LD2026110010001", "LD2026110010002"),
        "cobrado_con_codigo": ("Cobrado;;", "Cobrado;R01;"),
        "otro_lote": ("LD2026110010002", "LD2026110020002"),
    }
    with pytest.raises(formato.FormatoInvalido):
        formato.leer_respuesta(texto.replace(*cambios[cambio]))


def test_acepta_archivo_sin_bom_y_con_saltos_unix():
    texto = formato.generar_respuesta(LOTE, [_detalle(1)])
    sin_bom = texto.removeprefix(formato.BOM).replace("\r\n", "\n")
    assert formato.leer_respuesta(sin_bom) == formato.leer_respuesta(texto)


def test_importes_grandes_y_fuera_de_rango():
    filas = [_detalle(i, importe="9999999999.99") for i in range(1, 101)]
    assert formato.leer_respuesta(formato.generar_respuesta(LOTE, filas)) == (LOTE, filas)
    for invalido in ("1.005", "10000000000.00"):
        with pytest.raises(formato.FormatoInvalido):
            formato.generar_respuesta(LOTE, [_detalle(importe=invalido)])


def test_respuesta_admite_mas_de_quinientos_registros():
    filas = [_detalle(i) for i in range(1, 502)]
    assert formato.leer_respuesta(formato.generar_respuesta(LOTE, filas)) == (LOTE, filas)
