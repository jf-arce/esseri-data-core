#!/usr/bin/env bash
# Setup rápido para alguien que recién clona el repo: venv + deps + migraciones +
# seeds + levanta el servidor. Requiere Postgres ya corriendo (local o
# `docker compose up -d postgres` desde infra/) y backend/.env completado.
#
# Uso: cd backend && ./setup.sh
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f .env ]; then
    echo "Falta backend/.env — copiando .env.example. Completá DATABASE_URL, JWT_SECRET, etc. y volvé a correr este script."
    cp .env.example .env
    exit 1
fi

if [ ! -d venv ]; then
    python -m venv venv
fi
source venv/bin/activate
pip install -q -r requirements/dev.txt

alembic upgrade head

python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py

# Solo si está configurado: el script pide la contraseña por consola y trabaría el setup.
if grep -qE '^BOOTSTRAP_ADMIN_EMAIL=.+' .env; then
    python ../database/seeds/00_bootstrap_admin.py
else
    echo "Sin BOOTSTRAP_ADMIN_EMAIL en .env — nadie va a poder loguearse todavía."
    echo "Crear el primer admin con: python ../database/seeds/00_bootstrap_admin.py tu-email@ejemplo.com"
fi

exec uvicorn src.main:app --reload
