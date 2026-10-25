# Objetivo: convertir el Portal Docente en un espacio de trabajo académico conectado a datos reales.
# Rama: `feature/portal-docente-academico` | Ruta: implementación inline | Estrategia de entrega: `single-pr` con `size:exception`.
# Verificación: backend pytest + ruff check; frontend npm test + lint + format:check + build. Cambios superan 400 líneas; rama aislada, integración directa mediante un único PR a `main` con `size:exception`, revisión nativa omitida por decisión del usuario para este candidato y commit pendiente.

## Specs

### S1 — Mis cursos y detalle de curso
- Alcance solicitado: “Mostrar únicamente las divisiones asignadas al docente autenticado.” “Al seleccionar una división, abrir una pantalla de detalle del curso en lugar de ir directamente a tomar asistencia.” “Incluir accesos a **Tomar asistencia** y **Ver alumnos**.” “Respetar el ciclo lectivo y las asignaciones vigentes.”
- Aceptación: divisiones filtradas en backend por docente autenticado y ciclo consultado; el detalle presenta nombre, nivel/año, cantidad y alumnos activos de la inscripción del ciclo; acciones enlazan al flujo de asistencia ya existente y al listado autorizado.
- Aclaración de navegación, verbatim: “falta un detalle, al guardar la toma de asistencia, se guarda la asitencia todo perfecta pero deberia volver a la pesta;a anterior”. Aceptación: después de guardar correctamente desde el Portal Docente, regresar a la pantalla desde la que se inició la asistencia.
- Supuesto: el Portal Docente usa el ciclo vigente del store compartido existente; no se agrega selector de ciclo.

### S2 — Ficha académica e historial
- Alcance solicitado: “Mostrar nombre, legajo, división e información académica pertinente.” “Incorporar historial de asistencia, porcentaje de asistencia, ausencias y tardanzas.” “Mostrar el estado de las justificaciones, únicamente para consulta.”
- Aceptación: ficha disponible desde alumnos autorizados; reutiliza el resumen/servicios existentes y omite datos financieros y sensibles no necesarios; el docente no puede aprobar ni rechazar justificaciones. La lista de alumnos del curso también muestra para cada alumno el porcentaje de asistencia del ciclo, calculado con registros reales y la fórmula existente `(presentes + tardanzas) / total_registros`; sin registros no se presenta un porcentaje ficticio.

### S3 — Seguimiento e inasistencias reiteradas
- Alcance solicitado: “Permitir consultar el historial de asistencia por alumno y por curso.” “Identificar alumnos con inasistencias reiteradas mediante indicadores calculados con datos reales.”
- Regla confirmada por el usuario: “TIENEN QUE SER ACUMULADAS 20 O MAS, Y SI SON CONSECUTIVAS 5 O MAS”; las ausencias justificadas también cuentan (“SI”). Para consecutivas, contar jornadas escolares consecutivas con una inasistencia registrada en cada una e ignorar días sin registro (“SI”).
- Aceptación: umbrales inclusivos de 20 acumuladas o 5 consecutivas; la consulta se limita a asistencia real y al ciclo/división autorizados; no se crean alertas, automatizaciones ni estados ficticios.

### S4 — Restricciones funcionales y visuales
- Alcance solicitado: “No rediseñar el sistema. Respetar estrictamente los colores, tipografías, componentes, espaciados, navegación y patrones definidos en `DESIGN.md`.” “Mantener el Portal Docente separado de la consola administrativa.” “Conservar el flujo actual de toma de asistencia y sus funcionalidades.” “El docente solo puede consultar alumnos de sus divisiones autorizadas; validar permisos también en el backend.” “No permitir al docente aprobar o rechazar justificaciones: eso corresponde a los roles institucionales autorizados.” “No exponer datos financieros ni información sensible innecesaria.” “No duplicar lógica, servicios, consultas ni componentes existentes.” “No mostrar estados ficticios como «familia notificada» sin verificar el envío real.” “No agregar funcionalidades fuera de este alcance, como calificaciones, evaluaciones o comunicaciones nuevas.”
- Actualización visual confirmada: “asi deberia verse, manteniendo nuestros colores”; la captura adjunta aplica “solo para portal docente”.
- Aceptación: adaptar solo el shell y la jerarquía visual del Portal Docente a la referencia adjunta (barra superior y rail lateral con Inicio, Mis cursos, Asistencia, Alumnos y Seguimiento), usando tokens, tipografía, componentes y espaciado ESSERI. No copiar datos, nombres, fechas ni estados de muestra. Mantener sin cambios la consola administrativa y el Portal Familia; no ampliar capacidades institucionales.

