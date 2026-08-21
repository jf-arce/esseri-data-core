# ESSERI Data Core — Backend

API en FastAPI + SQLAlchemy + Alembic. Ver `ARCHITECTURE.md` en la raíz del repo para la explicación completa de la estructura (`src/<modulo>/`, convenciones, testing).

## Requisitos

- Python 3.14 (o compatible; el proyecto se armó con Python 3.14.7 vía [mise](https://mise.jdx.dev/)).
- PostgreSQL corriendo localmente (o vía `infra/docker-compose.yml` desde la raíz del repo).

## Setup local (sin Docker)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate en Windows
pip install -r requirements/dev.txt

cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
```

## Migraciones (Alembic)

Nunca se escribe SQL a mano en `database/` — todo cambio de esquema se genera con Alembic desde acá:

```bash
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

`alembic/env.py` ya está configurado para tomar la URL de conexión de `src.config.settings` (que lee `.env`) y para detectar automáticamente los modelos de todos los módulos — no hace falta tocarlo al agregar un modelo nuevo, solo asegurarse de que el `models.py` del módulo esté importado ahí (ya lo está para los 10 módulos, aunque estén vacíos).

## Levantar el servidor

```bash
uvicorn src.main:app --reload
```

Docs interactivas en `http://localhost:8000/docs`.

## Tests

```bash
pytest
```

Los tests usan una base SQLite en memoria (ver `tests/conftest.py`), no la base de `DATABASE_URL` — así corren sin depender de Postgres. Si el equipo prefiere testear contra un Postgres real, ajustar `TEST_DATABASE_URL` en `tests/conftest.py`.

## Lint y formato

```bash
ruff check src/ tests/
ruff format src/ tests/
```

## Con Docker

Desde la raíz del repo, usar `infra/docker-compose.yml` (levanta Postgres + backend + frontend + n8n juntos). Para buildear solo esta imagen:

```bash
docker build -t esseri-backend .
docker run --env-file .env -p 8000:8000 esseri-backend
```

## Estructura

Un paquete por módulo en `src/<modulo>/` (`router.py`, `schemas.py`, `models.py`, `service.py`, y lo que cada módulo necesite — ver la tabla de "Notas por módulo específico" en `ARCHITECTURE.md`). Lo compartido entre 2+ módulos vive en `src/config.py`, `src/database.py`, `src/models.py` y `src/exceptions.py`.
