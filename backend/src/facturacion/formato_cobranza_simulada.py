"""Proprietary demo codec. No bank layouts or official result codes are implemented."""

import csv
import hashlib
import re
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import StringIO

BOM = "\ufeff"  # lets Excel open the accents as UTF-8
COLUMNAS_SOLICITUD = {
    "cbu": [
        "Orden",
        "Referencia",
        "Factura",
        "Alumno",
        "CBU",
        "Importe",
        "Vencimiento",
        "Concepto",
    ],
    "tarjeta": [
        "Orden",
        "Referencia",
        "Factura",
        "Alumno",
        "Token de tarjeta",
        "Importe",
        "Vencimiento",
        "Concepto",
    ],
}
COLUMNAS_RESPUESTA = [
    "Orden",
    "Referencia",
    "Factura",
    "Alumno",
    "Importe",
    "Fecha",
    "Estado",
    "Código",
    "Motivo",
]
MAX_BYTES = 10 * 1024 * 1024
COBRADO = "COBRADO_SIM"
RECHAZADO = "RECHAZADO_SIM"

# The file carries the plain status; the database keeps the internal values above.
ESTADO_ARCHIVO = {COBRADO: "Cobrado", RECHAZADO: "Rechazado"}

# Realistic generic rejection reasons for the simulated response file.
MOTIVOS_RECHAZO_SIMULADOS: tuple[tuple[str, str], ...] = (
    ("SALDO_INSUF", "Saldo insuficiente"),
    ("CBU_INEXISTENTE", "CBU no encontrado"),
    ("CUENTA_INHABIL", "Cuenta inhabilitada para débitos"),
    ("CUENTA_CERRADA", "Cuenta cerrada o inactiva"),
    ("DEBITO_CUESTIONADO", "Débito cuestionado por el titular"),
    ("CONVENIO_VENCIDO", "Convenio de débito vencido"),
)
# File code (R01..R06) <-> internal code, in the same order as the reasons above.
CODIGOS_RECHAZO_ARCHIVO: dict[str, str] = {
    f"R{indice:02d}": codigo for indice, (codigo, _) in enumerate(MOTIVOS_RECHAZO_SIMULADOS, 1)
}
_CODIGO_A_ARCHIVO = {interno: archivo for archivo, interno in CODIGOS_RECHAZO_ARCHIVO.items()}
_DESCRIPCION_INTERNA = dict(MOTIVOS_RECHAZO_SIMULADOS)

_CODIGO_LOTE = re.compile(r"LD(\d{4})(\d{2})(\d{3}|[0-9A-F]{8})")
_IMPORTE = re.compile(r"\d{1,10},\d{2}")
_REFERENCIA = re.compile(r"(LD\d{6}(?:\d{3}|[0-9A-F]{8}))(\d{4})")
_MAX_ORDEN = 9999


class FormatoInvalido(ValueError):
    pass


@dataclass(frozen=True)
class SolicitudFila:
    """One invoice row of a per-platform request file."""

    orden: int
    factura: str
    alumno: str
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
    orden: int
    referencia: str
    factura: str
    alumno: str
    resultado: str
    importe: Decimal
    fecha: date
    codigo: str
    descripcion: str


def codigo_archivo(codigo_lote: str) -> str:
    """`LD-2026-11-001` -> `LD202611001`."""
    return codigo_lote.replace("-", "")


def codigo_lote_desde_archivo(valor: str) -> str:
    """`LD202611001` -> `LD-2026-11-001` (also the `LD-AAAA-MM-<HEX8>` fallback)."""
    coincidencia = _CODIGO_LOTE.fullmatch(valor)
    if coincidencia is None:
        raise FormatoInvalido("Código de lote inválido en la referencia.")
    return "-".join(("LD", *coincidencia.groups()))


def referencia_corta(codigo_lote: str, orden: int) -> str:
    """`LD-2026-11-001` + 1 -> `LD2026110010001`."""
    if not 1 <= orden <= _MAX_ORDEN:
        raise FormatoInvalido("El lote supera los 9999 registros que admite el formato.")
    return f"{codigo_archivo(codigo_lote)}{orden:04d}"


