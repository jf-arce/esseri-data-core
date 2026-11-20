"""Public A/B/C rendition flow with real dispatcher and an isolated email transport."""

import uuid
from datetime import date

import pytest
from sqlalchemy import select

from src.auth.models import Rol, Usuario, UsuarioRol
from src.facturacion import cobranzas_importacion_service as importaciones
from src.facturacion.facturas_service import registrar_pago
from src.facturacion.models import (
    DebitoCobranza,
    Factura,
    ImportacionCobranza,
    LoteCobranza,
    Pago,
    ResponsableEconomico,
)
from src.familias_alumnos.models import Familia
from src.models import AuditLog, EventLog
from src.notificaciones.models import NotificacionInterna
from src.workflows import despacho_service, n8n_client
from src.workflows.exceptions import N8nNoDisponible
from src.workflows.models import (
    Notificacion,
    NotificacionTemplate,
    TipoEvento,
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
from tests.facturacion.test_cobranzas_lotes import METODO_DEMO, crear_factura_demo
from tests.facturacion.test_debitos_demo_seed import _cargar_seed
from tests.facturacion.test_portal_familia import _crear_usuario, _login
from tests.workflows.factories import crear_regla_simple


@pytest.mark.parametrize("falla_email", [False, True])
def test_abc_despacha_una_vez_y_portal_sobrevive_a_fallo_email(
    client_autenticado, db_session, monkeypatch, falla_email
):
    tipo_pago = crear_catalogo_evento_pago_registrado(db_session)
    seed = _cargar_seed()
    regla = seed.seed_workflow(db_session)
    # An ordinary payment notification must not duplicate the debit-result notice.
    generica = NotificacionTemplate(nombre="Pago manual", asunto="Pago recibido", cuerpo="Pago")
    db_session.add(generica)
    db_session.flush()
    crear_regla_simple(
        db_session,
        tipo_evento_id=tipo_pago.id,
        # Default destination: the suppression must compare real recipients, not labels.
        accion_config={"destinatario": "responsables_habilitados"},
        notificacion_template_id=generica.id,
    )
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    usuarios = []
    for indice, factura in enumerate(facturas):
        responsable = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
        familia = db_session.get(Familia, responsable.familia_id)
        usuarios.append(
            _crear_usuario(
                db_session, persona_id=familia.persona_id, email=f"familia-{indice}@example.test"
            )
        )
    rol_familia = db_session.scalar(select(Rol).where(Rol.codigo == "familia"))
    if rol_familia is None:
        rol_familia = Rol(nombre="familia")
        db_session.add(rol_familia)
        db_session.flush()
    for usuario in usuarios:
        db_session.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol_familia.id))
    db_session.commit()
    enviados = []

    def enviar(destinatario, asunto, cuerpo, cuerpo_html=None, **kwargs):
        # Each external call observes a committed payment transaction.
        assert db_session.query(Pago).count() == 2
        if falla_email:
            raise N8nNoDisponible()
        enviados.append((destinatario, asunto, cuerpo))

    monkeypatch.setattr(n8n_client, "enviar_email", enviar)
    referencia_c = next(
        item["referencia"] for item in lote["items"] if item["factura_id"] == str(facturas[2].id)
    )
    texto = respuesta(client_autenticado, lote, rechazar=[referencia_c])
    revision = preview(client_autenticado, texto).json()
    assert db_session.query(EventLog).count() == 0
    assert db_session.query(Notificacion).count() == 0
    assert enviados == []
    assert confirmar(client_autenticado, revision["id"]).json()["estado"] == "confirmada"
    assert db_session.query(Notificacion).count() == 0

    despacho_service.procesar_eventos_pendientes(db_session)

    assert db_session.query(Pago).count() == 2
    assert db_session.query(NotificacionInterna).count() == 3
    assert sorted(db_session.get(Factura, f.id).estado for f in facturas) == [
        "pagada",
        "pagada",
        "pendiente",
    ]
    eventos = list(
        db_session.scalars(
            select(EventLog)
            .join(TipoEvento, TipoEvento.id == EventLog.tipo_evento_id)
            .where(TipoEvento.nombre == "debito.resultado_registrado")
        )
    )
    assert len(eventos) == 3
    rechazo = next(e for e in eventos if e.payload["resultado"] == "rechazado")
    assert rechazo.payload["factura_id"] == str(facturas[2].id)
    assert rechazo.payload["codigo_resultado"] == "SALDO_INSUF"
    assert rechazo.payload["motivo_rechazo"] == "Saldo insuficiente"

    avisos_internos = db_session.query(NotificacionInterna).all()
    assert {aviso.tipo for aviso in avisos_internos} == {
        "facturacion.debito_exitoso",
        "facturacion.debito_rechazado",
    }
    assert sum(1 for a in avisos_internos if a.tipo == "facturacion.debito_exitoso") == 2
    rechazo_interno = next(a for a in avisos_internos if a.tipo == "facturacion.debito_rechazado")
    assert "Saldo insuficiente" in rechazo_interno.mensaje
    assert "SALDO_INSUF" not in rechazo_interno.mensaje
    assert rechazo_interno.destino_tipo == "factura"
    assert rechazo_interno.destino_id == facturas[2].id
    assert rechazo_interno.contexto["debito_id"] == str(rechazo.entidad_id)
    assert all(
        aviso.destino_id in {factura.id for factura in facturas} for aviso in avisos_internos
    )

    assert len(enviados) == (0 if falla_email else 3)
    assert {e[0] for e in enviados} == (set() if falla_email else {u.email for u in usuarios})
    avisos = db_session.query(Notificacion).all()
    assert len(avisos) == 3
    assert {a.estado_envio for a in avisos} == ({"fallido"} if falla_email else {"enviado"})
    ejecuciones = db_session.query(WorkflowExecution).filter_by(workflow_rule_id=regla.id).all()
    assert len(ejecuciones) == 3
    assert {e.event_log_id for e in ejecuciones} == {e.id for e in eventos}
    assert {e.estado for e in ejecuciones} == ({"fallido"} if falla_email else {"exitoso"})
    assert db_session.query(AuditLog).filter_by(entidad="DEBITO_COBRANZA").count() == 3
    assert db_session.query(AuditLog).filter_by(entidad="NOTIFICACION").count() >= 3
    conteos = (db_session.query(EventLog).count(), db_session.query(WorkflowExecution).count())
    assert confirmar(client_autenticado, revision["id"]).json()["estado"] == "confirmada"
    assert preview(client_autenticado, texto).json()["estado"] == "confirmada"
    despacho_service.procesar_eventos_pendientes(db_session)
    assert (
        db_session.query(EventLog).count(),
        db_session.query(WorkflowExecution).count(),
    ) == conteos
    assert db_session.query(Notificacion).count() == 3
    assert db_session.query(NotificacionInterna).count() == 3
    assert len(enviados) == (0 if falla_email else 3)

    # Later template edits must never rewrite already-published snapshots.
    plantilla = db_session.get(NotificacionTemplate, seed._id("plantilla-rechazado"))
    plantilla.cuerpo = "Edited after publication"
    db_session.commit()
    for usuario in usuarios:
        _login(client_autenticado, usuario)
        lectura = client_autenticado.get("/facturacion/familia/me")
        assert lectura.status_code == 200
        avisos_familia = lectura.json()["avisos_debito"]
        assert len(avisos_familia) == 1
        aviso = avisos_familia[0]
        snapshot = next(a for a in avisos if a.destinatario_snapshot == usuario.email)
        assert aviso["cuerpo"] == snapshot.cuerpo_snapshot
        assert aviso["asunto"] == snapshot.asunto_snapshot
        assert aviso["factura_id"] in {f["id"] for f in lectura.json()["facturas"]}
        assert aviso["numero_factura"].startswith("F-")
        assert aviso["resultado"] in {"exitoso", "rechazado"}
        if aviso["resultado"] == "rechazado":
            assert aviso["motivo_rechazo"]
            assert aviso["codigo_resultado"]

    _login(client_autenticado, usuarios[2])
    listado = client_autenticado.get("/notificaciones?no_leidas=false&limite=50").json()
    propios = [item for item in listado["items"] if item["tipo"].startswith("facturacion.debito_")]
    assert [item["tipo"] for item in propios] == ["facturacion.debito_rechazado"]
    assert propios[0]["destino"]["tipo"] == "factura"
    assert propios[0]["destino"]["id"] == str(facturas[2].id)
    assert "Saldo insuficiente" in propios[0]["mensaje"]
    assert "SALDO_INSUF" not in propios[0]["mensaje"]

    _login(client_autenticado, usuarios[0])
    exitosos = [
        item
        for item in client_autenticado.get("/notificaciones?no_leidas=false&limite=50").json()[
            "items"
        ]
        if item["tipo"] == "facturacion.debito_exitoso"
    ]
    assert len(exitosos) == 1
    assert exitosos[0]["destino"]["id"] == str(facturas[0].id)


