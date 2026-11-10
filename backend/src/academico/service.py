"""Lógica de negocio del módulo Académico."""

import csv
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO, StringIO

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload, selectinload

from src.academico.exceptions import (
    AnioConDivisiones,
    AnioConMaterias,
    AnioDuplicado,
    AsignacionDocenteDuplicada,
    AsistenciaDuplicada,
    AsistenciaYaJustificada,
    CuentaSinPersona,
    DivisionConAsignaciones,
    DivisionConInscripciones,
    DivisionConMaterias,
    DivisionDuplicada,
    DocenteConAsignaciones,
    InscripcionNoActiva,
    LegajoDuplicado,
    MateriaConCursos,
    MateriaCursoConAsignaciones,
    MateriaCursoDuplicada,
    MateriaDuplicada,
)
from src.academico.horarios_service import (
    validar_franjas_propias,
    validar_horarios_division,
    validar_horarios_docente,
)
from src.academico.models import (
    Anio,
    ArchivoJustificacionInasistencia,
    AsignacionDocente,
    Division,
    Docente,
    HorarioMateriaCurso,
    JustificacionInasistencia,
    Materia,
    MateriaCurso,
    MotivoJustificacion,
    NivelEducativo,
)
from src.academico.schemas import (
    AltaDocenteCreate,
    AnioCreate,
    AnioResponse,
    AnioUpdate,
    AsignacionDocenteBulkCreate,
    AsignacionDocenteBulkItem,
    AsignacionDocenteBulkResponse,
    AsignacionDocenteCreate,
    AsignacionDocenteResponse,
    AsignacionDocenteUpdate,
    AsistenciaBulkCreate,
    AsistenciaBulkResponse,
    AsistenciaCreate,
    AsistenciaResumen,
    AsistenciaUpdate,
    DivisionCreate,
    DivisionResponse,
    DivisionUpdate,
    DocenteCreate,
    DocenteDesdeUsuarioCreate,
    DocenteUpdate,
    MateriaCreate,
    MateriaCursoCreate,
    MateriaCursoResponse,
    MateriaCursoUpdate,
    MateriaResponse,
    MateriaUpdate,
    NivelEducativoResponse,
)
from src.auditoria.service import log_audit
from src.auth import autorizacion_service
from src.auth import usuarios_service as auth_usuarios_service
from src.auth.constants import (
    PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA,
    PERMISO_ACADEMICO_EXPORTAR,
)
from src.auth.exceptions import PermisoDenegado
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from src.search import normalizar_texto_busqueda
from src.workflows.eventos_service import emit_event

ROL_DOCENTE = "docente"

logger = logging.getLogger(__name__)

# --- Asistencia --------------------------------------------------------------------------


_TIPO_DOCENTE_A_DB = {
    "presente": "presente",
    "tardanza": "tardanza",
    "ausente": "ausente_pendiente",
}

_TIPOS_JUSTIFICADOS = {"ausente_justificado", "ausente_injustificado"}

# Según el README de Workflows, `inasistencia.registrada` se emite para ausente_pendiente y
# tardanza (no para presente), igual que la notificación a los responsables.
_TIPOS_CON_EVENTO = {"ausente_pendiente", "tardanza"}
MAX_TAMANIO_COMPROBANTE_JUSTIFICACION = 5 * 1024 * 1024
TIPOS_COMPROBANTE_JUSTIFICACION_PERMITIDOS = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}


@dataclass
class AsistenciaFamiliaDetalle:
    """Asistencia de un alumno vinculado y su justificación, si fue presentada."""

    asistencia: Asistencia
    justificacion: JustificacionInasistencia | None


def _familia_del_usuario(db: Session, usuario: Usuario) -> Familia:
    familia = db.query(Familia).filter(Familia.persona_id == usuario.persona_id).first()
    if familia is None:
        raise PermisoDenegado("Tu cuenta no tiene una familia asociada")
    return familia


def asistencias_de_familia(
    db: Session, usuario: Usuario, alumno_id: uuid.UUID
) -> list[AsistenciaFamiliaDetalle]:
    familia = _familia_del_usuario(db, usuario)
    vinculo = (
        db.query(FamiliaAlumno)
        .filter(FamiliaAlumno.familia_id == familia.id, FamiliaAlumno.alumno_id == alumno_id)
        .first()
    )
    if vinculo is None:
        raise PermisoDenegado("No tenés acceso a este alumno")
    registros = (
        db.query(Asistencia, JustificacionInasistencia)
        .join(Inscripcion)
        .outerjoin(
            JustificacionInasistencia,
            JustificacionInasistencia.asistencia_id == Asistencia.id,
        )
        .filter(Inscripcion.alumno_id == alumno_id)
        .order_by(Asistencia.fecha.desc())
        .all()
    )
    return [
        AsistenciaFamiliaDetalle(asistencia=asistencia, justificacion=justificacion)
        for asistencia, justificacion in registros
    ]


def justificar_asistencia_de_familia(
    db: Session,
    usuario: Usuario,
    asistencia: Asistencia,
    motivo: str,
    observacion: str | None,
    comprobante_nombre: str | None = None,
    comprobante_tipo_contenido: str | None = None,
    comprobante_contenido: bytes | None = None,
) -> JustificacionInasistencia:
    inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
    if inscripcion is None:
        raise PermisoDenegado()
    asistencias_propias = asistencias_de_familia(db, usuario, inscripcion.alumno_id)
    if not any(registro.asistencia.id == asistencia.id for registro in asistencias_propias):
        raise PermisoDenegado("No tenés acceso a esta ausencia")
    if asistencia.tipo != "ausente_pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo podés justificar ausencias pendientes")
    existe_justificacion = (
        db.query(JustificacionInasistencia)
        .filter(JustificacionInasistencia.asistencia_id == asistencia.id)
        .first()
    )
    if existe_justificacion:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esta ausencia ya tiene una justificación")
    _validar_comprobante_justificacion(
        nombre=comprobante_nombre,
        tipo_contenido=comprobante_tipo_contenido,
        contenido=comprobante_contenido,
    )
    motivo_db = (
        db.query(MotivoJustificacion)
        .filter(
            MotivoJustificacion.nombre == motivo.strip(),
            MotivoJustificacion.activo.is_(True),
        )
        .first()
    )
    if motivo_db is None:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "El motivo de la justificación no está disponible en el catálogo.",
        )
    justificacion = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=_familia_del_usuario(db, usuario).id,
        motivo_justificacion_id=motivo_db.id,
        usuario_id=usuario.id,
        observacion=observacion,
        archivo=comprobante_nombre,
    )
    if comprobante_contenido is not None:
        justificacion.archivo_adjunto = ArchivoJustificacionInasistencia(
            nombre=comprobante_nombre or "comprobante",
            tipo_contenido=comprobante_tipo_contenido or "application/octet-stream",
            tamanio=len(comprobante_contenido),
            contenido=comprobante_contenido,
        )
    db.add(justificacion)
    db.flush()
    log_audit(
        db,
        entidad="JUSTIFICACION_INASISTENCIA",
        entidad_id=justificacion.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=motivo_db.nombre,
        usuario_id=usuario.id,
    )
    db.commit()
    db.refresh(justificacion)
    return justificacion


def _validar_comprobante_justificacion(
    *, nombre: str | None, tipo_contenido: str | None, contenido: bytes | None
) -> None:
    if contenido is None:
        return
    firmas_validas = {
        "application/pdf": contenido.startswith(b"%PDF-"),
        "image/jpeg": contenido.startswith(b"\xff\xd8\xff"),
        "image/png": contenido.startswith(b"\x89PNG\r\n\x1a\n"),
    }
    if (
        not nombre
        or tipo_contenido not in TIPOS_COMPROBANTE_JUSTIFICACION_PERMITIDOS
        or not contenido
        or len(contenido) > MAX_TAMANIO_COMPROBANTE_JUSTIFICACION
        or not firmas_validas.get(tipo_contenido, False)
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "El comprobante debe ser un archivo PDF, JPG o PNG de hasta 5 MB.",
        )


