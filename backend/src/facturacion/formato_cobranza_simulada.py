"""Proprietary demo codec. No bank layouts or official result codes are implemented."""

import csv
import hashlib
import re
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from io import StringIO

EMISOR = "ESSERI"
ENTIDAD = "BANCO DEMO"
TIPO_RESPUESTA = "RESPUESTA"
TIPOS_SOLICITUD = {"cbu": "DEBITO DIRECTO", "tarjeta": "TARJETA"}
MAX_BYTES = 10 * 1024 * 1024
COBRADO = "COBRADO_SIM"
RECHAZADO = "RECHAZADO_SIM"

# The file carries the plain status; the database keeps the internal values above.
ESTADO_ARCHIVO = {COBRADO: "COBRADO", RECHAZADO: "RECHAZADO"}
CODIGO_COBRADO = "000"

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
_CENTAVOS = re.compile(r"\d{15}")
_MAX_CENTAVOS_DETALLE = 10**12  # 10 integer digits + 2 decimals per detail amount
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
        raise FormatoInvalido("Código de lote inválido en la cabecera.")
    return "-".join(("LD", *coincidencia.groups()))


def referencia_corta(codigo_lote: str, orden: int) -> str:
    """`LD202611001` + 1 -> `LD2026110010001`."""
    if not 1 <= orden <= _MAX_ORDEN:
        raise FormatoInvalido("El lote supera los 9999 registros que admite el formato.")
    return f"{codigo_archivo(codigo_lote)}{orden:04d}"


def _texto(valor: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", valor).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", sin_tildes.replace(";", ",")).strip().upper()


def _centavos(importe: Decimal) -> str:
    centavos = int(importe * 100)
    if centavos != importe * 100 or not 0 <= centavos < 10**15:
        raise FormatoInvalido("Importe fuera de rango para el formato.")
    return f"{centavos:015d}"


def _fecha(valor: date) -> str:
    return f"{valor:%Y%m%d}"


def _escribir(registros: list[list[str | int]]) -> str:
    salida = StringIO(newline="")
    csv.writer(salida, delimiter=";", lineterminator="\n").writerows(registros)
    return salida.getvalue()


def generar_solicitud(codigo_lote: str, fecha: date, filas: list[SolicitudFila], medio: str) -> str:
    """Request file: header, one detail per invoice (ordered by `orden`) and a trailer."""
    tipo = TIPOS_SOLICITUD.get(medio)
    if tipo is None:
        raise FormatoInvalido("Medio desconocido: se espera cbu o tarjeta.")
    if not filas:
        raise FormatoInvalido("La solicitud requiere al menos un registro.")
    total = _centavos(sum((f.importe for f in filas), Decimal(0)))
    codigo = codigo_archivo(codigo_lote)
    detalles: list[list[str | int]] = [
        [
            "D",
            f"{f.orden:04d}",
            referencia_corta(codigo_lote, f.orden),
            _texto(f.factura),
            _texto(f.alumno),
            f.medio_dato,
            _centavos(f.importe),
            _fecha(f.vencimiento),
            _texto(f.concepto),
        ]
        for f in filas
    ]
    return _escribir(
        [
            ["H", EMISOR, tipo, codigo, _fecha(fecha), len(filas), total],
            *detalles,
            ["T", len(filas), total],
        ]
    )


def generar_respuesta(codigo_lote: str, fecha: date, filas: list[RespuestaDetalle]) -> str:
    cobradas = [f for f in filas if f.resultado == COBRADO]
    rechazadas = [f for f in filas if f.resultado == RECHAZADO]
    detalles: list[list[str | int]] = []
    for f in filas:
        if f.resultado == COBRADO:
            codigo, descripcion = CODIGO_COBRADO, ""
        else:
            codigo = _CODIGO_A_ARCHIVO.get(f.codigo) or _texto(f.codigo)
            descripcion = _texto(f.descripcion)
        detalles.append(
            [
                "D",
                f"{f.orden:04d}",
                referencia_corta(codigo_lote, f.orden),
                _texto(f.factura),
                _texto(f.alumno),
                _centavos(f.importe),
                ESTADO_ARCHIVO[f.resultado],
                codigo,
                descripcion,
            ]
        )
    return _escribir(
        [
            ["H", ENTIDAD, TIPO_RESPUESTA, codigo_archivo(codigo_lote), _fecha(fecha), len(filas)],
            *detalles,
            [
                "T",
                len(filas),
                len(cobradas),
                len(rechazadas),
                _centavos(sum((f.importe for f in cobradas), Decimal(0))),
                _centavos(sum((f.importe for f in rechazadas), Decimal(0))),
            ],
        ]
    )


def _importe(valor: str) -> Decimal:
    if not _CENTAVOS.fullmatch(valor):
        raise FormatoInvalido("Importe inválido: se esperan 15 dígitos en centavos.")
    centavos = int(valor)
    if not 0 < centavos < _MAX_CENTAVOS_DETALLE:
        raise FormatoInvalido("El importe informado debe ser positivo y dentro del límite.")
    return Decimal(centavos) / 100


def _fecha_archivo(valor: str) -> date:
    if not re.fullmatch(r"\d{8}", valor):
        raise FormatoInvalido("Fecha inválida: se espera AAAAMMDD.")
    return datetime.strptime(valor, "%Y%m%d").date()


def _orden(valor: str, referencia: str, codigo: str) -> int:
    if not re.fullmatch(r"\d{4}", valor) or int(valor) < 1:
        raise FormatoInvalido("Número de orden inválido.")
    if referencia != f"{codigo}{valor}":
        raise FormatoInvalido("La referencia no corresponde al lote y al orden informados.")
    return int(valor)


