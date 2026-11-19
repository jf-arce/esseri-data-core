"""Avisos internos de Comunicaciones."""

import uuid

from sqlalchemy.orm import Session

from src.comunicaciones.models import Comunicacion
from src.notificaciones import service as notificaciones_service
from src.notificaciones.constants import (
    AMBITO_COMUNICACIONES,
    DESTINO_COMUNICACION,
    TIPO_COMUNICACION_PUBLICADA,
)
from src.notificaciones.destinatarios import cuentas_de_familia


def registrar_comunicacion_publicada(
    db: Session, comunicacion: Comunicacion, destinatarios: dict[uuid.UUID, list[str]]
) -> int:
    """Un aviso por cuenta destinataria de una comunicación institucional del portal.

    La lectura del aviso no toca `ReciboComunicacion.leida_at`; abrir la comunicación conserva
    su propio registro de lectura. El aviso solo apunta a la comunicación publicada.
    """
    if comunicacion.tipo != "institucional" or comunicacion.canal not in ("portal", "ambos"):
        return 0

    insertadas = 0
    for familia_id in destinatarios:
        for usuario_id in cuentas_de_familia(db, familia_id):
            insertadas += int(
                notificaciones_service.publicar(
                    db,
                    usuario_id=usuario_id,
                    familia_id=familia_id,
                    ambito=AMBITO_COMUNICACIONES,
                    clave_hecho=f"comunicaciones:publicada:{comunicacion.id}",
                    tipo=TIPO_COMUNICACION_PUBLICADA,
                    titulo="Nueva comunicación institucional",
                    mensaje=f"Hay una nueva comunicación institucional: {comunicacion.asunto}.",
                    contexto={
                        "familia_id": str(familia_id),
                        "comunicacion_id": str(comunicacion.id),
                        "asunto": comunicacion.asunto,
                    },
                    destino_tipo=DESTINO_COMUNICACION,
                    destino_id=comunicacion.id,
                )
            )
    return insertadas
