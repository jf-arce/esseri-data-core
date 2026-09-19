"""Endpoints HTTP del módulo Académico."""

import uuid
from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.dependencies import (
    obtener_anio_o_404,
    obtener_asignacion_docente_o_404,
    obtener_asistencia_o_404,
    obtener_division_o_404,
    obtener_docente_o_404,
    obtener_materia_o_404,
    obtener_nivel_educativo_o_404,
)
from src.academico.exceptions import (
    AnioConDivisiones,
    AnioDuplicado,
    AsignacionDocenteDuplicada,
    AsistenciaDuplicada,
    AsistenciaYaJustificada,
    DivisionConAsignaciones,
    DivisionDuplicada,
    DocenteConAsignaciones,
    InscripcionNoActiva,
    LegajoDuplicado,
    MateriaConAsignaciones,
    MateriaDuplicada,
    NivelEducativoConAnios,
    NombreNivelDuplicado,
)
from src.academico.models import (
    Anio,
    ArchivoJustificacionInasistencia,
    AsignacionDocente,
    Division,
    Docente,
    JustificacionInasistencia,
    Materia,
    MotivoJustificacion,
    NivelEducativo,
)
from src.academico.schemas import (
    AltaDocenteCreate,
    AnioCreate,
    AnioResponse,
    AnioUpdate,
    AsignacionDocenteCreate,
    AsignacionDocenteResponse,
    AsistenciaBulkCreate,
    AsistenciaBulkResponse,
    AsistenciaCreate,
    AsistenciaFamiliaResponse,
    AsistenciaResponse,
    AsistenciaResumen,
    AsistenciaUpdate,
    DivisionCreate,
    DivisionResponse,
    DivisionUpdate,
    DocenteCreate,
    DocenteDesdeUsuarioCreate,
    DocenteResponse,
    DocenteUpdate,
    JustificacionFamiliaResponse,
    JustificacionResolucion,
    MateriaCreate,
    MateriaResponse,
    MateriaUpdate,
    MiDivisionResponse,
    NivelEducativoCreate,
    NivelEducativoResponse,
    NivelEducativoUpdate,
)
from src.academico.service import (
    actualizar_anio,
    actualizar_asistencia,
    actualizar_division,
    actualizar_docente,
    actualizar_materia,
    actualizar_nivel_educativo,
    asistencias_de_familia,
    calcular_resumen_asistencia,
    crear_alta_docente,
    crear_anio,
    crear_asignacion_docente,
    crear_division,
    crear_docente,
    crear_docente_desde_usuario,
    crear_materia,
    crear_nivel_educativo,
    divisiones_de_persona,
    eliminar_anio,
    eliminar_asignacion_docente,
    eliminar_asistencia,
    eliminar_division,
    eliminar_docente,
    eliminar_materia,
    eliminar_nivel_educativo,
    generar_csv_reporte_asistencias,
    generar_pdf_reporte_asistencias,
    generar_xlsx_reporte_asistencias,
    justificar_asistencia_de_familia,
    listar_anios,
    listar_anios_por_nivel,
    listar_asignaciones_docentes,
    listar_asistencias,
    listar_asistencias_reporte,
    listar_divisiones,
    listar_divisiones_por_anio,
    listar_docentes,
    listar_materias,
    listar_materias_por_anio,
    listar_materias_por_division,
    listar_niveles_educativos,
    registrar_asistencia,
    registrar_asistencia_masiva,
    resolver_justificacion,
    verificar_acceso_a_asistencia,
)
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA,
    PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA,
    PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES,
    PERMISO_ACADEMICO_CREAR,
    PERMISO_ACADEMICO_ELIMINAR,
    PERMISO_ACADEMICO_EXPORTAR,
    PERMISO_ACADEMICO_LEER,
)
from src.auth.dependencies import RolActivo, UsuarioAutenticado, requiere_permiso
from src.auth.models import Usuario
from src.database import get_db
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona

router = APIRouter(prefix="/academico", tags=["academico"])


def _contexto_justificacion(db: Session, justificacion_id: uuid.UUID):
    return (
        db.query(Asistencia.fecha, Persona.nombre, Persona.apellido)
        .join(
            JustificacionInasistencia,
            JustificacionInasistencia.asistencia_id == Asistencia.id,
        )
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .filter(JustificacionInasistencia.id == justificacion_id)
        .first()
    )


