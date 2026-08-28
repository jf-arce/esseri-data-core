# Arquitectura y convenciones del repositorio — ESSERI Data Core

## Propósito de este documento

Este es el documento de referencia sobre **cómo está estructurado el repositorio y cómo se trabaja en él**. Explica el *por qué* de cada decisión — está pensado para leerse una vez y consultarse cuando haga falta.

Para el resumen corto y accionable dirigido específicamente a asistentes de IA, ver **`AGENTS.md`** en la raíz del repo (formato genérico, usado por Cursor y otras herramientas) y **`CLAUDE.md`** (el archivo que Claude Code carga automáticamente al arrancar una sesión — importa `AGENTS.md` y agrega solo lo que es específico de esa herramienta).

Este documento describe **estructura y convenciones**, no decisiones de negocio (eso vive en `Enunciado_del_Alcance`, `Matriz_de_Requerimientos`, etc.) ni el estado de avance del proyecto (eso vive en el cronograma). Si algo acá contradice a esos documentos, esos documentos ganan — y hay que actualizar esto.

---

## Decisiones de base

- **Monorepo** (un solo repositorio para todo el sistema), no un repo por módulo. No lo exige ningún RF/RNF explícitamente — es una decisión del equipo para simplificar la coordinación entre los 4 integrantes y la transferencia final a ESSERI.
- **Separación por capas en la raíz** (`frontend/`, `backend/`, `database/`, `infra/`) para cumplir RNF-09 (separación entre frontend, backend y base de datos).
- **Dentro de cada capa, separación por dominio/módulo** (los 10 módulos del EDT: Autenticación, Familias y Alumnos, Académico, Inscripciones, Facturación, Proveedores y Compras, Workflows, Auditoría, Panel Administrativo, IA/Sugerencias), no por tipo de archivo. Esto refleja la arquitectura orientada a eventos: cada módulo puede evolucionar y publicar/escuchar eventos sin acoplarse a los demás.

---

## Vista general

```
esseri-data-core/
├── frontend/
├── backend/
├── database/
├── infra/
├── .github/
├── docs/
├── .gitignore
├── ARCHITECTURE.md
├── AGENTS.md
├── CLAUDE.md
└── README.md
```

---

## `frontend/`

**Stack:** TypeScript, React, Vite, Tailwind, shadcn/ui, Zustand, React Router.

Interfaz web. Un subfolder por módulo funcional (`modules/`), más carpetas al mismo nivel para todo lo que se comparte entre módulos.

```
frontend/
├── src/
│   ├── modules/
│   │   ├── auth/
│   │   ├── familias-alumnos/
│   │   ├── academico/
│   │   ├── inscripciones/
│   │   ├── facturacion/
│   │   ├── proveedores-compras/
│   │   ├── workflows/
│   │   ├── auditoria/
│   │   ├── panel-admin/
│   │   └── ia-sugerencias/
│   ├── pages/
│   ├── router/
│   ├── components/
│   ├── hooks/
│   ├── api/
│   ├── store/
│   ├── lib/
│   ├── layout/
│   ├── types/
│   ├── test/
│   │   └── setup.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── e2e/
├── components.json
├── index.html
├── vite.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .gitignore
├── eslint.config.js
├── .prettierrc
├── Dockerfile
├── .dockerignore
└── README.md
```

**Convención:** todo lo que está al mismo nivel que `modules/` dentro de `src/` (`pages/`, `router/`, `components/`, `hooks/`, `api/`, `store/`, `lib/`) es, por definición, código compartido entre **todos** los módulos. Nada de eso pertenece a un módulo en particular. Lo que sí es propio de un módulo va adentro de `modules/<modulo>/`.