@pytest.mark.parametrize("debito_anterior", [False, True])
def test_pago_manual_o_debito_anterior_conserva_su_workflow(
    client_autenticado, db_session, monkeypatch, debito_anterior
):
    tipo = crear_catalogo_evento_pago_registrado(db_session)
    factura = crear_factura_demo(db_session, 1)
    responsable = db_session.get(ResponsableEconomico, factura.responsable_economico_id)
    familia = db_session.get(Familia, responsable.familia_id)
    usuario = _crear_usuario(db_session, persona_id=familia.persona_id, email="manual@example.test")
    plantilla = NotificacionTemplate(nombre="Manual", asunto="Pago manual", cuerpo="Recibido")
    db_session.add(plantilla)
    db_session.flush()
    crear_regla_simple(
        db_session,
        tipo_evento_id=tipo.id,
        accion_config={"destinatario": "responsable_economico"},
        notificacion_template_id=plantilla.id,
    )
    enviados = []
    monkeypatch.setattr(n8n_client, "enviar_email", lambda *args: enviados.append(args))
    operador = db_session.scalar(
        select(Usuario).where(Usuario.email == "facturacion@esseri.edu.ar")
    )
    pago = registrar_pago(
        db_session,
        factura=factura,
        usuario_registro_id=operador.id,
        fecha=date.today(),
        monto=factura.monto_total,
        metodo_pago_id=METODO_DEMO,
        referencia_transaccion="MANUAL",
        comprobante_nombre=None,
        comprobante_tipo_contenido=None,
        comprobante_contenido=None,
    )
    if debito_anterior:
        lote = LoteCobranza(fecha=date.today(), estado="pagos_registrados", usuario_id=operador.id)
        db_session.add(lote)
        db_session.flush()
        db_session.add(
            DebitoCobranza(
                lote_id=lote.id,
                factura_id=factura.id,
                pago_id=pago.id,
                importe=pago.monto,
                vencimiento=factura.fecha_vencimiento,
                concepto="Legacy result without a debit-result event",
                reserva_activa=False,
            )
        )
        db_session.commit()
    despacho_service.procesar_eventos_pendientes(db_session)
    assert len(enviados) == 1
    assert db_session.query(Notificacion).count() == 1
    assert db_session.query(EventLog).count() == 1
    _login(client_autenticado, usuario)
    assert client_autenticado.get("/facturacion/familia/me").json()["avisos_debito"] == []


