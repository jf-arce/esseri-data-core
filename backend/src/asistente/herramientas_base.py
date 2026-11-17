"""Piezas comunes de las herramientas del Asistente.

Cada herramienta declara su contrato: permisos acumulativos (todos, igual que su router), el
esquema de sus parámetros y la función que arma el resultado campo por campo. Nunca se serializa
un objeto de dominio completo: lo que va al modelo (agregados y alias) se separa de lo que va al
navegador (bloques tipados).
"""

import uuid
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.asistente.constants import (
    BLOQUE_GRAFICO,
    BLOQUE_KPI,
    BLOQUE_TABLA,
    BLOQUE_TARJETA,
    MIN_FILAS_TABLA,
    MIN_PUNTOS_GRAFICO,
)
from src.auth import autorizacion_service
from src.auth.models import Usuario


@dataclass(frozen=True)
class ContextoHerramienta:
    """Quién pregunta y desde dónde: usuario autenticado, rol activo y ciclo seleccionado."""

    db: Session
    usuario: Usuario
    rol_codigo: str
    conversacion_id: uuid.UUID
    ciclo_lectivo: str
    hoy: date
    max_filas: int

    def tiene_permiso(self, codigo: str) -> bool:
        return autorizacion_service.tiene_permiso_en_rol(
            self.db, self.usuario.id, self.rol_codigo, codigo
        )


@dataclass
class ResultadoHerramienta:
    """`para_llm` va al proveedor; `bloques` y `navegar` van solo al navegador."""

    para_llm: dict[str, Any]
    bloques: list[dict[str, Any]] = field(default_factory=list)
    navegar: dict[str, Any] | None = None
    # Pantalla relacionada con el resultado: se ofrece como botón al final de la respuesta.
    destino_sugerido: str | None = None
    # Filtros con los que se abre esa pantalla (ids de nivel, año y división, por ejemplo).
    filtros_destino: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class Herramienta:
    nombre: str
    descripcion: str
    parametros: type[BaseModel]
    permisos: tuple[str, ...]
    ejecutar: Callable[[ContextoHerramienta, Any], ResultadoHerramienta]
    # Clave de `DESTINOS` de la pantalla donde se ve este dato (`panel` según el rol).
    destino: str | None = None

    def disponible_para(self, contexto: ContextoHerramienta) -> bool:
        """Todos los permisos son necesarios, como en el router del dominio."""
        return all(contexto.tiene_permiso(permiso) for permiso in self.permisos)

    def definicion(self) -> dict[str, Any]:
        esquema = self.parametros.model_json_schema()
        esquema.pop("title", None)
        return {
            "type": "function",
            "function": {
                "name": self.nombre,
                "description": self.descripcion,
                "parameters": esquema,
            },
        }


class SinParametros(BaseModel):
    pass


def fecha_ar(dia: date) -> str:
    """DD/MM/AAAA, el formato con el que se muestran y se citan las fechas."""
    return dia.strftime("%d/%m/%Y")


def mes_ar(anio: int, mes: int) -> str:
    return f"{mes:02d}/{anio}"


def mes_iso_ar(anio_mes: str) -> str:
    """Pasa un mes `AAAA-MM` a `MM/AAAA`; si no tiene esa forma, lo deja como vino."""
    anio, _, mes = anio_mes.partition("-")
    return f"{mes}/{anio}" if anio.isdigit() and mes.isdigit() else anio_mes


def numero(valor: Decimal | int | float) -> float | int:
    """Los importes salen como números JSON; el formato con separadores lo pone el cliente."""
    if isinstance(valor, Decimal):
        return float(valor) if valor != valor.to_integral_value() else int(valor)
    return valor


def porcentaje(parte: int, total: int) -> float | None:
    """`None` es "sin registros": no es lo mismo que 0 %."""
    if total == 0:
        return None
    return round(parte / total * 100, 1)