def _registros(texto: str) -> list[list[str]]:
    if len(texto.encode("utf-8")) > MAX_BYTES:
        raise FormatoInvalido("El archivo supera 10 MiB.")
    registros = list(csv.reader(StringIO(texto, newline=""), delimiter=";", strict=True))
    if len(registros) < 3:
        raise FormatoInvalido("Se requieren cabecera, al menos un detalle y cierre.")
    return registros


_ERROR_GENERICO = "Archivo inválido: revisar el código de lote, las fechas AAAAMMDD y las columnas."


def leer_solicitud(texto: str, medio: str = "cbu") -> tuple[str, date, list[SolicitudFila]]:
    """Validate a request file and return (lote code, file date, rows)."""
    tipo = TIPOS_SOLICITUD.get(medio)
    try:
        cabecera, *detalles, cierre = _registros(texto)
        if len(cabecera) != 7 or cabecera[:3:2] != ["H", tipo] or cabecera[1] != EMISOR:
            raise FormatoInvalido("Cabecera inválida: solo se admite una solicitud de ESSERI.")
        codigo = cabecera[3]
        codigo_lote = codigo_lote_desde_archivo(codigo)
        fecha = _fecha_archivo(cabecera[4])
        filas: list[SolicitudFila] = []
        for numero, detalle in enumerate(detalles, 2):
            if len(detalle) != 9 or detalle[0] != "D":
                raise FormatoInvalido(f"Línea {numero}: detalle inválido o columnas incorrectas.")
            _, orden, referencia, factura, alumno, medio_dato, importe, vencimiento, concepto = (
                detalle
            )
            filas.append(
                SolicitudFila(
                    _orden(orden, referencia, codigo),
                    factura,
                    alumno,
                    concepto,
                    _importe(importe),
                    _fecha_archivo(vencimiento),
                    medio_dato,
                )
            )
        total = _centavos(sum((f.importe for f in filas), Decimal(0)))
        if (
            cabecera[5] != str(len(filas))
            or cabecera[6] != total
            or cierre != ["T", str(len(filas)), total]
            or len({f.orden for f in filas}) != len(filas)
        ):
            raise FormatoInvalido("Cierre o totales de control incorrectos.")
        return codigo_lote, fecha, filas
    except FormatoInvalido:
        raise
    except (ValueError, csv.Error) as exc:
        raise FormatoInvalido(_ERROR_GENERICO) from exc


def leer_respuesta(texto: str) -> tuple[str, list[RespuestaDetalle]]:
    """Validate the complete envelope before exposing any normalized business row."""
    try:
        cabecera, *detalles, cierre = _registros(texto)
        if len(cabecera) != 6 or cabecera[:3:2] != ["H", TIPO_RESPUESTA] or cabecera[1] != ENTIDAD:
            raise FormatoInvalido("Cabecera inválida: solo se admite una respuesta de BANCO DEMO.")
        codigo = cabecera[3]
        codigo_lote = codigo_lote_desde_archivo(codigo)
        fecha = _fecha_archivo(cabecera[4])
        filas: list[RespuestaDetalle] = []
        referencias = set()
        for numero, detalle in enumerate(detalles, 2):
            if len(detalle) != 9 or detalle[0] != "D":
                raise FormatoInvalido(f"Línea {numero}: detalle inválido o columnas incorrectas.")
            _, orden, referencia, factura, alumno, importe, estado, codigo_fila, descripcion = (
                detalle
            )
            orden_n = _orden(orden, referencia, codigo)
            if referencia in referencias:
                raise FormatoInvalido(f"Línea {numero}: referencia duplicada; resultado ambiguo.")
            referencias.add(referencia)
            if estado == ESTADO_ARCHIVO[COBRADO]:
                resultado = COBRADO
                valido = codigo_fila == CODIGO_COBRADO and not descripcion
                codigo_interno = ""
            elif estado == ESTADO_ARCHIVO[RECHAZADO]:
                resultado = RECHAZADO
                valido = bool(codigo_fila) and codigo_fila != CODIGO_COBRADO and bool(descripcion)
                codigo_interno = CODIGOS_RECHAZO_ARCHIVO.get(codigo_fila, codigo_fila)
                descripcion = _DESCRIPCION_INTERNA.get(codigo_interno, descripcion)
            else:
                raise FormatoInvalido(f"Línea {numero}: estado desconocido.")
            if not valido or len(codigo_interno) > 30 or len(descripcion) > 250:
                raise FormatoInvalido(f"Línea {numero}: código o descripción de rechazo inválidos.")
            filas.append(
                RespuestaDetalle(
                    orden_n,
                    referencia,
                    factura,
                    alumno,
                    resultado,
                    _importe(importe),
                    fecha,
                    codigo_interno,
                    descripcion,
                )
            )
        cobradas = [f for f in filas if f.resultado == COBRADO]
        rechazadas = [f for f in filas if f.resultado == RECHAZADO]
        esperado = [
            "T",
            str(len(filas)),
            str(len(cobradas)),
            str(len(rechazadas)),
            _centavos(sum((f.importe for f in cobradas), Decimal(0))),
            _centavos(sum((f.importe for f in rechazadas), Decimal(0))),
        ]
        if cabecera[5] != str(len(filas)) or cierre != esperado:
            raise FormatoInvalido("Cierre, cantidades o totales de control incorrectos.")
        return codigo_lote, filas
    except FormatoInvalido:
        raise
    except (ValueError, csv.Error) as exc:
        raise FormatoInvalido(_ERROR_GENERICO) from exc
