"""Proprietary demo codec. No bank layouts or official result codes are implemented."""

import csv
import hashlib
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
MAX_REGISTROS = 500
COBRADO = "COBRADO_SIM"
RECHAZADO = "RECHAZADO_SIM"

# Realistic generic rejection reasons for the simulated response file.
MOTIVOS_RECHAZO_SIMULADOS: tuple[tuple[str, str], ...] = (
    ("SALDO_INSUF", "Saldo insuficiente"),
    ("CBU_INEXISTENTE", "CBU no encontrado"),
    ("CUENTA_INHABIL", "Cuenta inhabilitada para débitos"),
    ("CUENTA_CERRADA", "Cuenta cerrada o inactiva"),
    ("DEBITO_CUESTIONADO", "Débito cuestionado por el titular"),
    ("CONVENIO_VENCIDO", "Convenio de débito vencido"),
)


class FormatoInvalido(ValueError):
    pass


@dataclass(frozen=True)
class SolicitudFila:
    """One invoice row of a flat per-platform request file."""

    referencia: uuid.UUID
    factura: str
    alumno: str
    periodo: str
    concepto: str
    importe: Decimal
    vencimiento: date
    medio_dato: str


def _digitos(seed: bytes, cantidad: int) -> str:
    valor = int.from_bytes(hashlib.sha256(seed).digest(), "big") % (10**cantidad)
    return f"{valor:0{cantidad}d}"


def cbu_sintetico(factura_id: uuid.UUID) -> str:
    """Deterministic 22-digit fictional CBU; it is never a real account number."""
    return f"00799999{_digitos(factura_id.bytes, 14)}"


def token_tarjeta_sintetico(factura_id: uuid.UUID) -> str:
    """Deterministic 16-digit fictional card token; it is never a real card."""
    return _digitos(b"esseri-token-" + factura_id.bytes, 16)


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


def generar_solicitud(filas: list[SolicitudFila], medio: str) -> str:
    """Flat per-platform request file: one named header row plus one row per invoice."""
    if medio == "cbu":
        columnas = [
            "referencia",
            "factura",
            "alumno",
            "periodo",
            "concepto",
            "importe",
            "vencimiento",
            "cbu",
        ]
    elif medio == "tarjeta":
        columnas = [
            "referencia",
            "factura",
            "alumno",
            "periodo",
            "concepto",
            "importe",
            "vencimiento",
            "token_tarjeta",
        ]
    else:
        raise FormatoInvalido("Medio desconocido: se espera cbu o tarjeta.")
    if not filas:
        raise FormatoInvalido("La solicitud requiere al menos un registro.")
    if len(filas) > MAX_REGISTROS:
        raise FormatoInvalido(f"La solicitud admite hasta {MAX_REGISTROS} registros.")
    salida = StringIO(newline="")
    escritor = csv.writer(salida, delimiter=";", lineterminator="\n")
    escritor.writerow(columnas)
    for fila in filas:
        escritor.writerow(
            [
                fila.referencia,
                fila.factura,
                fila.alumno,
                fila.periodo,
                fila.concepto,
                f"{fila.importe:.2f}",
                fila.vencimiento,
                fila.medio_dato,
            ]
        )
    return salida.getvalue()


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
    # Control totals can sum up to 500 individual Numeric(12, 2) amounts.
    enteros = 13 if cero else 10
    if not re.fullmatch(rf"\d{{1,{enteros}}}\.\d{{2}}", valor):
        raise FormatoInvalido("Importe inválido: revisar el límite de enteros y los dos decimales.")
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
            raise FormatoInvalido(
                f"Se requieren cabecera, entre 1 y {MAX_REGISTROS} detalles y cierre."
            )
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
