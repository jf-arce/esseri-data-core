import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from src.auth.constants import (
    PERMISO_INSCRIPCIONES_ACTUALIZAR,
    PERMISO_INSCRIPCIONES_CREAR,
    PERMISO_INSCRIPCIONES_LEER,
)
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.inscripciones import admisiones_service, matriculas_service, opciones_service
from src.inscripciones.schemas import (
    AlumnoReinscripcionOpcionRead,
    BajaInscripcionCreate,
    CambioMatriculaCreate,
    DivisionOpcionRead,
    DocumentoSolicitudCreate,
    DocumentoSolicitudRead,
    DocumentoSolicitudUpdate,
    EtapaSolicitudCreate,
    InscripcionListadoRead,
    InscripcionNuevaCreate,
    InscripcionRead,
    ReinscripcionCreate,
    SolicitudInscripcionCreate,
    SolicitudInscripcionListadoRead,
    SolicitudInscripcionOpcionRead,
    SolicitudInscripcionRead,
)

router = APIRouter(prefix="/inscripciones", tags=["inscripciones"])

DbSession = Annotated[Session, Depends(get_db)]
PuedeCrear = Annotated[Usuario, Depends(requiere_permiso(PERMISO_INSCRIPCIONES_CREAR))]
PuedeLeer = Annotated[Usuario, Depends(requiere_permiso(PERMISO_INSCRIPCIONES_LEER))]
PuedeActualizar = Annotated[Usuario, Depends(requiere_permiso(PERMISO_INSCRIPCIONES_ACTUALIZAR))]


