#!/usr/bin/env bash
# Vuelve la base al estado del backup que dejó preparar-demo.sh (RNF-11, #225). Pensado para usar
# en medio de la demo: un solo comando en vez de los pasos manuales de infra/README.md.
#
# Uso, desde la raíz del repo:
#   infra/demo/restaurar-demo.sh                      # el backup de demo más reciente
#   infra/demo/restaurar-demo.sh backups/ARCHIVO.dump # uno en particular
#   COMPOSE_OVERRIDE=ruta/override.yml infra/demo/restaurar-demo.sh
#
# Reemplaza por completo esseri_data_core. Solo sirve con el mismo código con el que se sacó el
# backup (el de la demo): para otros casos seguir "Restaurar sobre la base real" en infra/README.md.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/../.." && pwd)"
dump="${1:-$(ls -t "$raiz"/backups/demo-*.dump 2>/dev/null | head -n 1)}"
if [[ -z "$dump" || ! -f "$dump" ]]; then
  echo "No hay backup de demo: corré primero infra/demo/preparar-demo.sh."
  exit 1
fi
dump="$(cd "$(dirname "$dump")" && pwd)/$(basename "$dump")"

cd "$raiz/infra"
export MSYS_NO_PATHCONV=1
archivos=(-f docker-compose.yml)
if [[ -n "${COMPOSE_OVERRIDE:-}" ]]; then
  archivos+=(-f "$COMPOSE_OVERRIDE")
fi
compose() { docker compose "${archivos[@]}" "$@"; }
psql_admin() { compose exec -T postgres psql -U esseri -d postgres -v ON_ERROR_STOP=1 -c "$1"; }

echo "==> Restaurando $(basename "$dump")"
compose stop backend frontend
# Corta conexiones que hayan quedado abiertas (por ejemplo, un cliente de base de datos).
psql_admin "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
            WHERE datname = 'esseri_data_core' AND pid <> pg_backend_pid();" >/dev/null
psql_admin "DROP DATABASE esseri_data_core;"
psql_admin "CREATE DATABASE esseri_data_core;"
compose exec -T postgres pg_restore -U esseri -d esseri_data_core --exit-on-error <"$dump"
compose start backend frontend

echo "==> Esperando al backend"
for _ in $(seq 1 60); do
  if compose exec -T backend python -c \
    "import httpx; httpx.get('http://localhost:8000/health', timeout=3).raise_for_status()" \
    >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
compose exec -T backend python - <demo/verificar_demo.py
