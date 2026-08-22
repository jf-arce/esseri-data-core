#!/usr/bin/env bash
# Smoke test for the full ESSERI stack via Docker Compose. Run from the repo root:
#   .claude/skills/run-infra/smoke.sh
#
# Brings up postgres + backend + frontend (n8n is skipped by default — see SKILL.md
# Gotchas about its fixed port 5678 conflicting with other local n8n instances),
# waits for health, curls the backend, then tears everything down.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
INFRA_DIR="$REPO_ROOT/infra"

cd "$INFRA_DIR"

if [ ! -f "$REPO_ROOT/backend/.env" ]; then
  echo "backend/.env missing — copying from .env.example"
  cp "$REPO_ROOT/backend/.env.example" "$REPO_ROOT/backend/.env"
fi

cleanup() {
  echo "Tearing down..."
  docker compose down
}
trap cleanup EXIT

echo "=== docker compose up -d postgres backend frontend ==="
docker compose up -d postgres backend frontend

echo "Waiting for backend /health..."
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://localhost:8000/health"; then break; fi
  sleep 1
done
echo "=== backend /health ==="
curl -s -w '\nstatus=%{http_code}\n' http://localhost:8000/health

echo "Waiting for frontend on :5173..."
for _ in $(seq 1 40); do
  if curl -s -o /dev/null "http://localhost:5173"; then break; fi
  sleep 1
done
echo "=== frontend status ==="
curl -s -o /dev/null -w 'status=%{http_code}\n' http://localhost:5173

echo "Smoke test done."
