"""Productores académicos de la bandeja interna.

Insertan dentro de la transacción del comando académico, sin commit ni efectos externos. La
ausencia se identifica por inscripción y fecha calendario; la resolución, por la justificación
individual o la solicitud por período, nunca por la decisión ni el intento.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from src.academico.cobertura_ausencias_service import solicitud_periodo_que_cubre
from src.academico.models import JustificacionInasistencia, SolicitudAusenciaPeriodo
from src.auth.models import Rol, Usuario, UsuarioRol
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona
from src.notificaciones import service as notificaciones_service
from src.notificaciones.constants import (
    AMBITO_ACADEMICO,
    AMBITO_ADMINISTRACION,
    DESTINO_ASISTENCIA,
    DESTINO_JUSTIFICACION,
    DESTINO_JUSTIFICACION_INDIVIDUAL,
    DESTINO_SOLICITUD_PERIODO,
    ROL_FAMILIA,
    TIPO_INASISTENCIA_REGISTRADA,
    TIPO_JUSTIFICACION_APROBADA,
    TIPO_JUSTIFICACION_PENDIENTE,
    TIPO_JUSTIFICACION_RECHAZADA,
)
from src.notificaciones.destinatarios import cuentas_de_administracion


def _nombre_alumno(db: Session, alumno_id: uuid.UUID) -> str:
    fila = db.execute(
        select(Persona.nombre, Persona.apellido)
        .join(Alumno, Alumno.persona_id == Persona.id)
        .where(Alumno.id == alumno_id)
    ).first()
    if fila is None:
        return ""
    return f"{fila.apellido}, {fila.nombre}"


def _cuentas_responsables(db: Session, alumno_id: uuid.UUID) -> list[tuple[uuid.UUID, uuid.UUID]]:
    """Cuentas activas con rol Familia de los responsables habilitados, una por cuenta.

    Varias cuentas de la misma persona reciben cada una su propia notificación; una cuenta que
    aparece por más de un vínculo se resuelve una sola vez, con el primer `familia_id` estable.
    """
    filas = db.execute(
        select(Usuario.id, Familia.id)
        .join(Familia, Familia.persona_id == Usuario.persona_id)
        .join(FamiliaAlumno, FamiliaAlumno.familia_id == Familia.id)
        .join(UsuarioRol, UsuarioRol.usuario_id == Usuario.id)
        .join(Rol, Rol.id == UsuarioRol.rol_id)
        .where(
            FamiliaAlumno.alumno_id == alumno_id,
            FamiliaAlumno.recibe_comunicaciones.is_(True),
            Usuario.estado == "activo",
            Rol.codigo == ROL_FAMILIA,
        )
        .order_by(Usuario.id, Familia.id)
    ).all()
    por_cuenta: dict[uuid.UUID, uuid.UUID] = {}
    for usuario_id, familia_id in filas:
        por_cuenta.setdefault(usuario_id, familia_id)
    return list(por_cuenta.items())


def registrar_ausencia(db: Session, *, asistencia: Asistencia, inscripcion: Inscripcion) -> int:
    """Avisa una ausencia pendiente a cada responsable habilitado.

    No avisa tardanzas, ni ausencias ya cubiertas por una solicitud pendiente o aprobada.
    """
    if asistencia.tipo != "ausente_pendiente":
        return 0
    if (
        solicitud_periodo_que_cubre(db, alumno_id=inscripcion.alumno_id, fecha=asistencia.fecha)
        is not None
    ):
        return 0

    nombre = _nombre_alumno(db, inscripcion.alumno_id)
    mensaje = f"Se registró una inasistencia de {nombre} el {asistencia.fecha:%d/%m/%Y}."
    clave = f"academico:ausencia:{inscripcion.id}:{asistencia.fecha.isoformat()}"
    insertadas = 0
    for usuario_id, familia_id in _cuentas_responsables(db, inscripcion.alumno_id):
        insertadas += int(
            notificaciones_service.publicar(
                db,
                usuario_id=usuario_id,
                familia_id=familia_id,
                alumno_id=inscripcion.alumno_id,
                ambito=AMBITO_ACADEMICO,
                clave_hecho=clave,
                tipo=TIPO_INASISTENCIA_REGISTRADA,
                titulo="Inasistencia registrada",
                mensaje=mensaje,
                contexto={
                    "familia_id": str(familia_id),
                    "alumno_id": str(inscripcion.alumno_id),
                    "inscripcion_id": str(inscripcion.id),
                    "fecha": asistencia.fecha.isoformat(),
                },
                destino_tipo=DESTINO_ASISTENCIA,
                destino_id=asistencia.id,
            )
        )
    return insertadas


def registrar_justificacion_pendiente(
    db: Session,
    *,
    justificacion: JustificacionInasistencia,
    asistencia: Asistencia,
    inscripcion: Inscripcion,
    motivo: str,
) -> int:
    """Avisa a Administración que la familia envió una justificación individual."""
    nombre = _nombre_alumno(db, inscripcion.alumno_id)
    mensaje = (
        f"{nombre} presentó una justificación para la falta del "
        f"{asistencia.fecha:%d/%m/%Y}. Motivo: {motivo}."
    )
    clave = f"administracion:justificacion_pendiente:{justificacion.id}"
    insertadas = 0
    for usuario_id in cuentas_de_administracion(db):
        insertadas += int(
            notificaciones_service.publicar(
                db,
                usuario_id=usuario_id,
                familia_id=justificacion.familia_id,
                alumno_id=inscripcion.alumno_id,
                ambito=AMBITO_ADMINISTRACION,
                clave_hecho=clave,
                tipo=TIPO_JUSTIFICACION_PENDIENTE,
                titulo="Nueva justificación para revisar",
                mensaje=mensaje,
                contexto={
                    "familia_id": str(justificacion.familia_id),
                    "alumno_id": str(inscripcion.alumno_id),
                    "justificacion_id": str(justificacion.id),
                    "asistencia_id": str(asistencia.id),
                    "fecha": asistencia.fecha.isoformat(),
                    "motivo": motivo,
                },
                destino_tipo=DESTINO_JUSTIFICACION,
                destino_id=justificacion.id,
            )
        )
    return insertadas


def registrar_resolucion_individual(
    db: Session, *, justificacion: JustificacionInasistencia
) -> int:
    """Avisa al usuario y la familia exactos que cargaron la justificación."""
    if justificacion.estado not in {"aprobada", "rechazada"}:
        return 0
    fila = db.execute(
        select(Asistencia.id, Asistencia.fecha, Inscripcion.alumno_id)
        .join(Inscripcion, Inscripcion.id == Asistencia.inscripcion_id)
        .where(Asistencia.id == justificacion.asistencia_id)
    ).first()
    if fila is None:
        return 0
    usuario = db.get(Usuario, justificacion.usuario_id)
    if usuario is None or usuario.estado != "activo":
        return 0

    aprobada = justificacion.estado == "aprobada"
    nombre = _nombre_alumno(db, fila.alumno_id)
    mensaje = (
        f"Se {'aprobó' if aprobada else 'rechazó'} la justificación de la inasistencia de "
        f"{nombre} del {fila.fecha:%d/%m/%Y}."
    )
    return int(
        notificaciones_service.publicar(
            db,
            usuario_id=usuario.id,
            familia_id=justificacion.familia_id,
            alumno_id=fila.alumno_id,
            ambito=AMBITO_ACADEMICO,
            clave_hecho=f"academico:justificacion_individual:{justificacion.id}:resolucion",
            tipo=(TIPO_JUSTIFICACION_APROBADA if aprobada else TIPO_JUSTIFICACION_RECHAZADA),
            titulo="Justificación aprobada" if aprobada else "Justificación rechazada",
            mensaje=mensaje,
            contexto={
                "familia_id": str(justificacion.familia_id),
                "alumno_id": str(fila.alumno_id),
                "justificacion_id": str(justificacion.id),
                "asistencia_id": str(fila.id),
                "fecha_asistencia": fila.fecha.isoformat(),
            },
            destino_tipo=DESTINO_JUSTIFICACION_INDIVIDUAL,
            destino_id=justificacion.id,
        )
    )


def registrar_resolucion_periodo(db: Session, *, solicitud: SolicitudAusenciaPeriodo) -> int:
    """Una sola notificación por resolución, no una por cada día del período.

    La solicitud familiar guarda el usuario y la familia que la cargaron: ese es el destinatario
    exacto. Una carga administrativa futura sin cuenta familiar asociada no inventa un sustituto;
    además la bandeja revalida que la familia congelada siga perteneciendo a la cuenta.
    """
    if solicitud.estado not in {"aprobada", "rechazada"}:
        return 0
    usuario = db.get(Usuario, solicitud.usuario_id)
    if usuario is None or usuario.estado != "activo":
        return 0

    aprobada = solicitud.estado == "aprobada"
    nombre = _nombre_alumno(db, solicitud.alumno_id)
    mensaje = (
        f"Se {'aprobó' if aprobada else 'rechazó'} la solicitud de ausencia de {nombre} "
        f"del {solicitud.fecha_inicio:%d/%m/%Y} al {solicitud.fecha_fin:%d/%m/%Y}."
    )
    return int(
        notificaciones_service.publicar(
            db,
            usuario_id=usuario.id,
            familia_id=solicitud.familia_id,
            alumno_id=solicitud.alumno_id,
            ambito=AMBITO_ACADEMICO,
            clave_hecho=f"academico:solicitud_periodo:{solicitud.id}:resolucion",
            tipo=(TIPO_JUSTIFICACION_APROBADA if aprobada else TIPO_JUSTIFICACION_RECHAZADA),
            titulo=(
                "Solicitud de ausencia aprobada" if aprobada else "Solicitud de ausencia rechazada"
            ),
            mensaje=mensaje,
            contexto={
                "familia_id": str(solicitud.familia_id),
                "alumno_id": str(solicitud.alumno_id),
                "solicitud_id": str(solicitud.id),
                "fecha_inicio": solicitud.fecha_inicio.isoformat(),
                "fecha_fin": solicitud.fecha_fin.isoformat(),
            },
            destino_tipo=DESTINO_SOLICITUD_PERIODO,
            destino_id=solicitud.id,
        )
    )