def test_pago_de_debito_conserva_aviso_si_la_regla_de_resultados_esta_inactiva(
    client_autenticado, db_session, monkeypatch
):
    """B1: an inactive result rule must not silence the preserved payment notice."""
    tipo = crear_catalogo_evento_pago_registrado(db_session)
    regla = _cargar_seed().seed_workflow(db_session)
    regla.activo = False
    db_session.commit()
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    responsable = db_session.get(ResponsableEconomico, facturas[0].responsable_economico_id)
    familia = db_session.get(Familia, responsable.familia_id)
    _crear_usuario(db_session, persona_id=familia.persona_id, email="pago@example.test")
    plantilla = NotificacionTemplate(nombre="Pago", asunto="Pago", cuerpo="Pago")
    db_session.add(plantilla)
    db_session.flush()
    crear_regla_simple(
        db_session,
        tipo_evento_id=tipo.id,
        accion_config={"destinatario": "responsable_economico"},
        notificacion_template_id=plantilla.id,
    )
    revision = preview(client_autenticado, respuesta(client_autenticado, lote)).json()
    assert confirmar(client_autenticado, revision["id"]).json()["estado"] == "confirmada"
    enviados = []
    monkeypatch.setattr(n8n_client, "enviar_email", lambda *args: enviados.append(args))
    despacho_service.procesar_eventos_pendientes(db_session)
    assert len(enviados) == 1
    assert db_session.query(Notificacion).count() == 1


