import importlib.util
import uuid
from datetime import date, time
from pathlib import Path
from unittest.mock import patch

import pytest
import sqlalchemy as sa
from alembic.script import ScriptDirectory
from sqlalchemy import inspect
from sqlalchemy.exc import IntegrityError

from src.academico.models import (
    HorarioMateriaCurso,
    Materia,
    MateriaCurso,
    SolicitudAusenciaPeriodo,
)
from src.inscripciones.models import Asistencia


def test_migration_graph_has_one_head_and_preserves_both_branches():
    scripts = ScriptDirectory(str(Path(__file__).parents[2] / "alembic"))
    head = scripts.get_current_head()
    revisions = {revision.revision for revision in scripts.walk_revisions()}
    merge = scripts.get_revision("38ea2e285478")
    assert head is not None
    assert {"5ff26cba86c4", "9f2c4b7a1e63"} <= revisions
    assert set(merge.down_revision) == {"5ff26cba86c4", "9f2c4b7a1e63"}


def test_models_from_both_integrated_changes_coexist():
    assert SolicitudAusenciaPeriodo.__table__.c.fecha_inicio.type.python_type is date
    assert HorarioMateriaCurso.__table__.c.hora_inicio.type.python_type is time
    assert "nombre_normalizado" in Materia.__table__.c
    assert {"materia_id", "division_id"} <= set(MateriaCurso.__table__.c.keys())
    assert "solicitud_ausencia_periodo_id" in Asistencia.__table__.c


def test_period_request_has_one_decision_and_reuses_existing_references():
    table = SolicitudAusenciaPeriodo.__table__
    assert {
        "fecha_inicio",
        "fecha_fin",
        "estado",
        "alumno_id",
        "familia_id",
        "motivo_justificacion_id",
    } <= set(table.c.keys())
    assert {fk.target_fullname for fk in table.foreign_keys} >= {
        "alumno.id",
        "familia.id",
        "motivo_justificacion.id",
        "usuario.id",
    }
    assert any(
        "fecha_inicio <= fecha_fin" in str(c.sqltext)
        for c in table.constraints
        if hasattr(c, "sqltext")
    )


def test_attendance_has_nullable_current_period_reference():
    column = inspect(Asistencia).columns.solicitud_ausencia_periodo_id
    assert column.nullable
    assert {fk.target_fullname for fk in column.foreign_keys} == {"solicitud_ausencia_periodo.id"}


def _request(**overrides):
    values = {
        "fecha_inicio": date(2026, 3, 2),
        "fecha_fin": date(2026, 3, 6),
        "alumno_id": uuid.uuid4(),
        "familia_id": uuid.uuid4(),
        "motivo_justificacion_id": uuid.uuid4(),
        "usuario_id": uuid.uuid4(),
    }
    return SolicitudAusenciaPeriodo(**(values | overrides))


def test_period_request_defaults_to_pending_and_accepts_single_day(db_session):
    request = _request(fecha_inicio=date(2027, 4, 1), fecha_fin=date(2027, 4, 1))
    db_session.add(request)
    db_session.flush()
    assert request.estado == "pendiente"
    assert request.fecha_carga is not None


@pytest.mark.parametrize(
    "changes",
    [
        {"fecha_inicio": date(2026, 3, 7)},
        {"estado": "borrador"},
    ],
)
def test_period_request_rejects_invalid_values(db_session, changes):
    db_session.add(_request(**changes))
    with pytest.raises(IntegrityError):
        db_session.flush()
    db_session.rollback()


def test_period_request_accepts_revoked_state(db_session):
    request = _request(estado="revocada")
    db_session.add(request)
    db_session.flush()

    assert request.estado == "revocada"


def test_generated_upgrade_matches_model_and_adds_nullable_reference():
    path = Path(__file__).parents[2] / "alembic/versions/5ff26cba86c4_add_absence_period_request.py"
    spec = importlib.util.spec_from_file_location("rev_solicitud_ausencia", path)
    assert spec and spec.loader
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    calls = {}

    def record(name):
        def store(*args, **kwargs):
            calls.setdefault(name, []).append((args, kwargs))

        return store

    with (
        patch("alembic.op.create_table", record("table")),
        patch("alembic.op.add_column", record("column")),
        patch("alembic.op.create_foreign_key", record("foreign_key")),
    ):
        revision.upgrade()

    (name, *items), _ = calls["table"][0]
    assert name == SolicitudAusenciaPeriodo.__tablename__
    columns = {item.name: item for item in items if isinstance(item, sa.Column)}
    model = {column.name: column for column in SolicitudAusenciaPeriodo.__table__.columns}
    assert set(columns) == set(model)
    assert all(columns[name].nullable == model[name].nullable for name in model)
    (source, column), _ = calls["column"][0]
    assert (source, column.name, column.nullable) == (
        "asistencia",
        "solicitud_ausencia_periodo_id",
        True,
    )
    (name, source, target, local, remote), _ = calls["foreign_key"][0]
    assert (name, source, target, local, remote) == (
        "fk_asistencia_solicitud_ausencia_periodo",
        "asistencia",
        "solicitud_ausencia_periodo",
        ["solicitud_ausencia_periodo_id"],
        ["id"],
    )
