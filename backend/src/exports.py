"""Exportación de listados a CSV, compartida entre módulos.

RF-38 es transversal: el EDT lo pone en "Funcionalidades Transversales" junto con la búsqueda,
o sea que lo van a necesitar todos los módulos. Por eso el helper vive en `src/` desde el
principio, y no dentro del primer módulo que lo usó — si cada uno arma su propio CSV, el
sistema termina exportando cuatro formatos distintos.
"""

import csv
import io
from collections.abc import Iterable, Sequence
from datetime import date

from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Font

# Excel en Windows asume la codificación regional (cp1252) al abrir un .csv, y sin esto "Librería"
# se ve como "LibrerÃ­a". El BOM le avisa que es UTF-8.
BOM_UTF8 = "﻿"


def respuesta_csv(
    nombre_archivo: str,
    encabezados: Sequence[str],
    filas: Iterable[Sequence[object]],
) -> StreamingResponse:
    """Armar la respuesta de descarga de un CSV.

    Args:
        nombre_archivo: nombre base, sin extensión ni fecha (ej. "proveedores")
        encabezados: nombres de columna, en español y legibles para quien abre el archivo
        filas: los datos, en el mismo orden que los encabezados

    Returns:
        Una descarga con el CSV, nombrada `<nombre>-<AAAA-MM-DD>.csv`.
    """
    buffer = io.StringIO()
    buffer.write(BOM_UTF8)
    # `lineterminator` explícito: el default de csv es \r\n y, combinado con el \n que agrega
    # el writer en Windows, salen líneas en blanco entre filas.
    escritor = csv.writer(buffer, lineterminator="\n")
    escritor.writerow(encabezados)
    escritor.writerows(filas)
    buffer.seek(0)

    nombre_completo = f"{nombre_archivo}-{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{nombre_completo}"'},
    )


MEDIA_TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def respuesta_xlsx(
    nombre_archivo: str,
    encabezados: Sequence[str],
    filas: Iterable[Sequence[object]],
) -> StreamingResponse:
    """Igual que `respuesta_csv`, pero como libro de Excel (una hoja, encabezado en negrita).

    Los números y las fechas se escriben como valores de celda, no como texto.
    """
    libro = Workbook()
    hoja = libro.active
    if hoja is None:
        raise RuntimeError("El libro nuevo no tiene hoja activa.")
    hoja.append(list(encabezados))
    for celda in hoja[1]:
        celda.font = Font(bold=True)
    for fila in filas:
        hoja.append(list(fila))
    buffer = io.BytesIO()
    libro.save(buffer)

    nombre_completo = f"{nombre_archivo}-{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type=MEDIA_TYPE_XLSX,
        headers={"Content-Disposition": f'attachment; filename="{nombre_completo}"'},
    )


def texto_o_vacio(valor: object) -> str:
    """`None` se exporta como celda vacía, no como el string "None"."""
    return "" if valor is None else str(valor)
