# ESSERI Data Core — Frontend

Interfaz web del sistema. Stack: TypeScript, React, Vite, Tailwind CSS, shadcn/ui, Zustand, React
Router. Para formularios: React Hook Form + Zod. Para tablas con orden/paginación/filtro:
TanStack Table (compuesto sobre `components/ui/table.tsx` de shadcn, que no trae esa lógica por sí
solo). Para selección de fecha: React Day Picker (dependencia del `Calendar` de shadcn). Para
adjuntar archivos por drag-and-drop: React Dropzone.

Para la estructura completa de carpetas y las convenciones del proyecto, ver **`ARCHITECTURE.md`** en la raíz del repo.

## Requisitos

### Communications — stages 1 and 2

Administration/Direction open `/comunicaciones` to create or resume their own drafts.
Teachers use `/docente/comunicaciones` inside the existing Portal Docente; the same four-step
form is reused with only their assigned courses/students and an explicit cycle. The teacher
history shows only their own course drafts and publications. Saving a draft does not publish it.
Changing the cycle while editing reloads the available courses/students without reopening the
persisted draft or discarding unsaved content; select the audience again for the new cycle.
Published content is immutable. Recipient counts are responsible people, not households or
student links. Email and attachments are not enabled in these stages.

Family uses `/familia/comunicaciones` in its existing portal. Opening an authorized detail
records that responsible's first read; a failed read request offers retry without hiding the
message. Plain-text content is rendered as text, never HTML. Search, unread filtering and
server pagination use the real API.

### Communications — stage 3 interface

The staff detail separates **Mensaje** from **Entrega (N)**, where N counts responsible
people (not email addresses). The active tab is preserved in `?vista=entrega`. Message content
and attachments remain on the first tab, with a short delivery link; delivery data is loaded
only when opening it. Portal-only publications and drafts have explicit delivery states without
calling email endpoints. Families do not receive staff delivery tabs or recipient lists.

**Entrega** is a server-side projection with one row per responsible. The **Email** column shows
only the address(es). Communications with email get **Estado mail**; communications with portal
get **Estado** (portal-only) or **Estado portal** (when both channels apply), carrying the first
portal read (“Leído” with its date/time on hover, “No leído”). The summary uses compact
individual metric cards: **Destinatarios**, plus **Enviados**/**Rechazados** when email applies
and **Leídos**/**Sin leer** when portal applies (3 cards for one channel, 5 for both). All cards
share the same size and typography. Portal-only rows show the responsible's contact email; the
summary clarifies that no emails were sent. Search and state filters run over the complete result
(accent-insensitive, including email addresses; `%` and `_` are literal); pagination shows 10
responsible people per page. If the current page becomes out of range after a retry or filter
change, the table clamps to the last valid page and refetches instead of showing a dead-end empty
state. Retry errors clear when the delivery is reloaded. Summary counts keep responsible people
and email intentions separate and never claim delivery or bounce. Send-status tooltips expose the
attempt history; retries are offered only for definite failures. Staff metadata
uses the subject as title, plain category/channel labels, publication state and a compact
Buenos Aires date/time without seconds. No new backend delivery states are inferred.

Management can select Institutional, Administrative or Other content types, then select the
audience independently. Audience cards expand inline; student/responsible searches preserve
checked entries. Attaching the first file saves the valid draft automatically without publishing.

Verified PNG/JPG/PDF files open through one **Ver adjunto** / **Ver adjuntos** action. The
authenticated viewer lets users switch files and download from inside the dialog; downloads
are not separate list actions. PDF display depends on browser support, with download as fallback.
Temporary blob URLs are revoked when switching files, closing or unmounting.

The email summary's recipient and sent counts open searchable dialogs with 10 rows per page. Search covers
the full server-side list; dialog height follows the current row count, capped for small screens.
The email attachment notice freezes filenames at publication and links to the authenticated portal,
never to public files or email binaries. Already-created email snapshots are not rewritten.

Focused component tests:

```bash
npm run test -- src/modules/comunicaciones/pages/__tests__/comunicaciones.test.tsx
```

Real end-to-end test (no frontend responses mocked): start the backend and frontend against an
isolated migrated PostgreSQL database. Supply an Administration account with the stage-one
permissions and a Family account linked to an active student with communications enabled.
Both accounts must have a single active role for this test login. Supply their addresses and
the shared **test-only** password through environment variables, never source files:

```bash
E2E_COMUNICACIONES_REAL=true \
E2E_BASE_URL=http://localhost:5173 E2E_API_URL=http://localhost:8000 \
E2E_COMUNICACIONES_ADMIN="$TEST_ADMIN_EMAIL" \
E2E_COMUNICACIONES_FAMILIA="$TEST_FAMILY_EMAIL" \
E2E_COMUNICACIONES_PASSWORD="$TEST_PASSWORD" \
npm run test:e2e -- --config playwright-comunicaciones.config.ts
```

The dedicated configuration runs Chromium desktop and mobile against real persisted data.
It creates publications and preserves them in the isolated database for inspection. Without
explicit opt-in it skips. Do not point it at shared or production environments.

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

| Variable       | Descripción                                                                                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | URL base de la API del backend (ej. `http://localhost:8000`). El login con Google es un link a `${VITE_API_URL}/auth/google/login` — el client ID de Google solo lo usa el backend, nunca llega al navegador (ver `docs/auth-oauth-google.md`). |

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

### Panel de Dirección

La ruta `/panel` conserva los colores, componentes y la preferencia de tema del sistema.
En la Consola, el botón de contraer/expandir de la cabecera reduce la navegación lateral
a sus íconos o vuelve a mostrar los nombres. El atajo existente `Ctrl+B` o `Cmd+B` conserva esa función.
Con la barra contraída, abrir un módulo muestra sus submódulos debajo de su ícono,
sin expandir la barra ni ocultar los otros módulos.
Además de los cuatro indicadores existentes, muestra solicitudes de compra pendientes,
cuentas por familia con deuda vencida, evolución financiera, asistencia de los últimos
30 días y actividad reciente de compras, finanzas y alumnos. Cada bloque respeta el permiso de lectura de su módulo.
Las secciones se cargan de forma independiente; un error no se representa como cero.

La evolución usa `GET /panel-admin/evolucion-financiera`, que exige lectura del panel
y de facturación. Compara facturas emitidas con pagos aprobados desde enero hasta la
fecha actual. No compara ingresos y gastos, ni incluye movimientos futuros. Los días
sin asistencia registrada no se consideran ausencias. La actividad reciente muestra los
seis hechos registrados más recientes que el rol puede consultar; no pretende ser una auditoría institucional completa.

Los bloques del panel ajustan su altura al contenido y mantienen columnas independientes
en escritorio. Los gráficos muestran sus escalas y referencias de período sin desplegar
el detalle; conservan los tooltips y las lecturas por teclado. La pestaña de compras
cuenta solamente solicitudes pendientes cargadas correctamente. La tabla muestra el
estado real de cada solicitud, pero no una columna de monto: ese dato no forma parte
de la solicitud de compra y no se estima a partir de los precios de proveedores.

### Historial de asistencia

El botón «Ver asistencias» del Panel de Dirección abre el historial con los registros
de hoy (fecha local) y respeta el ciclo lectivo del encabezado. El selector de ciclo de
la pantalla actualiza ese mismo estado global. Los filtros dependientes de nivel, año,
división y alumno usan inscripciones históricas, incluidas las finalizadas. Cambiar un
filtro superior limpia sus dependientes. Se puede filtrar también por estado y rango de
fechas; «Limpiar filtros» conserva el ciclo del sistema y vuelve al día actual.

Los indicadores muestran el total filtrado, presentes, ausencias justificadas e
injustificadas y porcentaje de asistencia (presentes más tardanzas sobre registros).
No dependen de la página visible. La tabla ordena inicialmente por fecha descendente,
permite ordenar por alumno y fecha y usa paginación del servidor con cantidad de resultados.
El botón «Exportar» abre un menú con CSV, Excel y PDF. Exporta todos los registros
filtrados, no solo la página, y solo se ofrece con `academico.exportar`. El acceso
separado «Exportar asistencias» ya no aparece en el menú; su URL anterior redirige al
historial y conserva el control de permiso de exportación. Un docente consulta una división asignada a su ciclo;
la pantalla no amplía sus permisos. Los errores no se muestran como indicadores en cero.

### Ejecución

```bash
npm run test         # corre una vez
npm run test:watch   # modo watch
```

Los tests unitarios/de componentes viven en `__tests__/` dentro de cada subcarpeta (`components/`, `hooks/`, `services/`) que los necesite. No todo componente requiere test — ver el criterio en `ARCHITECTURE.md`.

## Tests end-to-end (Playwright)

