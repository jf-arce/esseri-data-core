from datetime import date
from importlib import import_module
from pathlib import Path
from uuid import uuid4

import pytest
from sqlalchemy import select

from src.academico.models import Anio, NivelEducativo
from src.auth.models import Usuario
from src.inscripciones.models import SolicitudInscripcion
from src.models import Persona

ROOT = Path(__file__).resolve().parents[2]
SEEDS = ROOT / "database/seeds"


@pytest.fixture
def grupo_c(monkeypatch, db_session):
    monkeypatch.syspath_prepend(str(SEEDS))
    module = import_module("02_seed_grupo_c")
    monkeypatch.setattr(module, "SessionLocal", lambda: db_session)
    return module


def names(db):
    return sorted(db.scalars(select(NivelEducativo.nombre)))


def test_unused_legacy_levels_are_renamed_without_duplicates(grupo_c, db_session):
    db_session.add(NivelEducativo(nombre="Inicial"))
    db_session.flush()
    legacy_id = db_session.scalar(
        select(NivelEducativo.id).where(NivelEducativo.nombre == "Inicial")
    )

    grupo_c.seed_grupo_c()

    assert names(db_session) == ["Nivel Inicial", "Nivel Primario", "Nivel Secundario"]
    assert db_session.get(NivelEducativo, legacy_id).nombre == "Nivel Inicial"


def test_referenced_legacy_level_is_kept_and_not_duplicated(grupo_c, db_session):
    legacy = NivelEducativo(nombre="Primario")
    db_session.add(legacy)
    db_session.flush()
    db_session.add(Anio(numero=4, nivel_educativo_id=legacy.id))
    db_session.flush()

    grupo_c.seed_grupo_c()

    assert names(db_session) == ["Nivel Inicial", "Nivel Secundario", "Primario"]
    assert (
        db_session.scalar(
            select(NivelEducativo.id).where(NivelEducativo.nombre == "Nivel Primario")
        )
        is None
    )


def test_unused_duplicate_is_removed_when_canonical_exists(grupo_c, db_session):
    db_session.add_all(
        [
            NivelEducativo(nombre="Nivel Inicial"),
            NivelEducativo(nombre="Nivel Primario"),
            NivelEducativo(nombre="Nivel Secundario"),
            NivelEducativo(nombre="Primario"),
        ]
    )
    db_session.flush()

    grupo_c.seed_grupo_c()

    assert names(db_session) == ["Nivel Inicial", "Nivel Primario", "Nivel Secundario"]


def test_referenced_legacy_level_blocks_duplicate_creation(grupo_c, db_session):
    legacy = NivelEducativo(nombre="Secundario")
    persona = Persona(nombre="Aspirante", apellido="Demo", dni=uuid4().hex[:8])
    usuario = Usuario(email=f"{uuid4().hex[:8]}@example.test", auth_provider="local")
    db_session.add_all([legacy, persona, usuario])
    db_session.flush()
    db_session.add(
        SolicitudInscripcion(
            ciclo_lectivo="2027",
            etapa="consulta_lead",
            fecha_solicitud=date(2026, 5, 1),
            aspirante_persona_id=persona.id,
            nivel_educativo_id=legacy.id,
            usuario_id=usuario.id,
        )
    )
    db_session.flush()

    grupo_c.seed_grupo_c()

    assert names(db_session) == ["Nivel Inicial", "Nivel Primario", "Secundario"]
