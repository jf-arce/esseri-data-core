import uuid
from datetime import date

import pytest
from sqlalchemy import select

from src.academico.models import JustificacionInasistencia
from src.auth.models import Rol, Usuario, UsuarioRol
from src.facturacion.models import Factura, Pago, ResponsableEconomico
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia
from src.models import EventLog, Persona
from src.workflows import despacho_service, n8n_client, notificaciones_service
from src.workflows.constants import MAX_DESTINATARIOS_POR_EJECUCION
from src.workflows.exceptions import (
    N8nEnvioFallido,
    N8nNoConfigurado,
    N8nNoDisponible,
    PlantillaInvalida,
)
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    ReglaDestinatario,
    WorkflowExecution,
    WorkflowRule,
)
from src.workflows.notificaciones_service import (
    ejecutar_alerta_interna,
    ejecutar_notificar,
    resolver_destinatarios,
)
from src.workflows.plantillas_service import renderizar_contenido
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

# --- Render --------------------------------------------------------------------------------


def test_render_reemplaza_placeholders_en_asunto_y_cuerpo():
    asunto, cuerpo = renderizar_contenido(
        "Deuda de {{nombre_familia}}",
        "Debe {{monto_deuda}} hace {{dias_vencido}} días",
        {
            "nombre_familia": "Cabral",
            "monto_deuda": 1500,
            "dias_vencido": 6,
        },
    )

    assert asunto == "Deuda de Cabral"
    assert cuerpo == "Debe 1500 hace 6 días"


@pytest.mark.parametrize("payload", [{}, {"monto_deuda": None}])
def test_render_falla_si_falta_el_campo_o_es_none(payload):
    with pytest.raises(PlantillaInvalida, match="monto_deuda"):
        renderizar_contenido("Aviso", "Debe {{monto_deuda}}", payload)


def test_render_normaliza_el_asunto():
    asunto, _ = renderizar_contenido(
        "Hola\n{{nombre_familia}}\r\n", "x", {"nombre_familia": "A\nB"}
    )

    assert "\n" not in asunto and "\r" not in asunto
    assert asunto == "Hola A B"


# --- Fixtures ------------------------------------------------------------------------------


def _usuario(db, email, *, estado="activo", persona_id=None):
    usuario = Usuario(
        email=email, auth_provider="local", password_hash="x", estado=estado, persona_id=persona_id
    )
    db.add(usuario)
    db.flush()
    return usuario


@pytest.fixture()
def escenario(db_session):
    datos = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, datos, estado="activa")
    familia = db_session.get(Familia, datos["familia_id"])
    datos["inscripcion_id"] = inscripcion.id
    datos["persona_familia_id"] = familia.persona_id
    return datos


@pytest.fixture()
def plantilla(db_session):
    plantilla = NotificacionTemplate(
        nombre="Mora", asunto="Deuda de {{nombre_familia}}", cuerpo="Debe {{monto_deuda}}"
    )
    db_session.add(plantilla)
    db_session.commit()
    return plantilla


def _regla(db, tipo, plantilla, destinatario="responsables_habilitados"):
    regla = WorkflowRule(
        nombre="Avisar mora",
        condicion={},
        tipo_accion="notificar",
        accion_config={"destinatario": destinatario},
        criticidad="media",
        requiere_aprobacion_humana=False,
        activo=True,
        tipo_evento_id=tipo.id,
        notificacion_template_id=None if plantilla is None else plantilla.id,
    )
    db.add(regla)
    db.commit()
    return regla


def _evento(db, tipo, entidad="factura", entidad_id=None, payload=None):
    evento = EventLog(
        actor_tipo="sistema",
        entidad=entidad,
        entidad_id=entidad_id or uuid.uuid4(),
        payload=payload or {"nombre_familia": "Cabral", "monto_deuda": 1500, "dias_vencido": 6},
        tipo_evento_id=tipo.id,
    )
    db.add(evento)
    db.commit()
    return evento


def _ejecucion(db, regla, evento, intento=1):
    ejecucion = WorkflowExecution(
        workflow_rule_id=regla.id, event_log_id=evento.id, intento=intento
    )
    db.add(ejecucion)
    db.flush()
    return ejecucion


