"""Deuda por familia, desde la fuente contable."""

import calendar
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

from src.asistente.constants import TIPO_ALIAS_FAMILIA
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    bloque_kpi,
    bloque_tabla,
    fecha_ar,
    numero,
    variacion_porcentual,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias
from src.auth.constants import PERMISO_FACTURACION_LEER
from src.facturacion.cuenta_corriente_service import listar_deuda_por_familia

_FUENTE = "Cuenta corriente (movimientos contables)"
_MAX_FAMILIAS_PARA_TOTAL = 2000


class ParametrosDeudaPorFamilias(BaseModel):
    limite: int = Field(
        default=10, ge=1, le=100, description="Cuántas familias devolver, las de mayor deuda."
    )
    estado: Literal["vencida", "pendiente", "pagada"] | None = Field(
        default=None, description="Filtra por estado de la deuda de la familia."
    )
    al: date | None = Field(
        default=None,
        description="Deuda al cierre de este día, AAAA-MM-DD. Si falta, la deuda de hoy.",
    )
    comparar_al: date | None = Field(
        default=None,
        description="Compara el total vencido con el de esta fecha pasada, AAAA-MM-DD.",
    )
    comparar_con_anterior: bool = Field(
        default=False,
        description="Compara el total vencido con el de un mes antes del corte.",
    )


def _un_mes_antes(dia: date) -> date:
    anio, mes = (dia.year - 1, 12) if dia.month == 1 else (dia.year, dia.month - 1)
    return date(anio, mes, min(dia.day, calendar.monthrange(anio, mes)[1]))


def _total_vencido(
    contexto: ContextoHerramienta, corte: date, al: date | None
) -> tuple[int, float]:
    """Cantidad de familias con deuda vencida y el total vencido de todas ellas."""
    _, cantidad = listar_deuda_por_familia(
        contexto.db, fecha_referencia=corte, pagina=1, tamanio=1, estado="vencida", al=al
    )
    vencidas, _ = listar_deuda_por_familia(
        contexto.db,
        fecha_referencia=corte,
        pagina=1,
        tamanio=max(1, min(cantidad, _MAX_FAMILIAS_PARA_TOTAL)),
        estado="vencida",
        al=al,
    )
    return cantidad, sum(item["monto_vencido"] for item in vencidas)


def _deuda_por_familias(
    contexto: ContextoHerramienta, parametros: ParametrosDeudaPorFamilias
) -> ResultadoHerramienta:
    limite = min(parametros.limite, contexto.max_filas)
    corte = parametros.al or contexto.hoy
    if corte > contexto.hoy:
        return ResultadoHerramienta(para_llm={"error": "La fecha de corte no puede ser futura."})
    comparar_al = parametros.comparar_al
    if comparar_al is None and parametros.comparar_con_anterior:
        comparar_al = _un_mes_antes(corte)
    if comparar_al is not None and comparar_al >= corte:
        return ResultadoHerramienta(
            para_llm={"error": "La fecha a comparar debe ser anterior a la de corte."}
        )
    # Con una fecha pasada, la deuda se reconstruye con lo registrado hasta ese día.
    al = parametros.al
    items, total = listar_deuda_por_familia(
        contexto.db,
        fecha_referencia=corte,
        pagina=1,
        tamanio=limite,
        estado=parametros.estado,
        al=al,
    )
    # Orden de la fuente: primero el monto vencido y después la deuda total.
    filas = [
        {
            "familia": obtener_o_crear_alias(
                contexto.db, contexto.conversacion_id, TIPO_ALIAS_FAMILIA, item["familia_id"]
            ),
            "monto_vencido": numero(item["monto_vencido"]),
            "monto_pendiente": numero(item["monto_pendiente"]),
            "deuda_total": numero(item["deuda_total"]),
            "facturas_pendientes": int(item["facturas_pendientes"]),
        }
        for item in items
    ]
    # Cantidad real de familias por estado de deuda y total vencido de todas: la tabla (las de
    # mayor deuda) no los da y son las cifras que suelen pedirse.
    con_deuda_vencida, vencido = _total_vencido(contexto, corte, al)
    total_vencido = numero(vencido)
    periodo = f"al {fecha_ar(corte)}"
    tabla = bloque_tabla(
        "Deuda por familia",
        [
            {"clave": "familia", "etiqueta": "Familia", "tipo": "alias"},
            {"clave": "monto_vencido", "etiqueta": "Vencido", "tipo": "moneda"},
            {"clave": "monto_pendiente", "etiqueta": "Por vencer", "tipo": "moneda"},
            {"clave": "deuda_total", "etiqueta": "Deuda total", "tipo": "moneda"},
            {"clave": "facturas_pendientes", "etiqueta": "Facturas pendientes", "tipo": "numero"},
        ],
        filas,
        periodo=periodo,
        fuente=_FUENTE,
    )
    para_comparacion: dict[str, object] = {}
    bloques = [tabla]
    if comparar_al is not None:
        previa = comparar_al
        _, vencido_previo = _total_vencido(contexto, previa, previa)
        variacion = variacion_porcentual(vencido, vencido_previo)
        periodo_previo = f"al {fecha_ar(previa)}"
        para_comparacion = {
            "total_vencido_comparado": numero(vencido_previo),
            "periodo_comparado": periodo_previo,
            "variacion_porcentual": variacion,
        }
        bloques.insert(
            0,
            bloque_kpi(
                "Deuda vencida total",
                total_vencido,
                periodo=periodo,
                fuente=_FUENTE,
                unidad="$",
                variacion=variacion,
                periodo_comparado=periodo_previo,
                mejora="baja",
                valor_anterior=numero(vencido_previo),
            ),
        )
    return ResultadoHerramienta(
        para_llm={
            **para_comparacion,
            "periodo": periodo,
            "fuente": _FUENTE,
            "alcance": "deuda acumulada al corte; no se puede filtrar por mes de la cuota",
            "familias_con_deuda_vencida": con_deuda_vencida,
            "total_vencido_todas_las_familias": total_vencido,
            "familias_con_el_filtro": total,
            "familias_devueltas": len(filas),
            "familias": filas,
        },
        bloques=bloques,
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="deuda_por_familias",
        descripcion=(
            "Familias con mayor deuda (vencida y total) según la cuenta corriente, hoy o al "
            "cierre de cualquier día pasado (parámetro al), con variación contra otra fecha "
            "(comparar_al). Cada familia viene como alias, sin nombre ni DNI."
        ),
        parametros=ParametrosDeudaPorFamilias,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_deuda_por_familias,
        destino="deuda_por_familia",
    )
]
