"""Job diario de recordatorios de facturas próximas a vencer.

Es independiente de `FACTURACION_AUTOMATICA_HABILITADA`: los recordatorios deben ejecutarse
aunque la generación automática de facturas esté deshabilitada. No usa n8n ni email.
"""

import asyncio
import logging
from datetime import UTC, datetime

from src.config import settings
from src.database import SessionLocal
from src.facturacion.calendario_facturacion import (
    fecha_operativa_argentina,
    proxima_corrida_diaria_argentina,
)
from src.notificaciones.facturacion_service import detectar_proximos_vencimientos

logger = logging.getLogger(__name__)


def _ejecutar_corrida() -> None:
    with SessionLocal() as db:
        try:
            detectar_proximos_vencimientos(db, fecha_operativa_argentina())
            db.commit()
        except Exception:
            db.rollback()
            raise


async def ejecutar_job_vencimientos_periodico() -> None:
    """Recupera al iniciar y luego corre a la hora diaria configurada de Argentina."""

    while True:
        try:
            await asyncio.to_thread(_ejecutar_corrida)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "Falló el job de recordatorios de vencimiento (tipo=%s)",
                type(error).__name__,
            )
        ahora = datetime.now(UTC)
        proxima_corrida = proxima_corrida_diaria_argentina(
            settings.FACTURACION_HORA_EJECUCION, ahora
        )
        await asyncio.sleep((proxima_corrida - ahora).total_seconds())
