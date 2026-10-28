"""Contratos HTTP del módulo Panel Administrativo."""

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel


class IndicadoresDireccionRead(BaseModel):
    alumnos_activos: int
    deuda_pendiente_total: Decimal
    inasistencias_hoy: int
    solicitudes_compra_pendientes: int


class EvolucionFinancieraRead(BaseModel):
    mes: str
    facturado: Decimal
    cobrado: Decimal


class ActividadRecienteRead(BaseModel):
    """Un hecho ya ocurrido, listo para mostrarse sin reinterpretarlo en el cliente.

    `estado` es estable y se traduce a una etiqueta visual en el frontend; no es el estado
    actual de la entidad, sino el del hecho que se está informando.
    """

    id: str
    categoria: Literal["compras", "finanzas", "alumnos"]
    tipo: str
    titulo: str
    referencia: str | None
    detalle: str | None
    estado: str | None
    monto: Decimal | None
    ocurrido_en: datetime