def _respuesta_justificacion(
    db: Session, justificacion: JustificacionInasistencia, contexto=None
) -> JustificacionFamiliaResponse:
    contexto = contexto or _contexto_justificacion(db, justificacion.id)
    if contexto is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Asistencia de justificación no encontrada",
        )
    motivo = db.get(MotivoJustificacion, justificacion.motivo_justificacion_id)
    return JustificacionFamiliaResponse(
        id=justificacion.id,
        asistencia_id=justificacion.asistencia_id,
        fecha_asistencia=contexto[0],
        alumno_nombre=f"{contexto[1]} {contexto[2]}",
        estado=justificacion.estado,
        motivo=motivo.nombre if motivo is not None else "Otro",
        observacion=justificacion.observacion,
        archivo_nombre=justificacion.archivo,
        fecha_carga=justificacion.fecha_carga,
    )


# --- NivelEducativo ----------------------------------------------------------------------


@router.post("/niveles", response_model=NivelEducativoResponse, status_code=201)
def crear_nivel_educativo_endpoint(
    datos: NivelEducativoCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> NivelEducativo:
    """Crear un nuevo nivel educativo."""
    try:
        return crear_nivel_educativo(db, datos, usuario.id)
    except NombreNivelDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/niveles", response_model=list[NivelEducativoResponse])
def listar_niveles_educativos_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[NivelEducativo]:
    """Listar todos los niveles educativos."""
    return listar_niveles_educativos(db)


@router.get("/niveles/{nivel_educativo_id}", response_model=NivelEducativoResponse)
def obtener_nivel_educativo_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
) -> NivelEducativo:
    """Obtener un nivel educativo por su ID."""
    return nivel


