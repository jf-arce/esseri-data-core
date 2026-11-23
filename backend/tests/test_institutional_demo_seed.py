import os
import subprocess
import sys
from datetime import date
from importlib import import_module
from pathlib import Path

import pytest
from sqlalchemy import func, select

from src.academico.models import AsignacionDocente, Docente, HorarioMateriaCurso, NivelEducativo
from src.auth.models import Rol
from src.facturacion.models import Factura, FacturaCobranzaDemo, Movimiento, Pago
from src.familias_alumnos.models import Alumno, Familia, FamiliaAlumno
from src.inscripciones.models import Asistencia, Inscripcion
from src.models import Persona

ROLES = ("administracion", "direccion", "docente", "familia", "administrador del sistema")
ROOT = Path(__file__).resolve().parents[2]
SEEDS = ROOT / "database/seeds"


@pytest.fixture
def seed_module(monkeypatch):
    monkeypatch.syspath_prepend(str(SEEDS))
    return import_module("08_seed_institutional_demo")


def test_school_has_coherent_cohorts_and_does_not_duplicate(seed_module, db_session):
    db = db_session
    db.add_all(NivelEducativo(nombre=name) for name in seed_module.LEVELS)
    db.add_all(Rol(nombre=name) for name in ROLES)
    db.flush()
    reference = date(2026, 11, 18)
    school = seed_module.seed_school(db, reference, "local-only-demo-password")
    assert school is not None
    assert seed_module.seed_school(db, reference, "local-only-demo-password") is None
    assert db.scalar(select(func.count()).select_from(Alumno)) == 250
    assert db.scalar(select(func.count()).select_from(Familia)) == 220
    assert db.scalar(select(func.count()).select_from(Docente)) == 25
    assert db.scalar(select(func.count()).select_from(FamiliaAlumno)) == 270
    assert db.scalar(select(func.count()).select_from(HorarioMateriaCurso)) > 100
    assert set(db.scalars(select(AsignacionDocente.ciclo_lectivo))) == {"2025", "2026"}
    assert set(db.scalars(select(Inscripcion.ciclo_lectivo))) == {"2025", "2026", "2027"}
    assert {"activa", "finalizada", "baja"} == set(db.scalars(select(Inscripcion.estado)))


def test_existing_person_blocks_seed_without_writes(seed_module, db_session):
    db_session.add(Persona(nombre="Existing", apellido="Person", dni="1"))
    db_session.flush()
    with pytest.raises(RuntimeError, match="not empty"):
        seed_module.seed_school(db_session, date(2026, 11, 18), "local-only-demo-password")
    assert db_session.scalar(select(func.count()).select_from(Persona)) == 1
    assert db_session.scalar(select(func.count()).select_from(Alumno)) == 0


def test_billing_baseline_is_balanced_and_live_invoices_have_no_results(seed_module, db_session):
    from src.facturacion.models import ConceptoCobro, DebitoCobranza, MetodoPago
    from src.workflows.models import NotificacionTemplate, WorkflowRule

    db = db_session
    db.add_all(NivelEducativo(nombre=name) for name in seed_module.LEVELS)
    db.add_all(Rol(nombre=name) for name in ROLES)
    db.add_all(ConceptoCobro(nombre=name) for name in ("Cuota educativa", "Matrícula"))
    db.add(MetodoPago(nombre="tarjeta_debito", activo=True, requiere_comprobante=False))
    db.flush()
    reference = date(2026, 11, 18)
    school = seed_module.seed_school(db, reference, "local-only-demo-password")
    seed_module.seed_finance(db, school, reference)
    assert db.query(Factura).count() == 1013
    assert db.query(Pago).count() == 750
    assert db.query(Movimiento).filter_by(tipo="debe").count() == 1013
    assert db.query(Movimiento).filter_by(tipo="haber").count() == 750
    bills = db.scalars(select(Factura).join(FacturaCobranzaDemo)).unique().all()
    assert len(bills) == 30
    assert all(bill.estado == "pendiente" and not bill.pagos for bill in bills)
    assert db.query(DebitoCobranza).count() == 0
    assert db.query(NotificacionTemplate).count() == 2
    assert db.query(WorkflowRule).count() == 0


