"""Exportación del horario semanal de una división a Excel."""

import re
import unicodedata
import uuid
from datetime import time
from io import BytesIO

from openpyxl import Workbook
from openpyxl.cell.rich_text import CellRichText, TextBlock
from openpyxl.cell.text import InlineFont
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from src.academico.horarios_service import DIAS_SEMANA
from src.academico.models import Division, Docente, MateriaCurso

PASO_MINUTOS = 30
FUENTE = "Calibri"
COLOR_NEUTRO = "D9D9D9"
COLOR_TITULO = "111827"
COLOR_APAGADO = "6B7280"
COLOR_ENCABEZADO = "1F2937"
COLOR_HORA = "F3F4F6"
COLOR_BANDA = "F9FAFB"
LINEA = Side(style="thin", color="E5E7EB")
LINEA_HORA = Side(style="thin", color="D1D5DB")
SEPARADOR = Side(style="medium", color="FFFFFF")
BORDE = Border(left=LINEA, right=LINEA, top=LINEA, bottom=LINEA)
CENTRADO = Alignment(horizontal="center", vertical="center", wrap_text=True)
FILA_TITULO = 1
FILA_ENCABEZADO = 3
PRIMERA_FILA = FILA_ENCABEZADO + 1


def _minutos(hora: time) -> int:
    return hora.hour * 60 + hora.minute


def _hora_texto(minutos: int) -> str:
    return f"{minutos // 60:02d}:{minutos % 60:02d}"


def _hex_valido(color: str | None) -> str:
    if color and re.fullmatch(r"#[0-9a-fA-F]{6}", color):
        return color[1:].upper()
    return COLOR_NEUTRO


def _texto_legible(hex_color: str) -> str:
    """Blanco o negro según el contraste (mismo criterio que `colorTextoLegible` del front)."""
    canales = []
    for i in (0, 2, 4):
        canal = int(hex_color[i : i + 2], 16) / 255
        canales.append(canal / 12.92 if canal <= 0.03928 else ((canal + 0.055) / 1.055) ** 2.4)
    luminancia = 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2]
    return "FFFFFF" if 1.05 / (luminancia + 0.05) >= (luminancia + 0.05) / 0.05 else "000000"


class _Franja:
    def __init__(
        self,
        dia: int,
        inicio: time,
        fin: time,
        materia_curso: MateriaCurso,
        docentes: list[str],
    ) -> None:
        self.dia = dia
        self.inicio = _minutos(inicio)
        self.fin = _minutos(fin)
        self.materia = materia_curso.materia_nombre or ""
        self.tipo = materia_curso.materia_tipo or ""
        self.color = _hex_valido(materia_curso.materia.color if materia_curso.materia else None)
        self.docentes = docentes

    @property
    def rango(self) -> str:
        return f"{_hora_texto(self.inicio)} a {_hora_texto(self.fin)}"


def _docentes_del_ciclo(
    materia_curso: MateriaCurso, ciclo_lectivo: str, docentes: dict[uuid.UUID, Docente]
) -> list[str]:
    nombres = []
    for asignacion in materia_curso.asignaciones:
        docente = docentes.get(asignacion.docente_id)
        if asignacion.ciclo_lectivo != ciclo_lectivo or docente is None:
            continue
        if docente.apellido and docente.nombre:
            nombres.append(f"{docente.apellido}, {docente.nombre}")
        else:
            nombres.append(docente.legajo)
    return sorted(nombres)


