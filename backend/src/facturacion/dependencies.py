"""Dependencias HTTP propias de Facturación y Cobranza."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from src.database import get_db
from src.facturacion import facturas_service
from src.facturacion.exceptions import FacturaNoEncontrada
from src.facturacion.models import ConceptoCobro, Factura
from src.facturacion.service import obtener_concepto_cobro

DbSession = Annotated[Session, Depends(get_db)]


def obtener_concepto_cobro_o_404(concepto_id: uuid.UUID, db: DbSession) -> ConceptoCobro:
    concepto = obtener_concepto_cobro(db, concepto_id)
    if concepto is None:
        raise HTTPException(status_code=404, detail="El concepto de cobro indicado no existe.")
    return concepto


def obtener_factura_o_404(factura_id: uuid.UUID, db: DbSession) -> Factura:
    factura = facturas_service.obtener_factura(db, factura_id)
    if factura is None:
        raise FacturaNoEncontrada()
    return factura