### S5 — Reutilización y calidad
- Alcance solicitado: “Analizá primero qué se puede reutilizar y qué falta implementar.” “Priorizá cambios mínimos y consistentes con la arquitectura modular existente.” “Implementá frontend y los endpoints de backend necesarios.” “Agregá o actualizá las pruebas correspondientes.” “Verificá que no se rompan la asistencia actual ni los permisos de los demás roles.”
- Aceptación: respetar `ARCHITECTURE.md`, `DESIGN.md` y `docs/aclaraciones-cliente-esseri.md`; probar permisos docentes/institucionales, ciclo, alumnos activos, cálculos de asistencia y rutas del portal.

### S6 — Inicio docente y gráfico de asistencia por curso
- Alcance solicitado, verbatim: “primero en la vista de alumnos del curso, agrega q se vea los porcentajes de asistencia de cada uno. Despues en la seccion inicio que diga buen dia  *nombre del docente",ademas de cursos asignados, que diga cuantas de las asistencias q tenia que tomar hoy fueron tomadas y cantidad de alumnos a cargo.Por ultimo en la vista de cada curso agregar el grafico de barra se;alando ausencias, presentes y tardanzas.Cualquier duda me consultas si no quedo algo claro”
- Aclaración, verbatim: “ese punto de orevustas para hoy dejmoslo para despues”. Se posterga el indicador de asistencias previstas/completadas hoy; no inferir un horario ni un denominador.
- Aceptación: Inicio saluda al docente con su nombre real de perfil, conserva el conteo de cursos asignados y muestra la cantidad de alumnos activos de sus divisiones autorizadas del ciclo consultado. El detalle del curso agrega un gráfico de barras de presentes, tardanzas y ausencias con datos reales del período de los últimos 30 días mostrado en la referencia; agrupa los estados persistidos `ausente_*` como ausencias. No se generan métricas ficticias ni se instala una dependencia de gráficos nueva.

## Tasks
- T1 — S1, S2, S3, S5, S6 | inline | backend implementado; verificación en rama aislada: pruebas focales 34 passed, suite académica 64 passed, Ruff check/format OK; commit pendiente de rebanadas | backend: endpoints/consultas académicas seguras para ciclo, roster e historial/indicadores y consulta mínima del perfil docente autenticado; pruebas de acceso de docentes y roles institucionales | Risk: item 2 (autorización por división/ciclo y datos de alumnos).
- T2 — S1, S2, S3, S4, S5, S6 | inline | interfaz y correcciones implementadas y trasladadas; verificación: 11 pruebas focales, 464 en 73 archivos, lint/format/build OK; aviso chunk >500 kB; verificador independiente sin bloqueos nuevos; revisión nativa omitida explícitamente por el usuario para este candidato; commit pendiente | frontend: dashboard con nombre y alumnos a cargo, porcentaje por alumno en lista, gráfico por curso; rail docente, detalle/ficha/seguimiento y rutas; preservar toma de asistencia; pruebas de navegación y datos reales | Risk: item 2 (métricas visibles del portal dependen de datos autorizados por docente y ciclo).
- T3 — S1 | inline | retorno tras guardado implementado, verificado manualmente por usuario y cubierto por las pruebas frontend del T2; commit pendiente | volver al origen después de guardar con éxito desde el Portal Docente, sin cambiar la toma de asistencia administrativa | Risk: none.

