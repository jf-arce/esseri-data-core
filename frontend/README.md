# ESSERI Data Core — Frontend

Interfaz web del sistema. Stack: TypeScript, React, Vite, Tailwind CSS, shadcn/ui, Zustand, React
Router. Para formularios: React Hook Form + Zod. Para tablas con orden/paginación/filtro:
TanStack Table (compuesto sobre `components/ui/table.tsx` de shadcn, que no trae esa lógica por sí
solo). Para selección de fecha: React Day Picker (dependencia del `Calendar` de shadcn). Para
adjuntar archivos por drag-and-drop: React Dropzone.

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
