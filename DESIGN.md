# ESSERI Data Core — Design Guidelines

Especificación de diseño completa y agnóstica de implementación. Cualquier equipo, en cualquier stack, debe poder generar interfaces coherentes con ESSERI Data Core leyendo solo este documento.

## 1. Qué es esto

ESSERI Data Core es el ERP académico-administrativo interno del Colegio ESSERI (institución educativa privada argentina): familias y alumnos, gestión académica, inscripciones y asistencia, facturación y cobranzas, proveedores y compras, un motor de workflows con notificaciones automáticas, auditoría y trazabilidad, un panel de indicadores para Dirección, y una bandeja de sugerencias de IA con revisión humana obligatoria.

Es una superficie de **producto**, no de marketing: una herramienta de uso interno, con muchas horas de uso por día y alto volumen de datos tabulares. No lleva hero comercial, no vende, no felicita. Usuarios con permisos diferenciados por rol: Dirección (indicadores y decisión), Administración (operación diaria), Docentes (asistencia y asignaciones), Familias (estado de cuenta y notificaciones). Interfaz en español rioplatense (es-AR).

**Referencia de ambición:** la sobriedad de una herramienta financiera o de un ERP serio (densidad resuelta, tipografía precisa, cero decoración) construida con criterio visual actual. **Anti-referencia:** plantilla genérica de dashboard SaaS, demo de startup de IA, panel de admin de plantilla Bootstrap, app educativa infantil.

## 2. Color

Modo claro únicamente. Nunca `#000000` ni `#FFFFFF` puros: todo neutro de este sistema lleva un tinte violáceo (hue ≈300 en OKLCH), para que la interfaz se lea como una sola familia y no como grises de sistema operativo.

### 2.1 Superficies (tres capas neutras + superficies de módulo)

| Token | Valor | Uso |
|---|---|---|
| lienzo | `#F6F5F8` | fondo de la aplicación |
| superficie | `#FDFCFE` | tablas, modales, inputs (nunca `#FFFFFF`) |
| fila-hover | `#F1EFF4` | hover de fila en tablas, fondo de sección hover |
| borde | `#DAD3E2` | hairline de 1px: inputs, divisores, filas de tabla (ya no separa cards — ver 5.2). Revisado: el valor original (`#E6E2EC`) daba 1.25:1 de contraste contra `superficie`, muy por debajo del piso de 3:1 de WCAG 1.4.11 para el límite de un control interactivo — este valor sube a ~1.43:1 manteniendo el mismo hue violáceo (~268°) |

**Superficies de módulo (`--sup-*`)**: además de las tres capas neutras, cada módulo de la tabla en 2.5 tiene una superficie tonal propia (el color del módulo llevado a ~90–96% de luminosidad manteniendo el hue) — `sup-familias`, `sup-academico`, `sup-inscripciones`, `sup-facturacion`, `sup-compras`, `sup-workflows`, `sup-auditoria`, `sup-ia`. **No es el fondo de la Card** (ver 9): la Card va siempre sobre `superficie` lisa, sin excepción por módulo. Los `--sup-*` quedan reservados a dos usos puntuales: el fondo de un nodo en el canvas de workflows (disparador/condición/acción, ver 9) y el fondo de un tile de ícono (`36–44px`, radio 10–12px) donde hace falta más peso visual que un ícono suelto. Ninguna tabla los usa tampoco: una tabla densa se mantiene sobre `superficie` neutra por legibilidad de fila.

### 2.2 Tinta y rampa de navegación (estructura oscura, no negro)

| Token | Valor | Uso |
|---|---|---|
| tinta | `#14111A` | color de texto sobre superficie clara (títulos de página); fondo de overlays oscuros **transitorios**: snackbar, barra de selección masiva |

`tinta-2` queda deprecado: el hover dentro de superficies oscuras persistentes (el rail) ya no lo usa — ver `nav-hover` abajo.

**Rampa de navegación (rail lateral oscuro)**: el rail de la Consola (ver 8) no usa `tinta` como fondo — tiene su propia rampa, más clara y con más matiz violáceo, para diferenciarse de los overlays transitorios:

