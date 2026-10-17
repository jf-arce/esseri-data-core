"""Reglas de mora del seed de demo (#216): `crear_tarea` para Administración a partir de los 15
días vencida y `escalar_caso` (con aprobación humana) a partir de los 30."""

import importlib.util
import uuid
from pathlib import Path

import pytest
from sqlalchemy import select

from src.auth.models import Rol, Usuario, UsuarioRol
from src.workflows import despacho_service, ejecuciones_service
from src.workflows.eventos_service import emit_event
from src.workflows.models import ReglaDestinatario, Tarea, WorkflowExecution, WorkflowRule

SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "04_seed_demo.py"


@pytest.fixture(scope="module")
def seed_demo():
    """El seed no es un paquete (su nombre empieza con un número): se carga por ruta."""
    spec = importlib.util.spec_from_file_location("seed_demo", SEED)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _usuario_con_rol(db, email, rol):
    usuario = Usuario(email=email, auth_provider="local", password_hash="x", estado="activo")
    db.add(usuario)
    db.flush()
    db.add(UsuarioRol(usuario_id=usuario.id, rol_id=rol.id))
    db.flush()
    return usuario


@pytest.fixture()
def escenario(db_session, tipo_factura_vencida, seed_demo):
    administracion = Rol(nombre="administración")
    direccion = Rol(nombre="dirección")
    db_session.add_all([administracion, direccion])
    db_session.flush()
    administrativa = _usuario_con_rol(db_session, "admin@esseri.edu.ar", administracion)
    directora = _usuario_con_rol(db_session, "directora@esseri.edu.ar", direccion)
    demo = Usuario(
        email="demo@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    db_session.add(demo)
    db_session.commit()
    seed_demo._ensure_reglas_workflow(db_session, demo)
    return {"administrativa": administrativa, "directora": directora, "demo": demo}


def _emitir(db, dias_vencido, factura_id):
    emit_event(
        db,
        tipo="factura.vencida",
        entidad="factura",
        entidad_id=factura_id,
        payload={"dias_vencido": dias_vencido, "monto_deuda": 1500, "nombre_familia": "Cabral"},
    )
    db.commit()
    despacho_service.procesar_eventos_pendientes(db)


def _regla(db, nombre):
    return db.scalars(select(WorkflowRule).where(WorkflowRule.nombre == nombre)).one()


def test_el_seed_crea_las_dos_reglas_de_mora_con_su_destinatario(db_session, escenario):
    crear = _regla(db_session, "Mora > 15 días: crear tarea")
    escalar = _regla(db_session, "Mora > 30 días: escalar caso")

    assert crear.tipo_accion == "crear_tarea"
    assert crear.condicion == {"campo": "dias_vencido", "operador": ">", "valor": 15}
    assert crear.requiere_aprobacion_humana is False
    assert escalar.tipo_accion == "escalar_caso"
    assert escalar.condicion == {"campo": "dias_vencido", "operador": ">", "valor": 30}
    # Nace con aprobación humana: toma el default de la acción, no un valor fijado en el seed.
    assert escalar.requiere_aprobacion_humana is True
    roles = {
        regla.id: db_session.get(Rol, d.rol_id).nombre
        for regla in (crear, escalar)
        for d in db_session.scalars(
            select(ReglaDestinatario).where(ReglaDestinatario.workflow_rule_id == regla.id)
        )
    }
    assert roles == {crear.id: "administración", escalar.id: "dirección"}


def test_correr_el_seed_de_nuevo_no_duplica_ni_pisa_las_reglas(db_session, escenario, seed_demo):
    crear = _regla(db_session, "Mora > 15 días: crear tarea")
    crear.activo = False
    db_session.commit()

    seed_demo._ensure_reglas_workflow(db_session, escenario["demo"])

    assert len(db_session.scalars(select(WorkflowRule)).all()) == 2
    db_session.refresh(crear)
    assert crear.activo is False


def test_con_15_dias_o_menos_no_se_dispara_ninguna_regla(db_session, escenario):
    _emitir(db_session, 15, uuid.uuid4())

    assert db_session.scalars(select(WorkflowExecution)).all() == []
    assert db_session.scalars(select(Tarea)).all() == []


def test_entre_16_y_30_dias_se_crea_la_tarea_para_administracion(db_session, escenario):
    factura = uuid.uuid4()

    _emitir(db_session, 20, factura)

    tarea = db_session.scalars(select(Tarea)).one()
    assert (tarea.usuario_id, tarea.entidad, tarea.entidad_id) == (
        escenario["administrativa"].id,
        "factura",
        factura,
    )
    assert tarea.estado == "pendiente"
    ejecucion = db_session.scalars(select(WorkflowExecution)).one()
    assert ejecucion.estado == "exitoso"


def test_con_mas_de_30_dias_la_tarea_se_crea_y_el_escalamiento_espera_aprobacion(
    db_session, escenario
):
    _emitir(db_session, 40, uuid.uuid4())

    ejecuciones = {
        db_session.get(WorkflowRule, e.workflow_rule_id).tipo_accion: e.estado
        for e in db_session.scalars(select(WorkflowExecution))
    }
    assert ejecuciones == {"crear_tarea": "exitoso", "escalar_caso": "pendiente"}
    # Mientras no se apruebe, solo existe la tarea de Administración.
    assert [t.usuario_id for t in db_session.scalars(select(Tarea))] == [
        escenario["administrativa"].id
    ]


def test_al_aprobar_el_escalamiento_la_tarea_pasa_a_escalada_y_se_crea_una_para_direccion(
    db_session, escenario
):
    _emitir(db_session, 40, uuid.uuid4())
    pendiente = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.estado == "pendiente")
    ).one()

    resultado = ejecuciones_service.aprobar_ejecucion(
        db_session, pendiente.id, escenario["demo"].id
    )

    assert resultado.estado == "exitoso"
    original = db_session.scalars(
        select(Tarea).where(Tarea.usuario_id == escenario["administrativa"].id)
    ).one()
    escalada = db_session.scalars(
        select(Tarea).where(Tarea.usuario_id == escenario["directora"].id)
    ).one()
    assert original.estado == "escalada"
    assert (escalada.estado, escalada.prioridad, escalada.tarea_id) == (
        "pendiente",
        "alta",
        original.id,
    )
