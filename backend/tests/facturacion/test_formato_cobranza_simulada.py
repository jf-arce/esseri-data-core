import uuid
from datetime import date
from decimal import Decimal

import pytest

from src.facturacion import formato_cobranza_simulada as formato


def test_solicitud_tiene_cabecera_detalle_y_totales():
    lote, referencia, factura = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    contenido = formato.generar_solicitud(
        lote,
        date(2026, 11, 11),
        [
            formato.SolicitudDetalle(
                referencia, factura, date(2026, 12, 1), "Cuota; demo", Decimal("100.50")
            )
        ],
    )
    assert contenido.startswith(
        f"H;ESSERI_SIMULADO;1;SOLICITUD;{lote};ENTIDAD_FICTICIA;2026-11-11\n"
    )
    assert f'D;{referencia};{factura};2026-12-01;"Cuota; demo";100.50' in contenido
    assert contenido.endswith("T;1;100.50\n")


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
