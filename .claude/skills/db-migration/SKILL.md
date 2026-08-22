---
name: db-migration
description: Generate and apply an Alembic database migration for the ESSERI backend, with the manual-review checklist AGENTS.md requires for this sensitive zone. Use when a backend module's models.py changed and needs a migration, or when asked to run/apply/rollback migrations.
---

Paths below are relative to the **repo root**. This is a workflow/checklist skill, not
a "run" skill — no driver script, just the exact commands plus the review step
`AGENTS.md` rule #10 requires for `backend/alembic/` (a bad migration can force
rewriting migration history).

## Prerequisites

- `backend/venv` with deps installed (same as `run-backend`).
- A reachable Postgres at `backend/.env`'s `DATABASE_URL`. Easiest: `cd infra &&
  docker compose up -d postgres` (wait for `docker compose ps postgres` to show
  healthy).

## Flow

```bash
cd backend
source venv/bin/activate

# 1. Generate — Alembic diffs the live DB against every model imported in
#    alembic/env.py (see Gotchas: not every module's models.py is imported there).
alembic revision --autogenerate -m "descripción corta del cambio"

# 2. STOP — open the generated file in alembic/versions/<hash>_<slug>.py and read it
#    before doing anything else. Autogenerate gets column adds/drops right most of the
#    time, but NOT: renames (it emits a drop+add, losing data), some index/constraint
#    changes, or data migrations — those need to be hand-edited into upgrade()/downgrade().

# 3. Apply, only after the review above.
alembic upgrade head
```

Verified end-to-end in this container: `alembic upgrade head` against a repo with zero
migrations is a no-op (nothing to apply yet — `alembic/versions/` currently only has
`.gitkeep`), and `alembic revision --autogenerate` against the current stub `models.py`
files produces a real revision file with empty `upgrade()`/`downgrade()` bodies (no
columns exist yet to diff) — both commands run cleanly against a Postgres started per
the prerequisites above.

## Rollback

```bash
alembic downgrade -1     # un paso atrás
alembic history          # ver el árbol de revisiones
```

## Gotchas

- **Autogenerate only sees modules imported in `backend/alembic/env.py`.** That file
  hand-imports each module's `models.py` one by one — it is **not** automatic
  discovery. As of this writing `auditoria` and `panel_admin` have no `models.py` and
  are not in that import list, contradicting `backend/README.md`'s claim that all 10
  modules are already wired in (verified false by reading `env.py` directly). If you
  add a `models.py` to a module that isn't in `env.py` yet, `--autogenerate` will
  silently ignore its tables — no error, just an empty/incomplete migration. Use the
  `new-module` skill's `backend <modulo> models` command to add both the file and the
  `env.py` import together, or add the import to `env.py` by hand before generating.
- Right now every module's `models.py` is a docstring-only stub (no SQLAlchemy classes
  defined) — a fresh `--autogenerate` today produces an empty migration. That's
  expected, not a bug in this skill; it becomes meaningful once real model classes
  exist.
- `alembic.ini`'s configured DB URL is overridden at runtime by
  `settings.DATABASE_URL` from `backend/.env` (see `alembic/env.py`) — editing
  `alembic.ini` directly to change the target DB won't do anything.

## Troubleshooting

- `sqlalchemy.exc.OperationalError: connection to server ... failed: Connection
  refused` → Postgres isn't up/reachable at `DATABASE_URL`; start it (`docker compose
  up -d postgres` from `infra/`) and confirm it's healthy before retrying.
- Autogenerate produced an empty migration for a module you know has real model
  changes → check whether that module's `models.py` is actually imported in
  `alembic/env.py` (see Gotchas above).