| Token | Valor | Uso |
|---|---|---|
| nav | `#241E2E` | fondo del rail lateral |
| nav-hover | `#322C42` | hover de ítem sobre el rail |
| nav-activo | `#3D2F4E` | fondo píldora del ítem activo del rail |
| banda-oscura | `#2A2436` | card de dato hero (ver 9), banda oscura de un dashboard |
| texto-sobre-oscuro | `#EDE8F2` | texto principal sobre nav/banda oscura |
| texto-2-sobre-oscuro | `oklch(78% 0.03 308)` | texto secundario sobre esas mismas superficies: el lila desaturado, nunca gris neutro (gris sobre fondo de color se ve sucio) |
| lila-claro | `#D9B8F0` | texto e ícono del ítem activo del rail |

### 2.3 Violeta: dos roles distintos, nunca intercambiables

| Token | Valor | Rol |
|---|---|---|
| violeta-vibrante | `#7C24A3` | **primario de interacción**: botones, links activos, ítem activo de navegación, foco, iconografía de acento |
| violeta-esseri | `#6E2A8D` | **marca en reposo**: wordmark/logo, y estado *hover* de violeta-vibrante. No es un color de acción |
| violeta-pressed | `#55206E` | estado *pressed* del primario |
| violeta-suave | `#F6EDFB` | fondo tenue (chips, superficies seleccionadas) |
| violeta-borde | `#E7CFF2` | borde tenue a juego con violeta-suave |

Regla dura: el violeta va siempre **plano**. Cero degradés, y en particular cero violeta→azul o violeta→rosa: es el tell más reconocible de interfaz generada por IA, y acá el riesgo es mayor porque el violeta es la marca real.

*(Nota de revisión: al introducir la elevación de card con sombra en 5.2 se reafirmó deliberadamente esta regla — el objetivo de esa revisión era una interfaz más profesional, y un degradé de marca va en contra de eso exactamente igual que antes.)*

### 2.4 Acento secundario y semánticos

| Token | Valor | Uso |
|---|---|---|
| petroleo | `#0E7C86` | acento secundario: datos, links de detalle, y **toda la capa de IA** |
| exito | `#0F7A4D` | estado positivo |
| advertencia | `#B45309` | estado de alerta |
| error | `#B42318` | estado negativo/destructivo |
| info | `#175CD3` | estado informativo |
| exito-suave / advertencia-suave / error-suave / info-suave | `#E0ECE9` / `#F4E8E1` / `#F4E2E2` / `#E1E9F9` | fondo pastel de cada semántico, para badges de estado |

Los semánticos comunican **solo estado**, nunca identidad ni acción. Un badge de estado usa fondo `-suave` + texto/ícono en el color saturado + un punto indicador: el estado nunca se comunica solo por color.

Los `-suave` quedan reservados exclusivamente a badges de estado. La identidad de módulo (qué card pertenece a qué dominio) se comunica con la familia `--sup-*` de 2.1, deliberadamente distinta, para que "card celeste = académico" nunca se confunda con "badge celeste = estado informativo".

### 2.5 Paleta de módulo

Para diferenciar el dominio/tipo de evento en listas y líneas de tiempo (distinto del badge de estado semántico):

| Módulo | Color |
|---|---|
| familias | violeta-vibrante `#7C24A3` |
| académico | info `#175CD3` |
| inscripciones | petróleo `#0E7C86` |
| facturación | advertencia `#B45309` |
| compras | `#54577A` (pizarra violácea) |
| workflows | `#7B49E3` (lila frío, distinto del violeta de marca) |
| auditoría | `#334155` (pizarra oscura neutra) |
| IA | petróleo `#0E7C86` (mismo color reservado a la capa de IA) |

### 2.6 Texto

| Token | Valor | Contraste sobre superficie |
|---|---|---|
| texto | `#1B1822` | 16.1:1 |
| texto-2 | `#6B6577` | 5.2:1 |
| texto-3 | `#7C7688` | 4.0:1 (solo tamaños grandes) |
| desactivado | `#9A94A6` | solo placeholder/disabled, nunca texto que haya que leer |

Todo par texto/fondo debe llegar a ≥4.5:1 (piso AA). Texto gris nunca sobre fondo de color.

### 2.7 Charts

Violeta, petróleo, ámbar, ciruela clara, pizarra. Sin degradés. **Nunca pie/dona**: solo barra (horizontal para composición, vertical/línea para tendencia).

## 3. Tipografía

Una sola familia tipográfica: **Geist** (variable, pesos 100–900, roman + italic). Prohibidas Inter, Arial, system-ui, mono y Roboto como fuente de marca.