def _texto(valor: str) -> str:
    return re.sub(r"\s+", " ", valor.replace(";", ",")).strip()


def _importe_texto(importe: Decimal) -> str:
    if importe != importe.quantize(Decimal("0.01")) or not 0 <= importe < 10**10:
        raise FormatoInvalido("Importe fuera de rango para el formato.")
    return f"{importe:.2f}".replace(".", ",")


def _fecha_texto(valor: date) -> str:
    return f"{valor:%d/%m/%Y}"


def _escribir(registros: list[list[str | int]]) -> str:
    salida = StringIO(newline="")
    csv.writer(salida, delimiter=";", lineterminator="\r\n").writerows(registros)
    return BOM + salida.getvalue()


def generar_solicitud(codigo_lote: str, filas: list[SolicitudFila], medio: str) -> str:
    """Request file: one titled column row and one row per invoice, ordered by `orden`."""
    columnas = COLUMNAS_SOLICITUD.get(medio)
    if columnas is None:
        raise FormatoInvalido("Medio desconocido: se espera cbu o tarjeta.")
    if not filas:
        raise FormatoInvalido("La solicitud requiere al menos un registro.")
    return _escribir(
        [
            columnas,
            *(
                [
                    f.orden,
                    referencia_corta(codigo_lote, f.orden),
                    _texto(f.factura),
                    _texto(f.alumno),
                    f.medio_dato,
                    _importe_texto(f.importe),
                    _fecha_texto(f.vencimiento),
                    _texto(f.concepto),
                ]
                for f in filas
            ),
        ]
    )


def generar_respuesta(codigo_lote: str, filas: list[RespuestaDetalle]) -> str:
    if not filas:
        raise FormatoInvalido("La respuesta requiere al menos un registro.")
    detalles: list[list[str | int]] = []
    for f in filas:
        if f.resultado == COBRADO:
            codigo, descripcion = "", ""
        else:
            codigo = _CODIGO_A_ARCHIVO.get(f.codigo) or _texto(f.codigo)
            descripcion = _texto(f.descripcion)
        detalles.append(
            [
                f.orden,
                referencia_corta(codigo_lote, f.orden),
                _texto(f.factura),
                _texto(f.alumno),
                _importe_texto(f.importe),
                _fecha_texto(f.fecha),
                ESTADO_ARCHIVO[f.resultado],
                codigo,
                descripcion,
            ]
        )
    return _escribir([COLUMNAS_RESPUESTA, *detalles])


def _importe(valor: str) -> Decimal:
    if not _IMPORTE.fullmatch(valor):
        raise FormatoInvalido("Importe inválido: se espera el formato 1234,56.")
    importe = Decimal(valor.replace(",", "."))
    if importe <= 0:
        raise FormatoInvalido("El importe informado debe ser positivo.")
    return importe


def _fecha_archivo(valor: str) -> date:
    if not re.fullmatch(r"\d{2}/\d{2}/\d{4}", valor):
        raise FormatoInvalido("Fecha inválida: se espera DD/MM/AAAA.")
    return datetime.strptime(valor, "%d/%m/%Y").date()


def _orden(valor: str, referencia: str) -> tuple[str, int]:
    """Validate order and reference together; return (file batch code, order)."""
    coincidencia = _REFERENCIA.fullmatch(referencia)
    if not re.fullmatch(r"\d{1,4}", valor) or int(valor) < 1:
        raise FormatoInvalido("Número de orden inválido.")
    if coincidencia is None or int(coincidencia.group(2)) != int(valor):
        raise FormatoInvalido("La referencia no corresponde al orden informado.")
    return coincidencia.group(1), int(valor)


def _registros(texto: str, columnas: list[str]) -> list[list[str]]:
    if len(texto.encode("utf-8")) > MAX_BYTES:
        raise FormatoInvalido("El archivo supera 10 MiB.")
    texto = texto.removeprefix(BOM)
    registros = list(csv.reader(StringIO(texto, newline=""), delimiter=";", strict=True))
    if len(registros) < 2 or registros[0] != columnas:
        raise FormatoInvalido("Cabecera inválida: faltan los títulos de columna esperados.")
    return registros[1:]


