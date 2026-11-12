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
    navegar: dict[str, str] | None = None


@dataclass(frozen=True)
class Herramienta:
    nombre: str
    descripcion: str
    parametros: type[BaseModel]
    permisos: tuple[str, ...]
    ejecutar: Callable[[ContextoHerramienta, Any], ResultadoHerramienta]

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