### Dentro de cada carpeta en `modules/<modulo>/`
| Subcarpeta/archivo | Contenido |
|---|---|
| `components/` | Componentes visuales propios del módulo (formularios, tablas, cards), armados combinando los componentes base de `src/components/ui/`. |
| `pages/` | Vistas completas que arma el módulo combinando varios componentes, usando datos de ese único módulo (ej. `panel-facturas-pendientes.tsx`, con el componente exportado como `PanelFacturasPendientes`), una por pantalla que el ruteo de `App.tsx` referencia. |
| `routes.tsx` | Define las rutas (path + página) que aporta este módulo, ej. `/facturacion` y `/facturacion/:id`, apuntando a los componentes de `pages/`. No registra las rutas directamente en la app, solo las exporta — quien las junta todas es `src/router/`. |
| `hooks/` | Hooks de React específicos del módulo (ej. `use-facturas-pendientes.ts`, exportando `useFacturasPendientes`). |
| `services/` | Funciones que llaman a los endpoints del backend correspondientes a ese módulo (una función por endpoint consumido, ej. `facturacion/services/get-facturas-pendientes.ts`). |
| `store.ts` | Store de Zustand con el estado propio del módulo (ej. en `facturacion/store.ts`: filtros activos del panel de facturas, factura seleccionada) — solo si el módulo maneja estado que varios componentes propios necesitan compartir. |
| `types.ts` | Tipos TypeScript de las entidades del módulo (reflejan el diccionario de datos: `Familia`, `Alumno`, `Factura`, etc.). |
| `utils.ts` | Funciones auxiliares propias del módulo que no son componentes ni llamadas a la API (formateo de montos, cálculo de porcentaje de asistencia, etc.) — solo si el módulo las necesita. |

No todos los módulos necesitan todas las subcarpetas/archivos. Por ejemplo `panel-admin/` probablemente solo tenga `pages/` y `services/` (agrega datos de otros módulos, no tiene lógica ni estado ni tipos propios); `auth/` en cambio sí necesita casi todos, porque además de pantallas de login maneja hooks de sesión, estado global de usuario logueado y tipos propios de usuario/rol.

### `src/pages/`
Pantallas que combinan datos o componentes de **más de un módulo**, por eso no pueden vivir dentro de un solo `modules/<modulo>/pages/`. Ejemplos: un Dashboard general que muestra en una misma vista alertas de facturación, inscripciones del día y notificaciones de workflows; o una ficha de alumno que junta datos de `familias-alumnos`, `academico` e `inscripciones`. Cada página acá importa componentes y hooks desde los módulos que necesita (ej. `import { useFacturasPendientes } from '@/modules/facturacion/hooks'`), pero no define lógica de negocio propia — solo compone lo que ya existe en los módulos.

Regla para decidir dónde va una pantalla: si usa datos/componentes de un solo módulo → `modules/<modulo>/pages/`. Si combina dos o más → `src/pages/`.

### `src/router/`
Arma el árbol de rutas de React Router juntando lo que cada módulo expone en su `routes.tsx`, más las páginas de `src/pages/`.

| Archivo | Contenido |
|---|---|
| `index.tsx` | Router principal: importa el array de rutas de cada `modules/<modulo>/routes.tsx` y las combina en una sola lista que usa `App.tsx`. Acá también entran las rutas de `src/pages/` que no pertenecen a ningún módulo específico. |
| `protected-route.tsx` | Componente wrapper que envuelve rutas que requieren sesión iniciada — redirige a login si no hay usuario autenticado (usa `store/auth-store.ts`). |
| `role-route.tsx` | Wrapper similar a `protected-route.tsx`, pero además valida el rol del usuario contra los roles permitidos para esa ruta (ej. solo `admin` puede entrar a `panel-admin`). |

Con esto, ningún módulo necesita saber de la existencia de los demás para definir sus propias rutas — cada uno declara las suyas en su `routes.tsx`, y `router/index.tsx` es el único lugar que los conoce a todos.

