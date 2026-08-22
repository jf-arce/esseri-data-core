---
name: run-infra
description: Launch the full ESSERI stack (Postgres + backend + frontend, via Docker Compose) and smoke-test it end-to-end. Use when asked to run the whole system, verify a change works across frontend+backend together, or start/stop the local Docker environment.
---

Paths below are relative to the **repo root**. Requires Docker + Docker Compose
(confirmed available in this container: Docker 29.x, Compose v5.x).

## Prerequisites

- `backend/.env` must exist (the driver copies it from `.env.example` automatically
  if missing).
- Ports `5432` (Postgres), `8000` (backend), `5173` (frontend) free on the host. See
  Gotchas about port `5678` (n8n).

## Run (agent path)

```bash
.claude/skills/run-infra/smoke.sh
```

This does, in order: `docker compose up -d postgres backend frontend`, polls
`backend:8000/health` and `frontend:5173` until they respond, curls both, then
**always tears the stack down** (`docker compose down`) on exit, success or failure.
Verified working end-to-end in this container, including confirming the frontend page
actually loads in a real browser tab via chromium-cli (see `run-frontend`'s SKILL.md
for that driving sequence — same app, just served from the container instead of a
bare `npm run dev`).

## Run (human path)

```bash
cd infra
docker compose up
```

Ctrl-C to stop, or `docker compose down` from another shell. `docker compose down -v`
also wipes the Postgres/n8n volumes — only do that on purpose.

## Test

No infra-level test suite — use `run-backend`'s `pytest` and `run-frontend`'s `npm run
test` against the code directly; this skill only verifies the containers wire up and
serve traffic.

## Gotchas

- **`smoke.sh` deliberately does NOT start the `n8n` service.** `infra/docker-compose.yml`
  binds n8n to a fixed host port (`5678`), and in this container that port was already
  taken by an unrelated project's n8n container — bringing up the full `docker compose
  up -d` (all 4 services) failed with `Bind for 127.0.0.1:5678 failed: port is already
  allocated`. If you need n8n too, check `docker ps` for a port-5678 conflict first,
  or start it separately once the conflict is resolved: `docker compose up -d n8n`.
- **Stale process on the host can block the backend container.** `docker compose up`
  failed once during testing with `address already in use` on port 8000 — a leftover
  `uvicorn` process from a manual `run-backend` test (started outside Docker) was still
  bound to it. If `smoke.sh` fails to bind 8000/5173/5432, check for host processes
  holding those ports (`lsof -i :8000`) before assuming Docker itself is broken.
- The frontend container runs `npm install && npm run dev` on every fresh start (image
  is plain `node:26-alpine`, not pre-built) — first boot after `docker compose down`
  (without `-v`) is fast because `node_modules` persists in the `frontend-node-modules`
  volume, but a full `down -v` forces a slow reinstall on the next `up`.
- Whatever page you land on in the browser will be **blank** right now — see
  `run-frontend`'s SKILL.md Gotchas: no module has any real routes yet, so this isn't a
  container/wiring problem.

## Troubleshooting

- `Bind for 127.0.0.1:5678 failed: port is already allocated` → n8n port conflict, see
  Gotchas; the fix is not to change this compose file, it's to free the port or skip
  n8n.
- `failed to bind host port 0.0.0.0:8000/tcp: address already in use` → something on
  the host (often a manually-started `uvicorn` from testing `run-backend`) is holding
  the port; `lsof -i :8000` and kill it, or `docker compose down` to release ports this
  same stack held from a previous run.
