"""Deuda por familia, desde la fuente contable."""

from typing import Literal

from pydantic import BaseModel, Field

from src.asistente.constants import TIPO_ALIAS_FAMILIA
from src.asistente.herramientas_base import (
    ContextoHerramienta,
    Herramienta,
    ResultadoHerramienta,
    bloque_tabla,
    numero,
)
from src.asistente.seudonimos_service import obtener_o_crear_alias
from src.auth.constants import PERMISO_FACTURACION_LEER
from src.facturacion.cuenta_corriente_service import listar_deuda_por_familia

_FUENTE = "Cuenta corriente (movimientos contables)"


class ParametrosDeudaPorFamilias(BaseModel):
    limite: int = Field(
        default=10, ge=1, le=100, description="Cuántas familias devolver, las de mayor deuda."
    )
    estado: Literal["vencida", "pendiente", "pagada"] | None = Field(
        default=None, description="Filtra por estado de la deuda de la familia."
    )


def _deuda_por_familias(
    contexto: ContextoHerramienta, parametros: ParametrosDeudaPorFamilias
) -> ResultadoHerramienta:
    limite = min(parametros.limite, contexto.max_filas)
    items, total = listar_deuda_por_familia(
        contexto.db,
        fecha_referencia=contexto.hoy,
        pagina=1,
        tamanio=limite,
        estado=parametros.estado,
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
            "estado": item["estado"],
        }
        for item in items
    ]
    periodo = f"al {contexto.hoy.isoformat()}"
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
    return ResultadoHerramienta(
        para_llm={
            "periodo": periodo,
            "fuente": _FUENTE,
            "orden": "monto vencido y, a igualdad, deuda total, de mayor a menor",
            "familias_con_el_filtro": total,
            "familias_devueltas": len(filas),
            "familias": filas,
            "suma_vencido_de_las_devueltas": numero(sum(fila["monto_vencido"] for fila in filas)),
            "suma_deuda_total_de_las_devueltas": numero(sum(fila["deuda_total"] for fila in filas)),
        },
        bloques=[tabla],
    )


HERRAMIENTAS = [
    Herramienta(
        nombre="deuda_por_familias",
        descripcion=(
            "Familias con mayor deuda (vencida y total) según la cuenta corriente. Cada familia "
            "viene como alias, sin nombre ni DNI."
        ),
        parametros=ParametrosDeudaPorFamilias,
        permisos=(PERMISO_FACTURACION_LEER,),
        ejecutar=_deuda_por_familias,
    )
]
