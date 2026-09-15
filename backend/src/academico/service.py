"""Lógica de negocio del módulo Académico."""

import csv
import logging
import uuid
from dataclasses import dataclass
from datetime import date, datetime
from io import BytesIO, StringIO

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.exceptions import (
    AnioConDivisiones,
    AnioDuplicado,
    AsignacionDocenteDuplicada,
    AsistenciaDuplicada,
    AsistenciaYaJustificada,
    CuentaSinPersona,
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
    AnioUpdate,
    AsignacionDocenteCreate,
    AsistenciaBulkCreate,
    AsistenciaBulkResponse,
    AsistenciaCreate,
    AsistenciaResumen,
    AsistenciaUpdate,
    DivisionCreate,
    DivisionUpdate,
    DocenteCreate,
    DocenteDesdeUsuarioCreate,
    DocenteUpdate,
    MateriaCreate,
    MateriaUpdate,
    NivelEducativoCreate,
    NivelEducativoUpdate,
)
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

ROL_DOCENTE = "docente"

logger = logging.getLogger(__name__)

# --- Asistencia --------------------------------------------------------------------------


_TIPO_DOCENTE_A_DB = {
    "presente": "presente",
    "tardanza": "tardanza",
    "ausente": "ausente_pendiente",
}

_TIPOS_JUSTIFICADOS = {"ausente_justificado", "ausente_injustificado"}
MAX_TAMANIO_COMPROBANTE_JUSTIFICACION = 5 * 1024 * 1024
TIPOS_COMPROBANTE_JUSTIFICACION_PERMITIDOS = {
    "application/pdf",
    "image/jpeg",
    "image/png",
}


def _familia_del_usuario(db: Session, usuario: Usuario) -> Familia:
    familia = db.query(Familia).filter(Familia.persona_id == usuario.persona_id).first()
    if familia is None:
        raise PermisoDenegado("Tu cuenta no tiene una familia asociada")
    return familia


def asistencias_de_familia(db: Session, usuario: Usuario, alumno_id: uuid.UUID) -> list[Asistencia]:
    familia = _familia_del_usuario(db, usuario)
    vinculo = (
        db.query(FamiliaAlumno)
        .filter(FamiliaAlumno.familia_id == familia.id, FamiliaAlumno.alumno_id == alumno_id)
        .first()
    )
    if vinculo is None:
        raise PermisoDenegado("No tenés acceso a este alumno")
    return (
        db.query(Asistencia)
        .join(Inscripcion)
        .filter(Inscripcion.alumno_id == alumno_id)
        .order_by(Asistencia.fecha.desc())
        .all()
    )


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
    if not any(registro.id == asistencia.id for registro in asistencias_propias):
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
        db.query(MotivoJustificacion).filter(MotivoJustificacion.nombre == motivo.strip()).first()
    )
    if motivo_db is None:
        motivo_db = MotivoJustificacion(nombre=motivo.strip(), activo=True)
        db.add(motivo_db)
        db.flush()
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
    db: Session, justificacion: JustificacionInasistencia, aprobar: bool
) -> JustificacionInasistencia:
    if justificacion.estado != "pendiente":
        raise HTTPException(status.HTTP_409_CONFLICT, "La justificación ya fue resuelta")
    justificacion.estado = "aprobada" if aprobar else "rechazada"
    justificacion.fecha_resolucion = datetime.now()
    asistencia = db.get(Asistencia, justificacion.asistencia_id)
    if asistencia is not None:
        asistencia.tipo = "ausente_justificado" if aprobar else "ausente_injustificado"
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
    for resp in responsables:
        logger.info(
            "Notificación de %s: alumno_id=%s fecha=%s familia_id=%s parentesco=%s",
            tipo,
            inscripcion.alumno_id,
            fecha,
            resp.familia_id,
            resp.parentesco,
        )
    return len(responsables)


