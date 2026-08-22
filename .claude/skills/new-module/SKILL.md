---
name: new-module
description: Scaffold a new file (page, hook, service, component, models, schemas, etc.) into one of the 10 existing ESSERI EDT modules, following ARCHITECTURE.md's exact naming and export conventions. Use when adding a page/hook/service to a frontend module or a models/schemas/dependencies file to a backend module.
---

Paths below are relative to the **repo root**. This is a scaffolding skill, not a
"run" skill — it writes files, it doesn't launch anything. There's nothing to
screenshot; verification is "the generated file compiles/lints and matches
`ARCHITECTURE.md`'s conventions," checked directly in this repo (see Gotchas).

All 10 EDT modules (`auth`, `familias-alumnos`, `academico`, `inscripciones`,
`facturacion`, `proveedores-compras`, `workflows`, `auditoria`, `panel-admin`,
`ia-sugerencias`) **already exist**. This script never creates a new module — only
adds the next file an existing one needs — and refuses to overwrite a file that's
already there.

## Run

```bash
python3 .claude/skills/new-module/scaffold.py frontend <modulo> component <nombre-kebab>
python3 .claude/skills/new-module/scaffold.py frontend <modulo> page <nombre-kebab>
python3 .claude/skills/new-module/scaffold.py frontend <modulo> hook use-<nombre-kebab>
python3 .claude/skills/new-module/scaffold.py frontend <modulo> service <nombre-kebab>
python3 .claude/skills/new-module/scaffold.py frontend <modulo> store   # store.ts, sin nombre
python3 .claude/skills/new-module/scaffold.py frontend <modulo> types   # types.ts
python3 .claude/skills/new-module/scaffold.py frontend <modulo> utils   # utils.ts

python3 .claude/skills/new-module/scaffold.py backend <modulo> models
python3 .claude/skills/new-module/scaffold.py backend <modulo> schemas
python3 .claude/skills/new-module/scaffold.py backend <modulo> dependencies
python3 .claude/skills/new-module/scaffold.py backend <modulo> constants
python3 .claude/skills/new-module/scaffold.py backend <modulo> exceptions
python3 .claude/skills/new-module/scaffold.py backend <modulo> config
```

`<modulo>` siempre en kebab-case (ej. `familias-alumnos`), igual que el directorio de
`frontend/src/modules/`; el script deriva solo el equivalente `snake_case` de
`backend/src/` (`familias_alumnos`).

Verified in this container: generated `hook`/`page`/`service`/`component` files pass
`npx eslint` in `frontend/`; a generated backend `models.py` passes `ruff check` in
`backend/`, and running `backend models` also patches `backend/alembic/env.py` with
the matching import (see Gotchas) without introducing new lint errors.

## Después de correrlo

- **`frontend ... page`**: el script solo crea el archivo de la página. Si necesita
  ruta, agregá vos la entrada en `modules/<modulo>/routes.tsx` (import + push al array
  exportado) — el script te lo recuerda al terminar. `router/index.tsx` ya importa el
  array de los 10 módulos, no hace falta tocarlo.
- **`backend ... models`**: el script ya agrega el import correspondiente a
  `backend/alembic/env.py` (ver Gotchas — no es automático por defecto en Alembic).
  Sigue faltando: definir las clases reales dentro del `models.py` generado y correr
  la skill `db-migration` para generar la migración.
- Ningún kind crea tests automáticamente (ni frontend ni backend) — según
  `ARCHITECTURE.md`, no todo componente/hook necesita test; agregalo a mano en
  `__tests__/` (frontend) o `tests/<modulo>/` (backend) solo si el archivo tiene
  lógica real.

## Gotchas

- **Alembic no descubre `models.py` automáticamente.** `backend/alembic/env.py` importa
  el `models.py` de cada módulo a mano, uno por uno — `auditoria` y `panel-admin` hoy
  NO están en esa lista (ni tienen `models.py`), a pesar de que `backend/README.md`
  afirma que "ya está [hecho] para los 10 módulos, aunque estén vacíos" — verificado
  falso al leer `alembic/env.py` directamente. Por eso `backend ... models` parchea
  `env.py` como parte del mismo comando: si alguna vez agregás un `models.py` a mano en
  vez de con este script, no te olvides de este paso.
- `panel-admin` y `auditoria` no tienen `models.py`/`schemas.py` a propósito según
  `ARCHITECTURE.md` (son capas de consulta sobre tablas de otros módulos) — pensalo dos
  veces antes de generarles uno.
- El script es idempotente/seguro: si el archivo destino ya existe, corta con error en
  vez de sobreescribir.

## Troubleshooting

- `Ya existe <path> — no se sobreescribe` → el archivo pedido ya existe; editalo a
  mano o elegí otro nombre.
- `No existe backend/src/<pkg> — este script no crea módulos nuevos` → el `<modulo>`
  pasado no es uno de los 10 del EDT, o hay un typo en el nombre.
