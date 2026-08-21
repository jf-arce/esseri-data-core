# ESSERI Data Core — Infra

Todo lo que no es código de aplicación pero hace falta para correr el sistema completo (frontend + backend + Postgres + n8n). Ver `ARCHITECTURE.md` en la raíz para el detalle de cada decisión.

## Entorno local

```bash
cd infra
docker-compose up
```

Levanta 4 servicios en la misma red interna:

| Servicio | URL local | Notas |
|---|---|---|
| `postgres` | `localhost:5432` | Usuario/clave/DB: `esseri`/`esseri`/`esseri_data_core` (coincide con `backend/.env.example`). |
| `backend` | `http://localhost:8000` | Corre `uvicorn --reload`, con `backend/src` montado como volumen para hot-reload. Lee `backend/.env` (copiarlo desde `backend/.env.example` antes de levantar). |
| `frontend` | `http://localhost:5173` | Corre `npm run dev` sobre la imagen `node:26-alpine`, con `frontend/` montado como volumen para hot-reload. |
| `n8n` | `http://localhost:5678` | Sin autenticación en local. Los workflows se exportan a `infra/n8n/` (ver el README de esa carpeta). |

Antes de levantar el stack por primera vez:

```bash
cp ../backend/.env.example ../backend/.env   # completar lo que haga falta
```

Para bajar todo (y borrar los datos de Postgres/n8n): `docker-compose down -v`.

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

Los workflows exportados en `infra/n8n/*.json` se importan desde la UI de n8n (`http://localhost:5678` → Workflows → Import from File) o con la CLI: `n8n import:workflow --input=infra/n8n/<archivo>.json`.

## Variables de entorno

`infra/env/.env.example` documenta todas las variables que necesita el stack completo en producción. Para desarrollo local sin Docker, cada capa tiene su propio `.env.example` (`backend/.env.example`, `frontend/.env.example`) — ver los README de esa capa.
