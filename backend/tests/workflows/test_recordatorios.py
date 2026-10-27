"""`generar_recordatorio` (#218): el despachador no la ejecuta al llegar el evento sino cuando se
cumplen sus `dias_despues`, y solo manda el aviso si la inasistencia sigue sin justificar."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select

from src.academico.models import JustificacionInasistencia
from src.auth.models import Usuario
from src.models import EventLog
from src.workflows import despacho_service, ejecuciones_service
from src.workflows.constants import VENTANA_RECORDATORIOS_DIAS
from src.workflows.exceptions import N8nEnvioFallido
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    ReglaDestinatario,
    WorkflowExecution,
    WorkflowRule,
)
from tests.workflows.conftest import _ahora, _asistencia

# --- Armado --------------------------------------------------------------------------------


@pytest.fixture()
def plantilla(db_session):
    plantilla = NotificacionTemplate(
        nombre="Recordatorio",
        asunto="Recordatorio: {{alumno_nombre}}",
        cuerpo="La inasistencia del {{fecha}} sigue sin justificar.",
    )
    db_session.add(plantilla)
    db_session.commit()
    return plantilla


def _regla(db, tipos, plantilla, *, config=None, condicion=None, **campos):
    datos = {
        "nombre": "Recordatorio de justificación",
        "condicion": condicion
        if condicion is not None
        else {"campo": "tipo_asistencia", "operador": "==", "valor": "ausente_pendiente"},
        "tipo_accion": "generar_recordatorio",
        "accion_config": config
        if config is not None
        else {"destinatario": "responsables_habilitados", "dias_despues": 2},
        "criticidad": "baja",
        "requiere_aprobacion_humana": False,
        "activo": True,
        "tipo_evento_id": tipos["registrada"].id,
        "notificacion_template_id": plantilla.id,
        # La regla existe de antes que los eventos: solo se recuerdan los posteriores a su alta.
        "created_at": _ahora(db) - timedelta(days=60),
    }
    regla = WorkflowRule(**{**datos, **campos})
    db.add(regla)
    db.commit()
    return regla


def _evento(db, tipos, asistencia, *, hace_dias, tipo_asistencia="ausente_pendiente"):
    """Un evento ya procesado, registrado `hace_dias` días atrás."""
    evento = EventLog(
        actor_tipo="sistema",
        entidad="asistencia",
        entidad_id=asistencia.id,
        payload={
            "alumno_nombre": "Cabral, Ana",
            "fecha": "2027-03-03",
            "tipo_asistencia": tipo_asistencia,
        },
        tipo_evento_id=tipos["registrada"].id,
        estado="procesado",
        timestamp=_ahora(db) - timedelta(days=hace_dias),
    )
    db.add(evento)
    db.commit()
    return evento


# --- El despachador espera --------------------------------------------------------------------


def test_el_despachador_no_ejecuta_el_recordatorio_al_llegar_el_evento(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    asistencia = _asistencia(db_session, familia)
    evento = _evento(db_session, tipos_inasistencia, asistencia, hace_dias=0)
    evento.estado = "pendiente"
    db_session.commit()

    resumen = despacho_service.procesar_eventos_pendientes(db_session)

    assert (resumen.eventos_procesados, resumen.ejecuciones_creadas) == (1, 0)
    db_session.refresh(evento)
    assert evento.estado == "procesado"
    assert db_session.scalars(select(WorkflowExecution)).all() == []
    assert envios.enviados == []


def test_antes_de_cumplirse_los_dias_no_se_manda_nada(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=1)

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 0

    assert db_session.scalars(select(WorkflowExecution)).all() == []
    assert envios.enviados == []


def test_al_cumplirse_los_dias_manda_el_recordatorio_a_los_responsables(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    regla = _regla(db_session, tipos_inasistencia, plantilla)
    evento = _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    ejecutadas = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert ejecutadas == 1
    assert envios.enviados == [
        (
            familia["email"],
            "Recordatorio: Cabral, Ana",
            "La inasistencia del 2027-03-03 sigue sin justificar.",
        )
    ]
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert (ejecucion.workflow_rule_id, ejecucion.event_log_id) == (regla.id, evento.id)
    assert ejecucion.estado == "exitoso"
    assert len(db_session.scalars(select(Notificacion)).all()) == 1


def test_el_recordatorio_se_manda_una_sola_vez(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    primera = despacho_service.procesar_recordatorios_vencidos(db_session)
    segunda = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert (primera, segunda) == (1, 0)
    assert len(envios.enviados) == 1
    assert len(db_session.scalars(select(WorkflowExecution)).all()) == 1


def test_sin_dias_despues_el_recordatorio_es_al_dia_siguiente(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(
        db_session,
        tipos_inasistencia,
        plantilla,
        config={"destinatario": "responsables_habilitados"},
    )
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=2)

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 1


# --- Solo si todavía corresponde ---------------------------------------------------------------


def _con_justificacion_cargada(db, familia, asistencia):
    db.add(
        JustificacionInasistencia(
            asistencia_id=asistencia.id,
            familia_id=familia["datos"]["familia_id"],
            motivo_justificacion_id=uuid.uuid4(),
            usuario_id=uuid.uuid4(),
        )
    )
    db.commit()


def _resuelta_como_justificada(db, familia, asistencia):
    asistencia.tipo = "ausente_justificado"
    db.commit()


def _resuelta_como_injustificada(db, familia, asistencia):
    asistencia.tipo = "ausente_injustificado"
    db.commit()


def _borrada(db, familia, asistencia):
    db.delete(asistencia)
    db.commit()


@pytest.mark.parametrize(
    ("cambio", "motivo"),
    [
        (_con_justificacion_cargada, "la familia ya cargó una justificación"),
        (_resuelta_como_justificada, "la inasistencia ya está resuelta"),
        (_resuelta_como_injustificada, "la inasistencia ya está resuelta"),
        (_borrada, "la asistencia ya no existe"),
    ],
)
def test_si_ya_no_corresponde_no_manda_nada_y_lo_deja_dicho(
    db_session, tipos_inasistencia, familia, plantilla, envios, cambio, motivo
):
    _regla(db_session, tipos_inasistencia, plantilla)
    asistencia = _asistencia(db_session, familia)
    _evento(db_session, tipos_inasistencia, asistencia, hace_dias=3)
    cambio(db_session, familia, asistencia)

    ejecutadas = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert ejecutadas == 1
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    # No es una falla: pasó el tiempo y lo que se iba a recordar ya se resolvió.
    assert ejecucion.estado == "exitoso"
    assert ejecucion.detalle == f"No se envió: {motivo}."
    assert envios.enviados == []
    assert db_session.scalars(select(Notificacion)).all() == []


# --- Qué eventos se miran ----------------------------------------------------------------------


def test_una_regla_creada_despues_del_evento_no_lo_recuerda(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla, created_at=_ahora(db_session))
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=5)

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 0
    assert envios.enviados == []


def test_un_evento_mas_viejo_que_la_ventana_no_se_recuerda(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    dentro = 2 + VENTANA_RECORDATORIOS_DIAS - 1
    fuera = 2 + VENTANA_RECORDATORIOS_DIAS + 1
    reciente = _evento(
        db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=dentro
    )
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=fuera)

    ejecutadas = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert ejecutadas == 1
    assert db_session.scalars(select(WorkflowExecution)).one().event_log_id == reciente.id


def test_un_evento_que_no_cumple_la_condicion_no_deja_ejecucion(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    tardanza = _asistencia(db_session, familia, tipo="tardanza")
    _evento(db_session, tipos_inasistencia, tardanza, hace_dias=3, tipo_asistencia="tardanza")

    primera = despacho_service.procesar_recordatorios_vencidos(db_session)
    segunda = despacho_service.procesar_recordatorios_vencidos(db_session)

    assert (primera, segunda) == (0, 0)
    assert db_session.scalars(select(WorkflowExecution)).all() == []
    assert envios.enviados == []


def test_una_regla_inactiva_no_recuerda(db_session, tipos_inasistencia, familia, plantilla, envios):
    _regla(db_session, tipos_inasistencia, plantilla, activo=False)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 0


def test_un_evento_que_el_despachador_no_proceso_todavia_no_se_recuerda(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    evento = _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)
    evento.estado = "fallido"
    db_session.commit()

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 0


def test_el_limite_corta_la_pasada_y_la_siguiente_sigue(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    for _ in range(3):
        _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    primera = despacho_service.procesar_recordatorios_vencidos(db_session, limite=2)
    segunda = despacho_service.procesar_recordatorios_vencidos(db_session, limite=2)

    assert (primera, segunda) == (2, 1)


# --- Con las demás reglas del motor ------------------------------------------------------------


def test_el_recordatorio_con_aprobacion_humana_queda_pendiente(
    db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla, requiere_aprobacion_humana=True)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    despacho_service.procesar_recordatorios_vencidos(db_session)

    assert db_session.scalars(select(WorkflowExecution)).one().estado == "pendiente"
    assert envios.enviados == []


def test_si_el_envio_falla_la_ejecucion_queda_fallida_y_se_puede_reintentar(
    db_session, tipos_inasistencia, familia, plantilla, envios, usuario_workflows
):
    _regla(db_session, tipos_inasistencia, plantilla)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)
    envios.fallar[familia["email"]] = N8nEnvioFallido("rechazado")

    despacho_service.procesar_recordatorios_vencidos(db_session)

    fallida = db_session.scalars(select(WorkflowExecution)).one()
    assert fallida.estado == "fallido"
    envios.fallar.clear()

    reintento = ejecuciones_service.reintentar_ejecucion(
        db_session, fallida.id, usuario_workflows.id
    )

    assert (reintento.intento, reintento.estado) == (2, "exitoso")
    assert [e[0] for e in envios.enviados] == [familia["email"]]


def test_un_recordatorio_de_otro_evento_se_manda_sin_mas_condiciones(
    db_session, tipo_factura_vencida, envios
):
    destinatario = Usuario(
        email="destino@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    plantilla = NotificacionTemplate(
        nombre="Mora", asunto="Deuda de {{nombre_familia}}", cuerpo="Debe {{monto_deuda}}"
    )
    db_session.add_all([destinatario, plantilla])
    db_session.flush()
    regla = WorkflowRule(
        nombre="Recordar mora",
        condicion={},
        tipo_accion="generar_recordatorio",
        accion_config={"destinatario": "destinatarios_regla", "dias_despues": 3},
        criticidad="baja",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo_factura_vencida.id,
        notificacion_template_id=plantilla.id,
        created_at=_ahora(db_session) - timedelta(days=60),
    )
    db_session.add(regla)
    db_session.flush()
    db_session.add(
        ReglaDestinatario(
            destinatario_tipo="usuario", workflow_rule_id=regla.id, usuario_id=destinatario.id
        )
    )
    db_session.add(
        EventLog(
            actor_tipo="sistema",
            entidad="factura",
            entidad_id=uuid.uuid4(),
            payload={"nombre_familia": "Cabral", "monto_deuda": 1500, "dias_vencido": 6},
            tipo_evento_id=tipo_factura_vencida.id,
            estado="procesado",
            timestamp=_ahora(db_session) - timedelta(days=4),
        )
    )
    db_session.commit()

    assert despacho_service.procesar_recordatorios_vencidos(db_session) == 1
    assert envios.enviados == [("destino@esseri.edu.ar", "Deuda de Cabral", "Debe 1500")]


def test_el_endpoint_de_procesar_tambien_corre_los_recordatorios_vencidos(
    client_autenticado, db_session, tipos_inasistencia, familia, plantilla, envios
):
    _regla(db_session, tipos_inasistencia, plantilla)
    _evento(db_session, tipos_inasistencia, _asistencia(db_session, familia), hace_dias=3)

    respuesta = client_autenticado.post("/workflows/procesar")

    assert respuesta.status_code == 200
    assert respuesta.json()["recordatorios_ejecutados"] == 1
    assert len(envios.enviados) == 1
