# ESSERI Data Core — Backend

API en FastAPI + SQLAlchemy + Alembic. Ver `ARCHITECTURE.md` en la raíz del repo para la explicación completa de la estructura (`src/<modulo>/`, convenciones, testing).

## Requisitos

- Python 3.14 (o compatible; el proyecto se armó con Python 3.14.7 vía [mise](https://mise.jdx.dev/)).
- PostgreSQL corriendo localmente (o vía `infra/docker-compose.yml` desde la raíz del repo).

## Setup local (sin Docker)

Con Postgres ya corriendo (local o `docker compose up -d postgres` desde `infra/`):

```bash
cd backend
cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
./setup.sh                      # venv + deps + migraciones + seeds + levanta el servidor
```

`setup.sh` es idempotente — correrlo de nuevo no rompe nada, solo salta lo que ya esté hecho. Si preferís los pasos manuales (o `setup.sh` falla y querés diagnosticar), son los que siguen abajo.

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

`alembic/env.py` ya está configurado para tomar la URL de conexión de `src.config.settings` (que lee `.env`) y para importar el `models.py` de cada módulo (los 8 que tienen entidades propias — `auditoria` y `panel_admin` no tienen `models.py`, ver `ARCHITECTURE.md`) — no hace falta tocarlo salvo que se agregue un `models.py` nuevo.

## Seeds (catálogos iniciales)

Después de migrar, la base queda vacía — algunos módulos no funcionan sin catálogos mínimos (`ROL`, `METODO_PAGO`, `CONCEPTO_COBRO`, etc.). Ver `database/seeds/README.md` para el detalle completo; scripts disponibles hoy:

```bash
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py
```

## Login con Google + primer usuario (RF-27)

Documentado aparte, en `docs/auth-oauth-google.md` — abarca todo el módulo Auth (backend +
frontend), no solo cómo levantar el backend. Ahí está el flujo de OAuth, cómo configurar las
credenciales de Google, y cómo crear el primer usuario administrador
(`database/seeds/00_bootstrap_admin.py`) para poder loguearse.

## Autorización por permisos (RF-30)

Para proteger un endpoint según módulo y acción, usar `requiere_permiso(...)` de
`src.auth.dependencies` en vez de (o además de) `UsuarioAutenticado` — devuelve el `Usuario`
igual que `UsuarioAutenticado`, así que se puede usar donde ya se usa esa:

```python
from typing import Annotated

from fastapi import Depends

from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario

PuedeLeerAcademico = Annotated[Usuario, Depends(requiere_permiso(MODULO_ACADEMICO, ACCION_LEER))]


@router.get("/materias")
def listar_materias(usuario: PuedeLeerAcademico, db: DbSession) -> list[MateriaRead]:
    ...
```

`modulo` y `accion` tienen que ser los strings exactos de `src.auth.constants` (coinciden con
`database/seeds/grupo-b.yaml`). 401 sin sesión, 403 si la sesión no alcanza. El ABM de roles y
permisos vive en `/auth/roles`, `/auth/permisos` y `/auth/usuarios/{id}/roles` — ver
`src/auth/router.py`.

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

Desde la raíz del repo, usar `infra/docker-compose.yml` (levanta Postgres + backend + frontend + n8n juntos, migra y carga seeds automáticamente antes de arrancar `uvicorn`). El build context del backend es la raíz del repo, no `backend/` — necesita copiar también `database/seeds/`. Para buildear solo esta imagen:

```bash
cd ..   # raíz del repo
docker build -f backend/Dockerfile -t esseri-backend .
docker run --env-file backend/.env -p 8000:8000 esseri-backend
```

## Estructura

Un paquete por módulo en `src/<modulo>/` (`router.py`, `schemas.py`, `models.py`, `service.py`, y lo que cada módulo necesite — ver la tabla de "Notas por módulo específico" en `ARCHITECTURE.md`). Lo compartido entre 2+ módulos vive en `src/config.py`, `src/database.py`, `src/models.py` y `src/exceptions.py`.
