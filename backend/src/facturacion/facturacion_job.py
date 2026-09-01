"""Job recuperable para ejecutar reglas automáticas de facturación."""

import asyncio
import calendar
import logging
from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import settings
from src.database import SessionLocal
from src.facturacion.models import ReglaFacturacion
from src.facturacion.reglas_facturacion_service import (
    generar_facturacion,
    periodo_completado_para_regla,
    registrar_ejecucion_fallida,
    regla_aplica_periodo,
)
from src.facturacion.schemas import EjecucionFacturacionRead

logger = logging.getLogger(__name__)


def _periodos_entre(desde: date, hasta: date) -> list[date]:
    periodo = date(desde.year, desde.month, 1)
    ultimo = date(hasta.year, hasta.month, 1)
    periodos: list[date] = []
    while periodo <= ultimo:
        periodos.append(periodo)
        periodo = (
            date(periodo.year + 1, 1, 1)
            if periodo.month == 12
            else date(periodo.year, periodo.month + 1, 1)
        )
    return periodos


def _fecha_programada(regla: ReglaFacturacion, periodo: date) -> date:
    ultimo_dia = calendar.monthrange(periodo.year, periodo.month)[1]
    return date(periodo.year, periodo.month, min(regla.dia_generacion or 1, ultimo_dia))


def periodos_pendientes_de_regla(
    db: Session, regla: ReglaFacturacion, fecha_actual: date
) -> list[date]:
    """Devuelve períodos vencidos de agenda que todavía no terminaron exitosamente."""

    if fecha_actual < regla.vigencia_desde:
        return []
    hasta = min(fecha_actual, regla.vigencia_hasta)
    pendientes: list[date] = []
    for periodo in _periodos_entre(regla.vigencia_desde, hasta):
        if not regla_aplica_periodo(regla, periodo):
            continue
        fecha_programada = max(_fecha_programada(regla, periodo), regla.vigencia_desde)
        if fecha_programada > fecha_actual:
            continue
        if not periodo_completado_para_regla(db, regla.id, periodo):
            pendientes.append(periodo)
    return pendientes


def ejecutar_facturacion_automatica(
    db: Session, fecha_actual: date | None = None
) -> list[EjecucionFacturacionRead]:
    """Ejecuta solo reglas automáticas pendientes, agrupadas por período."""

    hoy = fecha_actual or date.today()
    reglas = list(
        db.scalars(
            select(ReglaFacturacion).where(
                ReglaFacturacion.estado == "activa",
                ReglaFacturacion.modo_generacion == "automatica",
            )
        ).all()
    )
    por_periodo: dict[date, list[ReglaFacturacion]] = defaultdict(list)
    for regla in reglas:
        for periodo in periodos_pendientes_de_regla(db, regla, hoy):
            por_periodo[periodo].append(regla)

    ejecuciones: list[EjecucionFacturacionRead] = []
    for periodo, reglas_periodo in sorted(por_periodo.items()):
        try:
            ejecuciones.append(
                generar_facturacion(
                    db,
                    periodo,
                    usuario_id=None,
                    reglas=reglas_periodo,
                    origen="automatica",
                )
            )
        except Exception as error:
            logger.exception("Falló la facturación automática del período %s", periodo)
            ejecuciones.append(registrar_ejecucion_fallida(db, periodo, reglas_periodo, error))
    return ejecuciones


def _ejecutar_corrida_con_sesion() -> None:
    with SessionLocal() as db:
        ejecutar_facturacion_automatica(db)


async def ejecutar_job_facturacion_periodico() -> None:
    """Corre al iniciar el backend y luego con el intervalo operativo configurado."""

    while True:
        try:
            await asyncio.to_thread(_ejecutar_corrida_con_sesion)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("No se pudo completar la corrida del job de facturación")
        await asyncio.sleep(settings.FACTURACION_JOB_INTERVAL_SECONDS)
