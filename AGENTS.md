# Instrucciones para asistentes de IA — ESSERI Data Core

> Este archivo es corto a propósito: es el formato genérico de instrucciones para IA que leen herramientas como Cursor o GitHub Copilot. **Claude Code no lee este archivo directamente** — lee `CLAUDE.md` en la raíz, que importa este archivo (`@AGENTS.md`) y agrega instrucciones propias. Para la explicación completa de cada decisión (el *por qué*, no solo el *dónde*), ver **`ARCHITECTURE.md`** en la raíz.

Si estás generando o modificando código en este repositorio, seguí estas reglas antes de crear o editar archivos:

1. **Ubicá el archivo según `ARCHITECTURE.md`, no según tu criterio general de "buenas prácticas".** Este repo tiene decisiones específicas del equipo (ej. `kebab-case` en todo el frontend, tests en `__tests__/` desde el día uno, `services/` en vez de `api/` para las llamadas HTTP por módulo) que pueden diferir de lo que harías por defecto. Ante la duda, priorizá lo que dice ahí por sobre una convención genérica.
2. **No crees una carpeta compartida nueva (`src/algo-nuevo/`) sin que ya exista una necesidad real de 2+ módulos.** Si estás resolviendo algo para un solo módulo, va adentro de `modules/<modulo>/` (frontend) o `src/<modulo>/` (backend), aunque "parezca" que en el futuro lo va a necesitar otro módulo.
3. **Respetá la convención de nombres de archivo de cada capa**: `kebab-case` en todo `frontend/` (incluidos componentes — el nombre del archivo no va en PascalCase aunque el componente exportado sí), `snake_case` en todo `backend/` (estándar de Python).
4. **No agregues un archivo `service.py`, `store.ts`, `types.ts`, etc. a un módulo que no lo necesita todavía.** No todos los módulos tienen todas las subcarpetas — revisar la tabla de "Notas por módulo específico" en `ARCHITECTURE.md` antes de asumir que un módulo necesita determinado archivo.
   Si un servicio backend ya contiene subdominios independientes y supera el umbral documentado en
   `ARCHITECTURE.md`, dividilo por capacidad como `<subdominio>_service.py`; no crees una fachada
   `service.py` que solo reexporte funciones.
5. **Si el cambio toca infraestructura** (Docker, CI/CD, variables de entorno, dependencias nuevas), actualizá el `README.md` y el `.env.example` de la capa correspondiente en el mismo cambio — no lo dejes para después.
6. **No dupliques lógica entre módulos.** Si al escribir código notás que ya existe algo parecido en otro módulo, es señal de que probablemente corresponde subir eso al nivel compartido (`src/` de esa capa) en vez de copiarlo.
7. **Los tests no son obligatorios para todo.** Antes de generar un test para un componente nuevo, evaluá si tiene lógica real (condicionales, cálculos, manejo de estado) — si es puro layout/composición, no hace falta testearlo. Ver la sección de Testing en `ARCHITECTURE.md` para el criterio completo.
8. **Si una instrucción no queda clara con lo que dice `ARCHITECTURE.md`** (por ejemplo, pide algo que no encaja en ningún módulo existente, o contradice una convención ya establecida), señalalo explícitamente en vez de decidir en silencio.
9. **`ARCHITECTURE.md` se actualiza cuando cambia una decisión de arquitectura real**, no al revés. Si el código termina evolucionando distinto a lo que dice ahí, avisá que hay que actualizar el documento — no lo dejes desactualizado en silencio.
10. **Manejá con cuidado extra los cambios en estas zonas** (revisar bien antes de aplicar, no aplicar cambios grandes de una sola vez):
    - `backend/alembic/` o cualquier migración de base de datos — un cambio mal generado puede requerir rehacer el historial de migraciones.
    - `src/auth/` (backend) o `modules/auth/` (frontend) — maneja JWT y permisos; un error ahí es un problema de seguridad, no solo un bug funcional.
    - `docker-compose.yml` / `docker-compose.prod.yml` — cambios ahí afectan a todo el equipo al levantar el entorno local.