- **Etiquetas de sección**: Geist peso 700, versalitas (uppercase), tracking ~0.06em, tamaño 13px (`text-xs`). Es el único lugar donde va texto tracked en mayúsculas; nunca en frases largas.
- **UI y cuerpo**: Geist 400/500/600, base 13–15px. Título de página 24px/600, encabezado de sección 17px/600, cuerpo 15px/400.

### 3.1 Escala (revisado: cuatro pasos sobre la escala nativa de Tailwind, apenas arriba del default)

La escala vive directamente en la escala de tamaños de Tailwind — **nunca** como un valor `text-[Npx]` a mano. Esto no es solo prolijidad: los componentes de shadcn/ui que ya usamos (y cualquiera que se instale a futuro con `npx shadcn add ...`) vienen escritos contra `text-xs`/`text-sm`/`text-base`, así que alinear la escala del proyecto a esos mismos pasos evita que cada componente nuevo necesite retocarse a mano.

`text-xs`/`text-sm`/`text-base` están redefinidos en `frontend/src/index.css` (`@theme inline`) apenas por encima del valor nativo de Tailwind — el sistema lo usa personal y familias de un colegio, no solo un equipo técnico, así que el piso de legibilidad sube de 12px a 13px, sin llegar a un salto completo de escalón. `text-2xl` (rol título) queda en su valor nativo, 24px.

| Rol | Utilidad Tailwind | Tamaño | Uso |
|---|---|---|---|
| micro | `text-xs` | 13px | Etiqueta de sección (versalitas), encabezado de columna de tabla densa, badge, chip, texto auxiliar mínimo (helper, error inline) |
| cuerpo | `text-sm` | 15px | Cuerpo de UI por defecto: botón, input, select, texto de fila de tabla, label de campo, breadcrumb, texto de tabs. También cubre lo que antes era "texto secundario/metadata" — se diferencia por color (`texto-2`/`texto-3`) y peso, no por un tamaño propio |
| encabezado | `text-base` | 17px | Encabezado de sección |
| título | `text-2xl` | 24px | Título de página |

Nunca un valor suelto entre estos pasos (nada de 12.5px, 13.5px, 14.5px, 16px, ni un `text-[Npx]` que solo reescribe a mano un valor que la escala de Tailwind ya cubre): si un texto no encaja claramente en un rol, es señal de que le falta jerarquía real (peso, color, spacing), no que necesite un tamaño intermedio. La densidad de este sistema (§1) ya justifica un piso de 13-15px para texto de UI corriente, por debajo del piso de 15-17px que aplicaría a una superficie de lectura o de marketing (el hero de marketing del login es la única excepción documentada, con un tamaño propio de 40px fuera de esta escala).
- **Datos**: Geist con numerales tabulares (`font-variant-numeric: tabular-nums`) para todo dato: montos, legajos, DNI, fechas, IDs, logs. No hay una fuente monoespaciada separada; la alineación tabular se logra con la feature OpenType, no con otra tipografía.
- Longitud de línea de texto corrido: 65–75ch máximo.
- Cualquier texto que pueda envolver a más de una línea (títulos, valores grandes) necesita un `line-height` explícito acorde a su tamaño (ej. 1.2–1.3), nunca heredar el line-height compacto del cuerpo: a 26–40px de tamaño, un line-height de cuerpo (20px) hace que las líneas se superpongan.

## 4. Espaciado

Grilla de 8px, submúltiplos de 4: **8 / 16 / 24 / 32 / 48**. Padding interno mínimo de 16px en cualquier superficie: nada apretado, nada inflado.

## 5. Forma y elevación

### 5.1 Radio por tamaño de componente (nunca un radio único)

| Contexto | Radio |
|---|---|
| Botón, ítem de navegación | 999px (píldora) |
| Input, select, switch | 8px |
| Checkbox | 5px (radio chico propio, es un control cuadrado pequeño) |
| Badge (estado o módulo) | 999px (pill) |
| Card chica (indicador, ítem de lista) | 12px |
| Card mediana (card genérica, paso de formulario, detalle) | 16px |
| Contenedor grande (panel completo, marco de una grilla de datos) | 20px |
| Modal/diálogo | 12px |
| Grilla de datos densa (fila de tabla, línea de tiempo) | 8px |

### 5.2 Elevación de card: superficie + sombra baja, sin borde

La Card (ver 9) no usa el hairline de 1px como recurso de separación — el hairline queda para inputs, divisores y filas de tabla. Una card se separa del lienzo por su `superficie` lisa (ver 2.1) más una sombra baja y difusa en reposo: `0 6px 20px rgba(20,17,26,.06)`. Sigue prohibida una sombra dura, de radio grande, o cualquier sombra decorativa fuera de ese valor — la sombra existe para separar la card del fondo, no para simular profundidad.

