"""Endpoints HTTP del módulo IA/Sugerencias."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.ia_sugerencias.constants import (
    PERMISO_IA_SUGERENCIAS_ACTUALIZAR,
    PERMISO_IA_SUGERENCIAS_CREAR,
    PERMISO_IA_SUGERENCIAS_LEER,
)
from src.ia_sugerencias.dependencies import obtener_sugerencia_o_404
from src.ia_sugerencias.models import IaSugerencia
from src.ia_sugerencias.schemas import (
    BorradorComunicacionCreate,
    DeteccionResponse,
    EstadoSugerencia,
    SugerenciaResponse,
    TipoSugerencia,
)
from src.ia_sugerencias.service import (
    aprobar_sugerencia,
    armar_respuesta,
    detectar_patrones,
    generar_borrador_comunicacion,
    listar_sugerencias,
    rechazar_sugerencia,
)

router = APIRouter(prefix="/ia-sugerencias", tags=["ia_sugerencias"])


@router.get("/sugerencias", response_model=list[SugerenciaResponse])
def listar_sugerencias_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_LEER))],
    estado: Annotated[
        EstadoSugerencia | None, Query(description="Filtra por estado de revisión")
    ] = None,
    tipo: Annotated[
        TipoSugerencia | None, Query(description="patron_detectado o comunicacion")
    ] = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[SugerenciaResponse]:
    """Listar sugerencias, de la más reciente a la más vieja.

    Con `estado=pendiente_revision` es la bandeja de revisión; sin filtro, el historial.
    """
    return listar_sugerencias(db, estado=estado, tipo=tipo)


@router.get("/sugerencias/{sugerencia_id}", response_model=SugerenciaResponse)
def obtener_sugerencia_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_LEER))],
    sugerencia: IaSugerencia = Depends(obtener_sugerencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> SugerenciaResponse:
    """Obtener una sugerencia por su ID."""
    return armar_respuesta(db, sugerencia)


@router.post("/sugerencias/{sugerencia_id}/aprobar", response_model=SugerenciaResponse)
def aprobar_sugerencia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_ACTUALIZAR))],
    sugerencia: IaSugerencia = Depends(obtener_sugerencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> SugerenciaResponse:
    """Aprobar una sugerencia pendiente. Da 409 si ya fue revisada.

    El revisor sale de la sesión, no del payload.
    """
    return armar_respuesta(db, aprobar_sugerencia(db, sugerencia, usuario.id))


@router.post("/sugerencias/{sugerencia_id}/rechazar", response_model=SugerenciaResponse)
def rechazar_sugerencia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_ACTUALIZAR))],
    sugerencia: IaSugerencia = Depends(obtener_sugerencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> SugerenciaResponse:
    """Rechazar una sugerencia pendiente. Da 409 si ya fue revisada."""
    return armar_respuesta(db, rechazar_sugerencia(db, sugerencia, usuario.id))


@router.post("/patrones/detectar", response_model=DeteccionResponse)
def detectar_patrones_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> DeteccionResponse:
    """Buscar patrones de morosidad e inasistencias y dejarlos como sugerencias pendientes.

    Se puede ejecutar las veces que haga falta: un caso que ya tiene una sugerencia sin revisar
    no se duplica.
    """
    return detectar_patrones(db, usuario_id=usuario.id)


@router.post("/comunicaciones", response_model=SugerenciaResponse, status_code=201)
def generar_borrador_comunicacion_endpoint(
    datos: BorradorComunicacionCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_IA_SUGERENCIAS_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> SugerenciaResponse:
    """Pedir un borrador de comunicación para un evento y dejarlo pendiente de revisión.

    Da 503 si falta la clave del proveedor de IA y 502 si el proveedor falla o devuelve un
    borrador que no se puede usar. Nada se envía: aprobarlo solo crea la plantilla.
    """
    return armar_respuesta(db, generar_borrador_comunicacion(db, datos, usuario.id))