def _cargar_franjas(db: Session, division_id: uuid.UUID, ciclo_lectivo: str) -> list[_Franja]:
    materias_curso = db.scalars(
        select(MateriaCurso)
        .where(MateriaCurso.division_id == division_id)
        .options(
            selectinload(MateriaCurso.materia),
            selectinload(MateriaCurso.horarios),
            selectinload(MateriaCurso.asignaciones),
        )
    ).all()
    ids_docentes = {a.docente_id for mc in materias_curso for a in mc.asignaciones}
    docentes = {
        docente.id: docente
        for docente in db.scalars(
            select(Docente)
            .where(Docente.id.in_(ids_docentes))
            .options(selectinload(Docente.persona))
        )
    }
    franjas = [
        _Franja(
            horario.dia_semana,
            horario.hora_inicio,
            horario.hora_fin,
            materia_curso,
            _docentes_del_ciclo(materia_curso, ciclo_lectivo, docentes),
        )
        for materia_curso in materias_curso
        for horario in materia_curso.horarios
    ]
    return sorted(franjas, key=lambda f: (f.dia, f.inicio, f.materia))


def _etiqueta_division(division: Division) -> str:
    """Igual que `etiquetaDivision` del front: "4°B", o "4° Primera" si el nombre es largo."""
    prefijo = f"{division.anio.numero}°"
    if division.nombre.startswith(prefijo):
        return division.nombre
    separador = "" if len(division.nombre) <= 2 else " "
    return f"{prefijo}{separador}{division.nombre}"


def _titulo(hoja: Worksheet, etiqueta: str, ciclo_lectivo: str, columnas: int) -> None:
    hoja.merge_cells(
        start_row=FILA_TITULO, start_column=1, end_row=FILA_TITULO, end_column=columnas
    )
    hoja.merge_cells(
        start_row=FILA_TITULO + 1, start_column=1, end_row=FILA_TITULO + 1, end_column=columnas
    )
    titulo = hoja.cell(row=FILA_TITULO, column=1, value=f"Horario de {etiqueta}")
    titulo.font = Font(name=FUENTE, size=18, bold=True, color=COLOR_TITULO)
    titulo.alignment = Alignment(horizontal="left", vertical="center")
    subtitulo = hoja.cell(row=FILA_TITULO + 1, column=1, value=f"Ciclo lectivo {ciclo_lectivo}")
    subtitulo.font = Font(name=FUENTE, size=11, color=COLOR_APAGADO)
    subtitulo.alignment = Alignment(horizontal="left", vertical="center")
    hoja.row_dimensions[FILA_TITULO].height = 30
    hoja.row_dimensions[FILA_TITULO + 1].height = 18


def _encabezado(hoja: Worksheet, fila: int, columna: int, texto: str) -> None:
    celda = hoja.cell(row=fila, column=columna, value=texto)
    celda.font = Font(name=FUENTE, bold=True, color="FFFFFF", size=11)
    celda.fill = PatternFill("solid", fgColor=COLOR_ENCABEZADO)
    celda.alignment = CENTRADO


def _texto_bloque(franja: _Franja, color_texto: str, una_linea: bool) -> CellRichText:
    nombre = InlineFont(rFont="Calibri", sz=11, b=True, color=color_texto)
    detalle = InlineFont(rFont="Calibri", sz=9, color=color_texto)
    docente = InlineFont(rFont="Calibri", sz=9, i=True, color=color_texto)
    docentes = "; ".join(franja.docentes)
    if una_linea:
        resto = " · ".join([franja.rango, *([docentes] if docentes else [])])
        return CellRichText(TextBlock(nombre, franja.materia), TextBlock(detalle, f"  {resto}"))
    partes = [TextBlock(nombre, franja.materia), TextBlock(detalle, f"\n{franja.rango}")]
    if docentes:
        partes.append(TextBlock(docente, f"\n{docentes}"))
    return CellRichText(*partes)


