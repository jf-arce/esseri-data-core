"""Job periódico que despacha los eventos de negocio pendientes al motor de workflows."""

import asyncio
import logging

from src.config import settings
from src.database import SessionLocal
from src.workflows.despacho_service import (
    procesar_eventos_pendientes,
    procesar_recordatorios_vencidos,
)

logger = logging.getLogger(__name__)


def _despachar_con_sesion() -> None:
    with SessionLocal() as db:
        resumen = procesar_eventos_pendientes(db)
        resumen.recordatorios_ejecutados = procesar_recordatorios_vencidos(db)
    if resumen.eventos_procesados or resumen.eventos_fallidos or resumen.recordatorios_ejecutados:
        logger.info("Despacho de workflows: %s", resumen.model_dump())


async def ejecutar_job_despacho_periodico() -> None:
    """Revisa los eventos pendientes cada `WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS`."""

    while True:
        try:
            await asyncio.to_thread(_despachar_con_sesion)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            logger.error(
                "No se pudo completar la pasada del despachador de workflows (tipo=%s)",
                type(error).__name__,
            )
        await asyncio.sleep(settings.WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS)