Los demás overlays (dropdowns, modales, toasts, popovers) mantienen su propia sombra de overlay, más marcada que la de una card en reposo. Un ítem en estado de arrastre activo puede llevar una sombra sutil como feedback transitorio.

Prohibido anidar cards dentro de cards: para agrupar contenido dentro de una card se usan divisores (`border-top`) y encabezados de sección internos, nunca otra card.

Densidad empresarial en tablas: fila de 44px (36px en modo compacto).

## 6. Movimiento

150–220ms, easing de salida (ease-out, sin rebote ni elástico). Cero glow, cero bounce. Respetar `prefers-reduced-motion` (duraciones a ~0 cuando está activo).

**Hover / press:** el hover sube un escalón de superficie (a fila-hover, o al hover del rail sobre fondos oscuros) o pasa el violeta a su tono hover (violeta-esseri); el press pasa a violeta-pressed. Nunca un hover de solo-opacidad sobre superficies oscuras: se ve sucio.

**Capa de estado**: la implementación concreta del escalón de arriba, sobre botón, ítem de nav, fila de tabla y chip por igual, es una capa translúcida del color de acción sobre la superficie base — no un hex fijo distinto por cada combinación de componente y estado. Sobre superficie clara: `color-mix(in oklch, var(--violeta) 8%, transparent)` en hover, 10% en foco, 12% en pressed. Sobre superficie oscura (nav, tinta): blanco a 8% / 10% / 12% respectivamente. Un mismo cálculo, reutilizado en todos lados.

## 7. Iconografía

Lucide, trazo 1.5px, `stroke-linecap` y `stroke-linejoin` en `round` (un ícono con puntas en ángulo recto se lee genérico, no del sistema). Tamaño único de 16px en controles de UI, 20px en navegación (sidebar, topbar). Sin emoji, sin unicode como ícono, sin ilustraciones figurativas ni personajes. La capa de IA se marca con color (petróleo) + texto explícito ("Sugerencia de IA"), nunca con un ícono de sparkles o cualquier imaginería "mágica": la IA tiene que verse auditable, no mágica.

Donde una vista necesita más peso visual que un ícono suelto (un nivel académico, una tarjeta de rol, una celda de bento), el ícono va dentro de un **tile**: 36-44px, radio 10-12px, fondo en el tono `-suave` del color de módulo correspondiente e ícono en el tono saturado. No se siembran íconos sueltos como decoración: dentro de una celda de tabla el estado ya lo comunica el badge (punto + texto), y un ícono ahí suma ruido en vez de jerarquía. Ver §13 para el set de ilustraciones geométricas, que es un lenguaje aparte del ícono funcional.

## 8. Estructura de la aplicación (app shell)

Dos shells, no uno solo — elegir según cuántos destinos tiene el rol, no por costumbre:

- **Consola** (rail oscuro lateral, ~260px, colapsable a solo íconos, fondo `nav` — ver 2.2): para **Dirección** y **Administración**, que tienen ~10 destinos agrupados por dominio. El ítem activo es una píldora de fondo `nav-activo` con ícono y texto en `lila-claro`, peso 600; el ítem en reposo/hover usa la capa de estado de §6 sobre `nav`. Topbar clara con búsqueda global (Cmd+K), breadcrumb, selector de ciclo lectivo, notificaciones y avatar con el rol visible.
- **Portal** (nav de píldoras arriba, a todo el ancho, sin rail lateral): para **Docente** y **Familia**, que tienen 3 destinos o menos. Un rail lateral de 230-260px para 3 ítems deja la mayoría del ancho vacío y un topbar sin nada que mostrar — no forzar la consola ahí solo por consistencia visual con Dirección/Administración.
- **Nunca ancho fijo ni alto fijo en el shell**: `width:100%;min-height:100vh` (o `min-height:100%` dentro de un contenedor con altura), nunca `width:1440px;min-height:900px`. El frame del artboard/viewport define el tamaño real; el CSS no debe imponer uno propio, o queda banda vacía abajo cuando el contenido es más corto que ese número fijo.
- Todo elemento de grid (`.two-col`, `.two`) que puede contener una tabla ancha necesita `min-width:0` en sus hijos directos, y la tabla va envuelta en un contenedor con `overflow-x:auto` — si no, la tabla fuerza su `min-width` y desborda la columna (y a veces la página entera) en vez de scrollear contenida.
- **Encabezado de página**: etiqueta de sección (estilo versalitas), breadcrumb que nombre la vista de origen (toda vista de detalle lo lleva), título, acciones primarias a la derecha, tabs debajo si corresponde.

