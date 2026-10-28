from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth import autorizacion_service
from src.auth.constants import (
    PERMISO_FACTURACION_LEER,
    PERMISO_FAMILIAS_ALUMNOS_LEER,
    PERMISO_PANEL_ADMIN_LEER,
    PERMISO_PROVEEDORES_COMPRAS_LEER,
)
from src.auth.dependencies import RolActivo, requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.panel_admin.schemas import (
    ActividadRecienteRead,
    EvolucionFinancieraRead,
    IndicadoresDireccionRead,
)
from src.panel_admin.service import (
    obtener_actividad_reciente,
    obtener_evolucion_financiera,
    obtener_indicadores_direccion,
)

router = APIRouter(prefix="/panel-admin", tags=["panel_admin"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_PANEL_ADMIN_LEER))]

# Cada categoría del feed se habilita con el permiso del módulo dueño de esos hechos, no con
# `panel_administrativo.leer`: Dirección ve el panel, pero un rol sin facturación no debe ver
# montos de cobros ni deudas.
PERMISO_POR_CATEGORIA = {
    "compras": PERMISO_PROVEEDORES_COMPRAS_LEER,
    "finanzas": PERMISO_FACTURACION_LEER,
    "alumnos": PERMISO_FAMILIAS_ALUMNOS_LEER,
}


@router.get("/indicadores-direccion")
def obtener_indicadores(db: DbSession, _: PuedeLeer) -> IndicadoresDireccionRead:
    return IndicadoresDireccionRead.model_validate(obtener_indicadores_direccion(db))


@router.get(
    "/evolucion-financiera",
    dependencies=[Depends(requiere_permiso(PERMISO_FACTURACION_LEER))],
)
def obtener_evolucion(db: DbSession, _: PuedeLeer) -> list[EvolucionFinancieraRead]:
    return [EvolucionFinancieraRead.model_validate(mes) for mes in obtener_evolucion_financiera(db)]


@router.get("/actividad-reciente", response_model=list[ActividadRecienteRead])
def obtener_actividad(
    db: DbSession,
    usuario: PuedeLeer,
    rol_activo: RolActivo,
    limite: Annotated[int, Query(ge=1, le=20)] = 8,
) -> list[ActividadRecienteRead]:
    """Hechos recientes de las categorías que el rol activo puede ver.

    Sin categorías habilitadas devuelve una lista vacía; nunca inventa actividad ni completa
    una categoría que el sistema no registra.
    """
    categorias = {
        categoria
        for categoria, permiso in PERMISO_POR_CATEGORIA.items()
        if autorizacion_service.tiene_permiso_en_rol(db, usuario.id, rol_activo, permiso)
    }
    return [
        ActividadRecienteRead.model_validate(fila)
        for fila in obtener_actividad_reciente(db, categorias=categorias, limite=limite)
    ]
