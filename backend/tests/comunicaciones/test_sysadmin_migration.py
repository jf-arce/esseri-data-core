"""S7: the System Administrator communications migration is additive and reversible."""

import importlib.util
import uuid
from pathlib import Path

import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

from alembic import op as alembic_op

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "alembic"
    / "versions"
    / "98d809a30507_grant_system_administrator_.py"
)
CODES = ("comunicaciones.crear", "comunicaciones.leer", "comunicaciones.actualizar")


def _migration():
    spec = importlib.util.spec_from_file_location("grant_sysadmin_98", MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _tables(engine):
    metadata = sa.MetaData()
    roles = sa.Table(
        "rol",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("codigo", sa.String(), unique=True, nullable=False),
    )
    permisos = sa.Table(
        "permiso",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("codigo", sa.String(), unique=True, nullable=False),
    )
    links = sa.Table(
        "rol_permiso",
        metadata,
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("rol_id", sa.Uuid(), nullable=False),
        sa.Column("permiso_id", sa.Uuid(), nullable=False),
        sa.UniqueConstraint("rol_id", "permiso_id"),
    )
    metadata.create_all(engine)
    return roles, permisos, links


def _bind(conn, monkeypatch):
    monkeypatch.setattr(
        alembic_op, "_proxy", Operations(MigrationContext.configure(conn)), raising=False
    )


def _insert_ids(conn, roles, permisos, *, role=True):
    role_id = uuid.uuid4()
    permission_ids = {code: uuid.uuid4() for code in CODES}
    if role:
        conn.execute(roles.insert(), {"id": role_id, "codigo": "administrador_del_sistema"})
    conn.execute(
        permisos.insert(), [{"id": pid, "codigo": code} for code, pid in permission_ids.items()]
    )
    return role_id, permission_ids


def test_upgrade_adds_exactly_three_deterministic_links_and_downgrade_removes_them(monkeypatch):
    engine = sa.create_engine("sqlite://")
    roles, permisos, links = _tables(engine)
    with engine.begin() as conn:
        role_id, pids = _insert_ids(conn, roles, permisos)
        before = set(conn.execute(sa.select(links)).all())
        _bind(conn, monkeypatch)
        migration = _migration()
        migration.upgrade()
        migration.upgrade()  # repeated upgrade must be a no-op
        after = set(conn.execute(sa.select(links)).all())
        expected = {
            uuid.uuid5(uuid.NAMESPACE_URL, f"{migration.revision}/{role_id}/{pids[code]}")
            for code in CODES
        }
        assert len(after) == 3
        assert {row.id for row in after} == expected
        migration.downgrade()
        assert set(conn.execute(sa.select(links)).all()) == before


def test_upgrade_and_downgrade_preserve_preexisting_link_and_other_grants(monkeypatch):
    engine = sa.create_engine("sqlite://")
    roles, permisos, links = _tables(engine)
    with engine.begin() as conn:
        role_id, pids = _insert_ids(conn, roles, permisos)
        other_role_id, other_permiso_id, other_link_id = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
        preexisting_link_id = uuid.uuid4()
        conn.execute(roles.insert(), {"id": other_role_id, "codigo": "rol_centinela"})
        conn.execute(permisos.insert(), {"id": other_permiso_id, "codigo": "verify.sentinel"})
        conn.execute(
            links.insert(),
            [
                {
                    "id": preexisting_link_id,
                    "rol_id": role_id,
                    "permiso_id": pids["comunicaciones.leer"],
                },
                {"id": other_link_id, "rol_id": other_role_id, "permiso_id": other_permiso_id},
            ],
        )
        before = set(conn.execute(sa.select(links)).all())
        _bind(conn, monkeypatch)
        migration = _migration()
        migration.upgrade()
        migration.upgrade()
        after = set(conn.execute(sa.select(links)).all())
        added = after - before
        assert len(added) == 2
        assert {row.id for row in after} >= {preexisting_link_id, other_link_id}
        assert {row.id for row in added} == {
            uuid.uuid5(uuid.NAMESPACE_URL, f"{migration.revision}/{role_id}/{pids[code]}")
            for code in ("comunicaciones.crear", "comunicaciones.actualizar")
        }
        migration.downgrade()
        assert set(conn.execute(sa.select(links)).all()) == before


def test_upgrade_and_downgrade_are_no_ops_without_the_system_administrator_role(monkeypatch):
    engine = sa.create_engine("sqlite://")
    _, _, links = _tables(engine)
    with engine.begin() as conn:
        _bind(conn, monkeypatch)
        migration = _migration()
        migration.upgrade()
        migration.downgrade()
        assert conn.scalar(sa.select(sa.func.count()).select_from(links)) == 0