### 8.1 Autenticación y roles

Un solo formulario de login para las cuatro audiencias (Dirección, Administración, Docente, Familia). El rol **nunca se pregunta antes de autenticar**: es un dato que devuelve el servidor junto con el JWT, no una elección del usuario. Preguntar el rol de antemano agrega un paso a un flujo diario, permite enumerar qué tipos de cuenta existen, y si el usuario elige mal se entera recién después de tipear la contraseña. El router (`role-route.tsx`) redirige a la home de cada rol según lo que trae el token.

El único selector de rol legítimo es **posterior al login**, y solo para la cuenta que tiene más de un rol (el caso real: una docente que además es madre de un alumno). Una cuenta con un solo rol nunca lo ve, en ninguno de los dos momentos siguientes.

**Momento 1, al entrar:** un diálogo grande y bloqueante ("¿Cómo querés entrar?"), sin botón de cerrar ni click-afuera, sobre el shell de la app difuminado detrás. Una tarjeta por rol disponible, con tile de ícono en el color de módulo del rol y su contexto (Docente: las divisiones a cargo; Familia: el alumno). Si el rol Familia tiene más de un alumno a cargo, cada uno es una tarjeta propia, porque el contexto de datos que abre es distinto por alumno, no por rol.

**Momento 2, ya dentro:** el menú del avatar muestra en su cabecera el rol actual (nombre, mail, badge con el color de módulo del rol), y un ítem "Cambiar vista" que abre el mismo listado de roles/alumnos para alternar sin cerrar sesión. Es el mecanismo para pasar, por ejemplo, de Docente a Familia sin perder el contexto de la cuenta.

El resto del menú del avatar es corto a propósito: "Mi cuenta" (contacto y contraseña, porque no tiene ninguna otra pantalla en el sistema) y "Cerrar sesión". No lleva un ítem de "Preferencias" sin contenido definido: cualquier ajuste nuevo se agrega solo cuando tiene una función concreta y un lugar que le corresponde (ej. la configuración de qué avisos llegan va en el panel de notificaciones, no acá).

## 9. Componentes: base obligatoria

Cuando el stack de destino use **shadcn/ui** (o cualquier librería de primitivos accesibles equivalente, ej. Radix): si el componente que se necesita ya existe ahí (botón, input, select, checkbox, radio, switch, diálogo, tabs, tooltip, toast), se construye **sobre ese primitivo**, nunca reimplementado desde cero ni reemplazado por un elemento HTML plano sin las garantías de accesibilidad del primitivo. Lo que nunca se reutiliza es el **estilo por defecto** de la librería (sus radios, sombras, paleta neutra): eso se sobrescribe por completo con los tokens de este documento, para que el resultado tenga la identidad ESSERI y no la estética genérica de la librería de base.

Vocabulario mínimo de componentes que cualquier implementación de este sistema necesita: Button (variantes primary/secondary/ghost/destructive, con estado disabled y loading), Input, Select, Checkbox (con estado indeterminado), Radio, Switch, Badge de estado, Badge/chip de módulo, Snackbar, Tooltip, Tabs, ítem de navegación de sidebar, Breadcrumb, Dialog de confirmación, Card, Card de indicador (KPI), encabezado de sección, paginación, Dropdown de filtro (radio para exclusivo, checkbox para múltiple, rango para numérico o de fechas), Menú de acciones de fila, Barra de selección masiva, Estado vacío, Esqueleto de carga, Pantalla sin permiso, Resumen de errores de formulario, Banner de error de operación.

Los 7 estados que todo control interactivo (Button, Input, ítem de nav, chip) contempla: reposo, hover, foco, pressed/activo, deshabilitado, cargando (solo Button), error (solo campos).

**Card**: siempre sobre `superficie` lisa, sin borde, radio según 5.1, sombra baja en reposo según 5.2. El título va en `texto`, nunca en el color de un módulo — el color queda reservado a íconos, badges y a los nodos del canvas de workflows, no a la superficie ni al texto de una card genérica. Una tabla dentro de una card se mantiene sobre `superficie` neutra (mismo tono, sin distinción visual adicional).