@pytest.fixture()
def envios(monkeypatch):
    """Registra los emails enviados; `fallar` lista los destinatarios cuyo envío lanza."""

    class Registro:
        enviados: list[tuple[str, str, str]]
        intentos: list[str]
        fallar: dict[str, Exception]

    registro = Registro()
    registro.enviados = []
    registro.intentos = []
    registro.fallar = {}

    def enviar(destinatario, asunto, cuerpo, transport=None):
        registro.intentos.append(destinatario)
        if destinatario in registro.fallar:
            raise registro.fallar[destinatario]
        registro.enviados.append((destinatario, asunto, cuerpo))

    monkeypatch.setattr(n8n_client, "enviar_email", enviar)
    return registro


def _emails(destinatarios):
    return sorted(d.email for d in destinatarios[0])


# --- Destinatarios -------------------------------------------------------------------------


def test_destinatarios_regla_une_usuarios_y_roles_activos(db_session, tipo_factura_vencida):
    regla = _regla(db_session, tipo_factura_vencida, None, "destinatarios_regla")
    rol = Rol(codigo="cobranzas", nombre="Cobranzas")
    directo = _usuario(db_session, "directo@esseri.edu.ar")
    por_rol = _usuario(db_session, "rol@esseri.edu.ar")
    inactivo = _usuario(db_session, "baja@esseri.edu.ar", estado="inactivo")
    db_session.add(rol)
    db_session.flush()
    db_session.add_all(
        [
            UsuarioRol(usuario_id=por_rol.id, rol_id=rol.id),
            UsuarioRol(usuario_id=inactivo.id, rol_id=rol.id),
            UsuarioRol(usuario_id=directo.id, rol_id=rol.id),
            ReglaDestinatario(destinatario_tipo="rol", workflow_rule_id=regla.id, rol_id=rol.id),
            ReglaDestinatario(
                destinatario_tipo="usuario", workflow_rule_id=regla.id, usuario_id=directo.id
            ),
        ]
    )
    db_session.commit()
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = resolver_destinatarios(db_session, regla, evento, "destinatarios_regla")

    assert _emails(resultado) == ["directo@esseri.edu.ar", "rol@esseri.edu.ar"]
    assert {d.tipo for d in resultado[0]} == {"usuario"}


def _factura(db, escenario, responsable_id):
    factura = Factura(
        fecha_emision=date(2027, 3, 1),
        fecha_vencimiento=date(2027, 3, 10),
        monto_total=100,
        estado="vencida",
        inscripcion_id=escenario["inscripcion_id"],
        responsable_economico_id=responsable_id,
    )
    db.add(factura)
    db.flush()
    return factura


def _responsable(db, escenario, familia_id, *, vigente=True):
    responsable = ResponsableEconomico(
        vigencia_desde=date(2026, 1, 1),
        vigencia_hasta=None if vigente else date(2026, 12, 31),
        alumno_id=escenario["alumno_id"],
        familia_id=familia_id,
    )
    db.add(responsable)
    db.flush()
    return responsable


def test_responsables_habilitados_solo_los_que_reciben_comunicaciones(
    db_session, tipo_factura_vencida, escenario
):
    otra_persona = Persona(nombre="Otro", apellido="Cabral", dni="1")
    db_session.add(otra_persona)
    db_session.flush()
    otra = Familia(estado_deuda="al_dia", persona_id=otra_persona.id)
    db_session.add(otra)
    db_session.flush()
    db_session.add(
        FamiliaAlumno(
            recibe_comunicaciones=False, familia_id=otra.id, alumno_id=escenario["alumno_id"]
        )
    )
    _usuario(db_session, "madre@mail.com", persona_id=escenario["persona_familia_id"])
    _usuario(db_session, "otro@mail.com", persona_id=otra_persona.id)
    factura = _factura(db_session, escenario, _responsable(db_session, escenario, otra.id).id)
    regla = _regla(db_session, tipo_factura_vencida, None)
    evento = _evento(db_session, tipo_factura_vencida, "factura", factura.id)

    destinatarios, sin_email = resolver_destinatarios(
        db_session, regla, evento, "responsables_habilitados"
    )

    assert [d.email for d in destinatarios] == ["madre@mail.com"]
    assert destinatarios[0].tipo == "familia"
    assert destinatarios[0].familia_id == escenario["familia_id"]
    assert sin_email == 0