### Resto de `frontend/src/` (carpetas compartidas con todos los módulos)
| Carpeta/archivo | Contenido |
|---|---|
| `components/ui/` | Componentes base, generados con la CLI de shadcn (`npx shadcn@latest add <componente>`) y luego editados a mano para reemplazar por completo el estilo por defecto de la librería por los tokens de `DESIGN.md` — variantes, radios, colores y estados quedan horneados adentro del componente (ver `frontend/README.md`), nunca resueltos con `className` en cada pantalla. Al regenerar uno con `--diff`, revisar el diff y volver a aplicar los cambios locales; no usar `--overwrite`. |
| `components/` (resto) | Componentes propios armados a partir de los de `ui/`, reutilizados por más de un módulo (ej. `data-table.tsx`, exportando `DataTable`, un genérico con paginación). |
| `hooks/` | Hooks genéricos (ej. `useDebounce`, `usePagination`). |
| `api/` | Cliente HTTP base (instancia de fetch/axios, interceptor de token JWT, manejo de errores comunes) — es la base técnica que todos los `services/` de cada módulo usan por debajo; no contiene llamadas a endpoints específicos, eso queda en `modules/<modulo>/services/`. |
| `store/` | Stores de Zustand con estado global de la app (ej. `auth-store.ts` con el usuario logueado y sus roles, `ui-store.ts` con estado de sidebar/tema) — separado de los stores por módulo, que viven dentro de cada `modules/<modulo>/store.ts`. |
| `lib/utils.ts` | Helper `cn()` (combinación de clases de Tailwind) que shadcn/ui necesita — es el archivo que la CLI de shadcn genera ahí por defecto. |
| `lib/` (resto) | Funciones auxiliares generales, no visuales, que usa más de un módulo (ej. `format-currency.ts`, `format-date.ts`, validación de DNI). Aprovechamos que shadcn ya crea `lib/` para que sea la única carpeta de utilidades globales, sin duplicar con una `utils/` aparte. Regla para decidir dónde va una función: si la necesita un solo módulo, queda en `modules/<modulo>/utils.ts`; en el momento en que un segundo módulo la necesita, se mueve a `lib/` y ambos importan desde ahí. |
| `layout/` | Headers, sidebars y navegación, adaptados según el rol del usuario logueado. |
| `types/global.d.ts` | Tipos globales que no pertenecen a un módulo específico. |
| `App.tsx` | Componente raíz: renderiza el `RouterProvider` (o `<Routes>`) con el árbol armado en `src/router/`, envuelto en el `layout/` general. |
| `main.tsx` | Punto de entrada de la aplicación. |
| `index.css` | Estilos globales y punto de entrada de Tailwind. Acá viven los tokens de `DESIGN.md` (`--violeta`, `--superficie`, `--texto-2`, etc.), mapeados sobre el contrato de variables de shadcn/ui y expuestos como utilidades Tailwind (`bg-superficie`, `text-texto-2`). Modo claro únicamente: no hay bloque `.dark`. |
| `components.json` | Archivo de configuración de shadcn/ui (le indica a la CLI dónde generar los componentes: `src/components/ui/`). |

### Archivos propios de `frontend/` (independientes del resto del repo)
| Archivo | Contenido |
|---|---|
| `.env.example` | Lista de variables de entorno que el frontend necesita para correr (ej. `VITE_API_URL`), sin valores reales — cada desarrollador copia esto a su propio `.env` local. |
| `.gitignore` | Ignora lo específico de esta capa: `node_modules/`, `dist/`, `.env` local. |
| `eslint.config.js` | Reglas de lint para TypeScript/React — es lo que corre `ci.yml` en el paso de lint. |
| `.prettierrc` | Reglas de formateo automático (comillas, punto y coma, ancho de línea) — evita discusiones de estilo en los PRs. |
| `Dockerfile` | Build multi-stage: una etapa instala dependencias y compila con `vite build`, otra sirve el resultado estático (ej. con Nginx). La misma imagen se usa en local (vía `docker-compose` de `infra/`) y en producción. |
| `.dockerignore` | Evita copiar `node_modules/`, `dist/` y `.env` dentro de la imagen al buildear — mismo espíritu que `.gitignore` pero para Docker. |
| `README.md` | Cómo instalar dependencias, levantar el frontend en local (con o sin Docker) y correr sus tests — para que cualquiera pueda levantar **solo** esta capa sin depender del resto del monorepo. |

### Testing en `frontend/`