**Card de indicador (KPI)**: variante chica de Card (radio 12px según 5.1) con una anatomía fija — encabezado con la etiqueta a la izquierda y el ícono de color a la derecha (fondo `-suave` del semántico o módulo que corresponda + ícono saturado, 30px, radio 9px), debajo el valor en grande (`26px`, tabular-nums) y, solo cuando hay un dato real que lo justifique, una nota chica en `texto-3` (variación respecto al período anterior, cantidad que vence pronto, etc.) — nunca una nota de relleno. La primera card de una grilla de indicadores puede ir en `tinta` como ancla visual de la métrica principal; en ese caso lleva una ilustración de línea sutil (un motivo geométrico en blanco al 8–10% de opacidad, recortado por el radio de la card) para que no quede vacía, y mantiene la misma anatomía que las demás.

**Input / Select / Textarea**: todo campo que tenga un tipo de dato reconocible (correo, contraseña, teléfono, fecha, importe, documento, nombre de persona, búsqueda) lleva un ícono a la izquierda identificando ese dato, con el mismo recurso que ya usa el buscador de la topbar (`position:relative` + ícono absoluto + padding-left en el control). El ícono va en `texto-3` en reposo y toma el color de foco cuando el campo está activo. Un campo de contraseña suma además el toggle de mostrar/ocultar a la derecha.

### 9.1 Filtros de tabla

Nunca una fila de chips todos-al-lado-del-otro cuando hay más de dos o tres opciones: eso no escala y no deja lugar a más de un criterio a la vez. El patrón es una barra con, de izquierda a derecha: búsqueda, uno o más **dropdowns de filtro** (cada uno abre un panel con el tipo de input que corresponde al dato: radio para estado excluyente, checkbox para selección múltiple con contador en el disparador, rango de dos inputs para importe, presets + rango personalizado para fecha), un espaciador, **Ordenar por** (alfabético, numérico o por fecha, según lo que la tabla realmente tenga) y, en tablas de alto volumen, el control de densidad (cómoda / compacta). Los filtros activos se muestran como chips removibles debajo de la barra, con "Limpiar todo".

No todas las tablas necesitan todos estos filtros. El criterio es el dato: una tabla de solo lectura (auditoría, log de accesos) lleva filtro y orden pero no densidad ni acciones; una tabla chica embebida en una vista de detalle (el historial de facturas de una familia, en su propio portal) no necesita el aparato completo de una barra de filtros — alcanza con orden simple o nada. Forzar el mismo patrón en todos lados es tan mal criterio como no tener ninguno.

### 9.2 Acciones de fila

Cuando una tabla tiene filas accionables, cada fila lleva o un botón de acción primaria inline (cuando hay una sola acción evidente y condicional al estado, ej. "Aprobar" solo en las solicitudes pendientes) o un menú de acciones (ícono kebab) con las acciones específicas de esa tabla, nunca un menú genérico idéntico en todas las tablas del sistema. Una acción destructiva (dar de baja, anular, desactivar) va al final del menú, separada por un divisor, en color error. Cuando hay filas seleccionadas con checkbox, la barra de filtros se reemplaza por una barra de selección ("N seleccionadas" + las acciones que aplican en lote + Cancelar). Tablas de solo lectura (auditoría, logs, matrices de referencia) no llevan acciones de fila.

### 9.3 Badge de módulo (chip de identidad, distinto de la superficie de card)

Además de las superficies `--sup-*` de card (2.1), una fila o ítem de lista puede llevar una **etiqueta de módulo**: chip píldora con fondo del color de módulo llevado a un tinte muy claro (mezcla ~12% del color saturado sobre blanco) y texto en el color saturado. Los dos mecanismos conviven y responden preguntas distintas: `--sup-*` es la superficie de una card o celda completa; el chip de módulo es una etiqueta puntual dentro de una fila o lista densa donde no hay una card entera para teñir.

### 9.4 Estado vacío

Anatomía fija: ícono en un tile circular de 52px (radio 999px, fondo `-suave` del semántico o módulo que corresponda + ícono saturado), título (14.5px/600), descripción en `texto-2` (13px, máximo ~280px de ancho) y, **solo cuando hay algo que crear o resolver**, un botón de acción primaria debajo ("Dar de alta familia", "Nueva regla"). Un vacío que es en sí mismo una buena noticia (ej. "No hay facturas vencidas") no lleva botón: forzar una acción ahí es ruido. Esto precisa la regla de §11: la acción sugerida es obligatoria en un vacío que representa trabajo pendiente, no en cualquier vacío.

