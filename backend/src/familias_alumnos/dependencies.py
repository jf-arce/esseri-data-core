"""Dependencias de FastAPI para el módulo Familias y Alumnos."""

import uuid
from typing import Annotated

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.auth.dependencies import RolActivo, UsuarioAutenticado
from src.auth.exceptions import PermisoDenegado
from src.database import get_db
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.familias_alumnos.service import (
    es_rol_familia,
    familia_tiene_alumno,
    obtener_alumno_por_id,
    obtener_familia_de_usuario,
    obtener_familia_por_id,
    obtener_vinculo_por_id,
)

DbSession = Annotated[Session, Depends(get_db)]


def obtener_familia_activa(
    usuario: UsuarioAutenticado,
    rol_activo: RolActivo,
    db: DbSession,
) -> Familia | None:
    """Familia propia si la sesión actúa como `familia`; `None` para el staff.

    Un usuario con rol familia pero sin fila en `Familia` no tiene nada que consultar: se corta
    acá con 403 en vez de devolver `None`, que en el resto de las dependencias significa "sin
    restricción" (staff).
    """
    if not es_rol_familia(rol_activo):
        return None
    familia = obtener_familia_de_usuario(db, usuario)
    if familia is None:
        raise PermisoDenegado("Tu cuenta no tiene una familia asociada")
    return familia


FamiliaActiva = Annotated[Familia | None, Depends(obtener_familia_activa)]


def obtener_familia_o_404(
    familia_id: uuid.UUID,
    familia_activa: FamiliaActiva,
    db: DbSession,
) -> Familia:
    """Obtener una familia por ID o retornar 404; 403 si es ajena al rol familia."""
    familia = obtener_familia_por_id(db, familia_id)
    if familia is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Familia con ID {familia_id} no encontrada",
        )
    if familia_activa is not None and familia.id != familia_activa.id:
        raise PermisoDenegado("No tenés acceso a esta familia")
    return familia


def obtener_alumno_o_404(
    alumno_id: uuid.UUID,
    familia_activa: FamiliaActiva,
    db: DbSession,
) -> Alumno:
    """Obtener un alumno por ID o retornar 404; 403 si no está vinculado al rol familia."""
    alumno = obtener_alumno_por_id(db, alumno_id)
    if alumno is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alumno con ID {alumno_id} no encontrado",
        )
    if familia_activa is not None and not familia_tiene_alumno(db, familia_activa.id, alumno.id):
        raise PermisoDenegado("No tenés acceso a este alumno")
    return alumno


def obtener_vinculo_o_404(
    vinculo_id: uuid.UUID,
    familia_activa: FamiliaActiva,
    db: DbSession,
) -> FamiliaAlumno:
    """Obtener un vínculo por ID o retornar 404; 403 si es de otra familia."""
    vinculo = obtener_vinculo_por_id(db, vinculo_id)
    if vinculo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Vínculo con ID {vinculo_id} no encontrado",
        )
    if familia_activa is not None and vinculo.familia_id != familia_activa.id:
        raise PermisoDenegado("No tenés acceso a este vínculo")
    return vinculo