def test_responsable_economico_de_factura_es_el_historico(
    db_session, tipo_factura_vencida, escenario
):
    otra_persona = Persona(nombre="Ex", apellido="Responsable", dni="2")
    db_session.add(otra_persona)
    db_session.flush()
    anterior = Familia(estado_deuda="al_dia", persona_id=otra_persona.id)
    db_session.add(anterior)
    db_session.flush()
    historico = _responsable(db_session, escenario, anterior.id, vigente=False)
    _responsable(db_session, escenario, escenario["familia_id"])
    _usuario(db_session, "ex@mail.com", persona_id=otra_persona.id)
    _usuario(db_session, "actual@mail.com", persona_id=escenario["persona_familia_id"])
    factura = _factura(db_session, escenario, historico.id)
    regla = _regla(db_session, tipo_factura_vencida, None, "responsable_economico")
    evento = _evento(db_session, tipo_factura_vencida, "factura", factura.id)

    resultado = resolver_destinatarios(db_session, regla, evento, "responsable_economico")

    assert _emails(resultado) == ["ex@mail.com"]


def test_responsable_economico_vigente_para_entidades_sin_factura(
    db_session, tipo_factura_vencida, escenario
):
    _responsable(db_session, escenario, escenario["familia_id"])
    _usuario(db_session, "actual@mail.com", persona_id=escenario["persona_familia_id"])
    regla = _regla(db_session, tipo_factura_vencida, None, "responsable_economico")
    evento = _evento(db_session, tipo_factura_vencida, "inscripcion", escenario["inscripcion_id"])

    resultado = resolver_destinatarios(db_session, regla, evento, "responsable_economico")

    assert _emails(resultado) == ["actual@mail.com"]


def test_alumno_se_resuelve_desde_cada_entidad_de_evento(
    db_session, tipo_factura_vencida, escenario
):
    _usuario(db_session, "madre@mail.com", persona_id=escenario["persona_familia_id"])
    responsable = _responsable(db_session, escenario, escenario["familia_id"])
    factura = _factura(db_session, escenario, responsable.id)
    pago = Pago(
        fecha=date(2027, 3, 2),
        monto=10,
        estado="aprobado",
        factura_id=factura.id,
        metodo_pago_id=uuid.uuid4(),
    )
    asistencia = Asistencia(
        fecha=date(2027, 3, 3),
        tipo="ausente_injustificado",
        inscripcion_id=escenario["inscripcion_id"],
    )
    db_session.add_all([pago, asistencia])
    db_session.flush()
    justificacion = JustificacionInasistencia(
        asistencia_id=asistencia.id,
        familia_id=escenario["familia_id"],
        motivo_justificacion_id=uuid.uuid4(),
        usuario_id=uuid.uuid4(),
    )
    db_session.add(justificacion)
    db_session.commit()
    regla = _regla(db_session, tipo_factura_vencida, None)

    for entidad, entidad_id in [
        ("factura", factura.id),
        ("pago", pago.id),
        ("asistencia", asistencia.id),
        ("justificacion_inasistencia", justificacion.id),
        ("inscripcion", escenario["inscripcion_id"]),
    ]:
        evento = _evento(db_session, tipo_factura_vencida, entidad, entidad_id)
        resultado = resolver_destinatarios(db_session, regla, evento, "responsables_habilitados")
        assert _emails(resultado) == ["madre@mail.com"], entidad


def test_familia_sin_cuenta_no_tiene_email_y_se_cuenta(db_session, tipo_factura_vencida, escenario):
    regla = _regla(db_session, tipo_factura_vencida, None)
    evento = _evento(db_session, tipo_factura_vencida, "inscripcion", escenario["inscripcion_id"])

    destinatarios, sin_email = resolver_destinatarios(
        db_session, regla, evento, "responsables_habilitados"
    )

    assert destinatarios == []
    assert sin_email == 1


