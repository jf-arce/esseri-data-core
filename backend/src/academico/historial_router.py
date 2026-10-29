from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from src.academico.historial_schemas import FiltrosHistorial, OpcionHistorial, PaginaHistorial
from src.academico.historial_service import (
    ciclos_historial,
    opciones_historial,
    pagina_historial,
    reporte_historial,
)
from src.academico.service import (
    generar_csv_reporte_asistencias,
    generar_pdf_reporte_asistencias,
    generar_xlsx_reporte_asistencias,
)
from src.auth.constants import PERMISO_ACADEMICO_EXPORTAR, PERMISO_ACADEMICO_LEER
from src.auth.dependencies import RolActivo, requiere_permiso
from src.auth.models import Usuario
from src.database import get_db

router = APIRouter(prefix="/asistencias")
Db = Annotated[Session, Depends(get_db)]
Lector = Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))]


@router.get("/consulta")
def consultar_historial(
    usuario: Lector, rol_activo: RolActivo, db: Db, filtros: Annotated[FiltrosHistorial, Query()]
) -> PaginaHistorial:
    return pagina_historial(db, usuario.id, rol_activo, filtros)


@router.get("/filtros")
def obtener_opciones_historial(
    usuario: Lector,
    rol_activo: RolActivo,
    db: Db,
    ciclo_lectivo: Annotated[str, Query(pattern=r"^\d{4}$")],
) -> list[OpcionHistorial]:
    return opciones_historial(db, usuario.id, rol_activo, ciclo_lectivo)


@router.get("/ciclos")
def obtener_ciclos_historial(usuario: Lector, rol_activo: RolActivo, db: Db) -> list[str]:
    return ciclos_historial(db, usuario.id, rol_activo)


@router.get("/consulta/exportar")
def exportar_historial(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_EXPORTAR))],
    rol_activo: RolActivo,
    db: Db,
    filtros: Annotated[FiltrosHistorial, Query()],
) -> Response:
    filas = reporte_historial(db, usuario.id, rol_activo, filtros)
    if filtros.formato == "xlsx":
        contenido = generar_xlsx_reporte_asistencias(filas)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    elif filtros.formato == "pdf":
        desde = filtros.fecha_desde or min((fila.fecha for fila in filas), default=date.today())
        hasta = filtros.fecha_hasta or max((fila.fecha for fila in filas), default=desde)
        contenido = generar_pdf_reporte_asistencias(filas, desde, hasta)
        media_type = "application/pdf"
    else:
        contenido = generar_csv_reporte_asistencias(filas)
        media_type = "text/csv"
    return Response(
        content=contenido,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="asistencias_{filtros.ciclo_lectivo}.{filtros.formato}"'
            ),
        },
    )
