"""Job periódico que borra las conversaciones del Asistente que superaron la retención."""

import asyncio
import logging

from src.asistente.service import borrar_conversaciones_vencidas
from src.config import settings
from src.database import SessionLocal

logger = logging.getLogger(__name__)


def _borrar_con_sesion() -> None:
    with SessionLocal() as db:
        borradas = borrar_conversaciones_vencidas(db)
    if borradas:
        logger.info("Retención del asistente: %s conversaciones borradas", borradas)


async def ejecutar_job_retencion_periodico() -> None:
    """Corre al arrancar y después cada `ASISTENTE_RETENCION_INTERVALO_HORAS` horas."""

    while True:
        try:
            await asyncio.to_thread(_borrar_con_sesion)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "No se pudo completar la retención del asistente (tipo=%s)", type(error).__name__
            )
        await asyncio.sleep(settings.ASISTENTE_RETENCION_INTERVALO_HORAS * 3600)