def resolver_justificacion(
    db: Session,
    justificacion: JustificacionInasistencia,
    aprobar: bool,
    observacion: str | None = None,
    usuario_id: uuid.UUID | None = None,
) -> JustificacionInasistencia:
    if justificacion.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, "La justificación ya fue resuelta")
    estado_nuevo = "aprobada" if aprobar else "rechazada"
    justificacion.estado = estado_nuevo
    if not aprobar:
        justificacion.observacion = observacion
    justificacion.fecha_resolucion = datetime.now()
    asistencia = db.get(Asistencia, justificacion.asistencia_id)
    if asistencia is not None:
        asistencia.tipo = "ausente_justificado" if aprobar else "ausente_injustificado"
    log_audit(
        db,
        entidad="JUSTIFICACION_INASISTENCIA",
        entidad_id=justificacion.id,
        campo="estado",
        valor_anterior="pendiente",
        valor_nuevo=estado_nuevo,
        usuario_id=usuario_id,
    )
    motivo = db.get(MotivoJustificacion, justificacion.motivo_justificacion_id)
    inscripcion = db.get(Inscripcion, asistencia.inscripcion_id) if asistencia is not None else None
    emit_event(
        db,
        tipo="inasistencia.justificada",
        entidad="justificacion_inasistencia",
        entidad_id=justificacion.id,
        payload={
            "alumno_nombre": _nombre_alumno(db, inscripcion.alumno_id) if inscripcion else "",
            "motivo": motivo.nombre if motivo is not None else "",
            "fecha_resolucion": justificacion.fecha_resolucion.date().isoformat(),
        },
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(justificacion)
    return justificacion


def listar_justificaciones_pendientes(db: Session) -> list[JustificacionInasistencia]:
    return (
        db.query(JustificacionInasistencia)
        .filter(JustificacionInasistencia.estado == "pendiente")
        .order_by(JustificacionInasistencia.fecha_carga.asc())
        .all()
    )


def _notificar_asistencia(db: Session, inscripcion: Inscripcion, fecha: date, tipo: str) -> int:
    """Notificar a todos los responsables con recibe_comunicaciones=true.

    Placeholder: loggea la notificación. Cuando exista infraestructura de
    email/SMS/push, este función es el único punto a modificar.
    """
    responsables = (
        db.query(FamiliaAlumno)
        .filter(
            FamiliaAlumno.alumno_id == inscripcion.alumno_id,
            FamiliaAlumno.recibe_comunicaciones.is_(True),
        )
        .all()
    )
    if responsables:
        logger.info("Notificación académica preparada")
    return len(responsables)


def _nombre_alumno(db: Session, alumno_id: uuid.UUID) -> str:
    """Devuelve 'Apellido, Nombre' del alumno -- para el payload legible de `emit_event`, no
    para identificarlo (eso ya lo hace `entidad_id`)."""
    fila = db.execute(
        select(Persona.nombre, Persona.apellido)
        .join(Alumno, Alumno.persona_id == Persona.id)
        .where(Alumno.id == alumno_id)
    ).first()
    if fila is None:
        return ""
    nombre, apellido = fila
    return f"{apellido}, {nombre}"


def _docente_de(db: Session, usuario_id: uuid.UUID) -> Docente | None:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.persona_id is None:
        return None
    return db.query(Docente).filter(Docente.persona_id == usuario.persona_id).first()


def obtener_perfil_docente(db: Session, usuario_id: uuid.UUID) -> Persona | None:
    """Devolver solo la persona asociada al perfil docente autenticado."""
    docente = _docente_de(db, usuario_id)
    if docente is None:
        return None
    return db.get(Persona, docente.persona_id)


def _tiene_acceso_estructural(db: Session, usuario_id: uuid.UUID, rol_activo: str | None) -> bool:
    """El personal con `academico.actualizar` amplio, sin tipo (secretaría, coordinación
    académica, administrador del sistema) opera cualquier división. Se pide el código CON tipo
    (`..._ESTRUCTURA`, el mismo que exigen los endpoints de estructura) y no el código sin
    tipo: pedirlo sin tipo lo satisface cualquier variante tipada del usuario — incluida
    `..._ASISTENCIA`, la que tiene un docente — y volvería a filtrar la restricción que esto
    existe para poner (ver el comentario en `auth/constants.py`).

    También cuenta `academico.exportar` (RF-37): dirección tiene `Académico: leer, exportar`,
    sin `actualizar` de ningún tipo, y nunca va a tener una `AsignacionDocente` propia — sin
    esto quedaba del lado "acotado" pese a que exportar el historial institucional es
    justamente para lo que se le dio el permiso (antes era una limitación conocida y anotada
    acá mismo, sin consumidor real todavía; RF-37 es ese consumidor).

    A propósito NO se usa "¿tiene una fila en `Docente`?" como señal: un docente recién dado de
    alta, todavía sin esa fila cargada por RR.HH., tiene que seguir acotado a nada (deniega) en
    vez de leerse como "sin restricción".

    Se evalúa contra el ROL ACTIVO de la sesión, no la suma de roles de la cuenta (RF-30): una
    cuenta con docente + administración, actuando como docente, no hereda el acceso estructural
    de administración. `rol_activo=None` nunca pasa por acá en la práctica (`requiere_permiso`
    ya cortó antes), pero si pasara se trata como sin acceso, nunca como bypass."""
    if rol_activo is None:
        return False
    return autorizacion_service.tiene_permiso_en_rol(
        db, usuario_id, rol_activo, PERMISO_ACADEMICO_ACTUALIZAR_ESTRUCTURA
    ) or autorizacion_service.tiene_permiso_en_rol(
        db, usuario_id, rol_activo, PERMISO_ACADEMICO_EXPORTAR
    )


def verificar_acceso_a_division(
    db: Session,
    usuario_id: uuid.UUID,
    division_id: uuid.UUID,
    rol_activo: str | None,
    ciclo_lectivo: str | None = None,
) -> None:
    """RF-06: sin el `academico.actualizar` estructural (o sea, con solo el permiso tipado de
    asistencia — un docente), solo se opera sobre las divisiones con una `AsignacionDocente`
    vigente — sin esto, cualquier docente podía tomar/editar/leer asistencia de una división
    ajena con solo cambiar el `division_id` en la request. El resto de las cuentas (secretaría,
    coordinación académica, administrador del sistema, y desde RF-37 también dirección vía
    `academico.exportar`) no tiene esta restricción — ver `_tiene_acceso_estructural`."""
    if _tiene_acceso_estructural(db, usuario_id, rol_activo):
        return
    docente = _docente_de(db, usuario_id)
    filtros_asignacion = [
        AsignacionDocente.docente_id == docente.id if docente is not None else False,
        MateriaCurso.division_id == division_id,
    ]
    if ciclo_lectivo is not None:
        filtros_asignacion.append(AsignacionDocente.ciclo_lectivo == ciclo_lectivo)
    tiene_asignacion = docente is not None and (
        db.query(AsignacionDocente)
        .join(MateriaCurso, MateriaCurso.id == AsignacionDocente.materia_curso_id)
        .filter(*filtros_asignacion)
        .first()
        is not None
    )
    if not tiene_asignacion:
        raise PermisoDenegado("No tenés asignada esta división")


def verificar_acceso_a_asistencia(
    db: Session, asistencia: Asistencia, usuario_id: uuid.UUID, rol_activo: str | None
) -> None:
    """Variante de `verificar_acceso_a_division` a partir de un registro ya cargado (GET por id,
    actualizar, eliminar): resuelve la división vía su inscripción."""
    inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
    if inscripcion is not None:
        verificar_acceso_a_division(
            db, usuario_id, inscripcion.division_id, rol_activo, inscripcion.ciclo_lectivo
        )


def registrar_asistencia(
    db: Session, datos: AsistenciaCreate, usuario_id: uuid.UUID, rol_activo: str | None
) -> Asistencia:
    """Registrar asistencia diaria de un alumno.

    - presente/tardanza se guardan tal cual.
    - ausente se guarda como 'ausente_pendiente' y dispara notificación.
    """
    inscripcion = db.get(Inscripcion, datos.inscripcion_id)
    if inscripcion is None or inscripcion.estado != "activa":
        raise InscripcionNoActiva()
    verificar_acceso_a_division(
        db, usuario_id, inscripcion.division_id, rol_activo, inscripcion.ciclo_lectivo
    )

    existente = db.scalar(
        select(Asistencia.id).where(
            Asistencia.inscripcion_id == datos.inscripcion_id,
            Asistencia.fecha == datos.fecha,
        )
    )
    if existente is not None:
        raise AsistenciaDuplicada()

    tipo_db = _TIPO_DOCENTE_A_DB[datos.tipo]
    nuevo = Asistencia(
        inscripcion_id=datos.inscripcion_id,
        fecha=datos.fecha,
        tipo=tipo_db,
    )
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="ASISTENCIA",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=tipo_db,
        usuario_id=usuario_id,
    )
    if tipo_db in _TIPOS_CON_EVENTO:
        emit_event(
            db,
            tipo="inasistencia.registrada",
            entidad="asistencia",
            entidad_id=nuevo.id,
            payload={
                "alumno_nombre": _nombre_alumno(db, inscripcion.alumno_id),
                "tipo_asistencia": tipo_db,
                "fecha": datos.fecha.isoformat(),
            },
            usuario_id=usuario_id,
        )
    db.commit()
    db.refresh(nuevo)

    if tipo_db in {"ausente_pendiente", "tardanza"}:
        _notificar_asistencia(db, inscripcion, datos.fecha, tipo_db)

    return nuevo


