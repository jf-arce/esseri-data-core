"""Seed canónico del aviso de revocación: crea la plantilla y la regla una sola vez."""

import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import select

from src.workflows.models import CampoEvento, NotificacionTemplate, TipoEvento, WorkflowRule

SEED = Path(__file__).resolve().parents[3] / "database" / "seeds" / "06_seed_aviso_revocacion.py"
EVENTO = "solicitud_ausencia_periodo.revocada"
CAMPOS = (
    ("alumno_nombre", "texto"),
    ("motivo", "texto"),
    ("fecha_inicio", "fecha"),
    ("fecha_fin", "fecha"),
)


@pytest.fixture(scope="module")
def seed_aviso():
    """El seed no es un paquete (su nombre empieza con un número): se carga por ruta."""
    spec = importlib.util.spec_from_file_location("seed_aviso_revocacion", SEED)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _tipo_evento(db, *, con_campos: bool = True) -> TipoEvento:
    tipo = TipoEvento(nombre=EVENTO, descripcion="Solicitud revocada")
    db.add(tipo)
    db.flush()
    if con_campos:
        for nombre, tipo_dato in CAMPOS:
            db.add(
                CampoEvento(
                    tipo_evento_id=tipo.id,
                    nombre_interno=nombre,
                    etiqueta=nombre,
                    tipo_dato=tipo_dato,
                )
            )
    db.commit()
    return tipo


def test_crea_plantilla_y_regla_una_sola_vez(db_session, seed_aviso):
    _tipo_evento(db_session)

    seed_aviso.seed(db_session)
    seed_aviso.seed(db_session)

    plantillas = db_session.scalars(select(NotificacionTemplate)).all()
    reglas = db_session.scalars(select(WorkflowRule)).all()
    assert len(plantillas) == 1
    assert len(reglas) == 1
    plantilla, regla = plantillas[0], reglas[0]
    assert plantilla.nombre == seed_aviso.PLANTILLA["nombre"]
    assert regla.nombre == seed_aviso.REGLA["nombre"]
    assert regla.tipo_accion == "notificar"
    assert regla.accion_config["destinatario"] == "responsables_habilitados"
    assert regla.notificacion_template_id == plantilla.id
    assert regla.activo is True


def test_falla_con_un_mensaje_claro_si_faltan_los_campos_del_evento(db_session, seed_aviso):
    _tipo_evento(db_session, con_campos=False)

    with pytest.raises(SystemExit) as error:
        seed_aviso.seed(db_session)

    assert "03_seed_grupo_b.py" in str(error.value)
    assert db_session.scalar(select(NotificacionTemplate)) is None


def test_falla_con_un_mensaje_claro_si_falta_el_tipo_de_evento(db_session, seed_aviso):
    with pytest.raises(SystemExit) as error:
        seed_aviso.seed(db_session)

    assert "01_seed_grupo_a.py" in str(error.value)


def test_segunda_corrida_cambia_ids_ni_pisa_lo_editado(db_session, seed_aviso):
    _tipo_evento(db_session)
    seed_aviso.seed(db_session)
    plantilla = db_session.scalar(select(NotificacionTemplate))
    regla = db_session.scalar(select(WorkflowRule))
    ids = (plantilla.id, regla.id)

    plantilla.asunto = "Editado a mano"
    regla.criticidad = "alta"
    db_session.commit()

    seed_aviso.seed(db_session)

    plantilla = db_session.scalar(select(NotificacionTemplate))
    regla = db_session.scalar(select(WorkflowRule))
    assert (plantilla.id, regla.id) == ids
    assert plantilla.asunto == "Editado a mano"
    assert regla.criticidad == "alta"