Dos niveles, cada uno con su herramienta y su lugar en el árbol — es la convención estándar para proyectos Vite + React hoy: **Vitest** para unitarios/componentes (mismo motor que usa Vite, no hace falta configurar un segundo bundler como pedía Jest) y **Playwright** para end-to-end (ya está definido como herramienta del equipo, según el perfil de Tester/QA).

#### Tests unitarios y de componentes (Vitest) — en `__tests__/` dentro de cada subcarpeta
Cada tipo de código tiene su propia subcarpeta `__tests__/` dentro de `components/`, `hooks/` y `services/`, con el sufijo `.test.tsx`/`.test.ts`. Da una ubicación 100% predecible desde el día uno (no depende de cuántos componentes tenga cada módulo) y mantiene el explorador de archivos más limpio, sin mezclar código y tests en el mismo listado.

```
modules/facturacion/
├── components/
│   ├── __tests__/
│   │   └── factura-card.test.tsx
│   └── factura-card.tsx
├── hooks/
│   ├── __tests__/
│   │   └── use-facturas-pendientes.test.ts
│   └── use-facturas-pendientes.ts
└── services/
    ├── __tests__/
    │   └── get-facturas-pendientes.test.ts
    └── get-facturas-pendientes.ts
```

| Archivo | Contenido |
|---|---|
| `vitest.config.ts` | Configuración de Vitest — normalmente extiende `vite.config.ts` para no duplicar el setup de plugins (React, Tailwind). |
| `src/test/setup.ts` | Configuración global que corre antes de cada test: matchers de Testing Library (`@testing-library/jest-dom`), mocks globales si hacen falta. |

#### Tests end-to-end (Playwright) — carpeta propia en la raíz de `frontend/`
A diferencia de los unitarios, los E2E prueban flujos completos contra la app corriendo (login → navegar a facturación → registrar un pago), por eso no tiene sentido colocarlos junto a un componente puntual — viven en su propia carpeta, organizados por flujo, no por módulo de código.

```
e2e/
├── auth.spec.ts
├── inscripciones.spec.ts
├── facturacion.spec.ts
└── fixtures/
```

| Archivo | Contenido |
|---|---|
| `e2e/<flujo>.spec.ts` | Un archivo por flujo de usuario de punta a punta, no necesariamente 1 a 1 con los módulos de código (ej. `inscripciones.spec.ts` puede tocar `familias-alumnos` + `academico` + `inscripciones` en un solo flujo, como haría un usuario real). |
| `e2e/fixtures/` | Datos y helpers reutilizados entre specs (ej. login programático para no repetir el flujo de auth en cada test). |
| `playwright.config.ts` | Configuración de Playwright: contra qué URL corre (local o el entorno de staging), navegadores a probar, carpeta de resultados. |

Esto cubre directo la tarea 1.5.10 del cronograma ("Ejecución de pruebas de aceptación con ESSERI") — los específicos de esa tarea, escritos junto con QA, van armando `e2e/` a medida que se define cada criterio de aceptación.

**Qué merece test unitario y qué no:** no todo componente necesita uno. Componentes de puro layout/composición (sin lógica propia) no se testean. Sí se testean: lógica de negocio, condicionales según datos/rol, formularios, y hooks con fetch o transformación de datos.

## Convención de nombres

**Todo nombre de archivo y carpeta en `frontend/` va en `kebab-case`**, sin excepción — incluidos los archivos de componentes. Lo que cambia es el nombre **dentro** del código: la función/componente que exporta ese archivo sigue las convenciones normales de cada lenguaje.

| Tipo de archivo | Nombre de archivo | Nombre exportado en el código |
|---|---|---|
| Componente/página | `panel-facturas-pendientes.tsx` | `PanelFacturasPendientes` (PascalCase, como pide React) |
| Hook | `use-facturas-pendientes.ts` | `useFacturasPendientes` (camelCase, como pide la convención `use...` de React) |
| Servicio | `get-facturas-pendientes.ts` | `getFacturasPendientes` (camelCase) |
| Store de Zustand | `auth-store.ts` | `useAuthStore` (camelCase) |
| Tipos | `types.ts` | `Factura`, `DetalleFactura` (PascalCase, como pide TypeScript para tipos/interfaces) |