@router.get("")
def listar_inscripciones(
    db: DbSession,
    _: PuedeLeer,
    ciclo_lectivo: Annotated[str | None, Query(min_length=1, max_length=20)] = None,
    estado: Annotated[Literal["activa", "finalizada", "baja"] | None, Query()] = None,
    tipo: Annotated[
        Literal["nueva", "reinscripcion", "cambio_matricula", "baja"] | None,
        Query(),
    ] = None,
    alumno_id: Annotated[uuid.UUID | None, Query()] = None,
    division_id: Annotated[uuid.UUID | None, Query()] = None,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> InscripcionListadoRead:
    return matriculas_service.listar_inscripciones(
        db,
        ciclo_lectivo=ciclo_lectivo.strip() if ciclo_lectivo else None,
        estado=estado,
        tipo=tipo,
        alumno_id=alumno_id,
        division_id=division_id,
        buscar=buscar,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.post("", status_code=status.HTTP_201_CREATED)
def crear_inscripcion(
    datos: InscripcionNuevaCreate, db: DbSession, _: PuedeCrear
) -> InscripcionRead:
    inscripcion = matriculas_service.crear_inscripcion_nueva(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.post("/reinscripciones", status_code=status.HTTP_201_CREATED)
def crear_reinscripcion(
    datos: ReinscripcionCreate, db: DbSession, _: PuedeCrear
) -> InscripcionRead:
    inscripcion = matriculas_service.crear_reinscripcion(db, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.post("/solicitudes", status_code=status.HTTP_201_CREATED)
def crear_solicitud_inscripcion(
    datos: SolicitudInscripcionCreate, db: DbSession, usuario: PuedeCrear
) -> SolicitudInscripcionRead:
    return admisiones_service.crear_solicitud_inscripcion(db, datos, usuario.id)


@router.get("/solicitudes")
def listar_solicitudes_inscripcion(
    db: DbSession,
    _: PuedeLeer,
    estado: Annotated[
        Literal["en_proceso", "aprobada", "rechazada", "desistida"] | None, Query()
    ] = None,
    etapa: Annotated[
        Literal[
            "consulta_lead",
            "entrevista",
            "postulacion",
            "evaluacion_aprobacion",
            "reserva_matricula",
            "documentacion_contrato",
            "inscripcion_confirmada",
        ]
        | None,
        Query(),
    ] = None,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    tamanio_pagina: Annotated[int, Query(ge=1, le=100)] = 20,
) -> SolicitudInscripcionListadoRead:
    return admisiones_service.listar_solicitudes_inscripcion(
        db,
        estado=estado,
        etapa=etapa,
        buscar=buscar,
        pagina=pagina,
        tamanio_pagina=tamanio_pagina,
    )


@router.get("/solicitudes/{solicitud_id}")
def obtener_solicitud_inscripcion(
    solicitud_id: uuid.UUID, db: DbSession, _: PuedeLeer
) -> SolicitudInscripcionRead:
    return admisiones_service.obtener_solicitud_inscripcion(db, solicitud_id)


@router.post("/solicitudes/{solicitud_id}/avanzar")
def avanzar_solicitud_inscripcion(
    solicitud_id: uuid.UUID,
    datos: EtapaSolicitudCreate,
    db: DbSession,
    usuario: PuedeActualizar,
) -> SolicitudInscripcionRead:
    return admisiones_service.avanzar_solicitud_inscripcion(
        db, solicitud_id, datos.observaciones, usuario.id
    )


@router.post("/solicitudes/{solicitud_id}/aprobar")
def aprobar_solicitud_inscripcion(
    solicitud_id: uuid.UUID,
    datos: EtapaSolicitudCreate,
    db: DbSession,
    usuario: PuedeActualizar,
) -> SolicitudInscripcionRead:
    return admisiones_service.aprobar_solicitud_inscripcion(
        db, solicitud_id, datos.observaciones, usuario.id
    )


@router.post("/solicitudes/{solicitud_id}/rechazar")
def rechazar_solicitud_inscripcion(
    solicitud_id: uuid.UUID,
    datos: EtapaSolicitudCreate,
    db: DbSession,
    _: PuedeActualizar,
) -> SolicitudInscripcionRead:
    return admisiones_service.rechazar_solicitud_inscripcion(db, solicitud_id, datos.observaciones)


@router.post("/solicitudes/{solicitud_id}/documentos", status_code=status.HTTP_201_CREATED)
def registrar_documento_solicitud(
    solicitud_id: uuid.UUID,
    datos: DocumentoSolicitudCreate,
    db: DbSession,
    usuario: PuedeActualizar,
) -> DocumentoSolicitudRead:
    return admisiones_service.registrar_documento_solicitud(db, solicitud_id, datos, usuario.id)


@router.put("/solicitudes/{solicitud_id}/documentos/{documento_id}")
def actualizar_documento_solicitud(
    solicitud_id: uuid.UUID,
    documento_id: uuid.UUID,
    datos: DocumentoSolicitudUpdate,
    db: DbSession,
    _: PuedeActualizar,
) -> DocumentoSolicitudRead:
    return admisiones_service.actualizar_documento_solicitud(db, solicitud_id, documento_id, datos)


@router.post("/{inscripcion_id}/cambios-matricula", status_code=status.HTTP_201_CREATED)
def registrar_cambio_matricula(
    inscripcion_id: uuid.UUID,
    datos: CambioMatriculaCreate,
    db: DbSession,
    _: PuedeActualizar,
) -> InscripcionRead:
    inscripcion = matriculas_service.registrar_cambio_matricula(db, inscripcion_id, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.post("/{inscripcion_id}/bajas", status_code=status.HTTP_201_CREATED)
def registrar_baja_inscripcion(
    inscripcion_id: uuid.UUID,
    datos: BajaInscripcionCreate,
    db: DbSession,
    _: PuedeActualizar,
) -> InscripcionRead:
    inscripcion = matriculas_service.registrar_baja_inscripcion(db, inscripcion_id, datos)
    return InscripcionRead.model_validate(inscripcion)


@router.get("/opciones/solicitudes")
def listar_solicitudes_disponibles(
    db: DbSession,
    _: PuedeLeer,
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[SolicitudInscripcionOpcionRead]:
    return opciones_service.listar_solicitudes_disponibles(db, buscar=buscar, limite=limite)


@router.get("/opciones/divisiones")
def listar_divisiones_disponibles(db: DbSession, _: PuedeLeer) -> list[DivisionOpcionRead]:
    return opciones_service.listar_divisiones_disponibles(db)


@router.get("/opciones/reinscripciones")
def listar_alumnos_elegibles_reinscripcion(
    db: DbSession,
    _: PuedeLeer,
    ciclo_lectivo: Annotated[
        str,
        Query(min_length=4, max_length=4, pattern=r"^[1-9]\d{3}$"),
    ],
    buscar: Annotated[str | None, Query(max_length=100)] = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 50,
) -> list[AlumnoReinscripcionOpcionRead]:
    return opciones_service.listar_alumnos_elegibles_reinscripcion(
        db,
        ciclo_lectivo,
        buscar=buscar,
        limite=limite,
    )


@router.get("/{inscripcion_id}")
def obtener_inscripcion(inscripcion_id: uuid.UUID, db: DbSession, _: PuedeLeer) -> InscripcionRead:
    inscripcion = matriculas_service.obtener_inscripcion(db, inscripcion_id)
    return InscripcionRead.model_validate(inscripcion)
