from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.auth.constants import PERMISO_PANEL_ADMIN_LEER
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.panel_admin.schemas import IndicadoresDireccionRead
from src.panel_admin.service import obtener_indicadores_direccion

router = APIRouter(prefix="/panel-admin", tags=["panel_admin"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_PANEL_ADMIN_LEER))]


@router.get("/indicadores-direccion")
def obtener_indicadores(db: DbSession, _: PuedeLeer) -> IndicadoresDireccionRead:
    return IndicadoresDireccionRead.model_validate(obtener_indicadores_direccion(db))
