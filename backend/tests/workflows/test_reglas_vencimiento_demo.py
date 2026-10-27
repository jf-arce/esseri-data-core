"""Reglas de vencimiento del seed de demo (#205): marcar la factura vencida, alertar a
Administración y avisar a la familia."""

import importlib.util
from datetime import date, timedelta
from pathlib import Path

import pytest
from sqlalchemy import select

from src.auth.models import Rol, Usuario, UsuarioRol
from src.facturacion.models import Factura, ResponsableEconomico
from src.facturacion.vencimientos_service import detectar_facturas_vencidas
from src.familias_alumnos.models import Familia
from src.workflows import despacho_service, n8n_client
from src.workflows.eventos_service import emit_event
from src.workflows.models import (
    NotificacionTemplate,
    ReglaDestinatario,
    WorkflowExecution,
    WorkflowRule,
)
from tests.inscripciones.factories import crear_escenario, crear_inscripcion_previa

SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "04_seed_demo.py"


@pytest.fixture(scope="module")
def seed_demo():
    """El seed no es un paquete (su nombre empieza con un número): se carga por ruta."""
    spec = importlib.util.spec_from_file_location("seed_demo_vencimiento", SEED)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture()
def envios(monkeypatch):
    enviados: list[tuple[str, str, str]] = []

    def enviar(destinatario, asunto, cuerpo, transport=None):
        enviados.append((destinatario, asunto, cuerpo))

    monkeypatch.setattr(n8n_client, "enviar_email", enviar)
    return enviados