def test_persona_con_dos_cuentas_recibe_en_ambas_y_se_deduplica(
    db_session, tipo_factura_vencida, escenario
):
    _usuario(db_session, "uno@mail.com", persona_id=escenario["persona_familia_id"])
    _usuario(db_session, "dos@mail.com", persona_id=escenario["persona_familia_id"])
    _usuario(
        db_session, "baja@mail.com", persona_id=escenario["persona_familia_id"], estado="inactivo"
    )
    regla = _regla(db_session, tipo_factura_vencida, None)
    evento = _evento(db_session, tipo_factura_vencida, "inscripcion", escenario["inscripcion_id"])

    resultado = resolver_destinatarios(db_session, regla, evento, "responsables_habilitados")

    assert _emails(resultado) == ["dos@mail.com", "uno@mail.com"]


# --- Envío ---------------------------------------------------------------------------------


def _preparar_regla_con_usuarios(db, tipo, plantilla, cantidad=2):
    regla = _regla(db, tipo, plantilla, "destinatarios_regla")
    for i in range(cantidad):
        usuario = _usuario(db, f"u{i:02d}@esseri.edu.ar")
        db.add(
            ReglaDestinatario(
                destinatario_tipo="usuario", workflow_rule_id=regla.id, usuario_id=usuario.id
            )
        )
    db.commit()
    return regla


def test_envio_guarda_snapshots_y_marca_enviado(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida)
    ejecucion = _ejecucion(db_session, regla, evento)

    resultado = ejecutar_notificar(db_session, regla, evento, ejecucion)

    assert resultado.error is None
    assert resultado.detalle == "2 de 2 emails enviados"
    filas = db_session.scalars(select(Notificacion)).all()
    assert {f.estado_envio for f in filas} == {"enviado"}
    assert all(f.sent_at is not None for f in filas)
    assert {f.asunto_snapshot for f in filas} == {"Deuda de Cabral"}
    assert {f.cuerpo_snapshot for f in filas} == {"Debe 1500"}
    assert all(f.workflow_execution_id == ejecucion.id for f in filas)
    assert len(envios.enviados) == 2


def test_fallo_parcial_deja_filas_enviado_y_fallido(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida)
    ejecucion = _ejecucion(db_session, regla, evento)
    envios.fallar["u00@esseri.edu.ar"] = N8nEnvioFallido("n8n respondió 500.")

    resultado = ejecutar_notificar(db_session, regla, evento, ejecucion)

    assert resultado.error == notificaciones_service.ERROR_ENVIO
    assert resultado.detalle == "1 de 2 emails enviados"
    estados = {
        f.destinatario_snapshot: f.estado_envio for f in db_session.scalars(select(Notificacion))
    }
    assert estados == {"u00@esseri.edu.ar": "fallido", "u01@esseri.edu.ar": "enviado"}


def test_n8n_sin_configurar_deja_todo_fallido(db_session, tipo_factura_vencida, plantilla, envios):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida)
    envios.fallar.update(
        {"u00@esseri.edu.ar": N8nNoConfigurado(), "u01@esseri.edu.ar": N8nNoConfigurado()}
    )

    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_ENVIO
    assert {f.estado_envio for f in db_session.scalars(select(Notificacion))} == {"fallido"}


def test_corte_temprano_si_n8n_no_responde(db_session, tipo_factura_vencida, plantilla, envios):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla, cantidad=3)
    evento = _evento(db_session, tipo_factura_vencida)
    envios.fallar["u00@esseri.edu.ar"] = N8nNoDisponible()
    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_ENVIO
    assert envios.intentos == ["u00@esseri.edu.ar"]
    assert len(db_session.scalars(select(Notificacion)).all()) == 3
    assert {f.estado_envio for f in db_session.scalars(select(Notificacion))} == {"fallido"}


def test_regla_sin_plantilla_falla_sin_notificaciones(db_session, tipo_factura_vencida, envios):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, None)
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_SIN_PLANTILLA
    assert db_session.scalars(select(Notificacion)).all() == []


def _alerta(db, tipo, plantilla, accion_config):
    regla = _preparar_regla_con_usuarios(db, tipo, plantilla)
    regla.tipo_accion = "alerta_interna"
    regla.accion_config = accion_config
    db.commit()
    return regla


