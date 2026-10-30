"""Reapunta el caso de etapa 3 a un único intento pendiente para un envío real. No envía.

Asume que las cuentas sintéticas ya están sembradas en la base aislada. Hace, en orden:

1. Fija el email del usuario de familia sintética al destinatario autorizado.
2. Reinicia las filas de etapa 3 (adjuntos, notificaciones, intenciones, recibos y
   comunicaciones) para partir de cero.
3. Publica una comunicación institucional con `canal=email` dirigida solo a esa familia,
   dejando exactamente una intención `envio_notificacion` en `pendiente`.

El destinatario llega por `STAGE3_RECIPIENT_EMAIL` y **nunca se imprime**: la salida solo
informa si la intención almacenada coincide con él. El despacho real se dispara por
separado, nunca desde este script.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "backend"))

from sqlalchemy import delete, select
from sqlalchemy.engine import make_url

from src.auth.models import Usuario
from src.comunicaciones import service
from src.comunicaciones.models import (
    Comunicacion,
    ComunicacionAdjunto,
    ComunicacionAdjuntoContenido,
    ReciboComunicacion,
)
from src.comunicaciones.schemas import Audiencia, BorradorInput
from src.config import settings
from src.database import SessionLocal
from src.familias_alumnos.models import Familia
from src.models import Persona
from src.workflows.models import EnvioNotificacion, Notificacion

FAMILIA_DNI = "99000003"
ADMIN_EMAIL = "stage3.admin@esseri.test"
DB_NAME = "esseri_stage3_local"


def _abort(mensaje: str) -> None:
    print(f"preparar_envio_manual: {mensaje}", file=sys.stderr)
    raise SystemExit(1)


def validar_destino() -> None:
    """Rechaza cualquier base que no sea la sintética aislada de etapa 3."""
    if settings.ENVIRONMENT.strip().lower() in {"production", "prod"}:
        _abort("bloqueado en producción")
    url = make_url(settings.DATABASE_URL)
    if url.database != DB_NAME:
        _abort(f"destino incorrecto: se esperaba {DB_NAME!r}, no {url.database!r}")


def main() -> None:
    validar_destino()

    recipiente = os.environ.get("STAGE3_RECIPIENT_EMAIL", "").strip()
    if not recipiente or "@" not in recipiente:
        _abort("STAGE3_RECIPIENT_EMAIL es requerida y debe ser una dirección de correo")

    db = SessionLocal()
    try:
        persona = db.scalar(select(Persona).where(Persona.dni == FAMILIA_DNI).limit(1))
        if persona is None:
            _abort("no se encontró la persona de familia sintética")
        familia = db.scalar(select(Familia).where(Familia.persona_id == persona.id).limit(1))
        if familia is None:
            _abort("no se encontró la familia vinculada")
        familia_usuario = db.scalar(
            select(Usuario).where(Usuario.persona_id == persona.id).limit(1)
        )
        if familia_usuario is None:
            _abort("no se encontró la cuenta de la familia")
        autor = db.scalar(select(Usuario).where(Usuario.email == ADMIN_EMAIL).limit(1))
        if autor is None:
            _abort("no se encontró la cuenta administradora")

        familia_usuario.email = recipiente
        db.flush()

        # Reinicio de etapa 3 en orden seguro de dependencias.
        db.execute(delete(ComunicacionAdjuntoContenido))
        db.execute(delete(ComunicacionAdjunto))
        db.execute(delete(Notificacion))
        db.execute(delete(EnvioNotificacion))
        db.execute(delete(ReciboComunicacion))
        db.execute(delete(Comunicacion))
        db.commit()

        borrador = service.crear(
            db,
            BorradorInput(
                clave=uuid.uuid4(),
                asunto="Prueba de envío manual — Etapa 3",
                cuerpo="Correo de prueba de integración de Comunicaciones Etapa 3.",
                audiencia=Audiencia(tipo="responsables", ids=[familia.id]),
                canal="email",
            ),
            autor,
            tipo="institucional",
        )
        publicada = service.publicar(db, borrador.id, autor, tipo="institucional")

        envios = list(
            db.scalars(
                select(EnvioNotificacion).where(
                    EnvioNotificacion.comunicacion_id == publicada.id
                )
            )
        )
        envio = envios[0] if envios else None

        print(
            {
                "comunicacion_id": str(publicada.id),
                "envio_id": str(envio.id) if envio else None,
                "intenciones": len(envios),
                "estado": envio.estado if envio else None,
                "intentos": envio.intentos if envio else None,
                "recipiente_coincide": bool(envio and envio.email == recipiente),
            }
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
