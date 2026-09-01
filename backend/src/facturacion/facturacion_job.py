"""Job recuperable para ejecutar reglas automáticas de facturación."""

import asyncio
import logging
from collections import defaultdict
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.config import settings
from src.database import SessionLocal
from src.facturacion.calendario_facturacion import (
    fecha_operativa_argentina,
    fecha_programada,
    periodos_entre,
    proxima_corrida_diaria_argentina,
)
from src.facturacion.models import ReglaFacturacion
from src.facturacion.reglas_facturacion_service import (
    generar_facturacion,
    periodo_completado_para_regla,
    registrar_ejecucion_fallida,
    regla_aplica_periodo,
)
from src.facturacion.schemas import EjecucionFacturacionRead

logger = logging.getLogger(__name__)


def periodos_pendientes_de_regla(
    db: Session, regla: ReglaFacturacion, fecha_actual: date
) -> list[date]:
    """Devuelve períodos vencidos de agenda que todavía no terminaron exitosamente."""

    if fecha_actual < regla.vigencia_desde:
        return []
    hasta = min(fecha_actual, regla.vigencia_hasta)
    pendientes: list[date] = []
    for periodo in periodos_entre(regla.vigencia_desde, hasta):
        if not regla_aplica_periodo(regla, periodo):
            continue
        fecha_de_agenda = max(fecha_programada(regla.dia_generacion, periodo), regla.vigencia_desde)
        if fecha_de_agenda > fecha_actual:
            continue
        if not periodo_completado_para_regla(db, regla.id, periodo):
            pendientes.append(periodo)
    return pendientes


def ejecutar_facturacion_automatica(
    db: Session, fecha_actual: date | None = None
) -> list[EjecucionFacturacionRead]:
    """Ejecuta solo reglas automáticas pendientes, agrupadas por período."""

    hoy = fecha_actual or fecha_operativa_argentina()
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
    """Recupera al iniciar y luego corre a una hora diaria fija de Argentina."""

    while True:
        try:
            await asyncio.to_thread(_ejecutar_corrida_con_sesion)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("No se pudo completar la corrida del job de facturación")
        ahora = datetime.now(UTC)
        proxima_corrida = proxima_corrida_diaria_argentina(
            settings.FACTURACION_HORA_EJECUCION, ahora
        )
        await asyncio.sleep((proxima_corrida - ahora).total_seconds())