def registrar_asistencia_masiva(
    db: Session, datos: AsistenciaBulkCreate, usuario_id: uuid.UUID, rol_activo: str | None
) -> AsistenciaBulkResponse:
    """Registrar asistencia de toda una división en una fecha.

    Si ya existe un registro para (inscripcion_id, fecha), se actualiza.
    Si no existe, se crea. Para 'ausente' se dispara notificación.
    """
    ciclo_lectivo = datos.ciclo_lectivo
    if ciclo_lectivo is None and datos.registros:
        inscripcion_referencia = db.get(Inscripcion, datos.registros[0].inscripcion_id)
        ciclo_lectivo = inscripcion_referencia.ciclo_lectivo if inscripcion_referencia else None
    verificar_acceso_a_division(db, usuario_id, datos.division_id, rol_activo, ciclo_lectivo)

    creadas = 0
    actualizadas = 0
    notificaciones = 0

    for registro in datos.registros:
        inscripcion = db.get(Inscripcion, registro.inscripcion_id)
        if inscripcion is None or inscripcion.estado != "activa":
            continue
        if ciclo_lectivo is not None and inscripcion.ciclo_lectivo != ciclo_lectivo:
            continue

        existente = (
            db.query(Asistencia)
            .filter(
                Asistencia.inscripcion_id == registro.inscripcion_id,
                Asistencia.fecha == datos.fecha,
            )
            .first()
        )

        tipo_db = _TIPO_DOCENTE_A_DB[registro.tipo]

        if existente is not None:
            if existente.tipo in _TIPOS_JUSTIFICADOS:
                continue
            tipo_anterior = existente.tipo
            existente.tipo = tipo_db
            log_audit(
                db,
                entidad="ASISTENCIA",
                entidad_id=existente.id,
                campo="tipo",
                valor_anterior=tipo_anterior,
                valor_nuevo=tipo_db,
                usuario_id=usuario_id,
            )
            actualizadas += 1
            asistencia_id = existente.id
            # Solo en la transición real: resubir el mismo bulk no debe volver a emitir el
            # evento para una fila que ya estaba en ese mismo tipo.
            emite_evento = tipo_db in _TIPOS_CON_EVENTO and tipo_anterior != tipo_db
        else:
            nuevo = Asistencia(
                inscripcion_id=registro.inscripcion_id,
                fecha=datos.fecha,
                tipo=tipo_db,
            )
            db.add(nuevo)
            db.flush()
            log_audit(
                db,
                entidad="ASISTENCIA",
                entidad_id=nuevo.id,
                campo="__alta__",
                valor_anterior=None,
                valor_nuevo=tipo_db,
                usuario_id=usuario_id,
            )
            creadas += 1
            asistencia_id = nuevo.id
            emite_evento = tipo_db in _TIPOS_CON_EVENTO

        if emite_evento:
            emit_event(
                db,
                tipo="inasistencia.registrada",
                entidad="asistencia",
                entidad_id=asistencia_id,
                payload={
                    "alumno_nombre": _nombre_alumno(db, inscripcion.alumno_id),
                    "tipo_asistencia": tipo_db,
                    "fecha": datos.fecha.isoformat(),
                },
                usuario_id=usuario_id,
            )

        if tipo_db in {"ausente_pendiente", "tardanza"}:
            notificaciones += _notificar_asistencia(db, inscripcion, datos.fecha, tipo_db)

    db.commit()
    return AsistenciaBulkResponse(
        creadas=creadas,
        actualizadas=actualizadas,
        notificaciones_disparadas=notificaciones,
    )


def obtener_asistencia_por_id(db: Session, asistencia_id: uuid.UUID) -> Asistencia | None:
    """Obtener un registro de asistencia por su ID."""
    return db.query(Asistencia).filter(Asistencia.id == asistencia_id).first()


def listar_asistencias(
    db: Session,
    usuario_id: uuid.UUID,
    rol_activo: str | None,
    inscripcion_id: uuid.UUID | None = None,
    fecha: date | None = None,
    fecha_desde: date | None = None,
    fecha_hasta: date | None = None,
    division_id: uuid.UUID | None = None,
    ciclo_lectivo: str | None = None,
) -> list[Asistencia]:
    """Listar registros de asistencia con filtros opcionales.

    Si se pasa fecha_desde/fecha_hasta se filtra por rango (inclusive).
    Si se pasa fecha exacta, filtra por ese día.

    Para un docente (RF-06), el alcance tiene que resolverse a una división puntual antes de
    consultar: sin `division_id` ni `inscripcion_id` no hay nada que verificar contra sus
    `AsignacionDocente`, y dejarlo pasar sería listar asistencia de toda la institución.
    """
    division_a_verificar = division_id
    if division_a_verificar is None and inscripcion_id is not None:
        inscripcion_filtro = db.get(Inscripcion, inscripcion_id)
        division_a_verificar = inscripcion_filtro.division_id if inscripcion_filtro else None

    if division_a_verificar is not None:
        ciclo_a_verificar = ciclo_lectivo
        if inscripcion_id is not None:
            inscripcion_filtro = db.get(Inscripcion, inscripcion_id)
            if inscripcion_filtro is not None:
                ciclo_a_verificar = inscripcion_filtro.ciclo_lectivo
        verificar_acceso_a_division(
            db, usuario_id, division_a_verificar, rol_activo, ciclo_a_verificar
        )
    elif not _tiene_acceso_estructural(db, usuario_id, rol_activo):
        raise PermisoDenegado("No tenés asignada esta división")

    query = db.query(Asistencia)
    if inscripcion_id is not None:
        query = query.filter(Asistencia.inscripcion_id == inscripcion_id)
    if fecha is not None:
        query = query.filter(Asistencia.fecha == fecha)
    if fecha_desde is not None:
        query = query.filter(Asistencia.fecha >= fecha_desde)
    if fecha_hasta is not None:
        query = query.filter(Asistencia.fecha <= fecha_hasta)
    if division_id is not None:
        query = query.join(Inscripcion).filter(Inscripcion.division_id == division_id)
    if ciclo_lectivo is not None:
        if division_id is not None and inscripcion_id is None:
            query = query.filter(Inscripcion.ciclo_lectivo == ciclo_lectivo)
    return query.order_by(Asistencia.fecha.desc()).all()


def actualizar_asistencia(
    db: Session,
    asistencia: Asistencia,
    datos: AsistenciaUpdate,
    usuario_id: uuid.UUID,
    rol_activo: str | None,
) -> Asistencia:
    """Actualizar un registro de asistencia.

    El docente solo puede cambiar entre presente/tardanza/ausente.
    No puede modificar un registro ya justificado.
    """
    verificar_acceso_a_asistencia(db, asistencia, usuario_id, rol_activo)
    if asistencia.tipo in _TIPOS_JUSTIFICADOS:
        raise AsistenciaYaJustificada()

    tipo_db = _TIPO_DOCENTE_A_DB[datos.tipo]
    tipo_anterior = asistencia.tipo
    asistencia.tipo = tipo_db
    log_audit(
        db,
        entidad="ASISTENCIA",
        entidad_id=asistencia.id,
        campo="tipo",
        valor_anterior=tipo_anterior,
        valor_nuevo=tipo_db,
        usuario_id=usuario_id,
    )

    inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
    emite_evento = tipo_db in _TIPOS_CON_EVENTO and tipo_anterior != tipo_db
    if emite_evento and inscripcion is not None:
        emit_event(
            db,
            tipo="inasistencia.registrada",
            entidad="asistencia",
            entidad_id=asistencia.id,
            payload={
                "alumno_nombre": _nombre_alumno(db, inscripcion.alumno_id),
                "tipo_asistencia": tipo_db,
                "fecha": asistencia.fecha.isoformat(),
            },
            usuario_id=usuario_id,
        )
    db.commit()
    db.refresh(asistencia)

    if tipo_db in {"ausente_pendiente", "tardanza"} and tipo_anterior != tipo_db:
        if inscripcion is not None:
            _notificar_asistencia(db, inscripcion, asistencia.fecha, tipo_db)

    return asistencia


def eliminar_asistencia(
    db: Session, asistencia: Asistencia, usuario_id: uuid.UUID, rol_activo: str | None
) -> None:
    """Eliminar un registro de asistencia."""
    verificar_acceso_a_asistencia(db, asistencia, usuario_id, rol_activo)
    asistencia_id = asistencia.id
    tipo_anterior = asistencia.tipo
    db.delete(asistencia)
    log_audit(
        db,
        entidad="ASISTENCIA",
        entidad_id=asistencia_id,
        campo="__eliminacion__",
        valor_anterior=tipo_anterior,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


def calcular_resumen_asistencia(
    db: Session,
    usuario_id: uuid.UUID,
    rol_activo: str | None,
    inscripcion_id: uuid.UUID,
    fecha_desde: date,
    fecha_hasta: date,
) -> AsistenciaResumen:
    """Calcular resumen de asistencia de un alumno en un período (RF-06).

    Devuelve conteos por tipo y porcentajes de presencia,
    ausencias justificadas vs. injustificadas.
    """
    inscripcion = db.get(Inscripcion, inscripcion_id)
    if inscripcion is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inscripción con ID {inscripcion_id} no encontrada",
        )
    verificar_acceso_a_division(
        db, usuario_id, inscripcion.division_id, rol_activo, inscripcion.ciclo_lectivo
    )

    registros = (
        db.query(Asistencia)
        .filter(
            Asistencia.inscripcion_id == inscripcion_id,
            Asistencia.fecha >= fecha_desde,
            Asistencia.fecha <= fecha_hasta,
        )
        .all()
    )

    total = len(registros)
    presentes = sum(1 for r in registros if r.tipo == "presente")
    tardanzas = sum(1 for r in registros if r.tipo == "tardanza")
    ausentes_pendientes = sum(1 for r in registros if r.tipo == "ausente_pendiente")
    ausentes_justificadas = sum(1 for r in registros if r.tipo == "ausente_justificado")
    ausentes_injustificadas = sum(1 for r in registros if r.tipo == "ausente_injustificado")

    total_ausentes = ausentes_pendientes + ausentes_justificadas + ausentes_injustificadas

    if total > 0:
        porcentaje_presencia = round((presentes + tardanzas) / total * 100, 2)
    else:
        porcentaje_presencia = 0.0

    if total_ausentes > 0:
        porcentaje_justificadas = round(ausentes_justificadas / total_ausentes * 100, 2)
        porcentaje_injustificadas = round(ausentes_injustificadas / total_ausentes * 100, 2)
    else:
        porcentaje_justificadas = 0.0
        porcentaje_injustificadas = 0.0

    return AsistenciaResumen(
        inscripcion_id=inscripcion_id,
        alumno_id=inscripcion.alumno_id,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        total_registros=total,
        presentes=presentes,
        tardanzas=tardanzas,
        ausentes_pendientes=ausentes_pendientes,
        ausentes_justificadas=ausentes_justificadas,
        ausentes_injustificadas=ausentes_injustificadas,
        porcentaje_presencia=porcentaje_presencia,
        porcentaje_justificadas=porcentaje_justificadas,
        porcentaje_injustificadas=porcentaje_injustificadas,
    )


