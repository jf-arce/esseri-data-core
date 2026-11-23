#!/usr/bin/env bash
# Copia de seguridad de la base de la presentación, para repetir los ensayos sin volver a cargar
# los seeds.
#
#   ./presentacion-copia.sh guardar     congela el estado actual de esseri_presentacion
#   ./presentacion-copia.sh restaurar   vuelve la base de la presentación a ese estado
#
# Guardar pisa la copia anterior: hacelo con la base lista, antes de ensayar el flujo de débitos.
# Restaurar corta las conexiones abiertas (el backend se reconecta solo) y tarda unos segundos.
# Usa la conexión de backend/.env como usuario administrador de Postgres.

set -euo pipefail

BASE=esseri_presentacion
COPIA=esseri_presentacion_base
MARCA="esseri:disposable-presentacion:v1"

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
URL="$(grep -m1 '^DATABASE_URL=' "$RAIZ/backend/.env" | cut -d= -f2-)"
SERVIDOR="${URL%/*}/postgres"

sql() { psql "$SERVIDOR" -q -v ON_ERROR_STOP=1 "$@"; }

cortar_conexiones() {
  sql -At -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
              WHERE datname = '$1' AND pid <> pg_backend_pid()" >/dev/null
}

copiar() { # origen destino
  sql -c "DROP DATABASE IF EXISTS $2 WITH (FORCE)"
  for _ in 1 2 3 4 5; do
    cortar_conexiones "$1"
    if sql -c "CREATE DATABASE $2 TEMPLATE $1 OWNER $BASE" 2>/dev/null; then
      sql -c "COMMENT ON DATABASE $2 IS '$MARCA'"
      return 0
    fi
    sleep 1
  done
  echo "No se pudo copiar $1: algo sigue conectado." >&2
  return 1
}

case "${1:-}" in
  guardar)
    copiar "$BASE" "$COPIA"
    echo "Copia guardada en $COPIA."
    ;;
  restaurar)
    sql -At -c "SELECT 1 FROM pg_database WHERE datname = '$COPIA'" | grep -q 1 \
      || { echo "No hay copia: corré primero 'guardar'." >&2; exit 1; }
    copiar "$COPIA" "$BASE"
    echo "Base $BASE restaurada desde la copia."
    ;;
  *)
    echo "Uso: $0 guardar|restaurar" >&2
    exit 1
    ;;
esac
