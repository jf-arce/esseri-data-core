"""Live-schema checks and a data-preserving downgrade refusal on isolated PostgreSQL."""

import importlib.util
import os
import uuid
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import inspect

from src.comunicaciones.models import Comunicacion

pytestmark = pytest.mark.skipif(
    not os.environ.get("COMUNICACIONES_TEST_DATABASE_URL"),
    reason="Requires explicitly selected migrated isolated PostgreSQL",
)


def test_migracion_tiene_checks_de_canal_origen_y_estados(db_session):
    inspector = inspect(db_session.connection())
    checks = {c["name"] for c in inspector.get_check_constraints("notificacion")}
    assert {"ck_notificacion_origen", "ck_notificacion_estado_envio"}.issubset(checks)
    assert "ck_comunicacion_canal" in {
        c["name"] for c in inspector.get_check_constraints("comunicacion")
    }
    assert "comunicacion_adjunto_contenido" in inspector.get_table_names()
    assert "contenido" not in {c["name"] for c in inspector.get_columns("comunicacion_adjunto")}


def test_downgrade_no_borra_publicaciones_solo_email(db_session, escenario_dos_familias):
    path = (
        Path(__file__).parents[2]
        / "alembic"
        / "versions"
        / "7b60ea457979_add_communication_channels_private_.py"
    ).resolve()
    spec = importlib.util.spec_from_file_location("stage3_revision", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    c = Comunicacion(
        clave=uuid.uuid4(),
        solicitud_hash="c" * 64,
        autor_id=escenario_dos_familias["usuario_a"],
        asunto="Rollback sentinel",
        cuerpo="Test",
        audiencia={"tipo": "todos", "ids": []},
        canal="email",
    )
    db_session.add(c)
    db_session.flush()
    with Operations.context(MigrationContext.configure(db_session.connection())):
        with pytest.raises(RuntimeError, match="data-safe rollback"):
            module.downgrade()
    assert db_session.get(Comunicacion, c.id).canal == "email"