### 9.5 Esqueleto de carga

Todo estado de carga de contenido (no de una acción puntual, ver Button en estado "cargando") usa esqueletos con la forma real del layout final — una fila con avatar más líneas de texto, un bloque de gráfico, una serie de renglones — nunca un spinner suelto centrado en la pantalla. El shimmer es un gradiente animado de baja amplitud sobre `fila-hover`.

### 9.6 Pantalla sin permiso

Mismo layout que un estado vacío (9.4: ícono en tile circular, título, descripción), pero el ícono va en tono neutro (`fila-hover` + `texto-3`, nunca un color de módulo o semántico: no es un estado del dominio, es una restricción de acceso) y la descripción nombra el rol que hace falta y a quién pedirle acceso.

### 9.7 Errores de formulario: resumen + inline

Un formulario con más de un campo con error suma, arriba de los campos, una caja de resumen (fondo `error-suave`, borde propio) que lista cada error como un link ancla al campo correspondiente. Convive con el error inline por campo que ya define Input (2.6/9): el resumen ayuda a saltar a cada error en un formulario largo, el inline confirma cuál es exactamente en el momento de corregirlo.

### 9.8 Banner de error de operación

Para el fallo de una operación de página completa (ej. "no se pudo emitir la orden de compra"), no un toast: una caja inline persistente con ícono + título + explicación concreta (mismo copy que exige §11: qué pasó y cómo resolverlo), en `error`/`error-suave`, que queda en la página hasta que el usuario actúa — a diferencia del snackbar (9.9), que es la confirmación transitoria de una acción puntual.

### 9.9 Snackbar

Confirmación o fallo de una acción puntual: posición fija abajo a la izquierda, apilable cuando hay más de una activa a la vez, con una acción de texto a la derecha cuando corresponde ("Deshacer", "Reintentar"). Variantes semánticas éxito/error/advertencia/info (mismos tokens de 2.4) más una neutra sobre `tinta` para confirmaciones sin carga semántica.

### 9.10 Canvas de nodos (editor de reglas de workflows)

El editor de una regla de automatización (disparador → condición → acción) se representa como un grafo: fondo de grilla de puntos (`radial-gradient` de `borde`, paso de 20px), cada nodo como una card tonal sin borde en la superficie `--sup-*` de su tipo, conectados por curvas SVG coloreadas según el nodo de destino. Es un lenguaje visual propio de este editor, no se reutiliza fuera de workflows.

## 10. Visualización de datos

- Nunca pie ni dona. Barra horizontal para mostrar composición (ej. facturación por estado), línea para tendencia (ej. cobranza últimos 12 meses).
- Todo número relevante se muestra **con contexto**: variación vs. período anterior, o comparación contra un umbral. Nunca una cifra pelada sin referencia.
- El mismo mapeo semántico y la misma paleta de módulo se usan en **todas** las visualizaciones del sistema: no se inventa una paleta nueva por gráfico.
- Cualquier bloque con un dato agregado (una card de indicador, un segmento de una barra) es clickeable y navega al detalle correspondiente: no es un cartel estático.
- Un panel de indicadores prioriza jerarquía real (un dato hero, secciones de "requiere atención" ordenadas por severidad) sobre una grilla pareja de tarjetas idénticas.

## 11. Contenido y voz

**Voz:** institucional y precisa. El sistema informa y ejecuta; no vende ni felicita. Nunca "¡Genial! 🎉", nunca signos de exclamación de entusiasmo, nunca emoji.

**Microcopy es-AR, voz activa, sentence case:** "Registrar pago", "Dar de alta familia", "Aprobar sugerencia". Nunca "Enviar" genérico, nunca Title Case. El verbo de la acción se mantiene igual entre el botón y el mensaje de éxito: "Registrar pago" → "Pago registrado".

**Errores:** dicen qué pasó y cómo resolverlo. Ejemplo: "No se pudo registrar el pago: el importe supera la deuda pendiente ($124.500). Ajustá el monto e intentá de nuevo.". Nunca "Error 500" ni "Algo salió mal".

**Estados vacíos:** siempre con una acción sugerida. Ejemplo: "Todavía no hay familias inscriptas este ciclo lectivo. Acción sugerida: Registrar primera inscripción".

**Acciones destructivas:** confirmación explícita en un modal, con el nombre concreto del registro afectado. Nunca "¿Estás seguro?" genérico.

