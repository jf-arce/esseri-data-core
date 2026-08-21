# ESSERI Data Core — Frontend

Interfaz web del sistema. Stack: TypeScript, React, Vite, Tailwind CSS, shadcn/ui, Zustand, React Router.

Para la estructura completa de carpetas y las convenciones del proyecto, ver **`ARCHITECTURE.md`** en la raíz del repo.

## Requisitos

- Node.js 20+ (probado con Node 26)
- npm 10+

## Instalación

```bash
npm install
```

## Variables de entorno

```bash
cp .env.example .env
```

| Variable       | Descripción                                                   |
| -------------- | ------------------------------------------------------------- |
| `VITE_API_URL` | URL base de la API del backend (ej. `http://localhost:8000`). |

## Desarrollo local

```bash
npm run dev
```

Levanta la app en `http://localhost:5173` con hot-reload.

## Con Docker

```bash
docker build -t esseri-frontend .
docker run -p 8080:80 esseri-frontend
```

Esto levanta **solo** esta capa (útil para probar el build de producción de forma aislada). Para correr el sistema completo (frontend + backend + base de datos + n8n) con Docker Compose, ver `infra/README.md`.

## Build de producción

```bash
npm run build
npm run preview   # sirve el build localmente para verificarlo
```

## Lint y formato

```bash
npm run lint
npm run format         # aplica formato con Prettier
npm run format:check   # solo verifica, no modifica archivos
```

## Tests unitarios (Vitest)

```bash
npm run test         # corre una vez
npm run test:watch   # modo watch
```

Los tests unitarios/de componentes viven en `__tests__/` dentro de cada subcarpeta (`components/`, `hooks/`, `services/`) que los necesite. No todo componente requiere test — ver el criterio en `ARCHITECTURE.md`.

## Tests end-to-end (Playwright)

```bash
npx playwright install   # una sola vez, instala los navegadores
npm run test:e2e
```

La configuración (`playwright.config.ts`) ya está lista contra `http://localhost:5173`. Los specs de `e2e/*.spec.ts` se van agregando a medida que cada flujo de usuario tenga pantallas reales — no existen todavía en este setup inicial.

## Estructura del proyecto

```
src/
├── modules/       # un subfolder por módulo funcional (auth, facturacion, etc.)
├── router/        # arma el árbol de rutas juntando el routes.tsx de cada módulo
├── components/ui/ # componentes base de shadcn/ui (no se editan a mano)
├── store/         # estado global de Zustand (ej. ui-store.ts)
├── api/           # cliente HTTP base
├── lib/           # utilidades compartidas (incluye cn() de shadcn)
├── layout/        # header/sidebar de la app
└── types/         # tipos globales
```

Detalle completo de cada carpeta, convenciones de nombres (`kebab-case`) y criterio de testing: ver `ARCHITECTURE.md` en la raíz del repo.