def test_bank_file_round_trip_uses_exported_references_and_control_totals(seed_module):
    from collections import Counter
    from decimal import Decimal

    from src.facturacion import formato_cobranza_simulada as codec

    day = date(2026, 11, 18)
    lote = "LD-2026-11-001"
    rows = [
        codec.SolicitudFila(
            i,
            f"ID-RENDICION-{i:03}",
            f"Alumno {i}",
            "Cuota",
            Decimal("125000.00"),
            day,
            "0079999900000000000000",
        )
        for i in range(1, 29)
    ]
    exported = codec.generar_solicitud(lote, rows, "cbu")
    result = seed_module.bank_response(exported, day)
    actual_lote, details = codec.leer_respuesta(result)
    assert actual_lote == lote
    assert {row.referencia for row in details} == {
        codec.referencia_corta(lote, row.orden) for row in rows
    }
    assert Counter(row.resultado for row in details) == {"COBRADO_SIM": 20, "RECHAZADO_SIM": 8}
    assert Counter(row.codigo for row in details if row.codigo) == {
        "SALDO_INSUF": 5,
        "CBU_INEXISTENTE": 1,
        "CUENTA_INHABIL": 1,
        "CUENTA_CERRADA": 1,
    }
    assert next(row for row in details if row.orden == rows[20].orden).codigo == "SALDO_INSUF"
    with pytest.raises(ValueError, match="28"):
        seed_module.bank_response(codec.generar_solicitud(lote, rows[:-1], "cbu"), day)


def demo_cli(script, *args, **overrides):
    demo_db = "esseri_institutional_demo"
    env = {
        **os.environ,
        "ENVIRONMENT": "development",
        "DATABASE_URL": f"postgresql://{demo_db}@127.0.0.1:1/{demo_db}",
        "JWT_SECRET": "local-tests",
        "ESSERI_DEMO_SEED_ENABLED": "true",
        "ESSERI_DEMO_PASSWORD": "local-only-demo-password",
        "PGHOSTADDR": "",
        "PYTHONDONTWRITEBYTECODE": "1",
        **overrides,
    }
    return subprocess.run(
        [sys.executable, str(SEEDS / script), *args],
        cwd=ROOT / "backend",
        env=env,
        capture_output=True,
        text=True,
        timeout=10,
        check=False,
    )


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"ENVIRONMENT": "production"}, "Use development/test"),
        ({"ESSERI_DEMO_SEED_ENABLED": ""}, "ESSERI_DEMO_SEED_ENABLED=true"),
        ({"ESSERI_DEMO_PASSWORD": ""}, "Set ESSERI_DEMO_PASSWORD"),
        (
            {
                "DATABASE_URL": "postgresql://esseri_institutional_demo@"
                "203.0.113.10/esseri_institutional_demo"
            },
            "Only a dedicated loopback",
        ),
        ({"PGHOSTADDR": "203.0.113.10"}, "Unset PGHOSTADDR"),
    ],
)
def test_seed_cli_refuses_unsafe_target(overrides, message):
    result = demo_cli("08_seed_institutional_demo.py", **overrides)
    assert result.returncode == 1
    assert message in result.stderr and "Traceback" not in result.stderr


@pytest.mark.parametrize(("token", "port"), [("", "8798"), ("test-only", "99999")])
def test_invalid_capture_start_does_not_create_file(tmp_path, token, port):
    output = tmp_path / "capture.jsonl"
    result = demo_cli(
        "institutional_demo_mail.py", str(output), "--port", port, N8N_WEBHOOK_TOKEN=token
    )
    assert result.returncode == 1 and not output.exists()


def test_capture_bind_failure_does_not_leave_a_stale_file(tmp_path):
    import socket

    output = tmp_path / "capture.jsonl"
    with socket.socket() as held:
        held.bind(("127.0.0.1", 0))
        held.listen()
        port = held.getsockname()[1]
        result = demo_cli(
            "institutional_demo_mail.py",
            str(output),
            "--port",
            str(port),
            N8N_WEBHOOK_TOKEN="test-only",
        )
    assert result.returncode == 1
    assert "in use" in result.stderr.lower()
    assert not output.exists()


def test_reference_date_near_term_start_keeps_attendance_inside_the_term(seed_module, db_session):
    db = db_session
    db.add_all(NivelEducativo(nombre=name) for name in seed_module.LEVELS)
    db.add_all(Rol(nombre=name) for name in ROLES)
    db.flush()
    seed_module.seed_school(db, date(2026, 3, 1), "local-only-demo-password")
    early_2026 = db.scalar(
        select(Asistencia.id)
        .where(Asistencia.fecha >= date(2026, 1, 1), Asistencia.fecha < date(2026, 3, 2))
        .limit(1)
    )
    early_2025 = db.scalar(
        select(Asistencia.id).where(Asistencia.fecha < date(2025, 3, 2)).limit(1)
    )
    assert early_2026 is None
    assert early_2025 is None


