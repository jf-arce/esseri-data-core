"""Debit-result workflows publish one communication for the invoice's economic family."""

import pytest
from sqlalchemy import select

from src.comunicaciones.models import Comunicacion, ReciboComunicacion
from src.comunicaciones.service import listar, recibos_propios
from src.config import settings
from src.facturacion.models import ResponsableEconomico
from src.facturacion.portal_familia_service import obtener_facturacion_familia
from src.familias_alumnos.models import Familia, FamiliaAlumno
from src.workflows import despacho_service, manuales_service, n8n_client
from src.workflows.models import (
    EnvioNotificacion,
    NotificacionTemplate,
    WorkflowExecution,
    WorkflowNodo,
)
from tests.facturacion.conftest import crear_catalogo_evento_pago_registrado
from tests.facturacion.test_cobranzas_importacion import (
    _lote_con_facturas,
    confirmar,
    preview,
    respuesta,
)
from tests.facturacion.test_debitos_demo_seed import _cargar_seed
from tests.facturacion.test_portal_familia import _crear_usuario
from tests.workflows.factories import crear_regla_simple


@pytest.mark.parametrize(
    ("canal", "rechazado", "estado_envio"),
    [("portal", False, None), ("email", True, "presentado"), ("ambos", False, "incierto")],
)
def test_publicar_resultado(
    client_autenticado, db_session, monkeypatch, canal, rechazado, estado_envio
):
    tipo_pago = crear_catalogo_evento_pago_registrado(db_session)
    plantilla_pago = NotificacionTemplate(nombre="Pago manual", asunto="Pago", cuerpo="Recibido")
    db_session.add(plantilla_pago)
    db_session.flush()
    crear_regla_simple(
        db_session,
        tipo_evento_id=tipo_pago.id,
        accion_config={"destinatario": "responsable_economico"},
        notificacion_template_id=plantilla_pago.id,
    )
    regla = _cargar_seed().seed_workflow(db_session)
    nodos = db_session.scalars(
        select(WorkflowNodo).where(
            WorkflowNodo.workflow_rule_id == regla.id, WorkflowNodo.tipo == "accion"
        )
    ).all()
    for nodo in nodos:
        nodo.tipo_accion = "publicar_comunicacion"
        nodo.accion_config = {"canal": canal}

    if canal == "ambos":
        # A second matching rule has a distinct execution but must reuse the publication.
        crear_regla_simple(
            db_session,
            nombre="Publicación redundante",
            tipo_evento_id=regla.tipo_evento_id,
            tipo_accion="publicar_comunicacion",
            accion_config={"canal": canal},
            notificacion_template_id=nodos[0].notificacion_template_id,
        )

    (factura, otra_factura), lote = _lote_con_facturas(client_autenticado, db_session, 2)
    usuarios = []
    for indice, fila in enumerate((factura, otra_factura)):
        responsable = db_session.get(ResponsableEconomico, fila.responsable_economico_id)
        familia = db_session.get(Familia, responsable.familia_id)
        db_session.add(
            FamiliaAlumno(
                familia_id=familia.id, alumno_id=responsable.alumno_id, recibe_comunicaciones=True
            )
        )
        if indice:
            # A second enabled family for the same student is not the economic recipient.
            titular = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
            db_session.add(
                FamiliaAlumno(
                    familia_id=familia.id, alumno_id=titular.alumno_id, recibe_comunicaciones=True
                )
            )
        usuarios.append(
            _crear_usuario(
                db_session, persona_id=familia.persona_id, email=f"destino-{indice}@example.test"
            )
        )

    referencias = [item["referencia"] for item in lote["items"]] if rechazado else []
    revision = preview(
        client_autenticado, respuesta(client_autenticado, lote, rechazar=referencias)
    ).json()
    llamadas = []
    pagos = []

    def enviar(email, asunto, cuerpo, *args, **kwargs):
        llamadas.append((email, asunto, cuerpo))
        return n8n_client.ResultadoEnvioManual(estado=estado_envio)

    monkeypatch.setattr(settings, "N8N_MANUAL_HABILITADO", True)
    monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", "http://n8n.test/webhook/enviar-email")
    monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "isolated-test-token")
    monkeypatch.setattr(settings, "N8N_CALLBACK_BASE_URL", "http://backend.test")
    monkeypatch.setattr(n8n_client, "enviar_email_manual", enviar)
    monkeypatch.setattr(
        n8n_client, "enviar_email", lambda email, *args, **kwargs: pagos.append(email)
    )
    assert confirmar(client_autenticado, revision["id"]).status_code == 200
    for _ in range(2):
        despacho_service.procesar_eventos_pendientes(db_session)
        manuales_service.procesar_envios_pendientes(db_session)

    recibos = [recibos_propios(db_session, usuario) for usuario in usuarios]
    assert [len(familia) for familia in recibos] == [1, 1]
    assert recibos[0][0].comunicacion_id != recibos[1][0].comunicacion_id
    assert db_session.query(ReciboComunicacion).count() == 2
    assert db_session.query(Comunicacion).count() == 2
    comunicacion = db_session.get(Comunicacion, recibos[0][0].comunicacion_id)
    assert comunicacion.estado == "publicada"
    assert comunicacion.canal == canal
    assert ("rechazado" if rechazado else "confirmado") in comunicacion.asunto
    bandeja = listar(db_session, usuarios[0], 1, "", False, familia=True)
    assert bandeja.total == (0 if canal == "email" else 1)
    envios = db_session.scalars(select(EnvioNotificacion)).all()
    assert {envio.estado for envio in envios} == ({estado_envio} if estado_envio else set())
    assert len(envios) == len(llamadas) == (2 if estado_envio else 0)
    assert {llamada[0] for llamada in llamadas} == (
        {usuario.email for usuario in usuarios} if estado_envio else set()
    )
    assert set(pagos) == ({usuario.email for usuario in usuarios} if canal == "portal" else set())
    for numero, (usuario, propia) in enumerate(
        zip(usuarios, (factura, otra_factura), strict=True), 1
    ):
        cuenta = obtener_facturacion_familia(db_session, usuario.persona_id).model_dump()
        assert cuenta["avisos_debito"] == []
        assert [fila["id"] for fila in cuenta["facturas"]] == [propia.id]
        resultado = cuenta["facturas"][0]["ultimo_resultado_debito"]
        assert resultado["debito_id"] is not None
        assert resultado["resultado"] == ("rechazado" if rechazado else "exitoso")
        assert resultado["numero_factura"] == f"F-{numero:04d}"
        assert (resultado["motivo_rechazo"] != "") is rechazado
        assert "codigo_resultado" not in resultado