Se aplica igual en `backend/`: los archivos de Python ya son `snake_case` por convención del lenguaje (`familias_alumnos/`, `models.py`), así que no hace falta ningún cambio ahí — la regla de kebab-case es específica de `frontend/`, donde el ecosistema JS/TS no impone un estándar único y kebab-case es hoy la convención más común en proyectos React.

---

## `backend/`

**Stack:** Python, FastAPI, SQLAlchemy, Alembic, PyTest.

API. Estructura por dominio: cada módulo es un paquete con los mismos archivos, nombrados igual, para que cualquiera del equipo encuentre las cosas sin tener que aprender la organización interna de cada módulo.

```
backend/
├── alembic/
│   ├── versions/
│   └── env.py
├── src/
│   ├── auth/
│   ├── familias_alumnos/
│   ├── academico/
│   ├── inscripciones/
│   ├── facturacion/
│   ├── proveedores_compras/
│   ├── workflows/
│   ├── auditoria/
│   ├── panel_admin/
│   ├── ia_sugerencias/
│   ├── config.py
│   ├── database.py
│   ├── models.py
│   ├── exceptions.py
│   └── main.py
├── tests/
├── requirements/
├── .env
├── .env.example
├── .gitignore
├── alembic.ini
├── logging.ini
├── pyproject.toml
├── Dockerfile
├── .dockerignore
└── README.md
```

### Dentro de cada carpeta en `src/<modulo>/`
| Archivo | Contenido |
|---|---|
| `router.py` | Endpoints HTTP del módulo (define las rutas de la API). |
| `schemas.py` | Modelos Pydantic — forma de los datos que entran y salen por la API. |
| `models.py` | Modelos SQLAlchemy — tablas del módulo según el diccionario de datos (ej. en `facturacion/models.py`: `Factura`, `DetalleFactura`, `MetodoPago`). |
| `service.py` | Lógica de negocio del módulo (qué pasa cuando se registra un pago, cuándo se genera una alerta de morosidad, etc.). |
| `dependencies.py` | Dependencias de FastAPI propias del módulo (ej. validar que una factura exista antes de procesarla). |
| `constants.py` | Constantes y códigos de error específicos del módulo. |
| `exceptions.py` | Excepciones propias del módulo (ej. `FacturaYaPagada`, `AlumnoNoEncontrado`). |
| `config.py` | Variables de configuración específicas del módulo, si las tiene (ej. `auth/config.py` con parámetros de JWT). |

### Resto de `src/` (archivos sueltos, no pertenecen a un módulo)
Así lo resuelve directamente el repo de referencia: unos pocos archivos a nivel de `src/`, sin carpeta aparte. Arrancamos así por simplicidad; si con el tiempo `models.py` empieza a acumular demasiado (muchas entidades compartidas, tablas intermedias, enums, etc.) y se vuelve difícil de navegar, ahí se evalúa partirlo — pero no antes.

| Archivo | Contenido |
|---|---|
| `config.py` | Configuración global de la app (conexión a base de datos, CORS, variables de entorno compartidas). |
| `database.py` | Configuración del engine de SQLAlchemy y la sesión de base de datos. |
| `models.py` | Base declarativa de SQLAlchemy + todo lo de dominio que usa más de un módulo: entidades compartidas (ej. `Persona`, que usan `familias_alumnos` y `auth`), **tablas intermedias** de relaciones muchos-a-muchos entre módulos distintos (si la relación es interna a un solo módulo, la tabla intermedia se queda en el `models.py` de ese módulo), y **enums** usados por más de uno (ej. un estado genérico que aplica a `Alumno` y a `Proveedor`). Regla simple: si algo lo usa un solo módulo, se queda en su propio `models.py`; recién cuando un segundo módulo lo necesita, se sube acá. |
| `exceptions.py` | Excepciones base de toda la aplicación (ej. handler genérico de errores no capturados). |
| `main.py` | Punto de entrada: crea la instancia de FastAPI e incluye los routers de todos los módulos. |