_TIPOS_AUSENCIA = {
    "ausente_pendiente",
    "ausente_justificado",
    "ausente_injustificado",
}


def calcular_indicadores_inasistencia(registros: list[Asistencia]) -> tuple[int, int, bool]:
    """Cuenta ausencias reales y la racha más larga, ignorando fechas sin registro.

    Las tardanzas y presencias registradas cortan la racha; los tres estados de ausencia,
    incluidas las justificadas, cuentan para ambos umbrales.
    """
    ordenados = sorted(registros, key=lambda registro: registro.fecha)
    total_ausencias = sum(1 for registro in ordenados if registro.tipo in _TIPOS_AUSENCIA)
    racha = 0
    consecutivas = 0
    for registro in ordenados:
        if registro.tipo in _TIPOS_AUSENCIA:
            racha += 1
            consecutivas = max(consecutivas, racha)
        else:
            racha = 0
    return total_ausencias, consecutivas, total_ausencias >= 20 or consecutivas >= 5


def obtener_seguimiento_division_docente(
    db: Session,
    usuario_id: uuid.UUID,
    rol_activo: str | None,
    division_id: uuid.UUID,
    ciclo_lectivo: str,
) -> list[dict[str, object]]:
    """Indicadores por inscripción activa, acotados a división y ciclo autorizados."""
    verificar_acceso_a_division(db, usuario_id, division_id, rol_activo, ciclo_lectivo)
    anio = int(ciclo_lectivo)
    inscripciones = (
        db.query(Inscripcion.id)
        .filter(
            Inscripcion.division_id == division_id,
            Inscripcion.ciclo_lectivo == ciclo_lectivo,
            Inscripcion.estado == "activa",
        )
        .all()
    )
    inscripcion_ids = [fila.id for fila in inscripciones]
    if not inscripcion_ids:
        return []
    registros = (
        db.query(Asistencia)
        .filter(
            Asistencia.inscripcion_id.in_(inscripcion_ids),
            Asistencia.fecha >= date(anio, 1, 1),
            Asistencia.fecha <= date(anio, 12, 31),
        )
        .order_by(Asistencia.fecha.desc())
        .all()
    )
    por_inscripcion: dict[uuid.UUID, list[Asistencia]] = {}
    for registro in registros:
        por_inscripcion.setdefault(registro.inscripcion_id, []).append(registro)
    seguimiento = []
    for inscripcion_id in inscripcion_ids:
        registros_alumno = por_inscripcion.get(inscripcion_id, [])
        if not registros_alumno:
            continue
        total_ausencias, ausencias_consecutivas, reiterada = calcular_indicadores_inasistencia(
            registros_alumno
        )
        seguimiento.append(
            {
                "inscripcion_id": inscripcion_id,
                "total_ausencias": total_ausencias,
                "ausencias_consecutivas": ausencias_consecutivas,
                "inasistencia_reiterada": reiterada,
            }
        )
    return seguimiento


_ETIQUETA_TIPO_ASISTENCIA = {
    "presente": "Presente",
    "tardanza": "Tardanza",
    "ausente_pendiente": "Ausente pendiente",
    "ausente_justificado": "Ausente justificado",
    "ausente_injustificado": "Ausente injustificado",
}


@dataclass
class FilaReporteAsistencia:
    """Una fila del reporte de exportación (RF-37) — ya en formato de texto, listo para
    volcar a CSV/Excel/PDF sin que cada formato tenga que conocer el modelo de datos."""

    fecha: date
    alumno: str
    numero_legajo: str
    division: str
    estado: str


def listar_asistencias_reporte(
    db: Session,
    usuario_id: uuid.UUID,
    rol_activo: str | None,
    fecha_desde: date,
    fecha_hasta: date,
    division_id: uuid.UUID | None = None,
) -> list[FilaReporteAsistencia]:
    """Reporte institucional de asistencias en un período (RF-37), para exportar.

    A diferencia de `listar_asistencias`/`calcular_resumen_asistencia` (acotadas a una
    inscripción puntual), esto cruza todos los alumnos de la división elegida — o de toda la
    institución si no se especifica `division_id`, lo que solo pueden pedir las cuentas con
    acceso estructural (dirección, secretaría, coordinación académica, administrador del
    sistema): un docente jamás tiene el permiso `academico.exportar`, así que no llega acá,
    pero se deja el mismo chequeo que el resto de las consultas de asistencia por consistencia
    y por si el permiso se le llega a otorgar a un rol más acotado en el futuro.
    """
    if division_id is not None:
        verificar_acceso_a_division(db, usuario_id, division_id, rol_activo)
    elif not _tiene_acceso_estructural(db, usuario_id, rol_activo):
        raise PermisoDenegado("Elegí una división para exportar")

    query = (
        db.query(Asistencia, Persona, Alumno, Division)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .join(Alumno, Alumno.id == Inscripcion.alumno_id)
        .join(Persona, Persona.id == Alumno.persona_id)
        .join(Division, Division.id == Inscripcion.division_id)
        .filter(Asistencia.fecha >= fecha_desde, Asistencia.fecha <= fecha_hasta)
    )
    if division_id is not None:
        query = query.filter(Inscripcion.division_id == division_id)
    query = query.order_by(Asistencia.fecha.desc(), Persona.apellido, Persona.nombre)

    return [
        FilaReporteAsistencia(
            fecha=asistencia.fecha,
            alumno=f"{persona.apellido}, {persona.nombre}",
            numero_legajo=alumno.numero_legajo,
            division=division.nombre,
            estado=_ETIQUETA_TIPO_ASISTENCIA[asistencia.tipo],
        )
        for asistencia, persona, alumno, division in query.all()
    ]


_ENCABEZADOS_REPORTE_ASISTENCIA = ("Fecha", "Alumno", "Legajo", "División", "Estado")


def _filas_a_tablas(filas: list[FilaReporteAsistencia]) -> list[list[str]]:
    return [
        [
            fila.fecha.strftime("%d/%m/%Y"),
            fila.alumno,
            fila.numero_legajo,
            fila.division,
            fila.estado,
        ]
        for fila in filas
    ]


def generar_csv_reporte_asistencias(filas: list[FilaReporteAsistencia]) -> bytes:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(_ENCABEZADOS_REPORTE_ASISTENCIA)
    writer.writerows(_filas_a_tablas(filas))
    # BOM (utf-8-sig): sin esto, Excel en Windows abre los acentos rotos al no detectar UTF-8.
    return buffer.getvalue().encode("utf-8-sig")


def generar_xlsx_reporte_asistencias(filas: list[FilaReporteAsistencia]) -> bytes:
    from openpyxl import Workbook

    libro = Workbook()
    hoja = libro.active
    hoja.title = "Asistencias"
    hoja.append(_ENCABEZADOS_REPORTE_ASISTENCIA)
    for fila in _filas_a_tablas(filas):
        hoja.append(fila)
    for columna in hoja.columns:
        letra = columna[0].column_letter
        hoja.column_dimensions[letra].width = max(
            12, min(40, max(len(str(c.value or "")) for c in columna) + 2)
        )

    buffer = BytesIO()
    libro.save(buffer)
    return buffer.getvalue()


def generar_pdf_reporte_asistencias(
    filas: list[FilaReporteAsistencia], fecha_desde: date, fecha_hasta: date
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    violeta = colors.HexColor("#7E22B5")
    borde = colors.HexColor("#DED8E6")
    zebra = colors.HexColor("#F6F5F8")

    buffer = BytesIO()
    documento = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
    )
    estilos = getSampleStyleSheet()
    titulo = f"Historial de asistencia — {fecha_desde:%d/%m/%Y} a {fecha_hasta:%d/%m/%Y}"
    elementos = [Paragraph(titulo, estilos["Title"]), Spacer(1, 6 * mm)]

    tabla = Table([list(_ENCABEZADOS_REPORTE_ASISTENCIA), *_filas_a_tablas(filas)], repeatRows=1)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), violeta),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.5, borde),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, zebra]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    elementos.append(tabla)
    documento.build(elementos)
    return buffer.getvalue()


# --- NivelEducativo ----------------------------------------------------------------------