@router.put("/niveles/{nivel_educativo_id}", response_model=NivelEducativoResponse)
def actualizar_nivel_educativo_endpoint(
    datos: NivelEducativoUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> NivelEducativo:
    """Actualizar un nivel educativo existente."""
    try:
        return actualizar_nivel_educativo(db, nivel, datos, usuario.id)
    except NombreNivelDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/niveles/{nivel_educativo_id}", status_code=204)
def eliminar_nivel_educativo_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    nivel: NivelEducativo = Depends(obtener_nivel_educativo_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un nivel educativo."""
    try:
        eliminar_nivel_educativo(db, nivel, usuario.id)
    except NivelEducativoConAnios as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Anio --------------------------------------------------------------------------------


@router.post("/anios", response_model=AnioResponse, status_code=201)
def crear_anio_endpoint(
    datos: AnioCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Anio:
    """Crear un nuevo año."""
    try:
        return crear_anio(db, datos, usuario.id)
    except AnioDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/anios", response_model=list[AnioResponse])
def listar_anios_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    nivel_educativo_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Anio]:
    """Listar años. Opcionalmente filtrar por nivel educativo con ?nivel_educativo_id="""
    if nivel_educativo_id is not None:
        return listar_anios_por_nivel(db, nivel_educativo_id)
    return listar_anios(db)


@router.get("/anios/{anio_id}", response_model=AnioResponse)
def obtener_anio_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
) -> Anio:
    """Obtener un año por su ID."""
    return anio


@router.put("/anios/{anio_id}", response_model=AnioResponse)
def actualizar_anio_endpoint(
    datos: AnioUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Anio:
    """Actualizar un año existente."""
    try:
        return actualizar_anio(db, anio, datos, usuario.id)
    except AnioDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/anios/{anio_id}", status_code=204)
def eliminar_anio_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    anio: Anio = Depends(obtener_anio_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un año."""
    try:
        eliminar_anio(db, anio, usuario.id)
    except AnioConDivisiones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Division ----------------------------------------------------------------------------


@router.post("/divisiones", response_model=DivisionResponse, status_code=201)
def crear_division_endpoint(
    datos: DivisionCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Division:
    """Crear una nueva división."""
    try:
        return crear_division(db, datos, usuario.id)
    except DivisionDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/divisiones", response_model=list[DivisionResponse])
def listar_divisiones_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    anio_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Division]:
    """Listar divisiones. Opcionalmente filtrar por año con ?anio_id="""
    if anio_id is not None:
        return listar_divisiones_por_anio(db, anio_id)
    return listar_divisiones(db)


@router.get("/divisiones/{division_id}", response_model=DivisionResponse)
def obtener_division_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
) -> Division:
    """Obtener una división por su ID."""
    return division


@router.put("/divisiones/{division_id}", response_model=DivisionResponse)
def actualizar_division_endpoint(
    datos: DivisionUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Division:
    """Actualizar una división existente."""
    try:
        return actualizar_division(db, division, datos, usuario.id)
    except DivisionDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/divisiones/{division_id}", status_code=204)
def eliminar_division_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    division: Division = Depends(obtener_division_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una división."""
    try:
        eliminar_division(db, division, usuario.id)
    except DivisionConAsignaciones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Materia -----------------------------------------------------------------------------


@router.post("/materias", response_model=MateriaResponse, status_code=201)
def crear_materia_endpoint(
    datos: MateriaCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Materia:
    """Crear una nueva materia.

    `division_id` nulo = materia común a todo el año;
    con valor = específica de esa división/orientación.
    """
    try:
        return crear_materia(db, datos, usuario.id)
    except MateriaDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/materias", response_model=list[MateriaResponse])
def listar_materias_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    anio_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Materia]:
    """Listar materias. Opcionalmente filtrar por ?anio_id= o ?division_id="""
    if division_id is not None:
        return listar_materias_por_division(db, division_id)
    if anio_id is not None:
        return listar_materias_por_anio(db, anio_id)
    return listar_materias(db)


@router.get("/materias/{materia_id}", response_model=MateriaResponse)
def obtener_materia_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    materia: Materia = Depends(obtener_materia_o_404),  # noqa: B008
) -> Materia:
    """Obtener una materia por su ID."""
    return materia


@router.put("/materias/{materia_id}", response_model=MateriaResponse)
def actualizar_materia_endpoint(
    datos: MateriaUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA))],
    materia: Materia = Depends(obtener_materia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Materia:
    """Actualizar una materia existente."""
    try:
        return actualizar_materia(db, materia, datos, usuario.id)
    except MateriaDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/materias/{materia_id}", status_code=204)
def eliminar_materia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    materia: Materia = Depends(obtener_materia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar una materia."""
    try:
        eliminar_materia(db, materia, usuario.id)
    except MateriaConAsignaciones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- Docente -----------------------------------------------------------------------------


@router.post("/docentes", response_model=DocenteResponse, status_code=201)
def crear_docente_endpoint(
    datos: DocenteCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Docente:
    """Crear un nuevo docente."""
    try:
        return crear_docente(db, datos, usuario.id)
    except LegajoDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/docentes", response_model=list[DocenteResponse])
def listar_docentes_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Docente]:
    """Listar todos los docentes."""
    return listar_docentes(db)


@router.post("/docentes/alta-completa", response_model=DocenteResponse, status_code=201)
def crear_alta_docente_endpoint(
    datos: AltaDocenteCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Docente:
    """Crear Persona + Usuario (rol docente) + Docente en un único alta. Antes de
    `/docentes/{docente_id}` para que "alta-completa" no matchee como un UUID."""
    try:
        _persona, docente = crear_alta_docente(db, datos, usuario.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return docente


@router.post("/docentes/desde-usuario", response_model=DocenteResponse, status_code=201)
def crear_docente_desde_usuario_endpoint(
    datos: DocenteDesdeUsuarioCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Docente:
    """Suma el rol docente (y su ficha) a una cuenta que ya existe, ej. desde el diálogo de
    roles de Usuarios."""
    try:
        return crear_docente_desde_usuario(db, datos, usuario.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.get("/docentes/me/divisiones", response_model=list[MiDivisionResponse])
def mis_divisiones_endpoint(
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[MiDivisionResponse]:
    """Divisiones asignadas al docente autenticado. Dato propio: solo requiere sesión, no
    `academico.leer` (RF-30 no aplica acá, es la propia cuenta). Antes de `/docentes/{id}`
    para que "me" no matchee como un UUID."""
    if usuario.persona_id is None:
        return []
    return [
        MiDivisionResponse(division_id=division_id, etiqueta=etiqueta)
        for division_id, etiqueta in divisiones_de_persona(db, usuario.persona_id)
    ]


@router.get("/docentes/{docente_id}", response_model=DocenteResponse)
def obtener_docente_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    docente: Docente = Depends(obtener_docente_o_404),  # noqa: B008
) -> Docente:
    """Obtener un docente por su ID."""
    return docente


@router.put("/docentes/{docente_id}", response_model=DocenteResponse)
def actualizar_docente_endpoint(
    datos: DocenteUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA))],
    docente: Docente = Depends(obtener_docente_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Docente:
    """Actualizar un docente existente."""
    try:
        return actualizar_docente(db, docente, datos, usuario.id)
    except LegajoDuplicado as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/docentes/{docente_id}", status_code=204)
def eliminar_docente_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    docente: Docente = Depends(obtener_docente_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un docente."""
    try:
        eliminar_docente(db, docente, usuario.id)
    except DocenteConAsignaciones as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


# --- AsignacionDocente -------------------------------------------------------------------


@router.post("/asignaciones-docentes", response_model=AsignacionDocenteResponse, status_code=201)
def crear_asignacion_docente_endpoint(
    datos: AsignacionDocenteCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_CREAR))],
    db: Session = Depends(get_db),  # noqa: B008
) -> AsignacionDocente:
    """Asignar un docente a materia+división por ciclo lectivo."""
    try:
        return crear_asignacion_docente(db, datos, usuario.id)
    except AsignacionDocenteDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.get("/asignaciones-docentes", response_model=list[AsignacionDocenteResponse])
def listar_asignaciones_docentes_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    ciclo_lectivo: str | None = None,
    docente_id: uuid.UUID | None = None,
    materia_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[AsignacionDocente]:
    """Listar asignaciones docentes con filtros opcionales."""
    return listar_asignaciones_docentes(
        db,
        ciclo_lectivo=ciclo_lectivo,
        docente_id=docente_id,
        materia_id=materia_id,
        division_id=division_id,
    )


@router.get(
    "/asignaciones-docentes/{asignacion_id}",
    response_model=AsignacionDocenteResponse,
)
def obtener_asignacion_docente_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    asignacion: AsignacionDocente = Depends(obtener_asignacion_docente_o_404),  # noqa: B008
) -> AsignacionDocente:
    """Obtener una asignación docente por su ID."""
    return asignacion


@router.delete("/asignaciones-docentes/{asignacion_id}", status_code=204)
def eliminar_asignacion_docente_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    asignacion: AsignacionDocente = Depends(obtener_asignacion_docente_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Desasignar un docente (eliminar la asignación docente)."""
    eliminar_asignacion_docente(db, asignacion, usuario.id)


# --- Asistencia --------------------------------------------------------------------------


@router.post("/asistencias", response_model=AsistenciaResponse, status_code=201)
def registrar_asistencia_endpoint(
    datos: AsistenciaCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA))],
    rol_activo: RolActivo,
    db: Session = Depends(get_db),  # noqa: B008
) -> Asistencia:
    """Registrar asistencia diaria de un alumno.

    El docente marca presente/tardanza/ausente.
    Si marca 'ausente', se guarda como 'ausente_pendiente' y se dispara
    notificación automática a los responsables con recibe_comunicaciones=true.
    """
    try:
        return registrar_asistencia(db, datos, usuario.id, rol_activo)
    except InscripcionNoActiva as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc
    except AsistenciaDuplicada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.post("/asistencias/bulk", response_model=AsistenciaBulkResponse)
def registrar_asistencia_masiva_endpoint(
    datos: AsistenciaBulkCreate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA))],
    rol_activo: RolActivo,
    db: Session = Depends(get_db),  # noqa: B008
) -> AsistenciaBulkResponse:
    """Registrar asistencia de toda una división en una fecha.

    Crea o actualiza registros existentes. Para 'ausente' dispara
    notificación automática a los responsables.
    """
    return registrar_asistencia_masiva(db, datos, usuario.id, rol_activo)


@router.get("/asistencias", response_model=list[AsistenciaResponse])
def listar_asistencias_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    rol_activo: RolActivo,
    inscripcion_id: uuid.UUID | None = None,
    fecha: date | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    division_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[Asistencia]:
    """Listar registros de asistencia con filtros opcionales.

    Soporta fecha exacta o rango con fecha_desde/fecha_hasta (inclusive).
    """
    return listar_asistencias(
        db,
        usuario.id,
        rol_activo,
        inscripcion_id=inscripcion_id,
        fecha=fecha,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        division_id=division_id,
    )


@router.get(
    "/familia/alumnos/{alumno_id}/asistencias",
    response_model=list[AsistenciaFamiliaResponse],
)
def listar_asistencias_familia(
    alumno_id: uuid.UUID,
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),  # noqa: B008
) -> list[AsistenciaFamiliaResponse]:
    """Historial diario del alumno, limitado a la familia autenticada."""
    respuestas = []
    for detalle in asistencias_de_familia(db, usuario, alumno_id):
        justificacion = detalle.justificacion
        motivo = (
            db.get(MotivoJustificacion, justificacion.motivo_justificacion_id)
            if justificacion
            else None
        )
        respuestas.append(
            AsistenciaFamiliaResponse(
                id=detalle.asistencia.id,
                fecha=detalle.asistencia.fecha,
                tipo=detalle.asistencia.tipo,
                inscripcion_id=detalle.asistencia.inscripcion_id,
                updated_at=detalle.asistencia.updated_at,
                justificacion_id=justificacion.id if justificacion else None,
                justificacion_estado=justificacion.estado if justificacion else None,
                justificacion_motivo=motivo.nombre if motivo else None,
                justificacion_observacion=justificacion.observacion if justificacion else None,
                justificacion_archivo_nombre=justificacion.archivo if justificacion else None,
            )
        )
    return respuestas