def _armar_grilla(
    hoja: Worksheet, franjas: list[_Franja], etiqueta: str, ciclo_lectivo: str
) -> None:
    hoja.title = "Horario"
    hoja.sheet_view.showGridLines = False
    if not franjas:
        _titulo(hoja, etiqueta, ciclo_lectivo, 7)
        hoja.cell(row=FILA_ENCABEZADO, column=1, value="Todavía no tiene horarios cargados.")
        return

    inicio = min(f.inicio for f in franjas) // PASO_MINUTOS * PASO_MINUTOS
    fin = -(-max(f.fin for f in franjas) // PASO_MINUTOS) * PASO_MINUTOS
    dias = list(range(1, 8 if any(f.dia == 7 for f in franjas) else 7))
    filas = (fin - inicio) // PASO_MINUTOS
    ultima_fila = PRIMERA_FILA + filas - 1

    _titulo(hoja, etiqueta, ciclo_lectivo, 1 + len(dias))
    _encabezado(hoja, FILA_ENCABEZADO, 1, "Hora")
    for i, dia in enumerate(dias):
        _encabezado(hoja, FILA_ENCABEZADO, 2 + i, DIAS_SEMANA[dia].capitalize())
    hoja.row_dimensions[FILA_ENCABEZADO].height = 24

    for i in range(filas):
        fila = PRIMERA_FILA + i
        minutos = inicio + i * PASO_MINUTOS
        # Línea más marcada en cada hora en punto, para leer la grilla de un vistazo.
        arriba = LINEA_HORA if minutos % 60 == 0 else LINEA
        hora = hoja.cell(
            row=fila, column=1, value=_hora_texto(minutos) if minutos % 60 == 0 else ""
        )
        hora.font = Font(name=FUENTE, size=10, color=COLOR_APAGADO)
        hora.fill = PatternFill("solid", fgColor=COLOR_HORA)
        hora.alignment = Alignment(horizontal="center", vertical="top")
        hora.border = Border(left=LINEA, right=LINEA, top=arriba)
        for j in range(len(dias)):
            hoja.cell(row=fila, column=2 + j).border = Border(left=LINEA, right=LINEA, top=arriba)
        hoja.row_dimensions[fila].height = 30
    for j in range(1 + len(dias)):
        hoja.cell(row=ultima_fila, column=1 + j).border = Border(
            left=LINEA, right=LINEA, bottom=LINEA_HORA
        )

    ocupadas: set[tuple[int, int]] = set()
    for franja in franjas:
        columna = 2 + dias.index(franja.dia)
        primera = (franja.inicio - inicio) // PASO_MINUTOS
        ultima = -(-(franja.fin - inicio) // PASO_MINUTOS) - 1
        celdas = {
            (fila, columna) for fila in range(PRIMERA_FILA + primera, PRIMERA_FILA + ultima + 1)
        }
        # Datos viejos pueden tener franjas que se pisan: combinar celdas ya combinadas
        # corrompe el archivo, así que esas quedan solo en la hoja "Listado".
        if celdas & ocupadas:
            continue
        ocupadas |= celdas

        relleno = PatternFill("solid", fgColor=franja.color)
        for fila, col in celdas:
            celda = hoja.cell(row=fila, column=col)
            celda.fill = relleno
            celda.border = Border(left=SEPARADOR, right=SEPARADOR, top=SEPARADOR, bottom=SEPARADOR)
        principal = hoja.cell(row=PRIMERA_FILA + primera, column=columna)
        principal.value = _texto_bloque(franja, _texto_legible(franja.color), ultima == primera)
        principal.alignment = Alignment(horizontal="left", vertical="top", wrap_text=True, indent=1)
        if ultima > primera:
            hoja.merge_cells(
                start_row=PRIMERA_FILA + primera,
                start_column=columna,
                end_row=PRIMERA_FILA + ultima,
                end_column=columna,
            )

    hoja.column_dimensions["A"].width = 9
    for i in range(len(dias)):
        hoja.column_dimensions[get_column_letter(2 + i)].width = 26
    hoja.freeze_panes = hoja.cell(row=PRIMERA_FILA, column=2)
    hoja.page_setup.orientation = "landscape"
    hoja.page_setup.paperSize = hoja.PAPERSIZE_A4
    hoja.page_setup.fitToWidth = 1
    hoja.page_setup.fitToHeight = 0
    hoja.sheet_properties.pageSetUpPr.fitToPage = True
    hoja.print_options.horizontalCentered = True
    hoja.page_margins.left = hoja.page_margins.right = 0.4
    hoja.print_area = f"A1:{get_column_letter(1 + len(dias))}{ultima_fila}"


def _armar_listado(hoja: Worksheet, franjas: list[_Franja], etiqueta: str) -> None:
    hoja.title = "Listado"
    hoja.sheet_view.showGridLines = False
    encabezados = ["", "Día", "Desde", "Hasta", "Materia", "Tipo", "Docentes"]
    for columna, texto in enumerate(encabezados, start=1):
        _encabezado(hoja, 1, columna, texto)
    hoja.row_dimensions[1].height = 24

    for i, f in enumerate(franjas):
        fila = 2 + i
        valores = [
            None,
            DIAS_SEMANA[f.dia].capitalize(),
            _hora_texto(f.inicio),
            _hora_texto(f.fin),
            f.materia,
            f.tipo.capitalize(),
            "; ".join(f.docentes),
        ]
        for columna, valor in enumerate(valores, start=1):
            celda = hoja.cell(row=fila, column=columna, value=valor)
            celda.border = BORDE
            celda.alignment = Alignment(vertical="center", wrap_text=columna == 7)
            if i % 2 == 1:
                celda.fill = PatternFill("solid", fgColor=COLOR_BANDA)
        # Muestra del color de la materia, igual que en la pantalla.
        hoja.cell(row=fila, column=1).fill = PatternFill("solid", fgColor=f.color)
        hoja.cell(row=fila, column=5).font = Font(name=FUENTE, bold=True)
        hoja.row_dimensions[fila].height = 20

    for letra, ancho in zip("ABCDEFG", (3, 13, 9, 9, 30, 12, 40), strict=True):
        hoja.column_dimensions[letra].width = ancho
    hoja.freeze_panes = "A2"
    if franjas:
        hoja.auto_filter.ref = f"A1:G{1 + len(franjas)}"
    hoja.page_setup.orientation = "landscape"
    hoja.page_setup.fitToWidth = 1
    hoja.page_setup.fitToHeight = 0
    hoja.sheet_properties.pageSetUpPr.fitToPage = True
    hoja.oddHeader.center.text = f"Horario de {etiqueta}"


def generar_xlsx_horario_division(db: Session, division: Division, ciclo_lectivo: str) -> bytes:
    """Excel con la grilla semanal de la división y un listado plano de las franjas.

    Los docentes son los asignados en `ciclo_lectivo`, igual que en la pantalla.
    """
    franjas = _cargar_franjas(db, division.id, ciclo_lectivo)
    etiqueta = _etiqueta_division(division)
    libro = Workbook()
    _armar_grilla(libro.worksheets[0], franjas, etiqueta, ciclo_lectivo)
    _armar_listado(libro.create_sheet(), franjas, etiqueta)

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def _slug(texto: str) -> str:
    ascii_ = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Za-z0-9]+", "_", ascii_).strip("_").lower()


def nombre_archivo_horario(division: Division, ciclo_lectivo: str) -> str:
    """`horario_semanal_nivel_<nivel>_<curso>_<ciclo>.xlsx`, en ASCII para el header
    `Content-Disposition` (el nombre de la división puede traer "°")."""
    nivel = _slug(division.anio.nivel_educativo.nombre)
    # Algunos niveles ya se llaman "Nivel Primario": no repetir la palabra.
    if nivel != "nivel" and not nivel.startswith("nivel_"):
        nivel = f"nivel_{nivel}"
    partes = [nivel, _slug(_etiqueta_division(division)), _slug(ciclo_lectivo)]
    return f"horario_semanal_{'_'.join(partes)}.xlsx"