## Log
- L1 — Solicitud original, verbatim:

  Quiero mejorar el **Portal Docente de ESSERI Data Core**, tomando como base la implementación actual del repositorio.

  Primero revisá el código existente del portal docente, académico, alumnos, inscripciones y asistencias, junto con `ARCHITECTURE.md`, `DESIGN.md` y las aclaraciones del cliente.

  ### Objetivo

  Convertir el Portal Docente en un espacio de trabajo académico, manteniendo la funcionalidad actual de asistencia y agregando:

  **1. Mis cursos**

  - Mostrar únicamente las divisiones asignadas al docente autenticado.
  - Al seleccionar una división, abrir una pantalla de detalle del curso en lugar de ir directamente a tomar asistencia.
  - Incluir accesos a **Tomar asistencia** y **Ver alumnos**.
  - Respetar el ciclo lectivo y las asignaciones vigentes.

  **2. Detalle del curso**

  - Mostrar nombre de la división, año/nivel y cantidad de alumnos.
  - Listar los alumnos inscriptos y activos.
  - Permitir acceder a la ficha académica de cada alumno.
  - Incorporar un resumen de asistencias cuando existan datos reales.

  **3. Ficha académica del alumno**

  - Mostrar nombre, legajo, división e información académica pertinente.
  - Incorporar historial de asistencia, porcentaje de asistencia, ausencias y tardanzas.
  - Mostrar el estado de las justificaciones, únicamente para consulta.
  - Reutilizar servicios, modelos y componentes existentes.

  **4. Seguimiento académico**

  - Permitir consultar el historial de asistencia por alumno y por curso.
  - Identificar alumnos con inasistencias reiteradas mediante indicadores calculados con datos reales.
  - No implementar todavía nuevas automatizaciones ni alertas, salvo reutilizar alguna funcionalidad ya existente.

  ### Restricciones importantes

  - **No rediseñar el sistema.** Respetar estrictamente los colores, tipografías, componentes, espaciados, navegación y patrones definidos en `DESIGN.md`.
  - Mantener el Portal Docente separado de la consola administrativa.
  - Conservar el flujo actual de toma de asistencia y sus funcionalidades.
  - El docente solo puede consultar alumnos de sus divisiones autorizadas; validar permisos también en el backend.
  - No permitir al docente aprobar o rechazar justificaciones: eso corresponde a los roles institucionales autorizados.
  - No exponer datos financieros ni información sensible innecesaria.
  - No duplicar lógica, servicios, consultas ni componentes existentes.
  - No mostrar estados ficticios como «familia notificada» sin verificar el envío real.
  - No agregar funcionalidades fuera de este alcance, como calificaciones, evaluaciones o comunicaciones nuevas.

  ### Implementación

  1. Analizá primero qué se puede reutilizar y qué falta implementar.
  2. Priorizá cambios mínimos y consistentes con la arquitectura modular existente.
  3. Implementá frontend y los endpoints de backend necesarios.
  4. Agregá o actualizá las pruebas correspondientes.
  5. Verificá que no se rompan la asistencia actual ni los permisos de los demás roles.

  Al finalizar, detallá qué funcionalidades incorporaste, qué componentes reutilizaste y qué quedó pendiente.

  **Busco una implementación funcional, integrada al sistema actual y visualmente consistente con ESSERI, no un prototipo ni una pantalla con datos simulados.cONSULTAME TODO LO NECESARIO ANTES DE DEFINIR BIEN EL PLAN**