@router.post(
    "/familia/asistencias/{asistencia_id}/justificaciones",
    response_model=JustificacionFamiliaResponse,
    status_code=201,
)
def justificar_asistencia_familia(
    motivo: Annotated[str, Form(min_length=1, max_length=120)],
    usuario: UsuarioAutenticado,
    observacion: Annotated[str | None, Form(max_length=500)] = None,
    comprobante: Annotated[UploadFile | None, File()] = None,
    asistencia: Asistencia = Depends(obtener_asistencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> JustificacionFamiliaResponse:
    contenido = comprobante.file.read() if comprobante is not None else None
    justificacion = justificar_asistencia_de_familia(
        db,
        usuario,
        asistencia,
        motivo,
        observacion,
        comprobante.filename if comprobante is not None else None,
        comprobante.content_type if comprobante is not None else None,
        contenido,
    )
    return _respuesta_justificacion(db, justificacion)


@router.get("/justificaciones", response_model=list[JustificacionFamiliaResponse])
def listar_justificaciones_endpoint(
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES))],
    db: Session = Depends(get_db),  # noqa: B008
) -> list[JustificacionFamiliaResponse]:
    filas = (
        db.query(
            JustificacionInasistencia,
            Asistencia.fecha,
            Persona.nombre,
            Persona.apellido,
        )
        .join(Asistencia, JustificacionInasistencia.asistencia_id == Asistencia.id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .filter(JustificacionInasistencia.estado == "pendiente")
        .order_by(JustificacionInasistencia.fecha_carga.asc())
        .all()
    )
    return [
        _respuesta_justificacion(db, item, (fecha, nombre, apellido))
        for item, fecha, nombre, apellido in filas
    ]


@router.patch(
    "/justificaciones/{justificacion_id}/resolver",
    response_model=JustificacionFamiliaResponse,
)
def resolver_justificacion_endpoint(
    justificacion_id: uuid.UUID,
    datos: JustificacionResolucion,
    usuario: Annotated[
        Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES))
    ],
    db: Session = Depends(get_db),  # noqa: B008
) -> JustificacionFamiliaResponse:
    justificacion = db.get(JustificacionInasistencia, justificacion_id)
    if justificacion is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Justificación no encontrada")
    resultado = resolver_justificacion(
        db, justificacion, datos.aprobar, datos.observacion, usuario.id
    )
    return _respuesta_justificacion(db, resultado)


