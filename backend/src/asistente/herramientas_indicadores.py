"""Indicadores del panel y evolución financiera."""

from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    bloque_kpi,
    bloque_tabla,
    fecha_ar,
    mes_iso_ar,
    numero,
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
    filas = [
        {
            "mes": mes_iso_ar(mes["mes"]),
            "facturado": numero(mes["facturado"]),
            "cobrado": numero(mes["cobrado"]),
        }
        for mes in meses
    ]
    periodo = f"{fecha_ar(desde)} a {fecha_ar(hasta)}"
    fuente = "Panel administrativo: facturas emitidas y pagos aprobados"
    tabla = bloque_tabla(
        "Facturado y cobrado por mes",
        [
            {"clave": "mes", "etiqueta": "Mes", "tipo": "texto"},
            {"clave": "facturado", "etiqueta": "Facturado", "tipo": "moneda"},
            {"clave": "cobrado", "etiqueta": "Cobrado", "tipo": "moneda"},
        ],
        filas,
        periodo=periodo,
        fuente=fuente,
    )
    return ResultadoHerramienta(
        para_llm={"periodo": periodo, "fuente": fuente, "meses": filas}, bloques=[tabla]
    )


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
    ),
]