```bash
npx playwright install chromium firefox webkit   # una sola vez, instala los navegadores
E2E_BASE_URL=http://localhost:5173 npm run test:e2e
```

Necesitan un backend con el seed de demo cargado (`database/seeds/04_seed_demo.py`): `e2e/auth.setup.ts`
inicia sesión con `demo.admin@esseri.local` (cambiable con `E2E_EMAIL` / `E2E_PASSWORD`) y guarda la
sesión en `e2e/.auth/` (ignorada por git). Con `E2E_BASE_URL` se apunta a un entorno ya levantado; sin
ella, Playwright levanta `npm run dev`.

**Cross-browser (RNF-02, #224).** `playwright.config.ts` corre cada spec en cinco perfiles: Chrome y
Edge (`chromium`, mismo motor), Firefox, Safari (`webkit`, el motor de Safari) y celular (`mobile-chrome`,
Pixel 7; `mobile-safari`, iPhone 14). `e2e/pantallas-principales.spec.ts` recorre las pantallas del
menú y verifica que carguen con su título, sin errores de JavaScript y sin ensanchar la página. Las
fallas conocidas quedan anotadas en `FALLAS_CONOCIDAS` con su motivo. WebKit no es Safari real: un
detalle propio de Safari en iOS solo se ve en un dispositivo.

Vitest excluye `e2e/`: esos specs corren solo con Playwright.

### Comunicaciones etapa 3 — prueba real de navegador

`e2e/comunicaciones-etapa-3.spec.ts` prueba canales, adjuntos privados con ClamAV real y
autorización sin mocks, contra un backend/PostgreSQL aislados. No usa `auth.setup.ts` ni el seed
de demo. La configuración dedicada es `playwright.comunicaciones.config.ts` (Chromium de
escritorio y Pixel 7) y apunta por defecto a `http://localhost:5179`; el backend se indica con
`E2E_API_URL` (por defecto `http://localhost:8019`).

1. Cargar las cuentas sintéticas en la base aislada `communications_stage3_e2e` (desde
   `backend/`, con el intérprete del proyecto). El seed es idempotente, exige una contraseña
   explícita y nunca la imprime:

   ```bash
   DATABASE_URL=postgresql+psycopg://communications:communications-test-only@127.0.0.1:54389/communications_stage3_e2e \
   JWT_SECRET=stage3-test-only STAGE3_E2E_PASSWORD=<synthetic-password> \
   python tests/comunicaciones/seed_e2e.py
   ```

2. Correr el spec con esa misma contraseña (sin ella, los tests se saltean con un motivo
   explícito):

   ```bash
   E2E_API_URL=http://localhost:8019 STAGE3_E2E_PASSWORD=<synthetic-password> \
   npx playwright test --config=playwright.comunicaciones.config.ts
   ```

Cuentas/escenario que imprime el seed: `stage3.admin@esseri.test`,
`stage3.docente@esseri.test` (Laura Díaz), `stage3.familia@esseri.test`,
`stage3.otra-familia@esseri.test`; división `4° B`, ciclo `2027`. El backend debe tener
`COMUNICACIONES_ADJUNTOS_HABILITADOS=true` y ClamAV real configurado: si el escáner no responde,
la subida queda en cuarentena y el test falla a propósito.

## Estructura del proyecto

```
src/
├── modules/       # un subfolder por módulo funcional (auth, facturacion, etc.)
├── router/        # arma el árbol de rutas juntando el routes.tsx de cada módulo
├── components/ui/ # componentes base de shadcn/ui, editados con la identidad ESSERI
├── store/         # estado global de Zustand (ej. ui-store.ts)
├── api/           # cliente HTTP base
├── lib/           # utilidades compartidas (incluye cn() de shadcn)
├── layout/        # header/sidebar de la app
└── types/         # tipos globales
```

Detalle completo de cada carpeta, convenciones de nombres (`kebab-case`) y criterio de testing: ver `ARCHITECTURE.md` en la raíz del repo.

## Asistente de IA

El asistente es un panel acoplado a la derecha, dentro de `layout/app-layout.tsx` (módulo
`modules/asistente/`). Angosta el contenido en vez de taparlo, se abre y se cierra desde el botón
del header o con `Ctrl/⌘ + I`, y su ancho se cambia arrastrando el borde izquierdo. Siempre
arranca cerrado y solo se recuerda su ancho en `localStorage`. Solo aparece con el permiso
`asistente.leer` y si el backend no responde 503 (`ASISTENTE_HABILITADO=false`).

- Las respuestas llegan por SSE (`services/enviar-mensaje.ts`, `fetch` + `ReadableStream`).
- El texto llega en trozos (`delta`) y `hooks/use-texto-gradual.ts` lo revela de a poco, como una escritura continua. Solo anima lo que llega en vivo (no los mensajes guardados) y respeta `prefers-reduced-motion`. Las cards y las acciones entran cuando termina de escribirse.
- El backend manda alias (`[ALUMNO:3]`) en vez de nombres; `hooks/use-alias.ts` los resuelve con
  `POST /asistente/resolver` y `components/texto-con-alias.tsx` los muestra.
- El modelo elige una clave de destino (`ir_a`) y `utils.ts` la convierte en una ruta validada contra
  el menú del rol activo. Nunca se navega a una URL generada por el modelo.
- Las respuestas se muestran con formato markdown (`react-markdown` + `remark-gfm`, sin HTML crudo). Los alias se reemplazan por links antes de renderizar y solo se aceptan links a rutas internas.
- El panel se remonta al cambiar de cuenta o de rol, lo que descarta la conversación visible, la
  caché de alias y el stream en curso.

## Selector de color

El panel del asistente usa [`@shadcn/react`](https://www.npmjs.com/package/@shadcn/react) (`message-scroller`): mantiene el scroll pegado al final mientras llega la respuesta y trae el botón de "ir al final". Lo usa `components/ui/message-scroller.tsx`, generado con la CLI de shadcn (AI Elements).

Las transiciones del panel del asistente (entrada de mensajes, sugerencias, puntos de "Pensando…") usan [`motion`](https://motion.dev) con `MotionConfig reducedMotion="user"`, así que se apagan si el sistema pide reducir movimiento. Solo lo usa `modules/asistente/`.

El color de las materias (Académico) se elige con [`react-colorful`](https://github.com/omgovich/react-colorful) (`HexColorPicker` y `HexColorInput`), dentro del `Popover` de shadcn: shadcn/ui no trae un color picker propio. Está fijado en una versión exacta en `package.json` y solo lo usa `modules/academico/components/selector-color.tsx`.

## Fechas y horas

Los instantes llegan de la API en ISO 8601 UTC (`2026-10-26T13:00:00Z`) y se muestran con `formatearFechaHora` (y `formatearDiaDeInstante` cuando solo se quiere el día) de `src/lib/fechas.ts`: siempre en hora de Buenos Aires y formato de 24 h (`28/02/2027, 23:30`), sin importar la zona del navegador. Las fechas de solo día (`YYYY-MM-DD`) no pasan por esas funciones.

## Sistema de diseño ESSERI

El sistema de diseño completo está documentado en **`DESIGN.md`** (raíz del repo), con cada
componente montado en vivo en **`docs/esseri-vistas.html`** (vistas 02 "Tokens" y 03
"Componentes"). Esta sección es el resumen operativo para escribir una pantalla nueva sin abrir
ninguno de los dos.

**Regla dura: en una pantalla no se escribe un hex ni un color arbitrario** (`bg-[#7C24A3]`,
`text-[#6B6577]`). Si hace falta un color que ningún token cubre, falta una variante en el
componente de `components/ui/` — se agrega ahí, no en el `className` de la pantalla.

### Tokens → utilidad Tailwind

Definidos en `src/index.css`, expuestos como clases (`bg-<token>`, `text-<token>`, `border-<token>`):

| Token                                                                                                                              | Uso                                                          |
| ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `lienzo`                                                                                                                           | Fondo de la aplicación                                       |
| `superficie`                                                                                                                       | Cards, tablas, modales, inputs (nunca blanco puro)           |
| `fila-hover`                                                                                                                       | Hover de fila/sección                                        |
| `borde`                                                                                                                            | Hairline de 1px: inputs, divisores, filas                    |
| `nav`, `nav-hover`, `nav-activo`                                                                                                   | Rampa del rail lateral oscuro                                |
| `texto-sobre-oscuro`, `texto-2-sobre-oscuro`, `lila-claro`                                                                         | Texto sobre `nav`/`tinta`                                    |
| `violeta`                                                                                                                          | Primario de interacción (botones, foco, ítem activo)         |
| `violeta-esseri`                                                                                                                   | Marca en reposo y hover de `violeta` — nunca color de acción |
| `violeta-suave`, `violeta-borde`                                                                                                   | Fondo/borde tenue (chips, selección)                         |
| `petroleo`                                                                                                                         | Acento secundario y toda la capa de IA                       |
| `exito`, `advertencia`, `error`, `info` (+ `-suave`)                                                                               | Estado, nunca identidad ni acción                            |
| `mod-familias`, `mod-academico`, `mod-inscripciones`, `mod-facturacion`, `mod-compras`, `mod-workflows`, `mod-auditoria`, `mod-ia` | Identidad de dominio en listas/timelines                     |
| `texto`, `texto-2`, `texto-3`, `desactivado`                                                                                       | Jerarquía de texto                                           |

Radios por tamaño de componente (§5.1 de `DESIGN.md`, nunca uno único): `rounded-full` (botón,
badge, ítem de nav), `rounded-lg` (input/select, 8px), `rounded-card-sm` (12px), `rounded-card`
(16px), `rounded-panel` (20px, contenedor grande/tabla).

### Qué variante usar en cada caso

| Necesito                                                           | Uso                                                                                                                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Botón primario / secundario / discreto / destructivo               | `<Button variant="default\|secondary\|ghost\|destructive">`, `size="default\|lg"`                                                     |
| Badge de estado (con punto, nunca solo color)                      | `<Badge variant="exito\|advertencia\|error\|info">`                                                                                   |
| Badge de módulo (identidad de dominio)                             | `<Badge variant="modulo" data-modulo="familias\|academico\|...">`                                                                     |
| Campo con ícono a la izquierda (correo, DNI, importe, búsqueda...) | `<Field>` + `<FieldLabel>` + `<InputGroup>` con `<InputGroupAddon>` + `<InputGroupInput>` (ver `modules/auth/pages/login-page.tsx`)   |
| Error inline de un campo                                           | `<FieldError>` dentro del `<Field>`                                                                                                   |
| Resumen de errores de formulario / banner de error de operación    | `<Alert variant="error">` — es una caja persistente en la página, no un toast                                                         |
| Confirmación o fallo de una acción puntual                         | `toast()` de `sonner` (`<Toaster />`), abajo a la izquierda                                                                           |
| Estado vacío con acción sugerida                                   | `<Empty>` + `<EmptyMedia variant="icon">` con el color del módulo/semántico correspondiente en `className`                            |
| Pantalla sin permiso                                               | `<Empty>` + `<EmptyMedia variant="neutral">` — nunca color de módulo, es una restricción de acceso, no un estado del dominio          |
| Carga de contenido                                                 | `<Skeleton>` con la forma real del layout final, nunca un spinner suelto                                                              |
| Confirmación destructiva                                           | `<AlertDialog>` con el nombre concreto del registro afectado en el título                                                             |
| Menú de acciones de fila                                           | `<DropdownMenu>`; la acción destructiva va al final, separada por `<DropdownMenuSeparator>`, `variant="destructive"`                  |
| Chip de filtro / botón segmentado                                  | `<ToggleGroup>` + `<ToggleGroupItem>` (`variant="default"` = chip, `variant="outline"` dentro de un grupo `spacing={0}` = segmentado) |
| Tabla                                                              | `<Table>`, una sola densidad: fila de 40px, `text-sm`, sin variantes                                                                  |

### Qué NO hacer

Los primitivos de `components/ui/` ya tienen la identidad ESSERI horneada adentro — no hace falta
(ni corresponde) volver a definir color, radio o sombra en el `className` de cada uso. Componer
pantallas nuevas combinando estos primitivos; si una composición se repite en 2+ módulos (card de
indicador, barra de filtros, riel de eventos), sube a `src/components/` como componente propio,
nunca copiada entre módulos.

## Contenedor en Railway sin dominio propio

Configurar `VITE_API_URL=/api` y `NGINX_CONFIG=nginx-railway.conf` durante el build. En runtime,
`BACKEND_UPSTREAM` contiene el host privado y puerto del backend (`host:8000`, sin protocolo).
El entrypoint de la imagen oficial genera Nginx desde la plantilla y usa los resolvers del contenedor.
La configuración predeterminada `nginx.conf` sigue sirviendo solo archivos estáticos.

Railway publica el frontend por HTTPS; `/api/` se reenvía al backend privado y la cookie OAuth
se ajusta a `/api/auth`. El procedimiento y las variables del backend están en
[Railway](../infra/railway.md). Para verificar este proxy sin Docker, seguir
[las pruebas de Infra](../infra/README.md#verificar-el-proxy-de-railway-sin-docker).