**¿Y constantes compartidas o lógica de negocio compartida?** Mismo criterio: si un segundo módulo empieza a necesitar una constante o una función de otro módulo, no se duplica — se sube a `src/`. Para constantes, alcanza con agregarlas directo a `models.py` si son pocas, o crear un `constants.py` puntual el día que haga falta. Para lógica (ej. una función de cálculo que usan `facturacion` y `proveedores_compras`), un archivo suelto y descriptivo como `src/vencimientos.py` que ambos módulos importan — si eso crece mucho, es señal de que probablemente merece ser su propio módulo.

### Notas por módulo específico
| Módulo | Particularidad |
|---|---|
| `facturacion/` | Además de facturas/pagos, incluye la cuenta corriente por alumno (`CUENTA_CORRIENTE`/`MOVIMIENTO`, libro de movimientos inmutable — el saldo nunca se persiste, se calcula sumando movimientos) y el motor de penalidades por tramos (`REGLA_PENALIDAD`, `EXCEPCION_VENCIMIENTO`) que dispara `aplicar_vencimiento`/`aplicar_penalidad` desde `workflows/`. |
| `workflows/` | Además de los archivos estándar, contiene el cliente que dispara la automatización externa (motor de workflows resuelto vía n8n según el diccionario de datos) y la entidad `TAREA` con su cadena de escalamiento (`crear_tarea`/`escalar_caso`, dos de los 15 tipos de acción del motor). |
| `auditoria/` | Solo `router.py` y `service.py` — es una capa de consulta sobre tablas de otros módulos (`AUDIT_LOG`, `EVENT_LOG`, `LOG_ACCESO`, `WORKFLOW_EXECUTION`, `NOTIFICACION`, `CUENTA_CORRIENTE`/`MOVIMIENTO`, `TAREA`), no tiene `models.py` propio. `AUDIT_LOG` (cambios de datos, ex `EVENT_LOG`) y `EVENT_LOG` (hechos de negocio append-only que consume el motor de workflows) son transversales y viven en `src/models.py`, no acá — ver diccionario de datos. |
| `panel_admin/` | Igual que auditoría: sin modelo propio, solo agrega y expone datos de otros módulos. |
| `ia_sugerencias/` | Contiene el cliente que se comunica con la API de OpenAI, además de los archivos estándar para `IA_SUGERENCIA`. |

### Resto de `backend/` (fuera de `src/`)
| Carpeta/archivo | Contenido |
|---|---|
| `alembic/versions/` | Cada migración de base de datos generada. |
| `alembic/env.py` | Punto de entrada que Alembic usa para ejecutar las migraciones. |
| `tests/` | Un subfolder por módulo, espejando `src/`, con los tests de cada uno. Un `conftest.py` en la raíz de `tests/` define fixtures compartidas por PyTest (ej. cliente de test, base de datos de prueba) — convención estándar de PyTest para no repetir el mismo setup en cada módulo. |
| `requirements/` | Dependencias del proyecto separadas por entorno (base, desarrollo, producción). |

### Archivos propios de `backend/` (independientes del resto del repo)
| Archivo | Contenido |
|---|---|
| `.env` | Variables de entorno reales de cada desarrollador (conexión a la base local, `JWT_SECRET`, credenciales de OpenAI) — nunca se commitea, va en `.gitignore`. |
| `.env.example` | Misma lista de variables que `.env`, sin valores reales — referencia para saber qué hace falta configurar. |
| `.gitignore` | Ignora lo específico de esta capa: entornos virtuales (`venv/`, `__pycache__/`), `.env` local. |
| `alembic.ini` | Configuración de Alembic: dónde está la carpeta de migraciones, formato de nombre de cada archivo de migración, y de dónde toma la URL de conexión a la base (vía `.env`). Es lo que lee Alembic al correr `alembic upgrade head` o `alembic revision --autogenerate`. |
| `logging.ini` | Configuración del logging de toda la app: nivel de detalle (`DEBUG`/`INFO`/`WARNING`/`ERROR`), formato de cada línea y destino (consola/archivo) — para que Uvicorn y el código de los módulos logueen de forma consistente en vez de que cada uno configure el suyo. |
| `pyproject.toml` | Configuración de `ruff` (lint + formato para Python, reemplaza tener black/isort/flake8 por separado) — es lo que corre `ci.yml` en el paso de lint del backend. |
| `Dockerfile` | Build de la imagen del backend: instala dependencias de `requirements/`, copia `src/` y corre Uvicorn. La misma imagen se usa en local (vía `docker-compose` de `infra/`) y en producción. |
| `.dockerignore` | Evita copiar `venv/`, `__pycache__/`, `tests/` y `.env` dentro de la imagen al buildear. |
| `README.md` | Cómo instalar dependencias (`pip install`/`poetry`), correr migraciones con Alembic, levantar el servidor con `uvicorn` (con o sin Docker) y correr los tests con PyTest — para poder levantar **solo** el backend sin tocar el resto del monorepo. |