def variacion_porcentual(
    actual: Decimal | int | float, anterior: Decimal | int | float
) -> float | None:
    """Cambio porcentual contra el período anterior; `None` si no hay base para comparar."""
    if anterior <= 0:
        return None
    return round(float((actual - anterior) / anterior * 100), 1)


def bloque_kpi(
    titulo: str,
    valor: int | float | str | None,
    *,
    periodo: str,
    fuente: str,
    unidad: str = "",
    variacion: float | None = None,
    periodo_comparado: str | None = None,
    mejora: Literal["alza", "baja"] | None = None,
    valor_anterior: int | float | None = None,
) -> dict[str, Any]:
    """Con `periodo_comparado` trae su variación; `variacion` en `None` es "sin base".

    `mejora` dice hacia dónde es mejor la cifra (más facturado es bueno, más ausentes no), para
    que el cliente coloree la variación; sin él la variación se muestra sin juicio.
    `valor_anterior` es la cifra del período comparado: sirve para mostrarla cuando la variación
    no se puede calcular (contra 0). Si ese período no tiene registros, va `None`: sin base.
    """
    bloque: dict[str, Any] = {
        "tipo": BLOQUE_KPI,
        "titulo": titulo,
        "valor": valor,
        "unidad": unidad,
        "periodo": periodo,
        "fuente": fuente,
    }
    if periodo_comparado is not None:
        bloque["variacion"] = variacion
        bloque["periodo_comparado"] = periodo_comparado
        if mejora is not None:
            bloque["mejora"] = mejora
        if valor_anterior is not None:
            bloque["valor_anterior"] = valor_anterior
    return bloque


def bloque_tabla(
    titulo: str,
    columnas: list[dict[str, str]],
    filas: list[dict[str, Any]],
    *,
    periodo: str,
    fuente: str,
) -> dict[str, Any]:
    """`tabla_id` identifica la tabla para los cálculos y gráficos de la Fase 2."""
    return {
        "tipo": BLOQUE_TABLA,
        "tabla_id": str(uuid.uuid4()),
        "titulo": titulo,
        "columnas": columnas,
        "filas": filas,
        "periodo": periodo,
        "fuente": fuente,
    }


def agregar_tabla(bloques: list[dict[str, Any]], tabla: dict[str, Any]) -> bool:
    """Suma la tabla solo si tiene al menos dos filas: con una (o ninguna) la cifra va en el texto.

    Devuelve si la tabla quedó: el gráfico que la referencia solo tiene sentido si está.
    """
    if len(tabla["filas"]) < MIN_FILAS_TABLA:
        return False
    bloques.append(tabla)
    return True


def bloque_grafico(
    tabla: dict[str, Any],
    *,
    forma: str,
    eje_x: str,
    series: list[str],
) -> dict[str, Any]:
    """Gráfico de una tabla ya emitida: referencia `tabla_id` y no repite las filas."""
    return {
        "tipo": BLOQUE_GRAFICO,
        "tabla_id": tabla["tabla_id"],
        "titulo": tabla["titulo"],
        "forma": forma,
        "eje_x": eje_x,
        "series": series,
        "periodo": tabla["periodo"],
        "fuente": tabla["fuente"],
    }


FormaGrafico = Literal["barras", "lineas", "areas"]


def agregar_grafico(
    bloques: list[dict[str, Any]],
    tabla: dict[str, Any],
    forma: FormaGrafico | None,
    *,
    eje_x: str,
    series: list[str],
) -> None:
    """Suma el gráfico de la tabla si lo pidieron y hay períodos suficientes para que aporte."""
    if forma is not None and len(tabla["filas"]) >= MIN_PUNTOS_GRAFICO and tabla in bloques:
        bloques.append(bloque_grafico(tabla, forma=forma, eje_x=eje_x, series=series))


def bloque_tarjeta(entidad: str, alias: str) -> dict[str, Any]:
    return {"tipo": BLOQUE_TARJETA, "entidad": entidad, "alias": alias}
