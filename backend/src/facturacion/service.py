"""Lógica de negocio propia de este módulo."""

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from src.facturacion.exceptions import (
    ConceptoCobroDuplicado,
    ConceptoCobroEnUso,
    FamiliaNoVinculadaAlAlumno,
    ResponsableEconomicoNoEncontrado,
    ResponsableEconomicoSinCambios,
)
from src.facturacion.models import (
    ConceptoCobro,
    DetalleFactura,
    Movimiento,
    ReglaPenalidad,
    ResponsableEconomico,
)
from src.facturacion.schemas import (
    ConceptoCobroCreate,
    ConceptoCobroUpdate,
    ResponsableEconomicoCreate,
)
from src.familias_alumnos.models import FamiliaAlumno


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


def _primer_dia_del_mes_siguiente(fecha: date) -> date:
    if fecha.month == 12:
        return date(fecha.year + 1, 1, 1)
    return date(fecha.year, fecha.month + 1, 1)


def calcular_vigencia_desde(fecha_solicitud: date) -> date:
    """Aplica el cambio al período siguiente solo si fue informado antes del día 10."""

    periodo_siguiente = _primer_dia_del_mes_siguiente(fecha_solicitud)
    if fecha_solicitud.day < 10:
        return periodo_siguiente
    return _primer_dia_del_mes_siguiente(periodo_siguiente)


def _obtener_responsable_abierto(
    db: Session, alumno_id: uuid.UUID
) -> ResponsableEconomico | None:
    return db.scalar(
        select(ResponsableEconomico)
        .where(
            ResponsableEconomico.alumno_id == alumno_id,
            ResponsableEconomico.vigencia_hasta.is_(None),
        )
        .order_by(ResponsableEconomico.vigencia_desde.desc())
    )


def asignar_responsable_economico(
    db: Session, alumno_id: uuid.UUID, datos: ResponsableEconomicoCreate
) -> ResponsableEconomico:
    """Cierra la vigencia previa y conserva el historial al cambiar el responsable."""

    vinculo_existe = db.scalar(
        select(FamiliaAlumno.id).where(
            FamiliaAlumno.alumno_id == alumno_id,
            FamiliaAlumno.familia_id == datos.familia_id,
        )
    )
    if vinculo_existe is None:
        raise FamiliaNoVinculadaAlAlumno()

    vigencia_desde = calcular_vigencia_desde(datos.fecha_solicitud_cambio)
    responsable_abierto = _obtener_responsable_abierto(db, alumno_id)
    if responsable_abierto is not None:
        if responsable_abierto.familia_id == datos.familia_id:
            raise ResponsableEconomicoSinCambios()
        if vigencia_desde <= responsable_abierto.vigencia_desde:
            raise ResponsableEconomicoSinCambios(
                "Ya existe un cambio de responsable económico programado para ese período."
            )
        responsable_abierto.vigencia_hasta = date.fromordinal(vigencia_desde.toordinal() - 1)

    responsable = ResponsableEconomico(
        alumno_id=alumno_id,
        familia_id=datos.familia_id,
        vigencia_desde=vigencia_desde,
        fecha_solicitud_cambio=datos.fecha_solicitud_cambio,
    )
    db.add(responsable)
    db.commit()
    db.refresh(responsable)
    return responsable


def obtener_responsable_economico_actual(
    db: Session, alumno_id: uuid.UUID
) -> ResponsableEconomico:
    responsable = _obtener_responsable_abierto(db, alumno_id)
    if responsable is None:
        raise ResponsableEconomicoNoEncontrado()
    return responsable


def listar_historial_responsables_economicos(
    db: Session, alumno_id: uuid.UUID
) -> list[ResponsableEconomico]:
    return list(
        db.scalars(
            select(ResponsableEconomico)
            .where(ResponsableEconomico.alumno_id == alumno_id)
            .order_by(ResponsableEconomico.vigencia_desde.desc())
        ).all()
    )
