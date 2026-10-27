"""Dependencias HTTP propias de Facturación y Cobranza."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from src.auth.exceptions import PermisoDenegado
from src.database import get_db
from src.facturacion import facturas_service
from src.facturacion.exceptions import FacturaNoEncontrada
from src.facturacion.models import ConceptoCobro, Factura, Pago
from src.facturacion.service import obtener_concepto_cobro
from src.familias_alumnos.dependencies import FamiliaActiva
from src.familias_alumnos.service import familia_tiene_alumno

DbSession = Annotated[Session, Depends(get_db)]


def obtener_concepto_cobro_o_404(concepto_id: uuid.UUID, db: DbSession) -> ConceptoCobro:
    concepto = obtener_concepto_cobro(db, concepto_id)
    if concepto is None:
        raise HTTPException(status_code=404, detail="El concepto de cobro indicado no existe.")
    return concepto


def obtener_factura_o_404(
    factura_id: uuid.UUID,
    familia_activa: FamiliaActiva,
    db: DbSession,
) -> Factura:
    """Factura por ID, con 403 si el rol familia no está vinculado a su alumno."""
    factura = facturas_service.obtener_factura(db, factura_id)
    if factura is None:
        raise FacturaNoEncontrada()
    if familia_activa is not None:
        alumno = facturas_service.obtener_alumno_factura(db, factura)
        if alumno is None or not familia_tiene_alumno(db, familia_activa.id, alumno.id):
            raise PermisoDenegado("No tenés acceso a esta factura")
    return factura


def obtener_pago_o_404(pago_id: uuid.UUID, db: DbSession) -> Pago:
    pago = facturas_service.obtener_pago(db, pago_id)
    if pago is None:
        raise HTTPException(status_code=404, detail="El pago indicado no existe.")
    return pago


def obtener_pago_accesible_o_404(
    pago: Annotated[Pago, Depends(obtener_pago_o_404)],
    familia_activa: FamiliaActiva,
    db: DbSession,
) -> Pago:
    """Pago por ID, con 403 si el rol familia no está vinculado al alumno de la factura."""
    if familia_activa is not None:
        factura = facturas_service.obtener_factura(db, pago.factura_id)
        alumno = facturas_service.obtener_alumno_factura(db, factura) if factura else None
        if alumno is None or not familia_tiene_alumno(db, familia_activa.id, alumno.id):
            raise PermisoDenegado("No tenés acceso a este comprobante")
    return pago
