"""Endpoints HTTP del módulo Familias y Alumnos."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.dependencies import UsuarioAutenticado
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
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Crear una nueva Familia.

    Args:
        familia_data: Datos de la familia a crear
        usuario: Usuario autenticado que realiza la acción
        db: Sesión de base de datos

    Returns:
        La familia creada
    """
    return crear_familia(db, familia_data, usuario.id)


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
    usuario: UsuarioAutenticado,
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Familia:
    """Actualizar una familia existente.

    Args:
        familia_data: Datos actualizados de la familia
        usuario: Usuario autenticado que realiza la acción
        familia: Familia a actualizar
        db: Sesión de base de datos

    Returns:
        La familia actualizada
    """
    return actualizar_familia(db, familia, familia_data, usuario.id)


@router.delete("/familias/{familia_id}", status_code=204)
def eliminar_familia_endpoint(
    usuario: UsuarioAutenticado,
    familia: Familia = Depends(obtener_familia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una familia (baja física).

    Args:
        usuario: Usuario autenticado que realiza la acción
        familia: Familia a eliminar
        db: Sesión de base de datos

    TODO: Considerar si debería ser soft-delete en lugar de baja física
    """
    eliminar_familia(db, familia, usuario.id)
