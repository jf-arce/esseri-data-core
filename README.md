# ESSERI Data Core

Sistema de gestión integral para ESSERI: familias y alumnos, académico, inscripciones, facturación, proveedores y compras, workflows, auditoría, panel administrativo e IA/sugerencias.

Monorepo separado en capas, con separación por módulo dentro de cada capa (arquitectura orientada a eventos: cada módulo evoluciona y publica/escucha eventos sin acoplarse a los demás). El detalle completo de esta decisión y de cada convención vive en **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** — léelo antes de agregar código nuevo.

## Estructura

```
esseri-data-core/
├── frontend/   # React + Vite + TypeScript
├── backend/    # FastAPI + SQLAlchemy + Alembic
├── database/   # Referencia del modelo de datos (DER, seeds)
├── infra/      # Docker Compose, n8n, variables de entorno por ambiente
└── docs/       # Diccionario de datos y documentación complementaria
```

## Por dónde empezar

- **Levantar el sistema completo** (Postgres + backend + frontend + n8n con un solo comando): [`infra/README.md`](./infra/README.md).
- **Solo el frontend**: [`frontend/README.md`](./frontend/README.md).
- **Solo el backend**: [`backend/README.md`](./backend/README.md).
- **Modelo de datos** (DER, seeds, cómo se relaciona con las migraciones de Alembic): [`database/README.md`](./database/README.md).
- **Convenciones de nombres, dónde va cada archivo, criterio de testing**: [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Reglas para asistentes de IA** (Cursor, Claude Code, Copilot): [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md).
- **Diccionario de datos y decisiones de diseño**: [`docs/diccionario-de-datos-esseri.md`](./docs/diccionario-de-datos-esseri.md).

## Flujo de trabajo

Feature-branch (GitHub Flow): `main` es la única rama larga y queda protegida (no se pushea directo).

- Cada tarea se trabaja en una rama corta creada desde `main`: `feature/<algo>` para funcionalidad nueva, `fix/<algo>` para bugs (ej. `feature/facturacion-alertas-morosidad`).
- Al terminar, se abre un Pull Request contra `main`.
- El PR debe pasar CI en verde (`ci-backend.yml` o `ci-frontend.yml` según la capa que cambió) y al menos una review de otro integrante del equipo antes de mergear.
- Al mergear se borra la rama.

## CI

Cada PR corre lint, build y tests solo de la capa que haya cambiado — ver [`.github/workflows/ci-frontend.yml`](./.github/workflows/ci-frontend.yml) y [`.github/workflows/ci-backend.yml`](./.github/workflows/ci-backend.yml).
