"""Callbacks autenticados de n8n para el transporte durable de emails manuales.

No usan JWT de usuario: n8n presenta el token compartido `N8N_WEBHOOK_TOKEN`. Sin token
configurado el endpoint falla cerrado (503). El claim es idempotente y solo avanza el intento
activo; el resultado exige evidencia del proveedor para declarar `presentado`.
"""

import secrets
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.config import settings
from src.database import get_db
from src.workflows import manuales_service

router = APIRouter(prefix="/workflows", tags=["workflows"])

DbSession = Annotated[Session, Depends(get_db)]


class ReclamoRequest(BaseModel):
    intento_id: uuid.UUID


class ResultadoRequest(BaseModel):
    intento_id: uuid.UUID
    estado: Literal["presentado", "fallido", "incierto"]
    referencia_proveedor: str | None = Field(default=None, max_length=200)
    error_codigo: str | None = Field(default=None, max_length=50)


def exigir_token_n8n(authorization: Annotated[str | None, Header()] = None) -> None:
    esperado = settings.N8N_WEBHOOK_TOKEN
    if not esperado:
        raise HTTPException(503, "El callback de n8n no está configurado")
    if not authorization:
        raise HTTPException(401, "Falta el token de n8n")
    esquema, _, valor = authorization.partition(" ")
    if esquema.lower() != "bearer" or not valor:
        raise HTTPException(401, "Token de n8n inválido")
    if not secrets.compare_digest(valor.encode("utf-8"), esperado.encode("utf-8")):
        raise HTTPException(401, "Token de n8n inválido")


TokenN8n = Annotated[None, Depends(exigir_token_n8n)]


@router.post("/envios/{envio_id}/reclamar")
def reclamar_envio(envio_id: uuid.UUID, data: ReclamoRequest, db: DbSession, _: TokenN8n) -> dict:
    return manuales_service.reclamar_intento(db, envio_id, data.intento_id)


@router.post("/envios/{envio_id}/resultado")
def registrar_resultado_envio(
    envio_id: uuid.UUID, data: ResultadoRequest, db: DbSession, _: TokenN8n
) -> dict:
    if data.estado == "presentado" and not (data.referencia_proveedor or "").strip():
        raise HTTPException(422, "Un resultado presentado requiere referencia del proveedor")
    return manuales_service.registrar_resultado(
        db,
        envio_id,
        data.intento_id,
        estado=data.estado,
        referencia_proveedor=(data.referencia_proveedor or "").strip() or None,
        error_codigo=(data.error_codigo or "").strip() or None,
    )