def obtener_nivel_educativo_por_id(db: Session, nivel_id: uuid.UUID) -> NivelEducativo | None:
    """Obtener un nivel educativo por su ID."""
    return db.query(NivelEducativo).filter(NivelEducativo.id == nivel_id).first()


def listar_niveles_educativos(db: Session) -> list[NivelEducativoResponse]:
    """Listar todos los niveles educativos con la cantidad de años de cada uno."""
    filas = (
        db.query(NivelEducativo, func.count(Anio.id).label("cantidad_anios"))
        .outerjoin(Anio, Anio.nivel_educativo_id == NivelEducativo.id)
        .group_by(NivelEducativo.id)
        .order_by(NivelEducativo.nombre)
        .all()
    )
    return [
        NivelEducativoResponse.model_validate(nivel).model_copy(
            update={"cantidad_anios": cantidad_anios}
        )
        for nivel, cantidad_anios in filas
    ]


# --- Anio --------------------------------------------------------------------------------


def crear_anio(db: Session, datos: AnioCreate, usuario_id: uuid.UUID | None = None) -> Anio:
    """Crear un nuevo año. Valida que no exista el mismo número para el nivel."""
    if (
        db.scalar(
            select(Anio.id).where(
                Anio.numero == datos.numero,
                Anio.nivel_educativo_id == datos.nivel_educativo_id,
            )
        )
        is not None
    ):
        raise AnioDuplicado()

    nuevo = Anio(**datos.model_dump())
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="ANIO",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=str(nuevo.numero),
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_anio_por_id(db: Session, anio_id: uuid.UUID) -> Anio | None:
    """Obtener un año por su ID."""
    return db.query(Anio).filter(Anio.id == anio_id).first()


def _query_anios_con_conteos(db: Session):
    """Años con cantidad de divisiones y materias asignadas a sus cursos."""
    return (
        db.query(
            Anio,
            func.count(func.distinct(Division.id)).label("cantidad_divisiones"),
            func.count(func.distinct(MateriaCurso.id)).label("cantidad_materias"),
        )
        .outerjoin(Division, Division.anio_id == Anio.id)
        .outerjoin(MateriaCurso, MateriaCurso.division_id == Division.id)
        .group_by(Anio.id)
    )


def _anios_con_conteos(db: Session, query) -> list[AnioResponse]:
    return [
        AnioResponse.model_validate(anio).model_copy(
            update={
                "cantidad_divisiones": cantidad_divisiones,
                "cantidad_materias": cantidad_materias,
            }
        )
        for anio, cantidad_divisiones, cantidad_materias in query.order_by(Anio.numero).all()
    ]


def listar_anios(db: Session) -> list[AnioResponse]:
    """Listar todos los años con sus cantidades de divisiones y materias."""
    return _anios_con_conteos(db, _query_anios_con_conteos(db))


def listar_anios_por_nivel(db: Session, nivel_educativo_id: uuid.UUID) -> list[AnioResponse]:
    """Listar los años de un nivel educativo con sus cantidades de divisiones y materias."""
    query = _query_anios_con_conteos(db).filter(Anio.nivel_educativo_id == nivel_educativo_id)
    return _anios_con_conteos(db, query)


