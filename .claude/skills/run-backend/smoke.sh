#!/usr/bin/env bash
# Smoke test for the ESSERI backend (FastAPI). Run from the repo root:
#   .claude/skills/run-backend/smoke.sh
#
# Requires: backend/venv already created with `pip install -r requirements/dev.txt`,
# backend/.env present, and a Postgres reachable at DATABASE_URL (see SKILL.md).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
BACKEND_DIR="$REPO_ROOT/backend"
LOG_FILE="$(mktemp)"
PORT=8000

cd "$BACKEND_DIR"
source venv/bin/activate

uvicorn src.main:app --host 0.0.0.0 --port "$PORT" > "$LOG_FILE" 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

echo "Waiting for backend to boot (pid $PID, log $LOG_FILE)..."
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://localhost:$PORT/health"; then
    break
  fi
  sleep 1
done

echo "=== /health ==="
curl -s -w '\nstatus=%{http_code}\n' "http://localhost:$PORT/health"

echo "=== /openapi.json paths ==="
curl -s "http://localhost:$PORT/openapi.json" | python3 -c "
import json, sys
paths = json.load(sys.stdin)['paths']
print('\n'.join(sorted(paths)) or '(no paths registered yet)')
"

echo "=== /docs ==="
curl -s -o /dev/null -w 'status=%{http_code}\n' "http://localhost:$PORT/docs"

echo "Smoke test done. Backend log:"
cat "$LOG_FILE"