def test_alerta_interna_envia_el_mensaje_a_los_destinatarios_de_la_regla(
    db_session, tipo_factura_vencida, envios
):
    regla = _alerta(db_session, tipo_factura_vencida, None, {"mensaje": "Revisar la mora"})
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_alerta_interna(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error is None
    filas = db_session.scalars(select(Notificacion)).all()
    assert {f.asunto_snapshot for f in filas} == {"Alerta interna: Avisar mora"}
    assert {f.cuerpo_snapshot for f in filas} == {"Revisar la mora"}
    assert {f.destinatario_tipo for f in filas} == {"usuario"}
    assert len(envios.enviados) == 2


def test_alerta_interna_prefiere_la_plantilla_al_mensaje(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _alerta(db_session, tipo_factura_vencida, plantilla, {"mensaje": "Ignorado"})
    evento = _evento(db_session, tipo_factura_vencida)

    ejecutar_alerta_interna(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    filas = db_session.scalars(select(Notificacion)).all()
    assert {f.cuerpo_snapshot for f in filas} == {"Debe 1500"}


def test_alerta_interna_sin_mensaje_ni_plantilla_falla(db_session, tipo_factura_vencida, envios):
    regla = _alerta(db_session, tipo_factura_vencida, None, {})
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_alerta_interna(
        db_session, regla, evento, _ejecucion(db_session, regla, evento)
    )

    assert resultado.error == notificaciones_service.ERROR_SIN_MENSAJE
    assert db_session.scalars(select(Notificacion)).all() == []


def test_payload_sin_campo_de_la_plantilla_falla(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida, payload={"nombre_familia": "Cabral"})

    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_RENDER
    assert envios.enviados == []


def test_sin_destinatarios_falla(db_session, tipo_factura_vencida, plantilla, envios):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla, cantidad=0)
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_SIN_DESTINATARIOS


def test_tope_de_destinatarios_no_envia_nada(db_session, tipo_factura_vencida, plantilla, envios):
    regla = _preparar_regla_con_usuarios(
        db_session, tipo_factura_vencida, plantilla, cantidad=MAX_DESTINATARIOS_POR_EJECUCION + 1
    )
    evento = _evento(db_session, tipo_factura_vencida)

    resultado = ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))

    assert resultado.error == notificaciones_service.ERROR_TOPE
    assert envios.enviados == []
    assert db_session.scalars(select(Notificacion)).all() == []


def test_despacho_deja_la_ejecucion_fallida_pero_conserva_las_notificaciones(
    db_session, tipo_factura_vencida, plantilla, envios
):
    _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    _evento(db_session, tipo_factura_vencida)
    envios.fallar["u01@esseri.edu.ar"] = N8nEnvioFallido()

    despacho_service.procesar_eventos_pendientes(db_session)

    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == notificaciones_service.ERROR_ENVIO
    assert len(db_session.scalars(select(Notificacion)).all()) == 2


# --- Reintento -----------------------------------------------------------------------------


def test_reintento_reenvia_solo_las_fallidas_con_el_snapshot(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida)
    envios.fallar["u00@esseri.edu.ar"] = N8nEnvioFallido()
    ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))
    envios.enviados.clear()
    envios.fallar.clear()
    plantilla.asunto = "Asunto nuevo"
    db_session.commit()

    segunda = _ejecucion(db_session, regla, evento, intento=2)
    resultado = ejecutar_notificar(db_session, regla, evento, segunda)

    assert resultado.error is None
    assert envios.enviados == [("u00@esseri.edu.ar", "Deuda de Cabral", "Debe 1500")]
    filas = db_session.scalars(
        select(Notificacion).where(Notificacion.workflow_execution_id == segunda.id)
    ).all()
    assert [(f.destinatario_snapshot, f.estado_envio) for f in filas] == [
        ("u00@esseri.edu.ar", "enviado")
    ]


def test_reintento_con_todo_enviado_no_manda_nada(
    db_session, tipo_factura_vencida, plantilla, envios
):
    regla = _preparar_regla_con_usuarios(db_session, tipo_factura_vencida, plantilla)
    evento = _evento(db_session, tipo_factura_vencida)
    ejecutar_notificar(db_session, regla, evento, _ejecucion(db_session, regla, evento))
    envios.enviados.clear()

    resultado = ejecutar_notificar(
        db_session, regla, evento, _ejecucion(db_session, regla, evento, intento=2)
    )

    assert resultado.error is None
    assert envios.enviados == []
