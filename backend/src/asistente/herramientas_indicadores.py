"""Indicadores del panel y evolución financiera."""

from datetime import date

from pydantic import BaseModel

from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    SinParametros,
    bloque_kpi,
    bloque_tabla,
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


def _indicadores_generales(contexto: ContextoHerramienta, _: BaseModel) -> ResultadoHerramienta:
    # No se expone `deuda_pendiente_total`: es una cifra provisoria del panel. La deuda sale de
    # la cuenta corriente (`deuda_por_familias`).
    base = obtener_indicadores_direccion(contexto.db, fecha_hoy=contexto.hoy)
    hoy = contexto.hoy.isoformat()
    datos: dict[str, object] = {
        "fecha": hoy,
        "alumnos_activos": base["alumnos_activos"],
        "inasistencias_del_dia": base["inasistencias_hoy"],
    }
    bloques = [
        bloque_kpi(
            "Alumnos activos", base["alumnos_activos"], periodo=f"al {hoy}", fuente=_FUENTE_PANEL
        ),
        bloque_kpi(
            "Inasistencias del día",
            base["inasistencias_hoy"],
            periodo=hoy,
            fuente=_FUENTE_PANEL,
        ),
    ]
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
        datos["secciones_sin_permiso"] = ["solicitudes_compra"]
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
    return ResultadoHerramienta(para_llm=datos, bloques=bloques)


def _evolucion_financiera(contexto: ContextoHerramienta, _: BaseModel) -> ResultadoHerramienta:
    meses = obtener_evolucion_financiera(contexto.db, fecha_hoy=contexto.hoy)
    filas = [
        {
            "mes": mes["mes"],
            "facturado": numero(mes["facturado"]),
            "cobrado": numero(mes["cobrado"]),
        }
        for mes in meses
    ]
    periodo = f"{date(contexto.hoy.year, 1, 1).isoformat()} a {contexto.hoy.isoformat()}"
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
            "Alumnos activos, inasistencias del día, solicitudes de compra pendientes y tareas "
            "abiertas. No incluye deuda: para eso usá deuda_por_familias."
        ),
        parametros=SinParametros,
        permisos=(PERMISO_PANEL_ADMIN_LEER,),
        ejecutar=_indicadores_generales,
    ),
    Herramienta(
        nombre="evolucion_financiera",
        descripcion="Facturado y cobrado mes a mes en el año en curso.",
        parametros=SinParametros,
        permisos=(PERMISO_PANEL_ADMIN_LEER, PERMISO_FACTURACION_LEER),
        ejecutar=_evolucion_financiera,
    ),
]
