from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from src.auth.constants import PERMISO_FACTURACION_CREAR
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.facturacion import cobranzas_importacion_service as importaciones
from src.facturacion import cobranzas_service as service
from src.facturacion.cobranzas_schemas import (
    ArchivoRead,
    BatchSummaryRead,
    ConfirmarImportacionInput,
    EstadoSeleccion,
    FacturasElegiblesRead,
    FiltrosSeleccion,
    HistorialLotesRead,
    ImportacionInput,
    ImportacionRead,
    LiberacionesRead,
    LiberarLoteInput,
    LoteCreate,
    LoteDetailRead,
    RespuestaCreate,
    ResumenSeleccionInput,
    ResumenSeleccionRead,
)

router = APIRouter(prefix="/cobranzas-simuladas")
DbSession = Annotated[Session, Depends(get_db)]
Operador = Annotated[Usuario, Depends(requiere_permiso(PERMISO_FACTURACION_CREAR))]
Pagina = Annotated[int, Query(ge=1)]
Tamanio = Annotated[int, Query(ge=1, le=100)]


@router.get("/opciones")
def opciones(db: DbSession, _: Operador) -> dict[str, list[str]]:
    return service.opciones(db)


@router.get("/facturas-elegibles")
def facturas_elegibles(
    db: DbSession,
    _: Operador,
    periodo: str | None = None,
    medio: Literal["cbu", "tarjeta"] | None = None,
    estado: EstadoSeleccion = "pendientes_sin_lote",
    buscar: str | None = None,
    pagina: Pagina = 1,
    tamanio: Tamanio = 25,
) -> FacturasElegiblesRead:
    filtros = FiltrosSeleccion(
        periodo=periodo, medio=medio, estado=estado, buscar=buscar
    )
    return service.listar_elegibles(db, filtros=filtros, pagina=pagina, tamanio=tamanio)


@router.post("/resumen-seleccion")
def resumen_seleccion(
    datos: ResumenSeleccionInput, db: DbSession, _: Operador
) -> ResumenSeleccionRead:
    return service.resumen_seleccion(db, datos.seleccion)


@router.get("/liberaciones")
def liberaciones(
    db: DbSession, _: Operador, pagina: Pagina = 1, tamanio: Tamanio = 25
) -> LiberacionesRead:
    return service.listar_liberaciones(db, pagina=pagina, tamanio=tamanio)


@router.get("/importaciones/{importacion_id}")
def obtener_importacion(
    importacion_id: UUID,
    db: DbSession,
    _: Operador,
    resultado: Literal[
        "revision", "cobrados", "rechazados", "errores", "todos"
    ] = "revision",
    buscar: str | None = None,
    pagina: Pagina = 1,
    tamanio: Tamanio = 25,
) -> ImportacionRead:
    return importaciones.leer_importacion(
        db,
        importacion_id,
        resultado=resultado,
        buscar=buscar,
        pagina=pagina,
        tamanio=tamanio,
    )


@router.get("/importaciones/{importacion_id}/incidencias")
def incidencias(importacion_id: UUID, db: DbSession, _: Operador) -> ArchivoRead:
    return importaciones.incidencias(db, importacion_id)


@router.post("/previsualizar")
def previsualizar(datos: ImportacionInput, db: DbSession, usuario: Operador) -> ImportacionRead:
    return importaciones.previsualizar(db, datos.contenido, usuario.id)


@router.post("/confirmar")
def confirmar(
    datos: ConfirmarImportacionInput, db: DbSession, usuario: Operador
) -> ImportacionRead:
    return importaciones.confirmar(
        db,
        datos.importacion_id,
        revision_confirmada=datos.revision_confirmada,
        usuario_id=usuario.id,
    )


@router.post("", status_code=201)
def crear(datos: LoteCreate, db: DbSession, usuario: Operador) -> LoteDetailRead:
    return service.crear_lote(db, datos, usuario.id)


@router.get("")
def listar(
    db: DbSession,
    _: Operador,
    periodo: str | None = None,
    estado: (
        Literal["exportado", "en_revision", "pagos_registrados", "liberado"] | None
    ) = None,
    buscar: str | None = None,
    pagina: Pagina = 1,
    tamanio: Tamanio = 25,
) -> HistorialLotesRead:
    return service.listar_lotes(
        db,
        periodo=periodo,
        estado=estado,
        buscar=buscar,
        pagina=pagina,
        tamanio=tamanio,
    )


@router.get("/{lote_id}")
def obtener(lote_id: UUID, db: DbSession, _: Operador) -> LoteDetailRead:
    return service.leer_lote(db, service.obtener_lote(db, lote_id))


@router.post("/{lote_id}/respuesta")
def respuesta(
    lote_id: UUID, datos: RespuestaCreate, db: DbSession, _: Operador
) -> ArchivoRead:
    return service.generar_respuesta(
        db, lote_id, datos.rechazar_referencias, datos.rechazos_cantidad
    )


@router.post("/{lote_id}/liberar")
def liberar(
    lote_id: UUID, datos: LiberarLoteInput, db: DbSession, usuario: Operador
) -> BatchSummaryRead:
    return service.liberar_lote(
        db,
        lote_id,
        motivo=datos.motivo,
        confirmacion_no_procesado=datos.confirmacion_no_procesado,
        usuario_id=usuario.id,
    )