- L2 — Criterio confirmado para inasistencias reiteradas: “TIENEN QUE SER ACUMULADAS 20 O MAS, Y SI SON CONSECUTIVAS 5 O MAS”.
- L3 — Confirmación de que las ausencias justificadas cuentan para ambos umbrales: “SI”.
- L4 — Confirmación de consecutividad en jornadas escolares con inasistencia registrada, ignorando días sin registro: “SI”.
- L5 — Hallazgos de revisión: el portal actualmente navega directo a asistencia; el roster docente reutiliza el endpoint administrativo paginado de inscripciones y filtra solo en frontend; la consulta de divisiones y el guard de asistencia no filtran por ciclo de asignación; el resumen de asistencia existente calcula presencia como (presentes + tardanzas) / registros y ya separa ausencias por estado. La ficha administrativa expone acciones financieras, por lo que debe reutilizarse solo información/servicios pertinentes, no esa página completa. Se preservan los cambios preexistentes del usuario en el worktree.
- L6 — Bloqueo antes de cambios de código: el mapeo adicional requerido por el umbral de delegación no pudo lanzarse porque el runtime rechazó el modelo `gpt-6.1-luna` asignado por las instrucciones del repositorio; no se sustituyó por otro modelo ni se inició implementación. El usuario indicó que lo habilitaba, pero el reintento exacto volvió a devolver `Unknown model`. T1 y T2 siguen pendientes.
- L7 — El usuario autorizó explícitamente usar `gpt-6-luna` tras el rechazo del modelo asignado; se completó el mapeo delegado de solo lectura sin cambios de código. Hallazgos: la autorización actual a división y las asignaciones deben filtrarse por ciclo; existe `GET /academico/docentes/me/divisiones` como punto de entrada; los hooks y servicios de asistencia/historial existentes pueden reutilizarse; la ficha administrativa no es reutilizable como página completa porque expone datos financieros. Próximo paso: ejecutar T1 backend primero y luego T2 frontend.
- L8 — Implementación inline: el backend ahora limita divisiones, alumnos activos, asistencia e indicadores al ciclo/asignación docente; se agregó seguimiento basado en registros reales con regla inclusiva 20+ acumuladas o 5+ consecutivas, contando justificadas e ignorando días sin fila. El frontend agrega detalle del curso y ficha académica bajo el shell docente y reutiliza hooks/componentes de asistencia; no se expone la ficha administrativa/financiera ni acciones sobre justificaciones.
- L9 — Verificación observada: `backend/venv/bin/pytest tests/academico/test_mis_divisiones.py tests/academico/test_asistencias.py -q` → 32 passed; `backend/venv/bin/ruff check src/ tests/` → OK; `backend/venv/bin/ruff format --check src/ tests/` → 191 files already formatted; suite completa → 953 passed, 1 warning. Frontend `npm test -- --run`, `npm run lint` y `npm run build` no arrancan porque faltan `vitest`, `eslint` y `tsc` en `frontend/node_modules`; no se instalaron dependencias por falta de autorización de operación remota.
- L10 — Antes del primer commit, estimación de cambios propios supera 400 líneas (~700); se debe elegir una sola estrategia de cadena conforme a `chained-pr`: stacked PRs a main si los slices pueden integrarse independientemente, o feature branch chain si el feature necesita integrarse primero como unidad. No se hará commit hasta confirmar la estrategia.
- L11 — Nueva referencia visual del usuario: “asi deberia verse, manteniendo nuestros colores”. La imagen muestra un inicio docente, rail lateral con cinco destinos, detalle del curso, toma de asistencia, lista de alumnos, ficha académica y seguimiento. Usar la composición como guía visual, no los datos de demostración.
- L12 — Alcance del shell confirmado por el usuario: “ah si , es solo para portal docente”. El cambio visual de navegación se limita al Portal Docente; la consola administrativa y el Portal Familia permanecen sin cambios.
- L13 — Se actualizó `DESIGN.md` §8 para documentar el shell docente de cinco destinos como excepción específica del Portal Docente, con tokens de navegación/superficie ESSERI; el shell de Familia y Consola no cambia.
- L14 — Implementación visual: shell docente propio con rail de cinco destinos y topbar ESSERI; Inicio muestra asignaciones reales y ciclo/fecha, y los accesos de cursos, asistencia, alumnos y seguimiento llevan a sus pantallas. El detalle conserva sólo métricas disponibles y ahora ofrece lista de alumnos y seguimiento como vistas separadas; no se copiaron nombres ni métricas del mock. `DESIGN.md` documenta la excepción solo para Docente.
- L15 — Evidencia y pendientes: `git diff --check` pasó y el detector Impeccable de layout no encontró hallazgos; CodeGraph reconoce las nuevas páginas/rutas. Tests, lint, build y formato frontend no arrancan (`vitest`, `eslint`, `tsc` y `prettier` ausentes). No se instalaron dependencias. RDD está activo; el assess no pudo evaluar archivos sin seguimiento y `gentle-ai review status` falló dos veces de forma segura antes de iniciar, sin mutación ni recibo. El endpoint actual de seguimiento entrega totales/consecutivas/booleano, no serie temporal; se omitió el gráfico/promedio del mock en vez de simular datos. La estrategia de cadena sigue pendiente y no hubo commits.
- L16 — Nuevo pedido del usuario, verbatim: “primero en la vista de alumnos del curso, agrega q se vea los porcentajes de asistencia de cada uno. Despues en la seccion inicio que diga buen dia  *nombre del docente",ademas de cursos asignados, que diga cuantas de las asistencias q tenia que tomar hoy fueron tomadas y cantidad de alumnos a cargo.Por ultimo en la vista de cada curso agregar el grafico de barra se;alando ausencias, presentes y tardanzas.Cualquier duda me consultas si no quedo algo claro”.
- L17 — El usuario postergó el indicador de asistencias previstas/completadas hoy: “ese punto de orevustas para hoy dejmoslo para despues”. No se agregará horario ni se inferirá el denominador en esta entrega.
- L18 — Implementación S6: el inicio consume el endpoint autenticado mínimo del perfil docente y suma los totales de inscripciones activas en las divisiones asignadas del ciclo; la lista muestra el porcentaje real del ciclo por legajo, contando tardanzas como asistencia y sin mostrar `0%` cuando no hay registros; el detalle agrupa registros reales de los últimos 30 días por presentes, tardanzas y estados `ausente_*`. Se reutiliza `listarAsistencias`; no se agrega dependencia ni se incluye el indicador de hoy postergado.
- L19 — Verificación independiente en scratch: pruebas académicas focalizadas `34 passed`, suite académica/familia/alumnos/inscripciones `97 passed`, Ruff check y formato pasan; probe del gráfico verifica estados de ausencia y límites 29/30 días. Frontend `npm test`, `npm run lint` y `npm run build` no arrancan porque faltan `vitest`, `eslint` y `tsc`; `prettier` también falta. Detector Impeccable devolvió `[]`; `git diff --check` pasó.
- L20 — Advisory preexistente: la API genérica de asistencias permite omitir `ciclo_lectivo` en una consulta docente por división y entonces puede devolver registros de otros ciclos si existe una asignación histórica; se reprodujo igual contra el baseline `c3e0c44a8c038587634fd7c7723c594263c113a5`, por lo que no es regresión del candidato. Las pantallas del Portal Docente sí envían el ciclo explícitamente; el hardening de la API genérica queda separado, sin ampliar este cambio.
- L21 — Estado de revisión nativa: RDD está activo y el assessment devolvió `risk: high`, `review_due: true`, pero marcó el candidato `unassessable` por archivos sin seguimiento. El preflight STATUS falló antes de iniciar con `operation_failed` (`open <redacted> operation not permitted`), `mutation_outcome: not_started`; no hubo consentimiento, inicio ni recibo. No se reintentó nuevamente porque la misma falla de permisos ya había ocurrido en intentos anteriores.
- L22 — Nuevo pedido, verbatim: “falta un detalle, al guardar la toma de asistencia, se guarda la asitencia todo perfecta pero deberia volver a la pesta;a anterior”. Se implementó retorno a la pantalla de origen desde el detalle del curso y la sección Asistencia; ante acceso directo, se vuelve al detalle del curso. La navegación ocurre sólo tras el guardado exitoso y dentro del Portal Docente. Se agregó prueba integrada para éxito y fallo en `frontend/src/pages/__tests__/portal-docente-asistencia-page.test.tsx`. `git diff --check` pasó; pruebas, lint, formato y build frontend no iniciaron (`vitest`, `eslint`, `prettier`, `tsc` ausentes). El assessment devolvió `unassessable` por archivos sin seguimiento (`risk: high`, `review_due: true`); el preflight STATUS volvió a fallar con `operation_failed` (`open <redacted> operation not permitted`, `mutation_outcome: not_started`), sin transacción, consentimiento ni recibo.
- L23 — El usuario confirmó corregir los diagnósticos con “dale”. Se reprodujeron y corrigieron: las dependencias de callbacks ahora usan valores de ciclo/portal desestructurados; los arrays de respaldo del curso son memoizados; errores API sin `detail` reciben mensajes genéricos; se completaron campos requeridos en una fixture y se quitaron parámetros `_fecha` sin uso. Prettier se aplicó sólo a los archivos reportados o corregidos. Verificación: prueba focalizada `10 passed`; suite `73` archivos / `464 passed`; `npm run lint` OK; `npm run format:check` OK; `npm run build` OK (con aviso de chunk >500 kB); `git diff --check` y whitespace checks OK. RDD sigue activo: assess devuelve `risk: high`, `review_due: true`, `unassessable` por inventario de archivos sin seguimiento; la revisión nativa continúa pendiente por fallo de permisos del preflight STATUS, sin consentimiento, transacción ni recibo.
- L24 — Verificación manual confirmada por el usuario, verbatim: “funciono perfecto”. El usuario probó el guardado de asistencia en la demo y confirmó que el retorno a la pantalla anterior funciona. La revisión RDD y la estrategia de entrega antes del commit siguen pendientes.
- L25 — El usuario eligió “integrar el portal como unidad”, equivalente a `feature-branch-chain`. La rama actual `fix/logging-rnf15` está un commit por delante de `main` y el worktree mezcla cambios de Portal Docente con otras tareas; se debe aislar el Portal Docente antes de crear commits. No se stageó ni commiteó nada.
- L26 — El usuario autorizó un worktree limpio desde `main` y pidió recibir los comandos para crearlo personalmente. No mover, copiar ni stagear cambios hasta que confirme que el worktree está listo.
- L27 — El usuario creó el worktree limpio `codex/portal-docente-academico` desde `main` local en `4a4fdae` y confirmó que quedó limpio. Se transfirieron solo los cambios del Portal Docente desde el checkout original; no se alteró el trabajo ajeno.
- L28 — Transferencia a la rama limpia completada: el patch basado en `c3e0c44` pasó `git apply --check` contra `main` en `4a4fdae`; se aplicaron 20 archivos versionados, 11 archivos nuevos del portal y este documento. Se excluyeron los cambios de Facturación/Inscripciones y el worktree Portal Familia. `git diff --check` pasa; todavía no hay commits.
- L29 — Verificación en la rama aislada: con SQLite en memoria y secreto JWT de prueba, las pruebas backend test_mis_divisiones.py + test_asistencias.py dieron 34 passed; la suite tests/academico dio 64 passed; Ruff check y format pasan (190 archivos). Frontend focal dio 11 passed; suite dio 73 archivos / 464 passed; lint, format:check y build pasan (Vite advierte chunk >500 kB). La primera ejecución backend se corrigió solo en el entorno de prueba: no hay .env en el worktree nuevo y ENVIRONMENT=development es necesario para las cookies no seguras de TestClient. En revisión independiente contra main 4a4fdae, no hay bloqueos nuevos para S1–S6; GET denegados dejan intacto el hash de datos y salidas institucionales representativas coinciden. Advisory preexistente: consultas genéricas de asistencia pueden omitir ciclo o incluir inscripciones inactivas, igual que el baseline. El assessment RDD sigue high/unassessable por archivos sin seguimiento; aún no hay STATUS transaccional, consentimiento ni commit.

