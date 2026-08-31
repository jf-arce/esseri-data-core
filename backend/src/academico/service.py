"""Lógica de negocio del módulo Académico."""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.exceptions import (
    AnioConDivisiones,
    AnioDuplicado,
    DivisionConAsignaciones,
    DivisionDuplicada,
    NivelEducativoConAnios,
    NombreNivelDuplicado,
)
from src.academico.models import Anio, AsignacionDocente, Division, NivelEducativo
from src.academico.schemas import (
    AnioCreate,
    AnioUpdate,
    DivisionCreate,
    DivisionUpdate,
    NivelEducativoCreate,
    NivelEducativoUpdate,
)

# --- NivelEducativo ----------------------------------------------------------------------


def crear_nivel_educativo(
    db: Session, datos: NivelEducativoCreate, usuario_id: uuid.UUID | None = None
) -> NivelEducativo:
    """Crear un nuevo nivel educativo. Valida nombre único."""
    if (
        db.scalar(
            select(NivelEducativo.id).where(NivelEducativo.nombre == datos.nombre.strip())
        )
        is not None
    ):
        raise NombreNivelDuplicado()

    nuevo = NivelEducativo(nombre=datos.nombre.strip())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_nivel_educativo_por_id(db: Session, nivel_id: uuid.UUID) -> NivelEducativo | None:
    """Obtener un nivel educativo por su ID."""
    return db.query(NivelEducativo).filter(NivelEducativo.id == nivel_id).first()


def listar_niveles_educativos(db: Session) -> list[NivelEducativo]:
    """Listar todos los niveles educativos ordenados por nombre."""
    return db.query(NivelEducativo).order_by(NivelEducativo.nombre).all()


def actualizar_nivel_educativo(
    db: Session,
    nivel: NivelEducativo,
    datos: NivelEducativoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> NivelEducativo:
    """Actualizar un nivel educativo existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data and update_data["nombre"] != nivel.nombre:
        if (
            db.scalar(
                select(NivelEducativo.id).where(
                    NivelEducativo.nombre == update_data["nombre"].strip(),
                    NivelEducativo.id != nivel.id,
                )
            )
            is not None
        ):
            raise NombreNivelDuplicado()
        update_data["nombre"] = update_data["nombre"].strip()

    for field, value in update_data.items():
        setattr(nivel, field, value)

    db.commit()
    db.refresh(nivel)
    return nivel


def eliminar_nivel_educativo(
    db: Session, nivel: NivelEducativo, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un nivel educativo. Valida que no tenga años asociados."""
    tiene_anios = (
        db.query(Anio).filter(Anio.nivel_educativo_id == nivel.id).first() is not None
    )
    if tiene_anios:
        raise NivelEducativoConAnios()

    db.delete(nivel)
    db.commit()


# --- Anio --------------------------------------------------------------------------------


def crear_anio(
    db: Session, datos: AnioCreate, usuario_id: uuid.UUID | None = None
) -> Anio:
    """Crear un nuevo año. Valida que no exista el mismo número para el nivel."""
    if (
        db.scalar(
            select(Anio.id).where(
                Anio.numero == datos.numero,
                Anio.nivel_educativo_id == datos.nivel_educativo_id,
            )
        )
        is not None
    ):
        raise AnioDuplicado()

    nuevo = Anio(**datos.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_anio_por_id(db: Session, anio_id: uuid.UUID) -> Anio | None:
    """Obtener un año por su ID."""
    return db.query(Anio).filter(Anio.id == anio_id).first()


def listar_anios(db: Session) -> list[Anio]:
    """Listar todos los años ordenados por número."""
    return db.query(Anio).order_by(Anio.numero).all()


def listar_anios_por_nivel(db: Session, nivel_educativo_id: uuid.UUID) -> list[Anio]:
    """Listar los años de un nivel educativo específico."""
    return (
        db.query(Anio)
        .filter(Anio.nivel_educativo_id == nivel_educativo_id)
        .order_by(Anio.numero)
        .all()
    )


def actualizar_anio(
    db: Session,
    anio: Anio,
    datos: AnioUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Anio:
    """Actualizar un año existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "numero" in update_data or "nivel_educativo_id" in update_data:
        numero_check = update_data.get("numero", anio.numero)
        nivel_check = update_data.get("nivel_educativo_id", anio.nivel_educativo_id)
        if (
            db.scalar(
                select(Anio.id).where(
                    Anio.numero == numero_check,
                    Anio.nivel_educativo_id == nivel_check,
                    Anio.id != anio.id,
                )
            )
            is not None
        ):
            raise AnioDuplicado()

    for field, value in update_data.items():
        setattr(anio, field, value)

    db.commit()
    db.refresh(anio)
    return anio


def eliminar_anio(
    db: Session, anio: Anio, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un año. Valida que no tenga divisiones asociadas."""
    tiene_divisiones = (
        db.query(Division).filter(Division.anio_id == anio.id).first() is not None
    )
    if tiene_divisiones:
        raise AnioConDivisiones()

    db.delete(anio)
    db.commit()


# --- Division ----------------------------------------------------------------------------


def crear_division(
    db: Session, datos: DivisionCreate, usuario_id: uuid.UUID | None = None
) -> Division:
    """Crear una nueva división. Valida nombre único por año."""
    if (
        db.scalar(
            select(Division.id).where(
                Division.nombre == datos.nombre.strip(),
                Division.anio_id == datos.anio_id,
            )
        )
        is not None
    ):
        raise DivisionDuplicada()

    nuevo = Division(nombre=datos.nombre.strip(), anio_id=datos.anio_id)
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_division_por_id(db: Session, division_id: uuid.UUID) -> Division | None:
    """Obtener una división por su ID."""
    return db.query(Division).filter(Division.id == division_id).first()


def listar_divisiones(db: Session) -> list[Division]:
    """Listar todas las divisiones."""
    return db.query(Division).order_by(Division.nombre).all()


def listar_divisiones_por_anio(db: Session, anio_id: uuid.UUID) -> list[Division]:
    """Listar las divisiones de un año específico."""
    return (
        db.query(Division)
        .filter(Division.anio_id == anio_id)
        .order_by(Division.nombre)
        .all()
    )


def actualizar_division(
    db: Session,
    division: Division,
    datos: DivisionUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Division:
    """Actualizar una división existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data or "anio_id" in update_data:
        nombre_check = update_data.get("nombre", division.nombre)
        anio_check = update_data.get("anio_id", division.anio_id)
        if (
            db.scalar(
                select(Division.id).where(
                    Division.nombre == (
                        nombre_check.strip()
                        if isinstance(nombre_check, str)
                        else nombre_check
                    ),
                    Division.anio_id == anio_check,
                    Division.id != division.id,
                )
            )
            is not None
        ):
            raise DivisionDuplicada()
        if isinstance(nombre_check, str):
            update_data["nombre"] = nombre_check.strip()

    for field, value in update_data.items():
        setattr(division, field, value)

    db.commit()
    db.refresh(division)
    return division


def eliminar_division(
    db: Session, division: Division, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar una división. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente)
        .filter(AsignacionDocente.division_id == division.id)
        .first()
        is not None
    )
    if tiene_asignaciones:
        raise DivisionConAsignaciones()

    db.delete(division)
    db.commit()