---

## `database/`

Documentación y referencia del modelo de datos (las migraciones ejecutables viven en `backend/alembic/`, acá queda la referencia legible por humanos).

```
database/
├── schema/
├── seeds/
└── README.md
```

| Carpeta/archivo | Contenido |
|---|---|
| `schema/` | DER actualizado, diagrama de referencia del modelo de datos. |
| `seeds/` | Scripts o archivos de carga inicial: catálogos que el sistema necesita para funcionar (niveles educativos, roles, métodos de pago, etc.), según lo documentado en el diccionario de datos. |
| `README.md` | Cómo generar el DER actualizado, orden en que se deben cargar los seeds, y link a `backend/alembic/` que es donde realmente se ejecutan las migraciones — para entender el modelo de datos sin tener que leer todo `backend/`. |

---

## `infra/`

Todo lo que no es código de aplicación pero hace falta para correr el sistema.

```
infra/
├── n8n/
├── env/
│   └── .env.example
├── docker-compose.yml
├── docker-compose.prod.yml
└── README.md
```

| Carpeta/archivo | Contenido |
|---|---|
| `n8n/` | Workflows exportados del motor de automatización (vive acá y no en `backend/` porque la ejecución de los workflows se resuelve vía n8n, sin lógica de aplicación propia). |
| `env/` | Plantillas de variables de entorno por ambiente (desarrollo, testing, producción) — nunca credenciales reales, solo la lista de variables que hacen falta. |
| `docker-compose.yml` | Orquesta el ambiente **local** (tarea 1.3.1 del cronograma): levanta un contenedor por cada pieza — PostgreSQL, backend (usando `backend/Dockerfile`), frontend (usando `frontend/Dockerfile`) y n8n — todos conectados en la misma red interna, con hot-reload para desarrollo. |
| `docker-compose.prod.yml` | Variante para producción: mismas imágenes, pero sin hot-reload, con el frontend sirviendo el build estático y variables tomadas de `env/` en vez de `.env` locales. |
| `README.md` | Cómo levantar el ambiente completo con `docker-compose up`, cómo importar los workflows de `n8n/` y qué variables de `env/` hay que completar — para que alguien pueda levantar el sistema entero sin tener que leer `frontend/README.md` y `backend/README.md` por separado. |

---

## `.github/workflows/`

| Archivo | Contenido |
|---|---|
| `ci-frontend.yml` | Pipeline de integración continua del frontend (lint, tests, build) — corre solo cuando cambia algo dentro de `frontend/`. |
| `ci-backend.yml` | Pipeline de integración continua del backend (lint, tests) — corre solo cuando cambia algo dentro de `backend/`. |

Se separó en dos workflows (en vez de un único `ci.yml`) para que cada PR dispare solo el CI de la capa que tocó, sin esperar el build de la otra.

---

## `docs/`

| Contenido |
|---|
| READMEs específicos por módulo, si hace falta más detalle que el README general. |
| Registro de decisiones de diseño (ADRs) — documentar por qué se tomó cada decisión marcada como [DECISIÓN DE DISEÑO] en el diccionario de datos, para poder justificarlas ante el tutor. |

---

## Raíz del repositorio

