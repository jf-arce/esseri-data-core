# ESSERI Data Core — Infra

Todo lo que no es código de aplicación pero hace falta para correr el sistema completo (frontend + backend + Postgres + n8n). Ver `ARCHITECTURE.md` en la raíz para el detalle de cada decisión.

## Entorno local

Antes de levantar el stack por primera vez:

```bash
cp ../backend/.env.example ../backend/.env   # completar lo que haga falta
```

```bash
cd infra
docker-compose up
```

Levanta 4 servicios en la misma red interna:

| Servicio | URL local | Notas |
|---|---|---|
| `postgres` | `localhost:5432` | Usuario/clave/DB: `esseri`/`esseri`/`esseri_data_core` (coincide con `backend/.env.example`). |
| `backend` | `http://localhost:8000` | Antes de levantar `uvicorn --reload` corre `alembic upgrade head` y los 3 scripts de `database/seeds/` (idempotentes, no rompen nada si ya corrieron). `backend/src` está montado como volumen para hot-reload. Lee `backend/.env`. |
| `frontend` | `http://localhost:5173` | Corre `npm run dev` sobre la imagen `node:26-alpine`, con `frontend/` montado como volumen para hot-reload. |
| `n8n` | `http://localhost:5678` | Sin autenticación en local. Los workflows se exportan a `infra/n8n/` (ver el README de esa carpeta). |

**Demo del 10/11:** el paso a paso para dejarla andando en una notebook, con los scripts que
preparan, verifican y restauran el entorno, está en [`infra/demo.md`](demo.md).

Para bajar el stack sin perder los datos locales: `docker compose down`. **No usar** `docker compose down -v` salvo que se quiera borrar deliberadamente los volúmenes de Postgres y n8n.

## Backup y recuperación de PostgreSQL

Los datos de PostgreSQL viven en el volumen Docker `postgres-data`. Un backup lógico en formato
PostgreSQL (`pg_dump -Fc`) permite recuperarlos incluso si ese volumen se pierde. Ejecutar estos
comandos desde la raíz del repositorio, con el stack levantado:

```bash
cd /ruta/a/esseri-data-core
mkdir -p backups

docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_dump -U esseri -d esseri_data_core -Fc \
  > backups/esseri-data-core-$(date +%Y%m%d-%H%M%S).dump
```

Los archivos de `backups/` son locales y están ignorados por Git. Guardar una copia fuera de la
máquina de desarrollo antes de hacer cambios de infraestructura, migraciones o una demo.

### Verificar un backup sin tocar la base real

Primero comprobar que el archivo se puede leer:

```bash
docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_restore -l < backups/esseri-data-core-AAAAmmdd-HHMMSS.dump
```

Para una prueba completa, restaurar en una base temporal y compararla con la base real. Reemplazar
`ARCHIVO.dump` por el backup a comprobar:

```bash
DUMP=backups/ARCHIVO.dump
TEST_DB=esseri_restore_verify_$(date +%s)

docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d postgres -c "CREATE DATABASE ${TEST_DB};"
docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_restore -U esseri -d "$TEST_DB" --exit-on-error < "$DUMP"
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d "$TEST_DB" -c "SELECT count(*) AS tablas FROM pg_tables WHERE schemaname = 'public';"
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d postgres -c "DROP DATABASE ${TEST_DB};"
```

La restauración de prueba no modifica `esseri_data_core`. Confirmar que la cantidad de tablas y los
datos esperados coinciden antes de considerar válido el backup.

### Restaurar sobre la base real

> **Advertencia: este procedimiento reemplaza por completo `esseri_data_core`.** Detener backend y
> frontend, crear antes un backup adicional del estado actual y confirmar que el archivo elegido es
> el correcto.

```bash
cd /ruta/a/esseri-data-core
DUMP=backups/ARCHIVO.dump

docker compose -f infra/docker-compose.yml stop backend frontend
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d postgres -c "DROP DATABASE esseri_data_core;"
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d postgres -c "CREATE DATABASE esseri_data_core;"
docker compose -f infra/docker-compose.yml exec -T postgres \
  pg_restore -U esseri -d esseri_data_core --exit-on-error < "$DUMP"
# Anotar la revisión restaurada ANTES de iniciar backend: su arranque ejecuta migraciones y seeds.
docker compose -f infra/docker-compose.yml exec -T postgres \
  psql -U esseri -d esseri_data_core -c "SELECT version_num FROM alembic_version;"
```

Comparar la revisión restaurada con la que requiere el código antes de iniciar backend. Si el
backup pertenece a una versión anterior incompatible, no arrancar backend ni ejecutar migraciones o
seeds automáticamente: primero restaurar una versión de código compatible o definir una migración
controlada. Solo cuando esa compatibilidad esté confirmada:

```bash
docker compose -f infra/docker-compose.yml start backend frontend
```

Después de iniciar los servicios, comprobar `http://localhost:8000/docs`, iniciar sesión y verificar
los datos críticos.

## Producción

```bash
cd infra
cp env/.env.example env/.env      # completar con valores reales, nunca commitear env/.env
export $(grep -v '^#' env/.env | xargs)   # o definir VITE_API_URL en infra/.env, ver nota abajo
docker-compose -f docker-compose.prod.yml up -d --build
```

Diferencias con el entorno local:
- Sin hot-reload ni volúmenes de código — cada servicio corre la imagen buildeada desde su propio `Dockerfile`.
- El frontend sirve el build estático de `vite build` vía Nginx (mismo `frontend/Dockerfile` que en local, pero sin overridear el `CMD`).
- Las variables se toman de `infra/env/.env`, no de los `.env` de cada capa.

**Nota sobre `VITE_API_URL`:** Vite incrusta esa variable en el bundle en tiempo de build, no en runtime — por eso el frontend la recibe como build arg (`args: VITE_API_URL` en `docker-compose.prod.yml`) en vez de `env_file`. Docker Compose resuelve `${VITE_API_URL}` desde variables de shell o desde un `infra/.env` (que Compose carga automáticamente, distinto de `infra/env/.env`) — asegurarse de que esté definida en uno de los dos antes de buildear.

## Importar workflows a n8n

Los workflows exportados en `infra/n8n/*.json` se importan desde la UI de n8n (`http://localhost:5678` → Workflows → Import from File) o con la CLI: `n8n import:workflow --input=infra/n8n/<archivo>.json`. Después de importar hay que asignar las credenciales y publicar el workflow; los pasos están en `infra/n8n/README.md`.

## Variables de entorno

`infra/env/.env.example` documenta todas las variables que necesita el stack completo en producción. Para desarrollo local sin Docker, cada capa tiene su propio `.env.example` (`backend/.env.example`, `frontend/.env.example`) — ver los README de esa capa.