@pytest.fixture()
def escenario(db_session, tipo_factura_vencida, seed_demo, monkeypatch):
    monkeypatch.setattr(seed_demo, "DEMO_EMAIL_BASE", "")
    db_session.add_all([Rol(nombre="administración"), Rol(nombre="dirección")])
    demo = Usuario(
        email="demo@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    db_session.add(demo)
    db_session.flush()

    datos = crear_escenario(db_session)
    inscripcion = crear_inscripcion_previa(db_session, datos, estado="activa")
    familia = db_session.get(Familia, datos["familia_id"])
    responsable = ResponsableEconomico(
        vigencia_desde=date.today() - timedelta(days=90),
        vigencia_hasta=None,
        alumno_id=datos["alumno_id"],
        familia_id=familia.id,
    )
    db_session.add(responsable)
    db_session.flush()
    factura = Factura(
        fecha_emision=date.today() - timedelta(days=40),
        fecha_vencimiento=date.today() - timedelta(days=3),
        monto_total=1500,
        estado="pendiente",
        inscripcion_id=inscripcion.id,
        responsable_economico_id=responsable.id,
    )
    db_session.add(factura)
    db_session.commit()
    return {"demo": demo, "familia": familia, "factura": factura, "datos": datos}


def _sembrar(seed_demo, db, escenario):
    seed_demo._ensure_cuentas_personal(db)
    seed_demo._ensure_cuentas_familias(db, [escenario["familia"]])
    seed_demo._ensure_reglas_vencimiento(db, escenario["demo"])
    db.commit()


def _regla(db, nombre):
    return db.scalars(select(WorkflowRule).where(WorkflowRule.nombre == nombre)).one()


def test_el_seed_crea_las_reglas_con_su_accion_y_destinatarios(db_session, escenario, seed_demo):
    _sembrar(seed_demo, db_session, escenario)

    marcar = _regla(db_session, "Vencimiento 1: marcar factura vencida")
    alerta = _regla(db_session, "Vencimiento 2: alerta a Administración")
    aviso = _regla(db_session, "Vencimiento 3: aviso a la familia")
    assert [r.tipo_accion for r in (marcar, alerta, aviso)] == [
        "aplicar_vencimiento",
        "alerta_interna",
        "notificar",
    ]
    assert all(r.condicion == {} for r in (marcar, alerta, aviso))
    assert aviso.accion_config == {"destinatario": "responsable_economico"}
    plantilla = db_session.get(NotificacionTemplate, aviso.notificacion_template_id)
    assert plantilla.nombre == "Aviso de factura vencida"
    plantilla_alerta = db_session.get(NotificacionTemplate, alerta.notificacion_template_id)
    assert plantilla_alerta.asunto == "Factura vencida: familia {{nombre_familia}}"
    por_regla = {
        r.id: db_session.get(Rol, d.rol_id).nombre
        for r in (marcar, alerta, aviso)
        for d in db_session.scalars(
            select(ReglaDestinatario).where(ReglaDestinatario.workflow_rule_id == r.id)
        )
    }
    assert por_regla == {alerta.id: "administración"}
    penalidad = _regla(db_session, "Vencimiento 4: aplicar penalidad por mora")
    assert penalidad.tipo_accion == "aplicar_penalidad"
    assert penalidad.requiere_aprobacion_humana is True


def test_correr_el_seed_de_nuevo_no_duplica_ni_pisa(db_session, escenario, seed_demo):
    _sembrar(seed_demo, db_session, escenario)
    alerta = _regla(db_session, "Vencimiento 2: alerta a Administración")
    alerta.activo = False
    db_session.commit()
    cuentas = len(db_session.scalars(select(Usuario)).all())

    _sembrar(seed_demo, db_session, escenario)

    assert len(db_session.scalars(select(WorkflowRule)).all()) == 4
    assert len(db_session.scalars(select(NotificacionTemplate)).all()) == 2
    assert len(db_session.scalars(select(Usuario)).all()) == cuentas
    db_session.refresh(alerta)
    assert alerta.activo is False


def _verificar_cadena(db, escenario, envios):
    ejecuciones = db.scalars(select(WorkflowExecution)).all()
    # La penalidad queda esperando aprobación humana.
    assert sorted(e.estado for e in ejecuciones) == ["exitoso"] * 3 + ["pendiente"]
    db.refresh(escenario["factura"])
    assert escenario["factura"].estado == "vencida"
    destinatarios = sorted(d for d, _, _ in envios)
    assert len(destinatarios) == 2
    assert destinatarios[0].startswith("administracion@")
    assert destinatarios[1].startswith("familia-")
    aviso = next(e for e in envios if e[0].startswith("familia-"))
    assert "{{" not in aviso[1] + aviso[2]


def test_con_un_evento_emitido_a_mano_se_marca_vencida_y_salen_los_dos_mails(
    db_session, escenario, seed_demo, envios
):
    _sembrar(seed_demo, db_session, escenario)
    escenario["factura"].estado = "pendiente"
    escenario["factura"].fecha_vencimiento = date.today() - timedelta(days=3)
    emit_event(
        db_session,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=escenario["factura"].id,
        payload={"dias_vencido": 3, "monto_deuda": 1500, "nombre_familia": "Cabral"},
    )
    db_session.commit()

    despacho_service.procesar_eventos_pendientes(db_session)

    _verificar_cadena(db_session, escenario, envios)


def test_detector_evento_despacho_y_segunda_deteccion_sin_eventos(
    db_session, escenario, seed_demo, envios
):
    _sembrar(seed_demo, db_session, escenario)
    hoy = date.today()
    escenario["factura"].estado = "pendiente"
    escenario["factura"].fecha_vencimiento = hoy - timedelta(days=3)
    db_session.commit()

    primera = detectar_facturas_vencidas(db_session, fecha_actual=hoy)
    db_session.commit()
    despacho_service.procesar_eventos_pendientes(db_session)
    segunda = detectar_facturas_vencidas(db_session, fecha_actual=hoy)

    assert primera.eventos_emitidos == 1
    assert segunda.eventos_emitidos == 0
    _verificar_cadena(db_session, escenario, envios)


def test_cuentas_con_alias_de_la_variable_o_esseri_local(
    db_session, escenario, seed_demo, monkeypatch
):
    monkeypatch.setattr(seed_demo, "DEMO_EMAIL_BASE", "equipo@gmail.com")
    _sembrar(seed_demo, db_session, escenario)

    dni = db_session.get(Familia, escenario["familia"].id).persona.dni
    emails = set(db_session.scalars(select(Usuario.email)))
    assert {
        "equipo+administracion@gmail.com",
        "equipo+direccion@gmail.com",
        f"equipo+familia-{dni}@gmail.com",
    } <= emails
    roles = {db_session.get(Rol, ur.rol_id).nombre for ur in db_session.scalars(select(UsuarioRol))}
    assert {"administración", "dirección"} <= roles


def test_no_toca_las_cuentas_que_ya_existen(db_session, escenario, seed_demo, capsys):
    persona_id = escenario["familia"].persona_id
    previa = Usuario(
        email="mama@example.com",
        auth_provider="local",
        password_hash="x",
        estado="inactivo",
        persona_id=persona_id,
    )
    db_session.add(previa)
    db_session.commit()

    _sembrar(seed_demo, db_session, escenario)

    db_session.refresh(previa)
    assert (previa.estado, previa.email) == ("inactivo", "mama@example.com")
    assert (
        len(db_session.scalars(select(Usuario).where(Usuario.persona_id == persona_id)).all()) == 1
    )
    assert "Aviso" in capsys.readouterr().out