def test_demo_mail_capture_accepts_only_fictional_families(seed_module, tmp_path, monkeypatch):
    import threading

    import httpx

    from src.config import settings
    from src.workflows.n8n_client import enviar_email

    mail = import_module("institutional_demo_mail")
    captured = tmp_path / "captured.jsonl"
    with captured.open("x", encoding="utf-8") as output:
        with mail.capture_server(0, "local-token", output) as server:
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                url = f"http://127.0.0.1:{server.server_port}/capture"
                payload = {
                    "destinatario": "familia-21@demo.esseri.test",
                    "asunto": "Débito rechazado",
                    "cuerpo": "Saldo insuficiente",
                }
                assert httpx.post(url, json=payload, trust_env=False).status_code == 403
                headers = {"Authorization": "Bearer local-token"}
                assert (
                    httpx.post(
                        url,
                        json={**payload, "destinatario": "recipient@example.com"},
                        headers=headers,
                        trust_env=False,
                    ).status_code
                    == 400
                )
                monkeypatch.setattr(settings, "N8N_WEBHOOK_URL", url)
                monkeypatch.setattr(settings, "N8N_WEBHOOK_TOKEN", "local-token")
                monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:1")
                monkeypatch.setenv("NO_PROXY", "127.0.0.1")
                enviar_email(payload["destinatario"], payload["asunto"], payload["cuerpo"])
            finally:
                server.shutdown()
                thread.join(timeout=5)
    lines = captured.read_text().splitlines()
    assert len(lines) == 1 and "Saldo insuficiente" in lines[0]