def _unico_lote(codigos: set[str]) -> str:
    if len(codigos) != 1:
        raise FormatoInvalido("Las referencias pertenecen a más de un lote.")
    return codigo_lote_desde_archivo(next(iter(codigos)))


_ERROR_GENERICO = "Archivo inválido: revisar las referencias, las fechas DD/MM/AAAA y las columnas."


def leer_solicitud(texto: str, medio: str = "cbu") -> tuple[str, list[SolicitudFila]]:
    """Validate a request file and return (lote code, rows)."""
    columnas = COLUMNAS_SOLICITUD.get(medio)
    if columnas is None:
        raise FormatoInvalido("Medio desconocido: se espera cbu o tarjeta.")
    try:
        detalles = _registros(texto, columnas)
        filas: list[SolicitudFila] = []
        codigos: set[str] = set()
        for numero, detalle in enumerate(detalles, 2):
            if len(detalle) != len(columnas):
                raise FormatoInvalido(f"Línea {numero}: columnas incorrectas.")
            orden, referencia, factura, alumno, medio_dato, importe, vencimiento, concepto = detalle
            codigo, orden_n = _orden(orden, referencia)
            codigos.add(codigo)
            filas.append(
                SolicitudFila(
                    orden_n,
                    factura,
                    alumno,
                    concepto,
                    _importe(importe),
                    _fecha_archivo(vencimiento),
                    medio_dato,
                )
            )
        if len({f.orden for f in filas}) != len(filas):
            raise FormatoInvalido("Hay órdenes duplicados en la solicitud.")
        return _unico_lote(codigos), filas
    except FormatoInvalido:
        raise
    except (ValueError, csv.Error) as exc:
        raise FormatoInvalido(_ERROR_GENERICO) from exc


def leer_respuesta(texto: str) -> tuple[str, list[RespuestaDetalle]]:
    """Validate the complete file before exposing any normalized business row."""
    try:
        detalles = _registros(texto, COLUMNAS_RESPUESTA)
        filas: list[RespuestaDetalle] = []
        referencias: set[str] = set()
        codigos: set[str] = set()
        for numero, detalle in enumerate(detalles, 2):
            if len(detalle) != len(COLUMNAS_RESPUESTA):
                raise FormatoInvalido(f"Línea {numero}: columnas incorrectas.")
            orden, referencia, factura, alumno, importe, fecha, estado, codigo_fila, motivo = (
                detalle
            )
            codigo, orden_n = _orden(orden, referencia)
            codigos.add(codigo)
            if referencia in referencias:
                raise FormatoInvalido(f"Línea {numero}: referencia duplicada; resultado ambiguo.")
            referencias.add(referencia)
            if estado == ESTADO_ARCHIVO[COBRADO]:
                resultado, valido, codigo_interno = COBRADO, not (codigo_fila or motivo), ""
            elif estado == ESTADO_ARCHIVO[RECHAZADO]:
                resultado, valido = RECHAZADO, bool(codigo_fila and motivo)
                codigo_interno = CODIGOS_RECHAZO_ARCHIVO.get(codigo_fila, codigo_fila)
                motivo = _DESCRIPCION_INTERNA.get(codigo_interno, motivo)
            else:
                raise FormatoInvalido(f"Línea {numero}: estado desconocido.")
            if not valido or len(codigo_interno) > 30 or len(motivo) > 250:
                raise FormatoInvalido(f"Línea {numero}: código o motivo de rechazo inválidos.")
            filas.append(
                RespuestaDetalle(
                    orden_n,
                    referencia,
                    factura,
                    alumno,
                    resultado,
                    _importe(importe),
                    _fecha_archivo(fecha),
                    codigo_interno,
                    motivo,
                )
            )
        return _unico_lote(codigos), filas
    except FormatoInvalido:
        raise
    except (ValueError, csv.Error) as exc:
        raise FormatoInvalido(_ERROR_GENERICO) from exc