def test_regla_resultados_con_aprobacion_conserva_el_aviso_de_pago(
    client_autenticado, db_session, monkeypatch
):
    tipo = crear_catalogo_evento_pago_registrado(db_session)
    _cargar_seed().seed_workflow(db_session)
    plantilla = db_session.scalar(
        select(NotificacionTemplate).where(
            NotificacionTemplate.nombre == "Débito automático exitoso"
        )
    )
    accion = db_session.scalar(
        select(WorkflowNodo).where(WorkflowNodo.notificacion_template_id == plantilla.id)
    )
    accion.requiere_aprobacion_humana = True
    db_session.commit()
    facturas, lote = _lote_con_facturas(client_autenticado, db_session, 1)
    responsable = db_session.get(ResponsableEconomico, facturas[0].responsable_economico_id)
    familia = db_session.get(Familia, responsable.familia_id)
    _crear_usuario(db_session, persona_id=familia.persona_id, email="pago@example.test")
    plantilla_pago = NotificacionTemplate(nombre="Pago", asunto="Pago", cuerpo="Pago")
    db_session.add(plantilla_pago)
    db_session.flush()
    crear_regla_simple(
        db_session,
        tipo_evento_id=tipo.id,
        accion_config={"destinatario": "responsable_economico"},
        notificacion_template_id=plantilla_pago.id,
    )
    revision = preview(client_autenticado, respuesta(client_autenticado, lote)).json()
    assert confirmar(client_autenticado, revision["id"]).json()["estado"] == "confirmada"
    enviados = []
    monkeypatch.setattr(n8n_client, "enviar_email", lambda *args: enviados.append(args))
    despacho_service.procesar_eventos_pendientes(db_session)
    assert len(enviados) == 1
    assert db_session.query(Notificacion).count() == 1


def test_fallo_inesperado_no_deja_pagos_ni_eventos(client_autenticado, db_session, monkeypatch):
    crear_catalogo_evento_pago_registrado(db_session)
    _cargar_seed().seed_workflow(db_session)
    _, lote = _lote_con_facturas(client_autenticado, db_session, 3)
    revision = preview(client_autenticado, respuesta(client_autenticado, lote)).json()
    real = registrar_pago
    llamadas = {"n": 0}

    def fallar(*args, **kwargs):
        llamadas["n"] += 1
        if llamadas["n"] == 2:
            raise RuntimeError("fallo simulado")
        return real(*args, **kwargs)

    monkeypatch.setattr(importaciones.facturas_service, "registrar_pago", fallar)
    operador = db_session.scalar(
        select(Usuario).where(Usuario.email == "facturacion@esseri.edu.ar")
    )
    with pytest.raises(RuntimeError):
        importaciones.confirmar(
            db_session,
            uuid.UUID(revision["id"]),
            revision_confirmada=True,
            usuario_id=operador.id,
        )
    db_session.rollback()
    assert db_session.query(Pago).count() == 0
    assert db_session.query(EventLog).count() == 0
    assert db_session.query(NotificacionInterna).count() == 0
    assert db_session.query(ImportacionCobranza).one().estado == "en_revision"
    assert db_session.query(DebitoCobranza).filter_by(reserva_activa=True).count() == 3
