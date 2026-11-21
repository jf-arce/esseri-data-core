"""Alta administrativa de justificaciones: nace aprobada y aplica la resolución."""

from datetime import date

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from src.academico import service
from src.academico.models import (
    Anio,
    Division,
    JustificacionInasistencia,
    MotivoJustificacion,
    NivelEducativo,
)
from src.auth.models import Usuario
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import AuditLog, EventLog, Persona
from src.notificaciones.models import NotificacionInterna


@pytest.fixture()
def escenario_alta(db_session, tipo_inasistencia_justificada):
    nivel = NivelEducativo(nombre="Primario")
    db_session.add(nivel)
    db_session.flush()
    anio = Anio(numero=4, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="A", anio_id=anio.id)
    persona_alumno = Persona(nombre="Ana", apellido="Prueba", dni="40111222")
    persona_familia = Persona(nombre="Andrés", apellido="Prueba", dni="30111222")
    db_session.add_all([division, persona_alumno, persona_familia])
    db_session.flush()
    alumno = Alumno(persona_id=persona_alumno.id, numero_legajo="A-1", estado="activo")
    familia = Familia(persona_id=persona_familia.id)
    db_session.add_all([alumno, familia])
    db_session.flush()
    db_session.add(
        FamiliaAlumno(
            familia_id=familia.id,
            alumno_id=alumno.id,
            responsable_principal=True,
        )
    )
    inscripcion = Inscripcion(
        alumno_id=alumno.id,
        division_id=division.id,
        ciclo_lectivo="2026",
        fecha_inscripcion=date(2026, 2, 1),
        tipo="nueva",
        estado="activa",
    )
    motivo = MotivoJustificacion(nombre="enfermedad", activo=True)
    admin = Usuario(email="admin.alta@example.test", estado="activo", auth_provider="local")
    db_session.add_all([inscripcion, motivo, admin])
    db_session.flush()
    asistencia = Asistencia(
        inscripcion_id=inscripcion.id,
        fecha=date(2026, 11, 10),
        tipo="ausente_pendiente",
    )
    db_session.add(asistencia)
    db_session.commit()
    return alumno, familia, admin, asistencia


def test_alta_administrativa_nace_aprobada_y_justifica_la_asistencia(db_session, escenario_alta):
    alumno, familia, admin, asistencia = escenario_alta
    justificacion = service.crear_justificacion_administrativa(
        db_session,
        admin,
        alumno.id,
        asistencia.fecha,
        "enfermedad",
        "Certificado presentado en Administración.",
    )

    assert justificacion.estado == "aprobada"
    assert justificacion.fecha_resolucion is not None
    assert justificacion.familia_id == familia.id
    assert justificacion.usuario_id == admin.id
    db_session.refresh(asistencia)
    assert asistencia.tipo == "ausente_justificado"

    campos = set(
        db_session.scalars(
            select(AuditLog.campo).where(
                AuditLog.entidad == "JUSTIFICACION_INASISTENCIA",
                AuditLog.entidad_id == justificacion.id,
            )
        ).all()
    )
    assert {"__alta_administrativa__", "estado"} <= campos

    evento = db_session.scalar(
        select(EventLog).where(
            EventLog.entidad == "justificacion_inasistencia",
            EventLog.entidad_id == justificacion.id,
        )
    )
    assert evento is not None

    # No se avisa al usuario administrativo que cargó el alta.
    assert (
        db_session.scalar(
            select(NotificacionInterna.id).where(NotificacionInterna.usuario_id == admin.id)
        )
        is None
    )

    with pytest.raises(HTTPException) as repetida:
        service.crear_justificacion_administrativa(
            db_session, admin, alumno.id, asistencia.fecha, "enfermedad", None
        )
    assert repetida.value.status_code == 409


def test_el_rechazo_reporta_su_estado_en_el_evento(db_session, escenario_alta):
    """El aviso por Workflows necesita saber el resultado, no solo que hubo una resolución."""
    alumno, familia, admin, asistencia = escenario_alta
    justificacion = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=familia.id,
        motivo_justificacion_id=db_session.scalar(
            select(MotivoJustificacion.id).where(MotivoJustificacion.nombre == "enfermedad")
        ),
        usuario_id=admin.id,
        estado="pendiente",
    )
    db_session.add(justificacion)
    db_session.commit()

    service.resolver_justificacion(db_session, justificacion, False, usuario_id=admin.id)

    evento = db_session.scalar(
        select(EventLog).where(
            EventLog.entidad == "justificacion_inasistencia",
            EventLog.entidad_id == justificacion.id,
        )
    )
    assert evento is not None
    assert evento.payload["estado"] == "rechazada"