---

## Dónde están los comandos de build, test y lint

No se listan comandos acá porque cambian con el proyecto y este archivo quedaría desactualizado. La fuente real:

- **Frontend**: sección `scripts` de `frontend/package.json` (nombres exactos de comandos) + `frontend/README.md` (explicación de uso).
- **Backend**: `backend/README.md` — Python no tiene un archivo de scripts equivalente a `package.json` en esta arquitectura, así que el README es la única fuente.
- **Ambiente completo con Docker**: `infra/README.md`.

Si necesitás correr algo (dev, test, lint, migraciones) leé el archivo correspondiente antes de asumir el comando. Si el comando que hace falta **no está documentado en ninguno de esos archivos**, no lo inventes — decilo explícitamente y agregalo a la fuente que corresponda (no acá, para no duplicar).

Antes de dar por terminada una tarea de código, correr el lint y los tests de la capa que se tocó (según lo que digan esos archivos).

---

## Checklist rápido de decisión

Para cuando hay que decidir dónde va algo nuevo, sin releer `ARCHITECTURE.md` completo.

| Necesito agregar... | ¿Dónde va? |
|---|---|
| Un componente/página/hook/servicio que usa **un solo módulo** del frontend | Dentro de `modules/<modulo>/`, en la subcarpeta que corresponda. |
| Un componente/hook/util que ya usan (o van a usar) **2+ módulos** del frontend | `src/components/`, `src/hooks/` o `src/lib/` — nivel `src/`, no adentro de ningún módulo. |
| Una pantalla que combina datos de **2+ módulos** | `src/pages/`, no en `modules/<modulo>/pages/`. |
| Una ruta nueva del frontend | Declararla en el `routes.tsx` del módulo dueño; `src/router/` la junta automáticamente, no hace falta tocarlo. |
| Un modelo SQLAlchemy / endpoint / lógica de negocio que pertenece a **un solo módulo** del backend | Dentro de `src/<modulo>/`, en el archivo que corresponda (`models.py`, `router.py`, `service.py`, etc.). |
| Un `service.py` backend que contiene **2+ subdominios independientes** y supera ~500 líneas o 15 operaciones públicas | Dividirlo dentro del mismo módulo en `<subdominio>_service.py`, según el criterio completo de `ARCHITECTURE.md`. |
| Una entidad, tabla intermedia o enum que usan **2+ módulos** del backend | `src/models.py` (nivel `src/`, no adentro de ningún módulo). |
| Un componente de shadcn/ui nuevo | Se genera con la CLI de shadcn, cae en `src/components/ui/` — no se escribe a mano. |
| Un test de un componente/hook/servicio del frontend | `__tests__/` dentro de la misma subcarpeta que el archivo que prueba. Solo si tiene lógica real. |
| Un test de un módulo del backend | `tests/<modulo>/`, espejando `src/<modulo>/`. Fixtures compartidas van en `tests/conftest.py`. |
| Un flujo de usuario de punta a punta (login, inscripción completa, etc.) | `frontend/e2e/<flujo>.spec.ts`, con Playwright. |
| Una migración de base de datos | Se genera con `alembic revision --autogenerate` desde `backend/`, nunca se escribe SQL a mano en `database/`. |
| Un workflow de automatización nuevo | Se define en n8n, se exporta a `infra/n8n/` — no es código de aplicación en `backend/`. |
| Una variable de entorno nueva | Agregarla a `.env.example` de la capa correspondiente (nunca solo al `.env` real) para que quede documentada. |

**Regla general que resuelve casi todo lo demás:** si algo lo necesita un solo módulo, se queda adentro de ese módulo. Recién cuando un **segundo** módulo lo necesita, se sube al nivel compartido de esa capa (`src/` en frontend y en backend). No se anticipa esa subida "por las dudas".
