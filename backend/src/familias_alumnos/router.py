"""Endpoints HTTP del módulo Familias y Alumnos."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.database import get_db
from src.familias_alumnos.dependencies import obtener_familia_o_404
from src.familias_alumnos.models import Familia
from src.familias_alumnos.schemas import FamiliaCreate, FamiliaResponse, FamiliaUpdate
from src.familias_alumnos.service import (
    actualizar_familia,
    crear_familia,
    eliminar_familia,
)

router = APIRouter(prefix="/familias-alumnos", tags=["familias_alumnos"])


@router.post("/familias", response_model=FamiliaResponse, status_code=201)
def crear_familia_endpoint(
    familia_data: FamiliaCreate,
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Crear una nueva Familia.

    Args:
        familia_data: Datos de la familia a crear
        db: Sesión de base de datos

    Returns:
        La familia creada

    TODO: Integración con Auth - obtener usuario_id del token JWT
    """
    # TODO: Obtener usuario_id del contexto de autenticación cuando auth esté implementado
    usuario_id = None

    return crear_familia(db, familia_data, usuario_id)


@router.get("/familias/{familia_id}", response_model=FamiliaResponse)
def obtener_familia_endpoint(
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
) -> Familia:
    """Obtener una familia por su ID.

    Args:
        familia: Familia obtenida por la dependencia

    Returns:
        La familia encontrada
    """
    return familia


@router.put("/familias/{familia_id}", response_model=FamiliaResponse)
def actualizar_familia_endpoint(
    familia_data: FamiliaUpdate,
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Actualizar una familia existente.

    Args:
        familia_data: Datos actualizados de la familia
        familia: Familia a actualizar
        db: Sesión de base de datos

    Returns:
        La familia actualizada

    TODO: Integración con Auth - obtener usuario_id del token JWT
    """
    # TODO: Obtener usuario_id del contexto de autenticación cuando auth esté implementado
    usuario_id = None

    return actualizar_familia(db, familia, familia_data, usuario_id)


@router.delete("/familias/{familia_id}", status_code=204)
def eliminar_familia_endpoint(
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una familia (baja física).

    Args:
        familia: Familia a eliminar
        db: Sesión de base de datos

    TODO: Integración con Auth - obtener usuario_id del token JWT
    TODO: Considerar si debería ser soft-delete en lugar de baja física
    """
    # TODO: Obtener usuario_id del contexto de autenticación cuando auth esté implementado
    usuario_id = None

    eliminar_familia(db, familia, usuario_id)
