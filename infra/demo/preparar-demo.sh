#!/usr/bin/env bash
# Prepara el entorno de la demo (RNF-11, #225): levanta el stack, carga los datos, verifica y deja
# un backup para volver a este estado si algo se rompe durante la presentación.
#
# Uso, desde la raíz del repo (Git Bash en Windows, o cualquier bash):
#   infra/demo/preparar-demo.sh
#   COMPOSE_OVERRIDE=ruta/override.yml infra/demo/preparar-demo.sh   # si hay puertos ocupados
#   CON_N8N=1 infra/demo/preparar-demo.sh                            # también levanta n8n
#
# Es idempotente: se puede correr de nuevo sin duplicar datos. Ver infra/demo.md.
set -euo pipefail

cd "$(dirname "$0")/.."
export MSYS_NO_PATHCONV=1 # Git Bash: que no reescriba las rutas del contenedor (/database/...)

archivos=(-f docker-compose.yml)
if [[ -n "${COMPOSE_OVERRIDE:-}" ]]; then
  archivos+=(-f "$COMPOSE_OVERRIDE")
fi
compose() { docker compose "${archivos[@]}" "$@"; }

servicios=(postgres backend frontend)
if [[ -n "${CON_N8N:-}" ]]; then
  servicios+=(n8n)
fi

echo "==> Levantando ${servicios[*]}"
compose up -d --build "${servicios[@]}"

echo "==> Esperando al backend (migraciones y catálogos corren al arrancar)"
for _ in $(seq 1 60); do
  if compose exec -T backend python -c \
    "import httpx; httpx.get('http://localhost:8000/health', timeout=3).raise_for_status()" \
    >/dev/null 2>&1; then
    break
  fi
  sleep 3
done

echo "==> Cargando los datos de la demo"
compose exec -T -e ESSERI_DEMO_SEED_ENABLED=true -e PYTHONUTF8=1 backend \
  python /database/seeds/04_seed_demo.py | tail -n 8

echo "==> Verificando"
if ! compose exec -T backend python - <demo/verificar_demo.py; then
  echo "La verificación encontró problemas: no se hizo el backup. Ver infra/demo.md."
  exit 1
fi

mkdir -p ../backups
backup="../backups/demo-$(date +%Y%m%d-%H%M%S).dump"
echo "==> Backup del estado listo para la demo: ${backup#../}"
compose exec -T postgres pg_dump -U esseri -d esseri_data_core -Fc >"$backup"

echo
echo "Listo. Si algo se rompe durante la demo, restaurá ese backup (infra/demo.md, 'Si algo falla')."