def _docente_de(db: Session, usuario_id: uuid.UUID) -> Docente | None:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.persona_id is None:
        return None
    return db.query(Docente).filter(Docente.persona_id == usuario.persona_id).first()


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
    db: Session, usuario_id: uuid.UUID, division_id: uuid.UUID, rol_activo: str | None
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
    tiene_asignacion = docente is not None and (
        db.query(AsignacionDocente)
        .filter(
            AsignacionDocente.docente_id == docente.id,
            AsignacionDocente.division_id == division_id,
        )
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
        verificar_acceso_a_division(db, usuario_id, inscripcion.division_id, rol_activo)


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
    verificar_acceso_a_division(db, usuario_id, inscripcion.division_id, rol_activo)

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
    verificar_acceso_a_division(db, usuario_id, datos.division_id, rol_activo)

    creadas = 0
    actualizadas = 0
    notificaciones = 0

    for registro in datos.registros:
        inscripcion = db.get(Inscripcion, registro.inscripcion_id)
        if inscripcion is None or inscripcion.estado != "activa":
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
            existente.tipo = tipo_db
            actualizadas += 1
        else:
            nuevo = Asistencia(
                inscripcion_id=registro.inscripcion_id,
                fecha=datos.fecha,
                tipo=tipo_db,
            )
            db.add(nuevo)
            creadas += 1

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
        verificar_acceso_a_division(db, usuario_id, division_a_verificar, rol_activo)
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
    db.commit()
    db.refresh(asistencia)

    if tipo_db in {"ausente_pendiente", "tardanza"} and tipo_anterior != tipo_db:
        inscripcion = db.get(Inscripcion, asistencia.inscripcion_id)
        if inscripcion is not None:
            _notificar_asistencia(db, inscripcion, asistencia.fecha, tipo_db)

    return asistencia


def eliminar_asistencia(
    db: Session, asistencia: Asistencia, usuario_id: uuid.UUID, rol_activo: str | None
) -> None:
    """Eliminar un registro de asistencia."""
    verificar_acceso_a_asistencia(db, asistencia, usuario_id, rol_activo)
    db.delete(asistencia)
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
    verificar_acceso_a_division(db, usuario_id, inscripcion.division_id, rol_activo)

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


def crear_nivel_educativo(
    db: Session, datos: NivelEducativoCreate, usuario_id: uuid.UUID | None = None
) -> NivelEducativo:
    """Crear un nuevo nivel educativo. Valida nombre único."""
    if (
        db.scalar(select(NivelEducativo.id).where(NivelEducativo.nombre == datos.nombre.strip()))
        is not None
    ):
        raise NombreNivelDuplicado()

    nuevo = NivelEducativo(nombre=datos.nombre.strip())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_nivel_educativo_por_id(db: Session, nivel_id: uuid.UUID) -> NivelEducativo | None:
    """Obtener un nivel educativo por su ID."""
    return db.query(NivelEducativo).filter(NivelEducativo.id == nivel_id).first()


def listar_niveles_educativos(db: Session) -> list[NivelEducativo]:
    """Listar todos los niveles educativos ordenados por nombre."""
    return db.query(NivelEducativo).order_by(NivelEducativo.nombre).all()


def actualizar_nivel_educativo(
    db: Session,
    nivel: NivelEducativo,
    datos: NivelEducativoUpdate,
    usuario_id: uuid.UUID | None = None,
) -> NivelEducativo:
    """Actualizar un nivel educativo existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data and update_data["nombre"] != nivel.nombre:
        if (
            db.scalar(
                select(NivelEducativo.id).where(
                    NivelEducativo.nombre == update_data["nombre"].strip(),
                    NivelEducativo.id != nivel.id,
                )
            )
            is not None
        ):
            raise NombreNivelDuplicado()
        update_data["nombre"] = update_data["nombre"].strip()

    for field, value in update_data.items():
        setattr(nivel, field, value)

    db.commit()
    db.refresh(nivel)
    return nivel


def eliminar_nivel_educativo(
    db: Session, nivel: NivelEducativo, usuario_id: uuid.UUID | None = None
) -> None:
    """Eliminar un nivel educativo. Valida que no tenga años asociados."""
    tiene_anios = db.query(Anio).filter(Anio.nivel_educativo_id == nivel.id).first() is not None
    if tiene_anios:
        raise NivelEducativoConAnios()

    db.delete(nivel)
    db.commit()


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
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_anio_por_id(db: Session, anio_id: uuid.UUID) -> Anio | None:
    """Obtener un año por su ID."""
    return db.query(Anio).filter(Anio.id == anio_id).first()


def listar_anios(db: Session) -> list[Anio]:
    """Listar todos los años ordenados por número."""
    return db.query(Anio).order_by(Anio.numero).all()


def listar_anios_por_nivel(db: Session, nivel_educativo_id: uuid.UUID) -> list[Anio]:
    """Listar los años de un nivel educativo específico."""
    return (
        db.query(Anio)
        .filter(Anio.nivel_educativo_id == nivel_educativo_id)
        .order_by(Anio.numero)
        .all()
    )


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

    for field, value in update_data.items():
        setattr(anio, field, value)

    db.commit()
    db.refresh(anio)
    return anio


def eliminar_anio(db: Session, anio: Anio, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar un año. Valida que no tenga divisiones asociadas."""
    tiene_divisiones = db.query(Division).filter(Division.anio_id == anio.id).first() is not None
    if tiene_divisiones:
        raise AnioConDivisiones()

    db.delete(anio)
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
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_division_por_id(db: Session, division_id: uuid.UUID) -> Division | None:
    """Obtener una división por su ID."""
    return db.query(Division).filter(Division.id == division_id).first()


def listar_divisiones(db: Session) -> list[Division]:
    """Listar todas las divisiones."""
    return db.query(Division).order_by(Division.nombre).all()


def listar_divisiones_por_anio(db: Session, anio_id: uuid.UUID) -> list[Division]:
    """Listar las divisiones de un año específico."""
    return db.query(Division).filter(Division.anio_id == anio_id).order_by(Division.nombre).all()


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

    for field, value in update_data.items():
        setattr(division, field, value)

    db.commit()
    db.refresh(division)
    return division


def eliminar_division(db: Session, division: Division, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una división. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.division_id == division.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise DivisionConAsignaciones()

    db.delete(division)
    db.commit()


# --- Materia -----------------------------------------------------------------------------


def crear_materia(
    db: Session, datos: MateriaCreate, usuario_id: uuid.UUID | None = None
) -> Materia:
    """Crear una nueva materia.

    Valida que no exista otra materia con el mismo nombre para el mismo año
    y la misma división (incluyendo division_id = None).
    """
    if (
        db.scalar(
            select(Materia.id).where(
                Materia.nombre == datos.nombre.strip(),
                Materia.anio_id == datos.anio_id,
                Materia.division_id == datos.division_id,
            )
        )
        is not None
    ):
        raise MateriaDuplicada()

    nuevo = Materia(
        nombre=datos.nombre.strip(),
        tipo=datos.tipo,
        anio_id=datos.anio_id,
        division_id=datos.division_id,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


def obtener_materia_por_id(db: Session, materia_id: uuid.UUID) -> Materia | None:
    """Obtener una materia por su ID."""
    return db.query(Materia).filter(Materia.id == materia_id).first()


def listar_materias(db: Session) -> list[Materia]:
    """Listar todas las materias ordenadas por nombre."""
    return db.query(Materia).order_by(Materia.nombre).all()


def listar_materias_por_anio(db: Session, anio_id: uuid.UUID) -> list[Materia]:
    """Listar las materias de un año específico."""
    return db.query(Materia).filter(Materia.anio_id == anio_id).order_by(Materia.nombre).all()


def listar_materias_por_division(db: Session, division_id: uuid.UUID) -> list[Materia]:
    """Listar las materias de una división específica."""
    return (
        db.query(Materia).filter(Materia.division_id == division_id).order_by(Materia.nombre).all()
    )


def actualizar_materia(
    db: Session,
    materia: Materia,
    datos: MateriaUpdate,
    usuario_id: uuid.UUID | None = None,
) -> Materia:
    """Actualizar una materia existente."""
    update_data = datos.model_dump(exclude_unset=True)

    if "nombre" in update_data or "anio_id" in update_data or "division_id" in update_data:
        nombre_check = update_data.get("nombre", materia.nombre)
        anio_check = update_data.get("anio_id", materia.anio_id)
        division_check = update_data.get("division_id", materia.division_id)
        if isinstance(nombre_check, str):
            nombre_check = nombre_check.strip()
        if (
            db.scalar(
                select(Materia.id).where(
                    Materia.nombre == nombre_check,
                    Materia.anio_id == anio_check,
                    Materia.division_id == division_check,
                    Materia.id != materia.id,
                )
            )
            is not None
        ):
            raise MateriaDuplicada()
        if isinstance(update_data.get("nombre"), str):
            update_data["nombre"] = update_data["nombre"].strip()

    for field, value in update_data.items():
        setattr(materia, field, value)

    db.commit()
    db.refresh(materia)
    return materia


def eliminar_materia(db: Session, materia: Materia, usuario_id: uuid.UUID | None = None) -> None:
    """Eliminar una materia. Valida que no tenga asignaciones docentes."""
    tiene_asignaciones = (
        db.query(AsignacionDocente).filter(AsignacionDocente.materia_id == materia.id).first()
        is not None
    )
    if tiene_asignaciones:
        raise MateriaConAsignaciones()

    db.delete(materia)
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
    db.commit()
    db.refresh(nuevo)
    return nuevo


def crear_alta_docente(db: Session, datos: AltaDocenteCreate) -> tuple[Persona, Docente]:
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
    db.commit()
    db.refresh(persona)
    db.refresh(docente)
    return persona, docente


def crear_docente_desde_usuario(db: Session, datos: DocenteDesdeUsuarioCreate) -> Docente:
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
    """Listar todos los docentes ordenados por legajo."""
    return db.query(Docente).order_by(Docente.legajo).all()


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

    for field, value in update_data.items():
        setattr(docente, field, value)

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

    db.delete(docente)
    db.commit()


# --- AsignacionDocente -------------------------------------------------------------------


def crear_asignacion_docente(
    db: Session, datos: AsignacionDocenteCreate, usuario_id: uuid.UUID | None = None
) -> AsignacionDocente:
    """Asignar un docente a materia+división por ciclo lectivo.

    Valida que no exista ya una asignación para el mismo docente,
    materia, división y ciclo lectivo.
    """
    if (
        db.scalar(
            select(AsignacionDocente.id).where(
                AsignacionDocente.docente_id == datos.docente_id,
                AsignacionDocente.materia_id == datos.materia_id,
                AsignacionDocente.division_id == datos.division_id,
                AsignacionDocente.ciclo_lectivo == datos.ciclo_lectivo.strip(),
            )
        )
        is not None
    ):
        raise AsignacionDocenteDuplicada()

    nuevo = AsignacionDocente(
        ciclo_lectivo=datos.ciclo_lectivo.strip(),
        docente_id=datos.docente_id,
        materia_id=datos.materia_id,
        division_id=datos.division_id,
    )
    db.add(nuevo)
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
    """Listar asignaciones docentes con filtros opcionales."""
    query = db.query(AsignacionDocente)
    if ciclo_lectivo is not None:
        query = query.filter(AsignacionDocente.ciclo_lectivo == ciclo_lectivo)
    if docente_id is not None:
        query = query.filter(AsignacionDocente.docente_id == docente_id)
    if materia_id is not None:
        query = query.filter(AsignacionDocente.materia_id == materia_id)
    if division_id is not None:
        query = query.filter(AsignacionDocente.division_id == division_id)
    return query.order_by(AsignacionDocente.ciclo_lectivo).all()


def divisiones_de_persona(db: Session, persona_id: uuid.UUID) -> list[tuple[uuid.UUID, str]]:
    """Divisiones donde el docente ligado a `persona_id` tiene una asignación vigente.

    Usado por GET /academico/docentes/me/divisiones (usuario autenticado, sin depender de
    `academico.leer`: es un dato propio, no una consulta al módulo). Sin `relationship()` en
    los modelos: resuelve Docente → AsignacionDocente → Division/Anio con joins explícitos,
    distinct por división para no repetir una división con varias materias asignadas.
    """
    docente = db.query(Docente).filter(Docente.persona_id == persona_id).first()
    if docente is None:
        return []

    filas = (
        db.query(Division.id, Anio.numero, Division.nombre)
        .join(AsignacionDocente, AsignacionDocente.division_id == Division.id)
        .join(Anio, Anio.id == Division.anio_id)
        .filter(AsignacionDocente.docente_id == docente.id)
        .distinct()
        .order_by(Anio.numero, Division.nombre)
        .all()
    )
    return [(division_id, f"{numero}°{nombre}") for division_id, numero, nombre in filas]


def eliminar_asignacion_docente(
    db: Session, asignacion: AsignacionDocente, usuario_id: uuid.UUID | None = None
) -> None:
    """Desasignar un docente (eliminar la asignación docente)."""
    db.delete(asignacion)
    db.commit()