@pytest.mark.parametrize(("primero", "segundo"), [("portal", "ambos"), ("ambos", "portal")])
def test_canales_incompatibles_informan_conflicto_sin_republicar(
    client_autenticado, db_session, primero, segundo
):
    demo = _cargar_seed().seed_workflow(db_session)
    demo.activo = False
    plantilla = NotificacionTemplate(nombre="Resultado", asunto="Resultado", cuerpo="Procesado")
    db_session.add(plantilla)
    db_session.flush()
    regla_incompatible = None
    for nombre, canal in [("A publica", primero), ("B en conflicto", segundo)]:
        regla_incompatible = crear_regla_simple(
            db_session,
            nombre=nombre,
            tipo_evento_id=demo.tipo_evento_id,
            tipo_accion="publicar_comunicacion",
            accion_config={"canal": canal},
            notificacion_template_id=plantilla.id,
        )
    (factura,), lote = _lote_con_facturas(client_autenticado, db_session, 1)
    titular = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
    db_session.add(FamiliaAlumno(familia_id=titular.familia_id, alumno_id=titular.alumno_id))
    db_session.commit()
    referencias = [item["referencia"] for item in lote["items"]]
    revision = preview(
        client_autenticado, respuesta(client_autenticado, lote, rechazar=referencias)
    ).json()
    assert confirmar(client_autenticado, revision["id"]).status_code == 200
    for _ in range(2):
        despacho_service.procesar_eventos_pendientes(db_session)

    assert db_session.scalars(select(Comunicacion.canal)).all() == [primero]
    assert db_session.query(ReciboComunicacion).count() == 1
    assert db_session.query(EnvioNotificacion).count() == (1 if primero == "ambos" else 0)
    ejecucion = db_session.scalar(
        select(WorkflowExecution).where(
            WorkflowExecution.workflow_rule_id == regla_incompatible.regla.id
        )
    )
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == (
        f"El resultado ya se publicó con el canal «{primero}»; esta regla pidió «{segundo}»."
    )


def test_familia_sin_vinculo_habilitado_no_recibe_publicacion(client_autenticado, db_session):
    regla_demo = _cargar_seed().seed_workflow(db_session)
    plantilla_id = db_session.scalars(
        select(WorkflowNodo.notificacion_template_id).where(
            WorkflowNodo.workflow_rule_id == regla_demo.id, WorkflowNodo.tipo == "accion"
        )
    ).first()
    regla_demo.activo = False
    regla = crear_regla_simple(
        db_session,
        tipo_evento_id=regla_demo.tipo_evento_id,
        tipo_accion="publicar_comunicacion",
        accion_config={"canal": "ambos"},
        notificacion_template_id=plantilla_id,
    )
    (factura,), lote = _lote_con_facturas(client_autenticado, db_session, 1)
    titular = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
    db_session.add(
        FamiliaAlumno(
            familia_id=titular.familia_id,
            alumno_id=titular.alumno_id,
            recibe_comunicaciones=False,
        )
    )
    db_session.commit()
    referencias = [item["referencia"] for item in lote["items"]]
    revision = preview(
        client_autenticado, respuesta(client_autenticado, lote, rechazar=referencias)
    ).json()
    assert confirmar(client_autenticado, revision["id"]).status_code == 200
    despacho_service.procesar_eventos_pendientes(db_session)
    ejecucion = db_session.scalar(
        select(WorkflowExecution).where(WorkflowExecution.workflow_rule_id == regla.regla.id)
    )
    assert ejecucion.estado == "fallido"
    assert ejecucion.error_detail == (
        "La factura no tiene un responsable económico habilitado para comunicaciones."
    )
    assert db_session.query(Comunicacion).count() == 0
    assert db_session.query(ReciboComunicacion).count() == 0
    assert db_session.query(EnvioNotificacion).count() == 0
