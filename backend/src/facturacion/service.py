"""Lógica de negocio propia de este módulo."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.facturacion.exceptions import ConceptoCobroDuplicado, ConceptoCobroEnUso
from src.facturacion.models import ConceptoCobro, DetalleFactura, Movimiento, ReglaPenalidad
from src.facturacion.schemas import ConceptoCobroCreate, ConceptoCobroUpdate


def _nombre_ya_existe(db: Session, nombre: str, concepto_id: uuid.UUID | None = None) -> bool:
    consulta = select(ConceptoCobro.id).where(func.lower(ConceptoCobro.nombre) == nombre.lower())
    if concepto_id is not None:
        consulta = consulta.where(ConceptoCobro.id != concepto_id)
    return db.scalar(consulta.limit(1)) is not None


def crear_concepto_cobro(db: Session, datos: ConceptoCobroCreate) -> ConceptoCobro:
    """Incorpora un concepto configurable al catálogo de Facturación."""

    if _nombre_ya_existe(db, datos.nombre):
        raise ConceptoCobroDuplicado()

    concepto = ConceptoCobro(**datos.model_dump())
    db.add(concepto)
    db.commit()
    db.refresh(concepto)
    return concepto


def listar_conceptos_cobro(db: Session) -> list[ConceptoCobro]:
    """Devuelve activos e inactivos para que Administración pueda reactivarlos."""

    return list(db.scalars(select(ConceptoCobro).order_by(ConceptoCobro.nombre)).all())


def obtener_concepto_cobro(db: Session, concepto_id: uuid.UUID) -> ConceptoCobro | None:
    return db.get(ConceptoCobro, concepto_id)


def actualizar_concepto_cobro(
    db: Session, concepto: ConceptoCobro, datos: ConceptoCobroUpdate
) -> ConceptoCobro:
    cambios = datos.model_dump(exclude_unset=True)
    nombre = cambios.get("nombre")
    if nombre is not None and _nombre_ya_existe(db, nombre, concepto.id):
        raise ConceptoCobroDuplicado()

    for campo, valor in cambios.items():
        setattr(concepto, campo, valor)
    db.commit()
    db.refresh(concepto)
    return concepto


def eliminar_concepto_cobro(db: Session, concepto: ConceptoCobro) -> None:
    """Borra solo conceptos sin uso; el historial debe conservar la referencia original."""

    referencias = (
        (DetalleFactura, DetalleFactura.concepto_cobro_id),
        (Movimiento, Movimiento.concepto_cobro_id),
        (ReglaPenalidad, ReglaPenalidad.concepto_cobro_id),
    )
    if any(
        db.scalar(select(modelo.id).where(columna == concepto.id).limit(1)) is not None
        for modelo, columna in referencias
    ):
        raise ConceptoCobroEnUso()

    db.delete(concepto)
    db.commit()
