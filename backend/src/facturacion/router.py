import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_FACTURACION_ACTUALIZAR,
    PERMISO_FACTURACION_CREAR,
    PERMISO_FACTURACION_ELIMINAR,
    PERMISO_FACTURACION_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.facturacion import service
from src.facturacion.dependencies import obtener_concepto_cobro_o_404
from src.facturacion.models import ConceptoCobro
from src.facturacion.schemas import (
    ConceptoCobroCreate,
    ConceptoCobroRead,
    ConceptoCobroUpdate,
    ResponsableEconomicoCreate,
    ResponsableEconomicoRead,
)
from src.familias_alumnos.dependencies import obtener_alumno_o_404
from src.familias_alumnos.models import Alumno

router = APIRouter(prefix="/facturacion", tags=["facturacion"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_LEER))]
PuedeActualizar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_ACTUALIZAR))]
PuedeEliminar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_ELIMINAR))]
ConceptoCobroActual = Annotated[ConceptoCobro, Depends(obtener_concepto_cobro_o_404)]
AlumnoActual = Annotated[Alumno, Depends(obtener_alumno_o_404)]


@router.post("/conceptos", status_code=201)
def crear_concepto_cobro(
    datos: ConceptoCobroCreate, db: DbSession, _: PuedeCrear
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(service.crear_concepto_cobro(db, datos))


@router.get("/conceptos")
def listar_conceptos_cobro(db: DbSession, _: PuedeLeer) -> list[ConceptoCobroRead]:
    return [
        ConceptoCobroRead.model_validate(concepto)
        for concepto in service.listar_conceptos_cobro(db)
    ]


@router.get("/conceptos/{concepto_id}")
def obtener_concepto_cobro(
    concepto_id: uuid.UUID, _: PuedeLeer, concepto: ConceptoCobroActual
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(concepto)


@router.put("/conceptos/{concepto_id}")
def actualizar_concepto_cobro(
    concepto_id: uuid.UUID,
    datos: ConceptoCobroUpdate,
    db: DbSession,
    _: PuedeActualizar,
    concepto: ConceptoCobroActual,
) -> ConceptoCobroRead:
    return ConceptoCobroRead.model_validate(service.actualizar_concepto_cobro(db, concepto, datos))


@router.delete("/conceptos/{concepto_id}", status_code=204)
def eliminar_concepto_cobro(
    concepto_id: uuid.UUID,
    db: DbSession,
    _: PuedeEliminar,
    concepto: ConceptoCobroActual,
) -> None:
    service.eliminar_concepto_cobro(db, concepto)


@router.post("/alumnos/{alumno_id}/responsable-economico", status_code=201)
def asignar_responsable_economico(
    datos: ResponsableEconomicoCreate,
    db: DbSession,
    _: PuedeActualizar,
    alumno: AlumnoActual,
) -> ResponsableEconomicoRead:
    responsable = service.asignar_responsable_economico(db, alumno.id, datos)
    return ResponsableEconomicoRead.model_validate(responsable)


@router.get("/alumnos/{alumno_id}/responsable-economico")
def obtener_responsable_economico_actual(
    db: DbSession, _: PuedeLeer, alumno: AlumnoActual
) -> ResponsableEconomicoRead:
    responsable = service.obtener_responsable_economico_actual(db, alumno.id)
    return ResponsableEconomicoRead.model_validate(responsable)


@router.get("/alumnos/{alumno_id}/responsable-economico/historial")
def listar_historial_responsables_economicos(
    db: DbSession, _: PuedeLeer, alumno: AlumnoActual
) -> list[ResponsableEconomicoRead]:
    return [
        ResponsableEconomicoRead.model_validate(responsable)
        for responsable in service.listar_historial_responsables_economicos(db, alumno.id)
    ]