- L30 — Preferencia de nomenclatura de ramas, verbatim: “nunca llames cpdexz a una rama, siempre es feature fix, etc”. Se renombró la rama local a `feature/portal-docente-academico`; para futuras ramas usar prefijos semánticos como `feature/` o `fix/`, no `codex/`.

- L31 — Aclaración de alcance, verbatim: “tiene q incluir todo lo que tenga q ver con el portal docente”. Se confirma incluir todos los cambios del Portal Docente, incluidos los 12 archivos nuevos elegibles enumerados por el STATUS nativo.
- L32 — Bloqueo de captura RDD: STATUS volvió a exigir `external.select_intended_untracked` con el esquema `gentle-ai.review-intended-untracked-selection/v1`, pero el CLI no documenta una ruta de captura ni el formato exacto; las entradas tentativas fueron rechazadas con `mutation_outcome: not_started`, sin START ni autoridad. La incidencia pública equivalente está registrada como Gentleman-Programming/gentle-ai#5129; no se creó ni comentó ningún reporte.

- L33 — Instrucción del usuario, verbatim: “y q hacemos, salteemos la revision”. Se omite la revisión nativa para este candidato; no se deshabilita la preferencia global de RDD y no se reporta el bloqueo.

- L34 — Corrección de estrategia, verbatim: “no entendi, yo quiero integrar el nuevo portal docente al main”. Se reemplaza `feature-branch-chain` por un único PR directo desde `feature/portal-docente-academico` hacia `main`; por exceder 400 líneas se declara `size:exception`. No se crea tracker ni PRs hijos.