@router.get("/justificaciones/{justificacion_id}/archivo")
def descargar_archivo_justificacion(
    justificacion_id: uuid.UUID,
    _: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_JUSTIFICACIONES))],
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    archivo = db.scalar(
        select(ArchivoJustificacionInasistencia).where(
            ArchivoJustificacionInasistencia.justificacion_id == justificacion_id
        )
    )
    if archivo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "La justificación no tiene comprobante")
    return Response(
        content=archivo.contenido,
        media_type=archivo.tipo_contenido,
        headers={"Content-Disposition": f'attachment; filename="{archivo.nombre}"'},
    )


@router.get("/familia/justificaciones/{justificacion_id}/archivo")
def descargar_archivo_justificacion_familia(
    justificacion_id: uuid.UUID,
    usuario: UsuarioAutenticado,
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    """Descarga un comprobante únicamente si pertenece a un alumno vinculado."""
    familia = db.query(Familia).filter(Familia.persona_id == usuario.persona_id).first()
    archivo = db.scalar(
        select(ArchivoJustificacionInasistencia)
        .join(
            JustificacionInasistencia,
            ArchivoJustificacionInasistencia.justificacion_id == JustificacionInasistencia.id,
        )
        .join(Asistencia, JustificacionInasistencia.asistencia_id == Asistencia.id)
        .join(Inscripcion, Asistencia.inscripcion_id == Inscripcion.id)
        .join(
            FamiliaAlumno,
            FamiliaAlumno.alumno_id == Inscripcion.alumno_id,
        )
        .where(
            ArchivoJustificacionInasistencia.justificacion_id == justificacion_id,
            FamiliaAlumno.familia_id == (familia.id if familia else None),
        )
    )
    if archivo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Comprobante no encontrado")
    return Response(
        content=archivo.contenido,
        media_type=archivo.tipo_contenido,
        headers={"Content-Disposition": f'attachment; filename="{archivo.nombre}"'},
    )


@router.get("/asistencias/resumen", response_model=AsistenciaResumen)
def resumen_asistencia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    rol_activo: RolActivo,
    inscripcion_id: uuid.UUID = ...,
    fecha_desde: date = ...,
    fecha_hasta: date = ...,
    db: Session = Depends(get_db),  # noqa: B008
) -> AsistenciaResumen:
    """Calcular resumen de asistencia de un alumno en un período (RF-06).

    Devuelve conteos por tipo y porcentajes de presencia,
    ausencias justificadas vs. injustificadas.
    """
    return calcular_resumen_asistencia(
        db, usuario.id, rol_activo, inscripcion_id, fecha_desde, fecha_hasta
    )