def actualizar_anio(
    db: Session,
    anio: Anio,
    datos: AnioUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Anio:
    """Actualizar un año existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "numero" in update_data or "nivel_educativo_id" in update_data:
        numero_check = update_data.get("numero", anio.numero)
        nivel_check = update_data.get("nivel_educativo_id", anio.nivel_educativo_id)
        if (
            db.scalar(
                select(Anio.id).where(
                    Anio.numero == numero_check,
                    Anio.nivel_educativo_id == nivel_check,
                    Anio.id != anio.id,
                )
            )
            is not None
        ):
            raise AnioDuplicado()

    valores_anteriores = {campo: getattr(anio, campo) for campo in update_data}

    for field, value in update_data.items():
        setattr(anio, field, value)

    for campo, valor_nuevo in update_data.items():
        log_audit(
            db,
            entidad="ANIO",
            entidad_id=anio.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )

    db.commit()
    db.refresh(anio)
    return anio


def eliminar_anio(db: Session, anio: Anio, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un año. Valida que no tenga materias asignadas a sus divisiones ni divisiones."""
    tiene_materias = (
        db.query(MateriaCurso)
        .join(Division, Division.id == MateriaCurso.division_id)
        .filter(Division.anio_id == anio.id)
        .first()
        is not None
    )
    if tiene_materias:
        raise AnioConMaterias()

    tiene_divisiones = db.query(Division).filter(Division.anio_id == anio.id).first() is not None
    if tiene_divisiones:
        raise AnioConDivisiones()

    anio_id = anio.id
    numero = anio.numero
    db.delete(anio)
    log_audit(
        db,
        entidad="ANIO",
        entidad_id=anio_id,
        campo="__eliminacion__",
        valor_anterior=str(numero),
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- Division ----------------------------------------------------------------------------


def crear_division(
    db: Session, datos: DivisionCreate, usuario_id: uuid.UUID | None = None
) -> Division:
    """Crear una nueva división. Valida nombre único por año."""
    if (
        db.scalar(
            select(Division.id).where(
                Division.nombre == datos.nombre.strip(),
                Division.anio_id == datos.anio_id,
            )
        )
        is not None
    ):
        raise DivisionDuplicada()

    nuevo = Division(nombre=datos.nombre.strip(), anio_id=datos.anio_id)
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="DIVISION",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=nuevo.nombre,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_division_por_id(db: Session, division_id: uuid.UUID) -> Division | None:
    """Obtener una división por su ID."""
    return db.query(Division).filter(Division.id == division_id).first()


def _query_divisiones_con_conteos(db: Session):
    """Divisiones con cantidad de materias, inscriptos y asignaciones docentes."""
    return (
        db.query(
            Division,
            func.count(func.distinct(MateriaCurso.id)).label("cantidad_materias"),
            func.count(func.distinct(Inscripcion.id)).label("cantidad_inscripciones"),
            func.count(func.distinct(AsignacionDocente.id)).label("cantidad_asignaciones"),
        )
        .outerjoin(MateriaCurso, MateriaCurso.division_id == Division.id)
        .outerjoin(Inscripcion, Inscripcion.division_id == Division.id)
        .outerjoin(AsignacionDocente, AsignacionDocente.materia_curso_id == MateriaCurso.id)
        .group_by(Division.id)
    )


def _divisiones_con_conteos(query) -> list[DivisionResponse]:
    return [
        DivisionResponse.model_validate(division).model_copy(
            update={
                "cantidad_materias": cantidad_materias,
                "cantidad_inscripciones": cantidad_inscripciones,
                "cantidad_asignaciones": cantidad_asignaciones,
            }
        )
        for division, cantidad_materias, cantidad_inscripciones, cantidad_asignaciones in (
            query.order_by(Division.nombre).all()
        )
    ]


def listar_divisiones(db: Session) -> list[DivisionResponse]:
    """Listar todas las divisiones con sus conteos de dependencias."""
    return _divisiones_con_conteos(_query_divisiones_con_conteos(db))


def listar_divisiones_por_anio(db: Session, anio_id: uuid.UUID) -> list[DivisionResponse]:
    """Listar las divisiones de un año específico con sus conteos de dependencias."""
    query = _query_divisiones_con_conteos(db).filter(Division.anio_id == anio_id)
    return _divisiones_con_conteos(query)


def actualizar_division(
    db: Session,
    division: Division,
    datos: DivisionUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Division:
    """Actualizar una división existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data or "anio_id" in update_data:
        nombre_check = update_data.get("nombre", division.nombre)
        anio_check = update_data.get("anio_id", division.anio_id)
        if (
            db.scalar(
                select(Division.id).where(
                    Division.nombre
                    == (nombre_check.strip() if isinstance(nombre_check, str) else nombre_check),
                    Division.anio_id == anio_check,
                    Division.id != division.id,
                )
            )
            is not None
        ):
            raise DivisionDuplicada()
        if isinstance(nombre_check, str):
            update_data["nombre"] = nombre_check.strip()

    valores_anteriores = {campo: getattr(division, campo) for campo in update_data}

    for field, value in update_data.items():
        setattr(division, field, value)

    for campo, valor_nuevo in update_data.items():
        log_audit(
            db,
            entidad="DIVISION",
            entidad_id=division.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )

    db.commit()
    db.refresh(division)
    return division


def eliminar_division(db: Session, division: Division, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una división.

    Valida que no tenga materias propias, inscriptos ni asignaciones docentes: cualquiera de
    esas dependencias quedaría apuntando a una división inexistente.
    """
    tiene_materias = (
        db.query(MateriaCurso).filter(MateriaCurso.division_id == division.id).first() is not None
    )
    if tiene_materias:
        raise DivisionConMaterias()

    tiene_inscripciones = (
        db.query(Inscripcion).filter(Inscripcion.division_id == division.id).first() is not None
    )
    if tiene_inscripciones:
        raise DivisionConInscripciones()

    tiene_asignaciones = (
        db.query(AsignacionDocente)
        .join(MateriaCurso, MateriaCurso.id == AsignacionDocente.materia_curso_id)
        .filter(MateriaCurso.division_id == division.id)
        .first()
        is not None
    )
    if tiene_asignaciones:
        raise DivisionConAsignaciones()

    division_id = division.id
    nombre = division.nombre
    db.delete(division)
    log_audit(
        db,
        entidad="DIVISION",
        entidad_id=division_id,
        campo="__eliminacion__",
        valor_anterior=nombre,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- Materia (catálogo global) -----------------------------------------------------------


def _materia_duplicada(db: Session, nombre: str, excluir_id: uuid.UUID | None = None) -> bool:
    query = select(Materia.id).where(
        Materia.nombre_normalizado == normalizar_texto_busqueda(nombre.strip())
    )
    if excluir_id is not None:
        query = query.where(Materia.id != excluir_id)
    return db.scalar(query) is not None


def crear_materia(
    db: Session, datos: MateriaCreate, usuario_id: uuid.UUID | None = None
) -> Materia:
    """Crear una materia en el catálogo global.

    El duplicado se valida por nombre normalizado (sin mayúsculas ni acentos), porque la
    materia se crea una sola vez y después se reutiliza en todos los cursos.
    """
    nombre = datos.nombre.strip()
    if _materia_duplicada(db, nombre):
        raise MateriaDuplicada()

    nuevo = Materia(nombre=nombre, tipo=datos.tipo, color=datos.color)
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="MATERIA",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=nuevo.nombre,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_materia_por_id(db: Session, materia_id: uuid.UUID) -> Materia | None:
    """Obtener una materia del catálogo por su ID."""
    return db.query(Materia).filter(Materia.id == materia_id).first()


def _query_materias_con_conteos(db: Session):
    """Materias del catálogo con la cantidad de cursos a los que están asignadas."""
    cantidad_cursos = (
        select(func.count(MateriaCurso.id))
        .where(MateriaCurso.materia_id == Materia.id)
        .correlate(Materia)
        .scalar_subquery()
    )
    return db.query(Materia, cantidad_cursos.label("cantidad_cursos"))


def _materias_con_conteos(query) -> list[MateriaResponse]:
    return [
        MateriaResponse.model_validate(materia).model_copy(
            update={"cantidad_cursos": cantidad_cursos}
        )
        for materia, cantidad_cursos in query.order_by(Materia.nombre).all()
    ]


def listar_materias(db: Session) -> list[MateriaResponse]:
    """Listar el catálogo completo con la cantidad de cursos de cada materia."""
    return _materias_con_conteos(_query_materias_con_conteos(db))


def actualizar_materia(
    db: Session,
    materia: Materia,
    datos: MateriaUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Materia:
    """Actualizar una materia del catálogo."""
    update_data = datos.model_dump(exclude_unset=True)

    if update_data.get("nombre") is not None:
        update_data["nombre"] = update_data["nombre"].strip()
        if _materia_duplicada(db, update_data["nombre"], excluir_id=materia.id):
            raise MateriaDuplicada()

    valores_anteriores = {campo: getattr(materia, campo) for campo in update_data}

    for field, value in update_data.items():
        setattr(materia, field, value)

    for campo, valor_nuevo in update_data.items():
        log_audit(
            db,
            entidad="MATERIA",
            entidad_id=materia.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )

    db.commit()
    db.refresh(materia)
    return materia


def eliminar_materia(db: Session, materia: Materia, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una materia del catálogo. Valida que no esté asignada a cursos."""
    tiene_cursos = (
        db.query(MateriaCurso).filter(MateriaCurso.materia_id == materia.id).first() is not None
    )
    if tiene_cursos:
        raise MateriaConCursos()

    materia_id = materia.id
    nombre = materia.nombre
    db.delete(materia)
    log_audit(
        db,
        entidad="MATERIA",
        entidad_id=materia_id,
        campo="__eliminacion__",
        valor_anterior=nombre,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- MateriaCurso (materia asignada a un curso) ------------------------------------------


def _crear_horarios(materia_curso: MateriaCurso, horarios) -> None:
    for horario in horarios:
        materia_curso.horarios.append(
            HorarioMateriaCurso(
                dia_semana=horario.dia_semana,
                hora_inicio=horario.hora_inicio,
                hora_fin=horario.hora_fin,
            )
        )


def crear_materia_curso(
    db: Session, datos: MateriaCursoCreate, usuario_id: uuid.UUID | None = None
) -> MateriaCurso:
    """Asignar una materia del catálogo a un curso, con una o más franjas horarias.

    Acepta una materia existente (`materia_id`) o crear una nueva en el momento
    (`materia_nombre`); en ese último caso valida que el nombre no exista ya en el catálogo.
    """
    division = db.get(Division, datos.division_id)
    if division is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"División con ID {datos.division_id} no encontrada",
        )

    if datos.materia_id is not None:
        materia = db.get(Materia, datos.materia_id)
        if materia is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Materia con ID {datos.materia_id} no encontrada",
            )
    else:
        nombre = datos.materia_nombre.strip()
        if _materia_duplicada(db, nombre):
            raise MateriaDuplicada()
        materia = Materia(nombre=nombre, tipo=datos.materia_tipo)
        db.add(materia)
        db.flush()

    if (
        db.scalar(
            select(MateriaCurso.id).where(
                MateriaCurso.materia_id == materia.id,
                MateriaCurso.division_id == division.id,
            )
        )
        is not None
    ):
        raise MateriaCursoDuplicada()

    validar_franjas_propias(datos.horarios)
    validar_horarios_division(db, division.id, datos.horarios)

    nuevo = MateriaCurso(materia_id=materia.id, division_id=division.id)
    db.add(nuevo)
    _crear_horarios(nuevo, datos.horarios)
    db.flush()
    log_audit(
        db,
        entidad="MATERIA_CURSO",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=f"{materia.nombre} en {division.nombre}",
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_materia_curso_por_id(db: Session, materia_curso_id: uuid.UUID) -> MateriaCurso | None:
    """Obtener una materia asignada a un curso por su ID."""
    return db.query(MateriaCurso).filter(MateriaCurso.id == materia_curso_id).first()


def _query_materias_curso_con_conteos(db: Session):
    """Materias de curso con sus horarios y la cantidad de docentes asignados."""
    cantidad_asignaciones = (
        select(func.count(AsignacionDocente.id))
        .where(AsignacionDocente.materia_curso_id == MateriaCurso.id)
        .correlate(MateriaCurso)
        .scalar_subquery()
    )
    return db.query(
        MateriaCurso,
        cantidad_asignaciones.label("cantidad_asignaciones"),
    ).options(
        joinedload(MateriaCurso.materia),
        joinedload(MateriaCurso.division)
        .joinedload(Division.anio)
        .joinedload(Anio.nivel_educativo),
        selectinload(MateriaCurso.horarios),
    )


def _materias_curso_con_conteos(query) -> list[MateriaCursoResponse]:
    return [
        MateriaCursoResponse.model_validate(materia_curso).model_copy(
            update={"cantidad_asignaciones": cantidad_asignaciones}
        )
        for materia_curso, cantidad_asignaciones in query.order_by(MateriaCurso.id).all()
    ]


def listar_materias_curso(
    db: Session,
    division_id: uuid.UUID | None = None,
    anio_id: uuid.UUID | None = None,
    materia_id: uuid.UUID | None = None,
    nivel_educativo_id: uuid.UUID | None = None,
) -> list[MateriaCursoResponse]:
    """Listar las materias asignadas a cursos, con filtros opcionales."""
    query = _query_materias_curso_con_conteos(db)
    if division_id is not None:
        query = query.filter(MateriaCurso.division_id == division_id)
    if materia_id is not None:
        query = query.filter(MateriaCurso.materia_id == materia_id)
    if anio_id is not None or nivel_educativo_id is not None:
        query = query.join(Division, Division.id == MateriaCurso.division_id)
        if anio_id is not None:
            query = query.filter(Division.anio_id == anio_id)
        if nivel_educativo_id is not None:
            query = query.join(Anio, Anio.id == Division.anio_id).filter(
                Anio.nivel_educativo_id == nivel_educativo_id
            )
    return _materias_curso_con_conteos(query)


def actualizar_materia_curso(
    db: Session,
    materia_curso: MateriaCurso,
    datos: MateriaCursoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> MateriaCurso:
    """Actualizar la materia o los horarios de una materia ya asignada a un curso."""
    update_data = datos.model_dump(exclude_unset=True)

    if datos.horarios is not None:
        validar_franjas_propias(datos.horarios)
        validar_horarios_division(
            db, materia_curso.division_id, datos.horarios, excluir_materia_curso_id=materia_curso.id
        )
        for asignacion in materia_curso.asignaciones:
            validar_horarios_docente(
                db,
                asignacion.docente_id,
                asignacion.ciclo_lectivo,
                datos.horarios,
                excluir_materia_curso_id=materia_curso.id,
            )

    if update_data.get("materia_id") is not None:
        nueva_materia = db.get(Materia, update_data["materia_id"])
        if nueva_materia is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Materia con ID {update_data['materia_id']} no encontrada",
            )
        if (
            db.scalar(
                select(MateriaCurso.id).where(
                    MateriaCurso.materia_id == nueva_materia.id,
                    MateriaCurso.division_id == materia_curso.division_id,
                    MateriaCurso.id != materia_curso.id,
                )
            )
            is not None
        ):
            raise MateriaCursoDuplicada()
        log_audit(
            db,
            entidad="MATERIA_CURSO",
            entidad_id=materia_curso.id,
            campo="materia_id",
            valor_anterior=str(materia_curso.materia_id),
            valor_nuevo=str(nueva_materia.id),
            usuario_id=usuario_id,
        )
        materia_curso.materia_id = nueva_materia.id

    if datos.horarios is not None:
        materia_curso.horarios.clear()
        db.flush()
        _crear_horarios(materia_curso, datos.horarios)

    db.commit()
    db.refresh(materia_curso)
    return materia_curso


def eliminar_materia_curso(
    db: Session, materia_curso: MateriaCurso, usuario_id: uuid.UUID | None = None
) -> None:
    """Quitar una materia de un curso. Valida que no tenga docentes asignados."""
    tiene_asignaciones = (
        db.query(AsignacionDocente)
        .filter(AsignacionDocente.materia_curso_id == materia_curso.id)
        .first()
        is not None
    )
    if tiene_asignaciones:
        raise MateriaCursoConAsignaciones()

    materia_curso_id = materia_curso.id
    descripcion = f"{materia_curso.materia_nombre} en {materia_curso.division_nombre}"
    db.delete(materia_curso)
    log_audit(
        db,
        entidad="MATERIA_CURSO",
        entidad_id=materia_curso_id,
        campo="__eliminacion__",
        valor_anterior=descripcion,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- Docente -----------------------------------------------------------------------------


def crear_docente(
    db: Session, datos: DocenteCreate, usuario_id: uuid.UUID | None = None
) -> Docente:
    """Crear un nuevo docente. Valida legajo único."""
    if db.scalar(select(Docente.id).where(Docente.legajo == datos.legajo.strip())) is not None:
        raise LegajoDuplicado()

    nuevo = Docente(legajo=datos.legajo.strip(), persona_id=datos.persona_id)
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="DOCENTE",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=nuevo.legajo,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def crear_alta_docente(
    db: Session, datos: AltaDocenteCreate, usuario_id: uuid.UUID | None = None
) -> tuple[Persona, Docente]:
    """Crea Persona, Usuario (rol docente) y Docente en una única transacción.

    Mismo patrón que `crear_alta_familia` (`familias_alumnos/service.py`): el legajo se valida
    primero para no dejar Persona/Usuario a mitad de camino si está duplicado.
    """
    if db.scalar(select(Docente.id).where(Docente.legajo == datos.legajo.strip())) is not None:
        raise LegajoDuplicado()

    persona = Persona(
        nombre=datos.persona.nombre.strip(),
        apellido=datos.persona.apellido.strip(),
        dni=datos.persona.dni.strip(),
        telefono=datos.persona.telefono,
        sexo=datos.persona.sexo,
    )
    db.add(persona)
    db.flush()

    auth_usuarios_service.crear_cuenta(
        db,
        persona=persona,
        email=datos.acceso.email,
        password=datos.acceso.password,
        codigos_rol=[ROL_DOCENTE],
    )

    docente = Docente(legajo=datos.legajo.strip(), persona_id=persona.id)
    db.add(docente)
    db.flush()
    log_audit(
        db,
        entidad="DOCENTE",
        entidad_id=docente.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=docente.legajo,
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(persona)
    db.refresh(docente)
    return persona, docente


def crear_docente_desde_usuario(
    db: Session, datos: DocenteDesdeUsuarioCreate, usuario_id: uuid.UUID | None = None
) -> Docente:
    """Suma el rol docente (y su ficha) a una cuenta que ya existe, ej. una familia que también
    da clases. Idempotente en el rol: si la cuenta ya tenía `docente`, no falla."""
    usuario = db.get(Usuario, datos.usuario_id)
    if usuario is None or usuario.persona_id is None:
        raise CuentaSinPersona()

    if db.scalar(select(Docente.id).where(Docente.legajo == datos.legajo.strip())) is not None:
        raise LegajoDuplicado()

    docente = db.scalar(select(Docente).where(Docente.persona_id == usuario.persona_id))
    if docente is None:
        docente = Docente(legajo=datos.legajo.strip(), persona_id=usuario.persona_id)
        db.add(docente)
        db.flush()
        log_audit(
            db,
            entidad="DOCENTE",
            entidad_id=docente.id,
            campo="__alta__",
            valor_anterior=None,
            valor_nuevo=docente.legajo,
            usuario_id=usuario_id,
        )

    rol = db.scalar(select(Rol).where(Rol.codigo == ROL_DOCENTE))
    if rol is None:
        raise ValueError("No existe el rol docente")
    ya_tiene_rol = db.scalar(
        select(UsuarioRol.id).where(
            UsuarioRol.usuario_id == usuario.id, UsuarioRol.rol_id == rol.id
        )
    )
    if ya_tiene_rol is None:
        db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))

    db.commit()
    db.refresh(docente)
    return docente


def obtener_docente_por_id(db: Session, docente_id: uuid.UUID) -> Docente | None:
    """Obtener un docente por su ID."""
    return db.query(Docente).filter(Docente.id == docente_id).first()


def listar_docentes(db: Session) -> list[Docente]:
    """Listar todos los docentes ordenados por legajo, con nombre y apellido de la persona."""
    return db.query(Docente).options(joinedload(Docente.persona)).order_by(Docente.legajo).all()


def actualizar_docente(
    db: Session,
    docente: Docente,
    datos: DocenteUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Docente:
    """Actualizar un docente existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "legajo" in update_data and update_data["legajo"] != docente.legajo:
        if (
            db.scalar(
                select(Docente.id).where(
                    Docente.legajo == update_data["legajo"].strip(),
                    Docente.id != docente.id,
                )
            )
            is not None
        ):
            raise LegajoDuplicado()
        update_data["legajo"] = update_data["legajo"].strip()

    valores_anteriores = {campo: getattr(docente, campo) for campo in update_data}

    for field, value in update_data.items():
        setattr(docente, field, value)

    for campo, valor_nuevo in update_data.items():
        log_audit(
            db,
            entidad="DOCENTE",
            entidad_id=docente.id,
            campo=campo,
            valor_anterior=str(valores_anteriores[campo]) if valores_anteriores[campo] else None,
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )

    db.commit()
    db.refresh(docente)
    return docente


def eliminar_docente(db: Session, docente: Docente, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un docente. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.docente_id == docente.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise DocenteConAsignaciones()

    docente_id = docente.id
    legajo = docente.legajo
    db.delete(docente)
    log_audit(
        db,
        entidad="DOCENTE",
        entidad_id=docente_id,
        campo="__eliminacion__",
        valor_anterior=legajo,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()


# --- AsignacionDocente -------------------------------------------------------------------


def _asignacion_docente_existente(
    db: Session,
    docente_id: uuid.UUID,
    materia_curso_id: uuid.UUID,
    ciclo_lectivo: str,
    excluir_id: uuid.UUID | None = None,
) -> bool:
    query = select(AsignacionDocente.id).where(
        AsignacionDocente.docente_id == docente_id,
        AsignacionDocente.materia_curso_id == materia_curso_id,
        AsignacionDocente.ciclo_lectivo == ciclo_lectivo,
    )
    if excluir_id is not None:
        query = query.where(AsignacionDocente.id != excluir_id)
    return db.scalar(query) is not None


def _obtener_materia_curso_o_404(db: Session, materia_curso_id: uuid.UUID) -> MateriaCurso:
    materia_curso = db.get(MateriaCurso, materia_curso_id)
    if materia_curso is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Materia del curso con ID {materia_curso_id} no encontrada",
        )
    return materia_curso


def crear_asignacion_docente(
    db: Session, datos: AsignacionDocenteCreate, usuario_id: uuid.UUID | None = None
) -> AsignacionDocente:
    """Asignar un docente a una materia de curso por ciclo lectivo.

    El docente hereda materia, división y horario de la materia-curso; no se duplica esa
    información en la asignación.
    """
    materia_curso = _obtener_materia_curso_o_404(db, datos.materia_curso_id)

    if _asignacion_docente_existente(
        db,
        datos.docente_id,
        datos.materia_curso_id,
        datos.ciclo_lectivo.strip(),
    ):
        raise AsignacionDocenteDuplicada()

    validar_horarios_docente(
        db,
        datos.docente_id,
        datos.ciclo_lectivo.strip(),
        materia_curso.horarios,
        excluir_materia_curso_id=materia_curso.id,
    )

    nuevo = AsignacionDocente(
        ciclo_lectivo=datos.ciclo_lectivo.strip(),
        docente_id=datos.docente_id,
        materia_curso_id=datos.materia_curso_id,
    )
    db.add(nuevo)
    db.flush()
    log_audit(
        db,
        entidad="ASIGNACION_DOCENTE",
        entidad_id=nuevo.id,
        campo="__alta__",
        valor_anterior=None,
        valor_nuevo=(f"docente={nuevo.docente_id} materia_curso={nuevo.materia_curso_id}"),
        usuario_id=usuario_id,
    )
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_asignacion_docente_por_id(
    db: Session, asignacion_id: uuid.UUID
) -> AsignacionDocente | None:
    """Obtener una asignación docente por su ID."""
    return db.query(AsignacionDocente).filter(AsignacionDocente.id == asignacion_id).first()


def listar_asignaciones_docentes(
    db: Session,
    ciclo_lectivo: str | None = None,
    docente_id: uuid.UUID | None = None,
    materia_id: uuid.UUID | None = None,
    division_id: uuid.UUID | None = None,
) -> list[AsignacionDocente]:
    """Listar asignaciones docentes con filtros opcionales.

    `materia_id` y `division_id` filtran a través de la materia-curso, que es la fuente de
    verdad de la relación materia + curso.
    """
    query = db.query(AsignacionDocente).options(
        joinedload(AsignacionDocente.materia_curso).joinedload(MateriaCurso.materia),
        joinedload(AsignacionDocente.materia_curso)
        .joinedload(MateriaCurso.division)
        .joinedload(Division.anio)
        .joinedload(Anio.nivel_educativo),
        joinedload(AsignacionDocente.materia_curso).selectinload(MateriaCurso.horarios),
    )
    if ciclo_lectivo is not None:
        query = query.filter(AsignacionDocente.ciclo_lectivo == ciclo_lectivo)
    if docente_id is not None:
        query = query.filter(AsignacionDocente.docente_id == docente_id)
    if materia_id is not None or division_id is not None:
        query = query.join(MateriaCurso, MateriaCurso.id == AsignacionDocente.materia_curso_id)
        if materia_id is not None:
            query = query.filter(MateriaCurso.materia_id == materia_id)
        if division_id is not None:
            query = query.filter(MateriaCurso.division_id == division_id)
    return query.order_by(AsignacionDocente.ciclo_lectivo).all()


def actualizar_asignacion_docente(
    db: Session,
    asignacion: AsignacionDocente,
    datos: AsignacionDocenteUpdate,
    usuario_id: uuid.UUID | None = None,
) -> AsignacionDocente:
    """Actualizar una asignación docente existente.

    Revalida la materia-curso y que no quede duplicada contra otra asignación del mismo
    docente en el mismo ciclo.
    """
    update_data = datos.model_dump(exclude_unset=True)
    if not update_data:
        return asignacion

    if "ciclo_lectivo" in update_data and update_data["ciclo_lectivo"] is not None:
        update_data["ciclo_lectivo"] = update_data["ciclo_lectivo"].strip()

    if update_data.get("materia_curso_id") is not None:
        _obtener_materia_curso_o_404(db, update_data["materia_curso_id"])

    materia_curso_id = update_data.get("materia_curso_id", asignacion.materia_curso_id)
    docente_id = update_data.get("docente_id", asignacion.docente_id)
    ciclo_lectivo = update_data.get("ciclo_lectivo", asignacion.ciclo_lectivo)

    if _asignacion_docente_existente(
        db, docente_id, materia_curso_id, ciclo_lectivo, excluir_id=asignacion.id
    ):
        raise AsignacionDocenteDuplicada()

    validar_horarios_docente(
        db,
        docente_id,
        ciclo_lectivo,
        _obtener_materia_curso_o_404(db, materia_curso_id).horarios,
        excluir_materia_curso_id=materia_curso_id,
        excluir_asignacion_id=asignacion.id,
    )

    valores_anteriores = {campo: getattr(asignacion, campo) for campo in update_data}
    for campo, valor in update_data.items():
        setattr(asignacion, campo, valor)

    for campo, valor_nuevo in update_data.items():
        log_audit(
            db,
            entidad="ASIGNACION_DOCENTE",
            entidad_id=asignacion.id,
            campo=campo,
            valor_anterior=(
                str(valores_anteriores[campo]) if valores_anteriores[campo] is not None else None
            ),
            valor_nuevo=str(valor_nuevo) if valor_nuevo is not None else None,
            usuario_id=usuario_id,
        )

    db.commit()
    db.refresh(asignacion)
    return asignacion


def crear_asignaciones_docentes_bulk(
    db: Session, datos: AsignacionDocenteBulkCreate, usuario_id: uuid.UUID | None = None
) -> AsignacionDocenteBulkResponse:
    """Asignar un docente a varias materias de curso en un solo alta.

    Las combinaciones ya existentes se omiten (no rompen el alta completa) y se devuelven en
    `omitidas` para que la UI pueda avisar qué quedó sin crear.
    """
    ciclo_lectivo = datos.ciclo_lectivo.strip()
    creadas: list[AsignacionDocente] = []
    omitidas: list[AsignacionDocenteBulkItem] = []
    vistas: set[uuid.UUID] = set()

    for item in datos.items:
        if item.materia_curso_id in vistas:
            omitidas.append(item)
            continue
        vistas.add(item.materia_curso_id)

        materia_curso = _obtener_materia_curso_o_404(db, item.materia_curso_id)
        if _asignacion_docente_existente(
            db, datos.docente_id, item.materia_curso_id, ciclo_lectivo
        ):
            omitidas.append(item)
            continue

        validar_horarios_docente(
            db,
            datos.docente_id,
            ciclo_lectivo,
            materia_curso.horarios,
            excluir_materia_curso_id=materia_curso.id,
        )

        nueva = AsignacionDocente(
            ciclo_lectivo=ciclo_lectivo,
            docente_id=datos.docente_id,
            materia_curso_id=item.materia_curso_id,
        )
        db.add(nueva)
        db.flush()
        log_audit(
            db,
            entidad="ASIGNACION_DOCENTE",
            entidad_id=nueva.id,
            campo="__alta__",
            valor_anterior=None,
            valor_nuevo=(f"docente={nueva.docente_id} materia_curso={nueva.materia_curso_id}"),
            usuario_id=usuario_id,
        )
        creadas.append(nueva)

    db.commit()
    for asignacion in creadas:
        db.refresh(asignacion)

    return AsignacionDocenteBulkResponse(
        creadas=[AsignacionDocenteResponse.model_validate(a) for a in creadas],
        omitidas=omitidas,
    )


def divisiones_de_persona(
    db: Session, persona_id: uuid.UUID, ciclo_lectivo: str | None = None
) -> list[tuple[uuid.UUID, str, int, str, int]]:
    """Divisiones donde el docente ligado a `persona_id` tiene una asignación vigente.

    Usado por GET /academico/docentes/me/divisiones (usuario autenticado, sin depender de
    `academico.leer`: es un dato propio, no una consulta al módulo). Sin `relationship()` en
    los modelos: resuelve Docente → AsignacionDocente → Division/Anio con joins explícitos,
    agrupando por división para no repetirla con varias materias asignadas y contando esas
    materias (`cantidad_materias`) para mostrarlas en el portal docente.

    `Division.nombre` ya es la etiqueta completa ("1°A", "3°C" — ver `nivel-seccion.tsx` y sus
    tests), no un sufijo suelto: anteponerle `Anio.numero` duplicaba el año ("1°3°C"). `numero`
    se sigue trayendo solo para poder ordenar por año antes que por nombre.
    """
    docente = db.query(Docente).filter(Docente.persona_id == persona_id).first()
    if docente is None:
        return []

    query = (
        db.query(
            Division.id,
            Anio.numero,
            Division.nombre,
            NivelEducativo.nombre,
            func.count(func.distinct(MateriaCurso.materia_id)).label("cantidad_materias"),
        )
        .join(AsignacionDocente, AsignacionDocente.materia_curso_id == MateriaCurso.id)
        .join(Division, Division.id == MateriaCurso.division_id)
        .join(Anio, Anio.id == Division.anio_id)
        .join(NivelEducativo, NivelEducativo.id == Anio.nivel_educativo_id)
        .filter(AsignacionDocente.docente_id == docente.id)
    )
    if ciclo_lectivo is not None:
        query = query.filter(AsignacionDocente.ciclo_lectivo == ciclo_lectivo)
    filas = (
        query.group_by(Division.id, Anio.numero, Division.nombre, NivelEducativo.nombre)
        .order_by(Anio.numero, Division.nombre)
        .all()
    )
    return [
        (division_id, nombre, numero, nivel, cantidad_materias)
        for division_id, numero, nombre, nivel, cantidad_materias in filas
    ]


def ultima_fecha_con_asistencias(
    db: Session, division_id: uuid.UUID, ciclo_lectivo: str | None = None
) -> date | None:
    """Última fecha con asistencias registradas en una división.

    Sirve para que la pantalla de asistencia pueda ofrecer "copiar la clase anterior" sin que
    el usuario tenga que recordar qué día se tomó lista por última vez.
    """
    query = (
        db.query(func.max(Asistencia.fecha))
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .filter(Inscripcion.division_id == division_id)
    )
    if ciclo_lectivo is not None:
        query = query.filter(Inscripcion.ciclo_lectivo == ciclo_lectivo)
    return query.scalar()


def eliminar_asignacion_docente(
    db: Session, asignacion: AsignacionDocente, usuario_id: uuid.UUID | None = None
) -> None:
    """Desasignar un docente (eliminar la asignación docente)."""
    asignacion_id = asignacion.id
    valor_anterior = (
        f"docente={asignacion.docente_id} materia={asignacion.materia_id} "
        f"division={asignacion.division_id}"
    )
    db.delete(asignacion)
    log_audit(
        db,
        entidad="ASIGNACION_DOCENTE",
        entidad_id=asignacion_id,
        campo="__eliminacion__",
        valor_anterior=valor_anterior,
        valor_nuevo=None,
        usuario_id=usuario_id,
    )
    db.commit()
