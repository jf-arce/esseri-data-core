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
from typing import Any

from pydantic import BaseModel
from sqlalchemy.orm import Session

from src.asistente.constants import BLOQUE_KPI, BLOQUE_TABLA, BLOQUE_TARJETA
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


def bloque_kpi(
    titulo: str, valor: int | float | str | None, *, periodo: str, fuente: str, unidad: str = ""
) -> dict[str, Any]:
    return {
        "tipo": BLOQUE_KPI,
        "titulo": titulo,
        "valor": valor,
        "unidad": unidad,
        "periodo": periodo,
        "fuente": fuente,
    }


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


def bloque_tarjeta(entidad: str, alias: str) -> dict[str, Any]:
    return {"tipo": BLOQUE_TARJETA, "entidad": entidad, "alias": alias}