_MEDIA_TYPE_POR_FORMATO = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "pdf": "application/pdf",
}


@router.get("/asistencias/exportar")
def exportar_asistencias_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_EXPORTAR))],
    rol_activo: RolActivo,
    fecha_desde: date = ...,
    fecha_hasta: date = ...,
    formato: Literal["csv", "xlsx", "pdf"] = "csv",
    division_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    """Exportación del historial de asistencias (RF-37): reporte institucional en el período
    elegido, opcionalmente acotado a una división. Sin `division_id`, solo lo puede pedir una
    cuenta con acceso estructural (dirección, secretaría, coordinación académica,
    administrador del sistema) — ver `listar_asistencias_reporte`.
    """
    filas = listar_asistencias_reporte(
        db, usuario.id, rol_activo, fecha_desde, fecha_hasta, division_id
    )
    nombre_base = f"asistencias_{fecha_desde.isoformat()}_{fecha_hasta.isoformat()}"
    if formato == "xlsx":
        contenido = generar_xlsx_reporte_asistencias(filas)
    elif formato == "pdf":
        contenido = generar_pdf_reporte_asistencias(filas, fecha_desde, fecha_hasta)
    else:
        contenido = generar_csv_reporte_asistencias(filas)
    return Response(
        content=contenido,
        media_type=_MEDIA_TYPE_POR_FORMATO[formato],
        headers={"Content-Disposition": f'attachment; filename="{nombre_base}.{formato}"'},
    )


@router.get("/asistencias/{asistencia_id}", response_model=AsistenciaResponse)
def obtener_asistencia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_LEER))],
    rol_activo: RolActivo,
    asistencia: Asistencia = Depends(obtener_asistencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Asistencia:
    """Obtener un registro de asistencia por su ID."""
    verificar_acceso_a_asistencia(db, asistencia, usuario.id, rol_activo)
    return asistencia


@router.put("/asistencias/{asistencia_id}", response_model=AsistenciaResponse)
def actualizar_asistencia_endpoint(
    datos: AsistenciaUpdate,
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ACTUALIZAR_ASISTENCIA))],
    rol_activo: RolActivo,
    asistencia: Asistencia = Depends(obtener_asistencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Asistencia:
    """Actualizar un registro de asistencia.

    El docente solo puede cambiar entre presente/tardanza/ausente.
    No puede modificar un registro ya justificado.
    """
    try:
        return actualizar_asistencia(db, asistencia, datos, usuario.id, rol_activo)
    except AsistenciaYaJustificada as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=exc.message) from exc


@router.delete("/asistencias/{asistencia_id}", status_code=204)
def eliminar_asistencia_endpoint(
    usuario: Annotated[Usuario, Depends(requiere_permiso(PERMISO_ACADEMICO_ELIMINAR))],
    rol_activo: RolActivo,
    asistencia: Asistencia = Depends(obtener_asistencia_o_404),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> None:
    """Eliminar un registro de asistencia."""
    eliminar_asistencia(db, asistencia, usuario.id, rol_activo)