| Archivo | Contenido |
|---|---|
| `ARCHITECTURE.md` | Este documento — explicación completa de la estructura del repo, convenciones de nombres y testing, con el *por qué* de cada decisión. |
| `AGENTS.md` | Resumen corto y accionable para asistentes de IA (checklist de decisión + reglas imperativas), en el formato genérico que leen herramientas como Cursor. |
| `CLAUDE.md` | Archivo que **Claude Code carga automáticamente** al arrancar una sesión — importa `AGENTS.md` (`@AGENTS.md`) y agrega la única instrucción que es específica de Claude Code (usar modo plan en zonas sensibles). Todo lo demás vive en `AGENTS.md` para no duplicar entre herramientas. |
| `.gitignore` | Solo lo que aplica a **todo** el repo (ej. archivos de IDE, `.DS_Store`). Lo específico de cada capa (`node_modules/`, `venv/`, etc.) va en el `.gitignore` de esa capa, no acá. |
| `README.md` | Punto de entrada del repositorio: qué es el proyecto, cómo está organizado en capas, un link a `ARCHITECTURE.md` para el detalle completo, y un link a cada `README.md` de capa (`frontend/`, `backend/`, `database/`, `infra/`) para quien necesite levantar esa capa en particular — requisito de RNF-13 para que ESSERI pueda mantener el sistema de forma autónoma. |

Con esto, cada capa queda autocontenida: alguien puede clonar el repo, entrar solo a `backend/` y con su propio README + `.env.example` + `.gitignore` tener todo lo necesario para entender y levantar esa capa, sin depender de leer el resto del monorepo.

---

## Pendiente de definir (no incluido acá a propósito)

- Contenido exacto de `infra/n8n/` — el motor ya tiene los 15 tipos de acción confirmados por el cliente (ver `WORKFLOW_RULE.tipo_accion` en el diccionario de datos), pero falta la allowlist campo por campo de `accion_config` y qué acciones requieren `requiere_aprobacion_humana` — decisión de equipo, no de ESSERI (preguntas pendientes #15/#16 del diccionario).

## Decisiones acordadas con el equipo (no vienen de la guía ni del cliente)

- **Dockerizar también producción**, no solo el entorno local — se usa la misma imagen de `frontend/Dockerfile` y `backend/Dockerfile` en ambos casos, cambiando solo la configuración vía `docker-compose.prod.yml`. Recomendado por simplicidad de mantenimiento para un equipo chico de DevOps y para facilitar la transferencia final a ESSERI (RNF-13). El cronograma solo exige Docker explícitamente para el entorno local (tarea 1.3.1); para producción se recomienda un servicio tipo Railway/Render que reciba las imágenes directamente, dado el tiempo acotado que tiene la tarea 1.6.1 (2 días).
- **Flujo de trabajo: feature-branch (GitHub Flow)** — `main` es la única rama larga y queda protegida. Cada tarea se trabaja en una rama corta desde `main` (`feature/<algo>` o `fix/<algo>`), se abre un Pull Request, y hace falta CI en verde (`ci-frontend.yml`/`ci-backend.yml` según la capa) más al menos una review antes de mergear; la rama se borra al mergear. Se eligió por ser el modelo más liviano de los tres estándar (GitHub Flow, Git Flow, trunk-based), acorde a un equipo chico de 4 personas sin necesidad de manejar releases versionados en paralelo. Documentado en el `README.md` de la raíz, sección "Flujo de trabajo".

---

## Instrucciones accionables para asistentes de IA

Las reglas imperativas para IA (checklist de decisión, qué hacer y qué no al generar código, comandos de build/test, zonas sensibles) viven en **`AGENTS.md`** en la raíz del repo — formato genérico que leen herramientas como Cursor o GitHub Copilot. **Claude Code no lee `AGENTS.md` directamente**: para eso está **`CLAUDE.md`**, que importa `AGENTS.md` con `@AGENTS.md` y agrega únicamente lo que es específico de esa herramienta (usar modo plan en las zonas sensibles). Este documento (`ARCHITECTURE.md`) es la explicación larga del *por qué* de cada decisión; `AGENTS.md` es el resumen accionable del *qué hacer*; `CLAUDE.md` es solo un puntero fino, sin duplicar contenido entre los tres.
