"""Proprietary demo codec. No bank layouts or official result codes are implemented."""

import csv
import re
import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from io import StringIO

MARCA = "ESSERI_SIMULADO"
VERSION = "1"
ENTIDAD = "ENTIDAD_FICTICIA"
MAX_BYTES = 1024 * 1024
MAX_REGISTROS = 100
COBRADO = "COBRADO_SIM"
RECHAZADO = "RECHAZADO_SIM"


class FormatoInvalido(ValueError):
    pass


@dataclass(frozen=True)
class SolicitudDetalle:
    referencia: uuid.UUID
    factura_id: uuid.UUID
    vencimiento: date
    concepto: str
    importe: Decimal


@dataclass(frozen=True)
class RespuestaDetalle:
    referencia: uuid.UUID
    resultado: str
    importe: Decimal
    fecha: date
    codigo: str
    descripcion: str


def _escribir(lote_id, fecha, tipo, detalles, cierre) -> str:
    salida = StringIO(newline="")
    escritor = csv.writer(salida, delimiter=";", lineterminator="\n")
    escritor.writerow(["H", MARCA, VERSION, tipo, lote_id, ENTIDAD, fecha])
    escritor.writerows(detalles)
    escritor.writerow(cierre)
    return salida.getvalue()


def generar_solicitud(lote_id: uuid.UUID, fecha: date, filas: list[SolicitudDetalle]) -> str:
    detalles = [
        ["D", f.referencia, f.factura_id, f.vencimiento, f.concepto, f"{f.importe:.2f}"]
        for f in filas
    ]
    return _escribir(
        lote_id,
        fecha,
        "SOLICITUD",
        detalles,
        ["T", len(filas), f"{sum((f.importe for f in filas), Decimal(0)):.2f}"],
    )


def generar_respuesta(lote_id: uuid.UUID, fecha: date, filas: list[RespuestaDetalle]) -> str:
    total = sum((f.importe for f in filas), Decimal(0))
    cobrado = sum((f.importe for f in filas if f.resultado == COBRADO), Decimal(0))
    rechazado = sum((f.importe for f in filas if f.resultado == RECHAZADO), Decimal(0))
    detalles = [
        ["D", f.referencia, f.resultado, f"{f.importe:.2f}", f.fecha, f.codigo, f.descripcion]
        for f in filas
    ]
    return _escribir(
        lote_id,
        fecha,
        "RESPUESTA",
        detalles,
        ["T", len(filas), f"{total:.2f}", f"{cobrado:.2f}", f"{rechazado:.2f}"],
    )


def _importe(valor: str, *, cero: bool = False) -> Decimal:
    if not re.fullmatch(r"\d{1,10}\.\d{2}", valor):
        raise FormatoInvalido("Importe inválido: se requieren hasta diez enteros y dos decimales.")
    importe = Decimal(valor)
    if importe <= 0 and not cero:
        raise FormatoInvalido("El importe informado debe ser positivo.")
    return importe


def leer_respuesta(texto: str) -> tuple[uuid.UUID, list[RespuestaDetalle]]:
    """Validate the complete envelope before exposing any normalized business row."""
    if len(texto.encode("utf-8")) > MAX_BYTES:
        raise FormatoInvalido("El archivo supera 1 MiB.")
    try:
        registros = list(csv.reader(StringIO(texto, newline=""), delimiter=";", strict=True))
        if not 3 <= len(registros) <= MAX_REGISTROS + 2:
            raise FormatoInvalido("Se requieren cabecera, entre 1 y 100 detalles y cierre.")
        cabecera, *detalles, cierre = registros
        if (
            len(cabecera) != 7
            or cabecera[:4] != ["H", MARCA, VERSION, "RESPUESTA"]
            or cabecera[5] != ENTIDAD
        ):
            raise FormatoInvalido("Cabecera inválida: solo se admite ESSERI_SIMULADO versión 1.")
        lote_id = uuid.UUID(cabecera[4])
        date.fromisoformat(cabecera[6])
        filas = []
        referencias = set()
        for numero, detalle in enumerate(detalles, 2):
            if len(detalle) != 7 or detalle[0] != "D":
                raise FormatoInvalido(f"Línea {numero}: detalle inválido o columnas incorrectas.")
            _, referencia, resultado, importe, fecha, codigo, descripcion = detalle
            referencia_id = uuid.UUID(referencia)
            if referencia_id in referencias:
                raise FormatoInvalido(f"Línea {numero}: referencia duplicada; resultado ambiguo.")
            referencias.add(referencia_id)
            if resultado not in (COBRADO, RECHAZADO):
                raise FormatoInvalido(f"Línea {numero}: resultado simulado desconocido.")
            if (
                (resultado == COBRADO and (codigo or descripcion))
                or (resultado == RECHAZADO and (not codigo or not descripcion))
                or len(codigo) > 30
                or len(descripcion) > 250
            ):
                raise FormatoInvalido(f"Línea {numero}: código o descripción de rechazo inválidos.")
            filas.append(
                RespuestaDetalle(
                    referencia_id,
                    resultado,
                    _importe(importe),
                    date.fromisoformat(fecha),
                    codigo,
                    descripcion,
                )
            )
        if len(cierre) != 5 or cierre[0] != "T" or cierre[1] != str(len(filas)):
            raise FormatoInvalido("Cierre inválido o cantidad de registros incorrecta.")
        totales = [sum((f.importe for f in filas), Decimal(0))]
        totales += [
            sum((f.importe for f in filas if f.resultado == r), Decimal(0))
            for r in (COBRADO, RECHAZADO)
        ]
        if [_importe(v, cero=True) for v in cierre[2:]] != totales:
            raise FormatoInvalido("Los totales de control no coinciden con los detalles.")
        return lote_id, filas
    except FormatoInvalido:
        raise
    except (ValueError, csv.Error) as exc:
        raise FormatoInvalido(
            "Archivo inválido: revisar referencias UUID, fechas ISO y columnas."
        ) from exc
