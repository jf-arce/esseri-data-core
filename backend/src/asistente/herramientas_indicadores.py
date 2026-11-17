"""Indicadores del panel y evolución financiera."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field

from src.asistente.herramientas_base import (
    ContextoHerramienta,
    FormaGrafico,
    Herramienta,
    ResultadoHerramienta,
    agregar_grafico,
    agregar_tabla,
    bloque_kpi,
    bloque_tabla,
    fecha_ar,
    mes_iso_ar,
    numero,
    variacion_porcentual,
)
from src.asistente.herramientas_workflows import contar_tareas
from src.auth.constants import (
    PERMISO_FACTURACION_LEER,
    PERMISO_PANEL_ADMIN_LEER,
    PERMISO_PROVEEDORES_COMPRAS_LEER,
)
from src.panel_admin.service import obtener_evolucion_financiera, obtener_indicadores_direccion

_FUENTE_PANEL = "Panel administrativo"
_MAX_MESES = 24


Indicador = Literal[
    "alumnos_activos", "inasistencias_del_dia", "solicitudes_compra_pendientes", "tareas_abiertas"
]


class ParametrosIndicadores(BaseModel):
    indicadores: list[Indicador] = Field(
        min_length=1,
        description="Solo los indicadores que pidió la persona; no pidas los que no necesites.",
    )


def _indicadores_generales(
    contexto: ContextoHerramienta, parametros: ParametrosIndicadores
) -> ResultadoHerramienta:
    # No se expone `deuda_pendiente_total`: es una cifra provisoria del panel. La deuda sale de
    # la cuenta corriente (`deuda_por_familias`).
    base = obtener_indicadores_direccion(contexto.db, fecha_hoy=contexto.hoy)
    hoy = fecha_ar(contexto.hoy)
    pedidos = set(parametros.indicadores)
    datos: dict[str, object] = {"fecha": hoy}
    bloques: list[dict[str, object]] = []
    sin_permiso: list[str] = []

    if "alumnos_activos" in pedidos:
        datos["alumnos_activos"] = base["alumnos_activos"]
        bloques.append(
            bloque_kpi(
                "Alumnos activos",
                base["alumnos_activos"],
                periodo=f"al {hoy}",
                fuente=_FUENTE_PANEL,
            )
        )
    if "inasistencias_del_dia" in pedidos:
        datos["inasistencias_del_dia"] = base["inasistencias_hoy"]
        bloques.append(
            bloque_kpi(
                "Inasistencias del día",
                base["inasistencias_hoy"],
                periodo=hoy,
                fuente=_FUENTE_PANEL,
            )
        )
    if "solicitudes_compra_pendientes" in pedidos:
        if contexto.tiene_permiso(PERMISO_PROVEEDORES_COMPRAS_LEER):
            datos["solicitudes_compra_pendientes"] = base["solicitudes_compra_pendientes"]
            bloques.append(
                bloque_kpi(
                    "Solicitudes de compra pendientes",
                    base["solicitudes_compra_pendientes"],
                    periodo=f"al {hoy}",
                    fuente="Proveedores y compras",
                )
            )
        else:
            sin_permiso.append("solicitudes_compra_pendientes")
    if "tareas_abiertas" in pedidos:
        tareas = contar_tareas(contexto)
        datos["tareas_abiertas"] = tareas.abiertas
        datos["tareas_alcance"] = tareas.alcance
        bloques.append(
            bloque_kpi(
                "Tareas abiertas" + (" (todas)" if tareas.alcance == "todas" else " (propias)"),
                tareas.abiertas,
                periodo=f"al {hoy}",
                fuente="Workflows",
            )
        )
    if sin_permiso:
        datos["secciones_sin_permiso"] = sin_permiso
    return ResultadoHerramienta(para_llm=datos, bloques=bloques)


class ParametrosEvolucion(BaseModel):
    desde: date | None = Field(
        default=None, description="Inicio, AAAA-MM-DD. Por defecto, el 1 de enero del año."
    )
    hasta: date | None = Field(default=None, description="Fin, AAAA-MM-DD. Por defecto, hoy.")
    comparar_con_anterior: bool = Field(
        default=False,
        description="Suma lo del período inmediatamente anterior de igual duración y la variación.",
    )
    grafico: FormaGrafico | None = Field(
        default=None, description="Solo si conviene verlo en un gráfico o lo piden."
    )


def _evolucion_financiera(
    contexto: ContextoHerramienta, parametros: ParametrosEvolucion
) -> ResultadoHerramienta:
    hasta = parametros.hasta or contexto.hoy
    desde = parametros.desde or date(hasta.year, 1, 1)
    if desde > hasta or (hasta.year - desde.year) * 12 + hasta.month - desde.month >= _MAX_MESES:
        return ResultadoHerramienta(
            para_llm={"error": "El período es inválido o supera 24 meses. Pedí uno más corto."}
        )
    meses = obtener_evolucion_financiera(
        contexto.db, fecha_hoy=contexto.hoy, desde=desde, hasta=hasta
    )
    anteriores: list[dict[str, Decimal | str]] = []
    desde_ant = hasta_ant = None
    if parametros.comparar_con_anterior:
        # Igual cantidad de días, terminando el día anterior al inicio pedido.
        hasta_ant = desde - timedelta(days=1)
        desde_ant = hasta_ant - (hasta - desde)
        anteriores = obtener_evolucion_financiera(
            contexto.db, fecha_hoy=contexto.hoy, desde=desde_ant, hasta=hasta_ant
        )
    filas = []
    for indice, mes in enumerate(meses):
        fila = {
            "mes": mes_iso_ar(mes["mes"]),
            "facturado": numero(mes["facturado"]),
            "cobrado": numero(mes["cobrado"]),
        }
        if parametros.comparar_con_anterior:
            # Se compara mes a mes por posición: el primero del rango contra el primero del previo.
            previo = anteriores[indice] if indice < len(anteriores) else None
            fila["facturado_anterior"] = None if previo is None else numero(previo["facturado"])
            fila["cobrado_anterior"] = None if previo is None else numero(previo["cobrado"])
            fila["variacion_facturado"] = (
                None
                if previo is None
                else variacion_porcentual(mes["facturado"], previo["facturado"])
            )
            fila["variacion_cobrado"] = (
                None if previo is None else variacion_porcentual(mes["cobrado"], previo["cobrado"])
            )
        filas.append(fila)
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}"
    fuente = "Panel administrativo: facturas emitidas y pagos aprobados"
    columnas = [
        {"clave": "mes", "etiqueta": "Mes", "tipo": "texto"},
        {"clave": "facturado", "etiqueta": "Facturado", "tipo": "moneda"},
        {"clave": "cobrado", "etiqueta": "Cobrado", "tipo": "moneda"},
    ]
    if parametros.comparar_con_anterior:
        columnas += [
            {"clave": "facturado_anterior", "etiqueta": "Facturado anterior", "tipo": "moneda"},
            {"clave": "cobrado_anterior", "etiqueta": "Cobrado anterior", "tipo": "moneda"},
            {"clave": "variacion_facturado", "etiqueta": "Var. facturado", "tipo": "porcentaje"},
            {"clave": "variacion_cobrado", "etiqueta": "Var. cobrado", "tipo": "porcentaje"},
        ]
    tabla = bloque_tabla(
        "Facturado y cobrado por mes", columnas, filas, periodo=periodo, fuente=fuente
    )
    bloques: list[dict[str, Any]] = []
    agregar_tabla(bloques, tabla)
    para_llm: dict[str, object] = {"periodo": periodo, "fuente": fuente, "meses": filas}
    if desde_ant is not None and hasta_ant is not None:
        periodo_ant = f"{fecha_ar(desde_ant)} a {fecha_ar(hasta_ant)}"
        actual = {k: sum(m[k] for m in meses) for k in ("facturado", "cobrado")}
        previo = {k: sum(m[k] for m in anteriores) for k in ("facturado", "cobrado")}
        # El modelo no calcula: los totales y la variación vienen resueltos.
        para_llm["periodo_anterior"] = periodo_ant
        para_llm["totales"] = {
            k: {
                "actual": numero(actual[k]),
                "anterior": numero(previo[k]),
                "variacion_porcentual": variacion_porcentual(actual[k], previo[k]),
            }
            for k in actual
        }
        bloques = [
            bloque_kpi(
                f"{titulo} (total)",
                numero(actual[clave]),
                periodo=periodo,
                fuente=fuente,
                unidad="$",
                variacion=variacion_porcentual(actual[clave], previo[clave]),
                periodo_comparado=periodo_ant,
                mejora="alza",
                valor_anterior=numero(previo[clave]),
            )
            for clave, titulo in (("facturado", "Facturado"), ("cobrado", "Cobrado"))
        ] + bloques
    # Con pocos períodos el gráfico no suma: se ignora aunque el modelo lo pida.
    agregar_grafico(
        bloques, tabla, parametros.grafico, eje_x="mes", series=["facturado", "cobrado"]
    )
    return ResultadoHerramienta(para_llm=para_llm, bloques=bloques)


HERRAMIENTAS = [
    Herramienta(
        nombre="indicadores_generales",
        descripcion=(
            "Indicadores puntuales: alumnos activos, inasistencias del día, solicitudes de compra "
            "pendientes y tareas abiertas. Pedí solo los que la persona preguntó. No incluye "
            "deuda: para eso usá deuda_por_familias."
        ),
        parametros=ParametrosIndicadores,
        permisos=(PERMISO_PANEL_ADMIN_LEER,),
        ejecutar=_indicadores_generales,
        destino="panel",
    ),
    Herramienta(
        nombre="evolucion_financiera",
        descripcion=(
            "Facturado y cobrado mes a mes. Sin fechas, el año en curso; con desde y hasta, "
            "cualquier período pasado (hasta 24 meses)."
        ),
        parametros=ParametrosEvolucion,
        permisos=(PERMISO_PANEL_ADMIN_LEER, PERMISO_FACTURACION_LEER),
        ejecutar=_evolucion_financiera,
        destino="facturas",
        grafico_por_defecto="barras",
    ),
]
