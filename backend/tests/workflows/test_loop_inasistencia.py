"""Loop de inasistencias de la demo (#218): las reglas del seed de demo, de punta a punta.

Una inasistencia avisa a los responsables, un recordatorio sale `dias_despues` días más tarde si
sigue sin justificar, y la resolución de la justificación vuelve a avisar."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from src.academico.models import JustificacionInasistencia
from src.auth.models import Usuario
from src.models import EventLog
from src.workflows import despacho_service
from src.workflows.eventos_service import emit_event
from src.workflows.models import NotificacionTemplate, WorkflowExecution, WorkflowRule
from tests.workflows.conftest import _ahora, _asistencia


@pytest.fixture()
def demo(db_session, tipos_inasistencia, seed_demo):
    usuario = Usuario(
        email="demo@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    db_session.add(usuario)
    db_session.commit()
    seed_demo._ensure_reglas_inasistencia(db_session, usuario)
    # Las reglas son "de antes" que los eventos de la prueba.
    for regla in db_session.scalars(select(WorkflowRule)):
        regla.created_at = _ahora(db_session) - timedelta(days=60)
    db_session.commit()
    return usuario


def _emitir_registrada(db, asistencia, tipo_asistencia="ausente_pendiente"):
    evento = emit_event(
        db,
        tipo="inasistencia.registrada",
        entidad="asistencia",
        entidad_id=asistencia.id,
        payload={
            "alumno_nombre": "Cabral, Ana",
            "tipo_asistencia": tipo_asistencia,
            "fecha": "2027-03-03",
        },
    )
    db.commit()
    return evento


def _pasar_dias(db, evento, dias):
    evento.timestamp = _ahora(db) - timedelta(days=dias)
    db.commit()


def _asuntos(envios):
    return [asunto for _, asunto, _ in envios.enviados]


def test_el_seed_crea_las_plantillas_y_las_cuatro_reglas_sin_duplicar(db_session, demo, seed_demo):
    seed_demo._ensure_reglas_inasistencia(db_session, demo)

    reglas = {r.nombre: r for r in db_session.scalars(select(WorkflowRule))}
    assert sorted(reglas) == [
        "Inasistencia justificada: avisar a la familia",
        "Inasistencia sin justificar: recordatorio",
        "Inasistencia: avisar a la familia",
        "Tardanza: avisar a la familia",
    ]
    assert len(db_session.scalars(select(NotificacionTemplate)).all()) == 4
    assert {r.tipo_accion for r in reglas.values()} == {"notificar", "generar_recordatorio"}
    assert all(r.requiere_aprobacion_humana is False for r in reglas.values())
    recordatorio = reglas["Inasistencia sin justificar: recordatorio"]
    assert recordatorio.accion_config == {
        "destinatario": "responsables_habilitados",
        "dias_despues": 2,
    }


def test_una_inasistencia_avisa_a_los_responsables_y_todavia_no_recuerda(
    db_session, demo, familia, envios
):
    _emitir_registrada(db_session, _asistencia(db_session, familia))

    despacho_service.procesar_eventos_pendientes(db_session)
    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert envios.enviados == [
        (
            familia["email"],
            "Inasistencia de Cabral, Ana",
            "Les informamos que Cabral, Ana no asistió al colegio el 2027-03-03. "
            "Si corresponde, pueden presentar la justificación.",
        )
    ]


def test_una_tardanza_avisa_con_su_propio_mensaje_y_no_genera_recordatorio(
    db_session, demo, familia, envios
):
    evento = _emitir_registrada(
        db_session, _asistencia(db_session, familia, tipo="tardanza"), "tardanza"
    )

    despacho_service.procesar_eventos_pendientes(db_session)
    _pasar_dias(db_session, evento, 3)
    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert _asuntos(envios) == ["Llegada tarde de Cabral, Ana"]


def test_dos_dias_despues_sin_justificar_llega_el_recordatorio(db_session, demo, familia, envios):
    evento = _emitir_registrada(db_session, _asistencia(db_session, familia))
    despacho_service.procesar_eventos_pendientes(db_session)

    _pasar_dias(db_session, evento, 3)
    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert _asuntos(envios) == [
        "Inasistencia de Cabral, Ana",
        "Recordatorio: justificación de Cabral, Ana",
    ]
    assert {e[0] for e in envios.enviados} == {familia["email"]}


def test_si_se_justifica_antes_no_llega_el_recordatorio_pero_si_el_aviso_de_resolucion(
    db_session, demo, familia, envios
):
    asistencia = _asistencia(db_session, familia)
    registrada = _emitir_registrada(db_session, asistencia)
    despacho_service.procesar_eventos_pendientes(db_session)

    justificacion = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=familia["datos"]["familia_id"],
        motivo_justificacion_id=uuid.uuid4(),
        usuario_id=uuid.uuid4(),
        estado="aprobada",
    )
    db_session.add(justificacion)
    asistencia.tipo = "ausente_justificado"
    db_session.commit()
    emit_event(
        db_session,
        tipo="inasistencia.justificada",
        entidad="justificacion_inasistencia",
        entidad_id=justificacion.id,
        payload={
            "alumno_nombre": "Cabral, Ana",
            "motivo": "Enfermedad",
            "fecha_resolucion": "2027-03-04",
        },
    )
    db_session.commit()
    despacho_service.procesar_eventos_pendientes(db_session)
    _pasar_dias(db_session, registrada, 3)
    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert _asuntos(envios) == [
        "Inasistencia de Cabral, Ana",
        "Justificación de Cabral, Ana resuelta",
    ]
    cuerpo = envios.enviados[1][2]
    assert cuerpo == (
        "Se resolvió el 2027-03-04 la justificación de la inasistencia de Cabral, Ana. "
        "Motivo presentado: Enfermedad."
    )
    # El recordatorio se evaluó, vio que ya estaba resuelta y lo dejó dicho sin mandar nada.
    detalles = [
        e.detalle
        for e in db_session.scalars(select(WorkflowExecution))
        if e.detalle and e.detalle.startswith("No se envió")
    ]
    assert detalles == ["No se envió: la inasistencia ya está resuelta."]


def test_el_evento_no_se_vuelve_a_despachar_al_recordar(db_session, demo, familia, envios):
    evento = _emitir_registrada(db_session, _asistencia(db_session, familia))
    despacho_service.procesar_eventos_pendientes(db_session)
    _pasar_dias(db_session, evento, 3)

    despacho_service.procesar_recordatorios_vencidos(db_session)
    despacho_service.procesar_eventos_pendientes(db_session)
    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert len(envios.enviados) == 2
    db_session.refresh(evento)
    assert evento.estado == "procesado"
    assert db_session.scalars(select(EventLog).where(EventLog.estado == "pendiente")).all() == []
