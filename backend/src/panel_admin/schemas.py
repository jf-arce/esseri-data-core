"""Contratos HTTP del módulo Panel Administrativo."""

from decimal import Decimal

from pydantic import BaseModel


class IndicadoresDireccionRead(BaseModel):
    alumnos_activos: int
    deuda_pendiente_total: Decimal
    inasistencias_hoy: int
    solicitudes_compra_pendientes: int
