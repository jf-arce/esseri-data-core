"""Loop A de la demo (#206, #209): alta integrada en vivo -> bienvenida a la familia y cargo de
matrícula con aprobación humana."""

import importlib.util
from datetime import date
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select

from src.academico.models import Anio, Division, NivelEducativo
from src.auth.models import Usuario
from src.facturacion.models import ConceptoCobro, Factura
from src.inscripciones import admisiones_service
from src.inscripciones.models import SolicitudInscripcion
from src.inscripciones.schemas import AltaIntegradaAdmisionCreate
from src.models import Persona
from src.workflows import acciones_admision_service
from src.workflows.despacho_service import procesar_eventos_pendientes
from src.workflows.ejecuciones_service import aprobar_ejecucion
from src.workflows.models import WorkflowExecution, WorkflowRule
from tests.inscripciones.conftest import catalogo_evento_inscripcion_confirmada  # noqa: F401

SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "04_seed_demo.py"
HOY = date(2026, 10, 28)


@pytest.fixture(scope="module")
def seed_demo():
    """El seed no es un paquete (su nombre empieza con un número): se carga por ruta."""
    spec = importlib.util.spec_from_file_location("seed_demo_loop_a", SEED)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


@pytest.fixture()
def demo(db_session, seed_demo, monkeypatch):
    monkeypatch.setattr(seed_demo, "DEMO_EMAIL_BASE", "")
    monkeypatch.setattr(acciones_admision_service, "fecha_operativa_argentina", lambda: HOY)
    nivel = NivelEducativo(nombre="Nivel Primario")
    db_session.add_all([nivel, ConceptoCobro(nombre="Matrícula", activo=True)])
    db_session.flush()
    anio = Anio(numero=1, nivel_educativo_id=nivel.id)
    db_session.add(anio)
    db_session.flush()
    division = Division(nombre="1° A", anio_id=anio.id)
    usuario = Usuario(
        email="demo@esseri.edu.ar", auth_provider="local", password_hash="x", estado="activo"
    )
    db_session.add_all([division, usuario])
    db_session.commit()

    def sembrar():
        seed_demo._ensure_admision_en_vivo(db_session, usuario, {"Nivel Primario": nivel}, HOY)
        seed_demo._ensure_reglas_loop_a(db_session, usuario)
        db_session.commit()

    sembrar()
    return {"usuario": usuario, "division": division, "sembrar": sembrar}


def _lista(db):
    """La solicitud del aspirante en vivo que todavía no se finalizó."""
    return db.scalars(
        select(SolicitudInscripcion)
        .join(Persona, Persona.id == SolicitudInscripcion.aspirante_persona_id)
        .where(Persona.dni.like("5092%"))
        .order_by(Persona.dni)
    ).all()


def _finalizar(db, demo, solicitud):
    return admisiones_service.finalizar_admision_con_alta_integrada(
        db,
        solicitud.id,
        AltaIntegradaAdmisionCreate(
            division_id=demo["division"].id,
            usar_contacto_como_familia=True,
            confirmar_familia_nueva_como_responsable_economico=True,
        ),
        demo["usuario"].id,
    )


def test_el_seed_crea_las_reglas_y_una_solicitud_lista(db_session, demo):
    cargo = db_session.scalars(
        select(WorkflowRule).where(WorkflowRule.nombre == "Loop A 1: cargo de matrícula")
    ).one()
    bienvenida = db_session.scalars(
        select(WorkflowRule).where(WorkflowRule.nombre == "Loop A 2: bienvenida a la familia")
    ).one()
    assert cargo.tipo_accion == "generar_cargo"
    assert cargo.requiere_aprobacion_humana is True
    assert cargo.accion_config["monto"] == "120000.00"
    assert bienvenida.accion_config["destinatario"] == "responsables_habilitados"
    assert bienvenida.notificacion_template_id is not None

    [solicitud] = _lista(db_session)
    assert (solicitud.etapa, solicitud.estado, solicitud.ciclo_lectivo) == (
        "inscripcion_confirmada",
        "aprobada",
        "2027",
    )
    assert solicitud.contacto_parentesco == "Madre"


def test_volver_a_sembrar_no_duplica_mientras_siga_lista(db_session, demo):
    demo["sembrar"]()

    assert len(_lista(db_session)) == 1
    assert len(db_session.scalars(select(WorkflowRule)).all()) == 2


def test_alta_en_vivo_bienvenida_y_cargo_con_aprobacion(db_session, demo, envios):
    [solicitud] = _lista(db_session)

    _finalizar(db_session, demo, solicitud)
    procesar_eventos_pendientes(db_session)

    # La bienvenida sale enseguida, a la madre que hizo el trámite.
    assert [e[0] for e in envios.enviados] == ["familia-28555001@esseri.local"]
    assert "Lucía" in envios.enviados[0][1]
    # La matrícula espera la aprobación de una persona.
    pendiente = db_session.scalars(
        select(WorkflowExecution).where(WorkflowExecution.estado == "pendiente")
    ).one()
    assert db_session.scalars(select(Factura)).all() == []

    aprobar_ejecucion(db_session, pendiente.id, demo["usuario"].id)

    [factura] = db_session.scalars(select(Factura)).all()
    assert factura.monto_total == Decimal("120000.00")
    assert factura.fecha_vencimiento == date(2026, 11, 7)


def test_despues_de_la_demo_el_seed_deja_otra_solicitud_lista(db_session, demo, envios):
    [primera] = _lista(db_session)
    _finalizar(db_session, demo, primera)

    demo["sembrar"]()

    _, segunda = _lista(db_session)
    assert segunda.etapa == "inscripcion_confirmada"
    aspirante = db_session.get(Persona, segunda.aspirante_persona_id)
    assert aspirante.nombre == "Bruno"
    # La misma madre: su familia ya existe y se reutiliza en la segunda alta.
    _finalizar(db_session, demo, segunda)