def test_institutional_demo_through_real_api(seed_module, db_session, client, monkeypatch):
    import uuid

    from src.academico.models import SolicitudAusenciaPeriodo
    from src.asistente import herramientas
    from src.asistente.herramientas_base import ContextoHerramienta
    from src.auth.models import Usuario
    from src.comunicaciones.models import ConversacionContextual, MensajeConversacion
    from src.facturacion.cobranzas_importacion_service import METODO_ID
    from src.facturacion.models import DebitoCobranza, MetodoPago
    from src.models import AuditLog, EventLog
    from src.notificaciones.models import NotificacionInterna
    from src.workflows import n8n_client
    from src.workflows.models import TipoEvento, WorkflowExecution
    from src.workflows.reglas_service import nodos_de_regla_simple

    db = db_session
    client.base_url = "https://testserver"
    for group in ("01_seed_grupo_a", "02_seed_grupo_c", "03_seed_grupo_b"):
        module = import_module(group)
        monkeypatch.setattr(module, "SessionLocal", lambda: db)
        getattr(module, "seed_grupo_" + group[-1])()
    db.add(MetodoPago(id=METODO_ID, nombre="ESSERI simulado", activo=True))
    db.flush()
    reference = seed_module.REFERENCE
    password = "local-only-demo-password"
    school = seed_module.seed_school(db, reference, password)
    seed_module.seed_finance(db, school, reference)
    seed_module.seed_offline_workflow(db, school, reference)
    seed_module.seed_history(db, school, reference)
    assert (
        seed_module.seed_communications(
            db,
            school.admin,
            school.registrations[0, 0].division_id,
            school.registrations[1, 0].division_id,
            reference,
            dual_channel_only=True,
        )
        == 0
    )
    seed_module.seed_conversations(db, school, reference)
    creados = seed_module.seed_audit(db, school, reference)
    assert creados > 0
    assert seed_module.seed_audit(db, school, reference) == 0
    db.commit()
    assert db.query(WorkflowExecution).filter_by(estado="exitoso").count() == 1
    assert db.query(ConversacionContextual).count() == 24
    assert db.query(MensajeConversacion).count() == 48
    assert db.query(SolicitudAusenciaPeriodo).count() == 8
    for entidad in (
        "ALUMNO",
        "FAMILIA",
        "INSCRIPCION",
        "ASISTENCIA",
        "JUSTIFICACION_INASISTENCIA",
        "FACTURA",
        "PAGO",
        "PROVEEDOR",
        "COMUNICACION",
        "CONVERSACION_CONTEXTUAL",
    ):
        assert db.query(AuditLog).filter_by(entidad=entidad).count() > 0, entidad
    assert (
        db.query(AuditLog).filter_by(entidad="ASISTENCIA").count() == db.query(Asistencia).count()
    )

    def login(alias):
        client.cookies.clear()
        response = client.post(
            "/auth/login", json={"email": f"{alias}@demo.esseri.test", "password": password}
        )
        assert response.status_code == 200, response.text

    def ok(response, status=200):
        assert response.status_code == status, response.text
        return response.json()

    login("docente")
    teacher_divisions = ok(
        client.get("/academico/docentes/me/divisiones", params={"ciclo_lectivo": "2026"})
    )
    assert 0 < len(teacher_divisions) < 15
    login("direccion")
    assert ok(client.get("/panel-admin/indicadores-direccion"))["alumnos_activos"] == 246
    assert client.post("/facturacion/cobranzas-simuladas", json={}).status_code == 403
    login("admin")
    assert ok(client.get("/panel-admin/indicadores-administracion"))
    assert len(ok(client.get("/proveedores-compras/proveedores"))) == 15
    comunicaciones = ok(client.get("/comunicaciones", params={"pagina": 1}))
    assert comunicaciones["total"] == 18
    ejemplos = [
        ok(client.get(f"/comunicaciones/{seed_module.stable_id(f'communication:{i}')}"))
        for i in range(9, 18)
    ]
    assert [
        sum(bool(c["evento"]) and not c["adjuntos"] for c in ejemplos),
        sum(not c["evento"] and bool(c["adjuntos"]) for c in ejemplos),
        sum(bool(c["evento"]) and bool(c["adjuntos"]) for c in ejemplos),
    ] == [3, 3, 3]
    for ejemplo in ejemplos:
        assert len(ejemplo["cuerpo"]) >= 400
        for adjunto in ejemplo["adjuntos"]:
            archivo = client.get(
                f"/comunicaciones/{ejemplo['id']}/adjuntos/{adjunto['id']}/archivo"
            )
            assert archivo.status_code == 200, archivo.text
            assert archivo.headers["content-type"] == "application/pdf"
            assert archivo.content.startswith(b"%PDF-")
            assert len(archivo.content) == adjunto["tamanio"]
    items = (
        comunicaciones["items"] + ok(client.get("/comunicaciones", params={"pagina": 2}))["items"]
    )
    canales = [c["canal"] for c in items]
    assert canales.count("portal") == 13
    assert canales.count("ambos") == 5
    assert {c["tipo"] for c in items} == {
        "institucional",
        "administrativa",
        "otro",
    }
    for comunicacion in items:
        entrega = ok(client.get(f"/comunicaciones/{comunicacion['id']}/entrega"))
        resumen = entrega["resumen"]
        assert resumen["lectura_aplica"] is True
        assert resumen["email_aplica"] == (comunicacion["canal"] == "ambos")
        if comunicacion["canal"] == "ambos":
            assert resumen["responsables_leidos"] > 0
            assert resumen["responsables_no_leidos"] > 0
            assert resumen["emails_aceptados"] == resumen["emails"] > 0
            assert resumen["emails_pendientes"] == 0
            assert all(
                envio["intentos"][0]["estado"] == "presentado"
                for item in entrega["items"]
                for envio in item["emails"]
                if envio["email"]
            )
    inbox = ok(client.get("/comunicaciones/conversaciones", params={"limite": 50}))
    assert len(inbox["items"]) == 24
    estados = [item["estado"] for item in inbox["items"]]
    assert {estado: estados.count(estado) for estado in set(estados)} == {
        "resuelta": 8,
        "pendiente_familia": 8,
        "pendiente_administracion": 8,
    }

    prefix = "/facturacion/cobranzas-simuladas"
    assert (
        ok(client.get(f"{prefix}/facturas-elegibles", params={"periodo": "2026-11"}))["total"] == 30
    )

    def export(term):
        data = {
            "seleccion": {"modo": "filtrados", "filtros": {"periodo": "2026-11", "buscar": term}}
        }
        return ok(client.post(prefix, json=data), 201)

    login("workflow")
    event_type = db.scalar(
        select(TipoEvento.id).where(TipoEvento.nombre == "debito.resultado_registrado")
    )
    rule = ok(
        client.post(
            "/workflows/reglas",
            json={
                "nombre": "Avisar rechazo de la demo",
                "tipo_evento_id": str(event_type),
                "nodos": [
                    item.model_dump(mode="json")
                    for item in nodos_de_regla_simple(
                        condicion={"campo": "resultado", "operador": "==", "valor": "rechazado"},
                        tipo_accion="notificar",
                        notificacion_template_id=seed_module.stable_id("template:debit:rechazado"),
                        accion_config={
                            "destinatario": "responsable_economico",
                            "enlace": "familia_facturacion",
                        },
                    )
                ],
            },
        ),
        201,
    )

    login("admin")
    lot, pending = export("ID-RENDICION"), export("ID-RESERVA")
    assert (lot["cantidad_facturas"], pending["cantidad_facturas"]) == (28, 2)
    content = seed_module.bank_response(lot["solicitudes"][0]["contenido"], reference)
    preview = ok(client.post(f"{prefix}/previsualizar", json={"contenido": content}))
    assert preview["puede_confirmar"] is True
    assert db.query(Pago).count() == 750
    assert db.query(EventLog).filter_by(tipo_evento_id=event_type).count() == 0

    confirmation = {"importacion_id": preview["id"], "revision_confirmada": True}
    imported = ok(client.post(f"{prefix}/confirmar", json=confirmation))
    assert imported["estado"] == "confirmada"
    assert imported["resumen"]["cobrados"]["cantidad"] == 20
    assert imported["resumen"]["rechazados"]["cantidad"] == 8

    sent = []
    monkeypatch.setattr(
        n8n_client, "enviar_email", lambda recipient, *a, **kw: sent.append(recipient)
    )
    login("workflow")
    assert ok(client.post("/workflows/procesar"))
    assert len(sent) == 8
    assert "familia-21@demo.esseri.test" in sent
    assert (
        db.query(WorkflowExecution).filter_by(workflow_rule_id=uuid.UUID(rule["id"])).count() == 8
    )

    login("admin")
    assert (
        ok(client.post(f"{prefix}/previsualizar", json={"contenido": content}))["id"]
        == preview["id"]
    )
    assert ok(client.post(f"{prefix}/confirmar", json=confirmation))["estado"] == "confirmada"
    login("workflow")
    assert ok(client.post("/workflows/procesar"))
    assert len(sent) == 8
    assert db.query(Pago).count() == 770
    assert db.query(Movimiento).filter_by(tipo="haber").count() == 770
    assert db.get(Factura, seed_module.stable_id("bill:202611:0")).estado == "pagada"
    assert db.get(Factura, seed_module.stable_id("bill:202611:20")).estado == "pendiente"
    assert db.get(Factura, seed_module.stable_id("bill:202611:28")).estado == "pendiente"
    assert db.query(EventLog).filter_by(tipo_evento_id=event_type).count() == 28
    assert db.query(AuditLog).filter_by(entidad="DEBITO_COBRANZA").count() == 28
    assert (
        db.query(DebitoCobranza).filter_by(lote_id=uuid.UUID(pending["id"]), resultado=None).count()
        == 2
    )
    assert db.query(NotificacionInterna).filter_by(tipo="facturacion.debito_rechazado").count() == 8
    assert ok(client.get("/auditoria", params={"entidad": "DEBITO_COBRANZA"}))["total"] == 28

    def debt_as(alias, role):
        context = ContextoHerramienta(
            db=db,
            usuario=db.get(Usuario, seed_module.stable_id(f"account:{alias}")),
            rol_codigo=role,
            conversacion_id=uuid.uuid4(),
            ciclo_lectivo="2026",
            hoy=reference,
            max_filas=5,
        )
        return herramientas.ejecutar(context, "deuda_por_familias", {}).para_llm

    assert "error" not in debt_as("direccion", "direccion")

    login("familia-21")
    portal = ok(client.get("/facturacion/familia/me"))
    assert len(portal["avisos_debito"]) == 1
    assert "Saldo insuficiente" in portal["avisos_debito"][0]["cuerpo"]
    own_id = school.students[20].id
    schedule = ok(client.get(f"/academico/familia/alumnos/{own_id}/horario"))
    assert len(schedule) == 5 and all(row["horarios"] and row["docentes"] for row in schedule)
    events = ok(
        client.get(
            "/comunicaciones/familia/eventos",
            params={
                "alumno_id": str(own_id),
                "desde": "2026-11-16",
                "hasta": "2026-11-22",
            },
        )
    )
    assert [row["titulo"] for row in events] == ["Feria de ciencias"]
    assert (
        client.get(f"/academico/familia/alumnos/{school.students[0].id}/horario").status_code == 403
    )
    assert client.get(prefix).status_code == 403
    assert client.get("/asistente/conversaciones").status_code == 403
    assert ok(client.get("/comunicaciones/conversaciones"))["total"] == 0
    login("familia-29")
    assert not ok(client.get("/facturacion/familia/me"))["avisos_debito"]
