---
name: run-backend
description: Build, launch, and smoke-test the ESSERI backend (FastAPI + SQLAlchemy + Alembic). Use when asked to run, start, or verify the backend API, hit its endpoints, or confirm a backend change works against a real server (not just pytest).
---

Paths below are relative to the **repo root**. The backend is driven with `curl`
against a real `uvicorn` process — there is no GUI here, so no screenshots.

## Prerequisites

- Python 3.14 and a `backend/venv/` already created (this repo has one committed).
  Confirm deps are installed: `cd backend && source venv/bin/activate && python -c
  "import fastapi, uvicorn, sqlalchemy, alembic"`. If that fails: `pip install -r
  requirements/dev.txt`.
- `backend/.env` must exist (copy from `backend/.env.example` if missing) and its
  `DATABASE_URL` must point at a reachable Postgres.
- A Postgres reachable at that `DATABASE_URL`. Easiest path — start just the `postgres`
  service from `infra/docker-compose.yml`:
  ```bash
  cd infra && docker compose up -d postgres
  ```
  Wait for it to report healthy: `docker compose ps postgres`.

## Run (agent path)

```bash
.claude/skills/run-backend/smoke.sh
```

This launches `uvicorn src.main:app --host 0.0.0.0 --port 8000` in the background,
polls `/health` until it responds, then reports:
- `GET /health` (status + body)
- `GET /openapi.json` paths (which endpoints actually exist right now)
- `GET /docs` status

It kills the uvicorn process on exit (including on failure). Verified working in this
container against a Postgres started per the prerequisites above.

## Run (human path)

```bash
cd backend
source venv/bin/activate
uvicorn src.main:app --reload
```

Docs UI at `http://localhost:8000/docs`. `Ctrl-C` to stop.

## Test

```bash
cd backend
source venv/bin/activate
pytest
```

As of this writing `pytest` collects **0 tests** — `tests/<modulo>/` exist but only
contain empty `__init__.py`. Don't read "no failures" as "tests pass"; check the
"collected" count.

## Gotchas

- **All 10 module routers are registered in `src/main.py` but currently expose zero
  routes.** `GET /openapi.json` only lists `/health`. This isn't a smoke-test bug — the
  modules (`auth`, `facturacion`, etc.) haven't defined any `@router.get/post(...)`
  yet. Once a module adds real endpoints, `smoke.sh`'s openapi-paths check will show
  them automatically; no change to the driver is needed.
- `backend/Dockerfile` only installs `requirements/base.txt` (no `pytest`/`httpx`) —
  don't expect to run tests inside the built image, only in the local `venv/`.
- The FastAPI app requires `DATABASE_URL` to point at a **live** Postgres at import
  time (`src/database.py` creates the engine eagerly) — `uvicorn` will fail to boot,
  not just fail on first request, if Postgres isn't reachable yet. `smoke.sh`'s polling
  loop will just time out with no useful error in that case; check `docker compose ps
  postgres` first if the smoke test hangs.

## Troubleshooting

- `curl: (7) Failed to connect` after the poll loop gives up → Postgres isn't up/healthy
  yet, or `backend/.env`'s `DATABASE_URL` host/port doesn't match how Postgres was
  started (e.g. pointing at `postgres:5432` — the in-Docker hostname — while running
  uvicorn on the host, where it must be `localhost:5432`).
