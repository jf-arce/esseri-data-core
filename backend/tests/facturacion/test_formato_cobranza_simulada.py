import uuid
from datetime import date
from decimal import Decimal

import pytest

from src.facturacion import formato_cobranza_simulada as formato


def test_solicitud_plana_cbu_tiene_columnas_y_filas_uniformes():
    referencia, factura_id = uuid.uuid4(), uuid.uuid4()
    fila = formato.SolicitudFila(
        referencia=referencia,
        factura="F-202611-0001",
        alumno="Demo, Alumno 1",
        periodo="2026-11",
        concepto="Cuota; demo",
        importe=Decimal("100.50"),
        vencimiento=date(2026, 12, 1),
        medio_dato=formato.cbu_sintetico(factura_id),
    )
    contenido = formato.generar_solicitud([fila], "cbu")
    lineas = contenido.splitlines()
    assert lineas[0] == "referencia;factura;alumno;periodo;concepto;importe;vencimiento;cbu"
    assert lineas[1] == (
        f'{referencia};F-202611-0001;Demo, Alumno 1;2026-11;"Cuota; demo";100.50;'
        f"2026-12-01;{formato.cbu_sintetico(factura_id)}"
    )
    assert len(lineas) == 2


def test_solicitud_plana_tarjeta_usa_token_y_sin_cambios_de_columnas():
    fila = formato.SolicitudFila(
        referencia=uuid.uuid4(),
        factura="F-202611-0002",
        alumno="Demo, Alumno 2",
        periodo="2026-11",
        concepto="Cuota",
        importe=Decimal("60.00"),
        vencimiento=date(2026, 12, 1),
        medio_dato=formato.token_tarjeta_sintetico(uuid.uuid4()),
    )
    contenido = formato.generar_solicitud([fila], "tarjeta")
    lineas = contenido.splitlines()
    assert lineas[0].endswith(";token_tarjeta")
    assert "cbu" not in lineas[0]
    assert len(lineas) == 2


def test_datos_sinteticos_son_deterministas_y_ficticios():
    factura_id = uuid.uuid4()
    cbu = formato.cbu_sintetico(factura_id)
    token = formato.token_tarjeta_sintetico(factura_id)
    assert cbu == formato.cbu_sintetico(factura_id)
    assert token == formato.token_tarjeta_sintetico(factura_id)
    assert len(cbu) == 22 and cbu.isdigit()
    assert len(token) == 16 and token.isdigit()
    assert cbu != formato.cbu_sintetico(uuid.uuid4()) or cbu.startswith("00799999")
    assert formato.MOTIVOS_RECHAZO_SIMULADOS, "debe haber motivos de rechazo"
    for codigo, descripcion in formato.MOTIVOS_RECHAZO_SIMULADOS:
        assert 0 < len(codigo) <= 30
        assert 0 < len(descripcion) <= 250


def test_solicitud_plana_rechaza_vacia_y_mas_de_quinientos_registros():
    with pytest.raises(formato.FormatoInvalido):
        formato.generar_solicitud([], "cbu")
    filas = [
        formato.SolicitudFila(
            referencia=uuid.uuid4(),
            factura="F",
            alumno="A",
            periodo="2026-11",
            concepto="C",
            importe=Decimal("1.00"),
            vencimiento=date(2026, 12, 1),
            medio_dato=formato.cbu_sintetico(uuid.uuid4()),
        )
        for _ in range(501)
    ]
    with pytest.raises(formato.FormatoInvalido, match="500"):
        formato.generar_solicitud(filas, "cbu")


def test_respuesta_con_cobro_y_rechazo_se_lee_sin_perder_importes():
    lote = uuid.uuid4()
    filas = [
        formato.RespuestaDetalle(
            uuid.uuid4(), "COBRADO_SIM", Decimal("100.50"), date(2026, 11, 11), "", ""
        ),
        formato.RespuestaDetalle(
            uuid.uuid4(),
            "RECHAZADO_SIM",
            Decimal("20.00"),
            date(2026, 11, 11),
            "SIM01",
            "Rechazo ficticio",
        ),
    ]
    texto = formato.generar_respuesta(lote, date(2026, 11, 11), filas)
    assert texto.endswith("T;2;120.50;100.50;20.00\n")
    assert formato.leer_respuesta(texto) == (lote, filas)


@pytest.mark.parametrize(
    "cambio",
    [
        "total",
        "cantidad",
        "resultado",
        "importe",
        "fecha",
        "version",
        "entidad",
        "tipo",
        "columna",
        "cierre",
        "duplicado",
    ],
)
def test_archivo_invalido_se_rechaza_completo(cambio):
    fila = formato.RespuestaDetalle(
        uuid.uuid4(), "COBRADO_SIM", Decimal("10.00"), date(2026, 11, 11), "", ""
    )
    texto = formato.generar_respuesta(uuid.uuid4(), date(2026, 11, 11), [fila])
    cambios = {
        "total": ("T;1;10.00;10.00;0.00", "T;1;11.00;10.00;0.00"),
        "cantidad": ("T;1;", "T;2;"),
        "resultado": ("COBRADO_SIM", "00"),
        "importe": (";10.00;2026-", ";NaN;2026-"),
        "fecha": (";2026-11-11;;", ";no-es-fecha;;"),
        "version": (";1;RESPUESTA", ";2;RESPUESTA"),
        "entidad": ("ENTIDAD_FICTICIA", "BANCO_REAL"),
        "tipo": ("RESPUESTA", "SOLICITUD"),
        "columna": (";COBRADO_SIM;", ";extra;COBRADO_SIM;"),
        "cierre": ("T;1;10.00;10.00;0.00\n", ""),
        "duplicado": ("T;1;", f"D;{fila.referencia};COBRADO_SIM;10.00;2026-11-11;;\nT;2;"),
    }
    with pytest.raises(formato.FormatoInvalido):
        formato.leer_respuesta(texto.replace(*cambios[cambio]))


def test_total_admite_la_suma_de_cien_importes_validos():
    filas = [
        formato.RespuestaDetalle(
            uuid.uuid4(), formato.COBRADO, Decimal("9999999999.99"), date(2026, 11, 11), "", ""
        )
        for _ in range(100)
    ]
    lote = uuid.uuid4()
    texto = formato.generar_respuesta(lote, date(2026, 11, 11), filas)
    assert formato.leer_respuesta(texto) == (lote, filas)


def test_respuesta_admite_quinientos_registros_para_el_dataset_autorizado():
    filas = [
        formato.RespuestaDetalle(
            uuid.uuid4(), formato.COBRADO, Decimal("172000.00"), date(2026, 11, 11), "", ""
        )
        for _ in range(500)
    ]
    lote = uuid.uuid4()
    texto = formato.generar_respuesta(lote, date(2026, 11, 11), filas)
    assert formato.leer_respuesta(texto) == (lote, filas)


def test_respuesta_rechaza_mas_de_quinientos_registros():
    filas = [
        formato.RespuestaDetalle(
            uuid.uuid4(), formato.COBRADO, Decimal("10.00"), date(2026, 11, 11), "", ""
        )
        for _ in range(501)
    ]
    texto = formato.generar_respuesta(uuid.uuid4(), date(2026, 11, 11), filas)
    with pytest.raises(formato.FormatoInvalido, match="500"):
        formato.leer_respuesta(texto)