**Formatos locales:** `$ ARS` con separador de miles (`$ 124.500,00`), fechas `dd/mm/aaaa`, numerales tabulares en toda cifra que aparezca en tabla. Contemplar nombres y razones sociales largas (truncar con tooltip, nunca cortar sin indicarlo).

**Prohibido el guion largo (em dash) y signos similares "de IA"** en todo copy de producto y en la documentación del propio sistema: no usar raya larga, ni el guion corto como conector estilístico entre ideas. Cortar la oración en dos, o usar coma, punto y coma, o dos puntos.

## 12. Accesibilidad (piso, no aspiración)

AA en todo texto. Anillo de foco violeta (violeta-vibrante) de 2px con 2px de offset, visible en todo elemento interactivo. Targets de al menos 40px. El estado nunca se comunica solo por color: los badges siempre llevan punto + texto. Jerarquía de encabezados sin saltos. Tablas y modales navegables por teclado.

## 13. Elemento de firma

El isotipo de la marca es un hexágono rodeado de nodos conectados: una red, porque el sistema está construido sobre arquitectura orientada a eventos. Esa idea se traduce en dos motivos, uno estructural y otro decorativo, ambos derivados de la misma figura, y ningún otro gesto decorativo se admite fuera de estos dos.

**El riel de eventos** (estructural): una línea fina con nodos circulares. El centro de cada nodo cae exactamente sobre la línea, nunca desplazado (revisar la aritmética del CSS, no a ojo: con nodo de 8px y borde de 2px en `box-sizing:border-box`, el centro queda a 4px del borde del nodo). Aparece como estructura real, no decoración, en líneas de tiempo de auditoría, historiales de ejecución de workflows y feeds de alertas. Tiene una variante horizontal (línea + nodo centrado, misma aritmética, orientación horizontal) para procesos de pocos pasos como la ejecución de un workflow paso a paso; el paso que falla queda en rojo (`error`/`error-suave`) con su mensaje debajo.

**Ilustración geométrica** (decorativa, nueva en este documento): composiciones abstractas del hexágono con sus nodos, en trazo fino y muy baja opacidad (0.12-0.18), coloreadas con el lila claro de marca u otro color de módulo cuando la pantalla pertenece a un dominio específico. Van solo en zonas de respiro sin datos que leer: portadas de sección, login, estados vacíos, y como fondo de headers de card (nivel académico, tarjeta de rol, celda hero de un bento). **Nunca dentro de una tabla, un formulario o cualquier superficie con datos reales**: ahí compiten con la información en vez de enmarcarla. Donde la ilustración es interactiva (ej. una portada con hover), la transición sigue las reglas de §6: 150-220ms, ease-out, sin glow ni blur. Siguen prohibidas las ilustraciones figurativas (objetos, escenas, personajes): el motivo es siempre geométrico y deriva del isotipo, nunca decoración genérica de stock.

## 14. Qué evitar (resumen)

- Inter, Arial, system-ui o Roboto como fuente de marca.
- `#000000` o `#FFFFFF` puros; cualquier gris sin tinte violáceo.
- Degradés de violeta, en particular violeta→azul o violeta→rosa.
- Texto gris sobre fondos de color.
- Cards anidadas dentro de otras cards.
- Sombra dura, de radio grande, o cualquier sombra fuera de la elevación de card definida en 5.2 (esa sí lleva sombra baja en reposo).
- Un radio único para todos los componentes.
- Glassmorphism, blur decorativo, glows, sombras difusas grandes fuera de la de 5.2.
- Easing con rebote o elástico.
- Una teja de ícono redondeada arriba de cada encabezado.
- Emoji como ícono, ilustraciones 3D, ilustraciones figurativas, personajes.
- Una fila plana de chips como único filtro cuando hay más de dos o tres opciones que combinar.
- Un menú de acciones idéntico copiado entre tablas de dominios distintos, en vez de las acciones específicas de cada una.
- Gráficos de torta/dona.
- Guion largo (em dash) o conectores estilísticos "de IA" en cualquier copy.
- Hero de landing o tono de marketing: esto es una herramienta interna.
- Que el sistema visual tape el dato: la tabla y la cifra son el producto.
- Preguntar el rol antes de autenticar, o forzar el shell de consola en un rol con 3 destinos o menos.
- Un `width`/`height` fijo en el shell de una pantalla — usar `100%`/`100vh` y dejar que el contenido defina el alto real.
