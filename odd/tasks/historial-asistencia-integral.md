# Attendance history improvements
Objective: improve the existing Academic attendance history without changing ESSERI's design language. Branch: feat/historial-asistencia-integral. Delivery: feature-branch-chain; scoped commit/push authorized, no PR or merge.
Runners: backend/venv/bin/python -m pytest; backend/venv/bin/ruff; frontend npm run test/lint/build. Forecast: 800–1100 authored changed lines. Route: inline; one behavior, dependent backend/UI units, no parallel writer reason. Risk: item 3 (shared export/query contracts), item 2 only if authorization changes prove necessary; preserve permissions.

## Specs
S1. "Agregar filtro por ciclo lectivo, nivel educativo, año y división, utilizando selectores dependientes." "Mantener el filtro por alumno y rango de fechas." "Agregar filtro por estado de asistencia." "Permitir limpiar filtros." "Respetar el ciclo lectivo seleccionado en el sistema." Verify backend predicates and UI dependency resets/global cycle.
S2. "Total de registros." "Presentes." "Ausencias justificadas." "Ausencias injustificadas." "Porcentaje de asistencia del período." "Los indicadores deben actualizarse según los filtros aplicados y utilizar únicamente datos reales." Verify aggregate counts over the full filtered result, including empty results; preserve existing present+tardy definition.
S3. "Mantener las columnas fecha, alumno, división y estado." "Agregar ordenamiento por fecha y alumno." "Mostrar primero los registros más recientes." "Incorporar paginación y cantidad de resultados." "Agregar un estado vacío claro cuando no haya registros." Verify ordering, stable pages, counts and empty UI.
S4. "Mejorar la distribución del espacio: actualmente queda demasiado espacio vacío debajo de la tabla." "Organizar filtros e indicadores de manera compacta." "Mantener los colores, componentes, tipografía y estilo visual actual de ESSERI." "Garantizar una vista responsive." "Usar los componentes reutilizables existentes." Verify desktop/mobile rendering without artificial height or new visual system.
S5. "Verificar que los filtros funcionen realmente desde el backend." "Consultar las asistencias por su inscripción, respetando el ciclo lectivo y la división correspondiente a cada registro histórico." "Evitar duplicaciones y garantizar que los indicadores coincidan con los registros." "No utilizar datos simulados." Verify historical inactive enrollment, multiple cycles, filtered totals and row uniqueness.
S6. "Agregar la posibilidad de exportar el historial filtrado a CSV o Excel, reutilizando mecanismos existentes." Later: "dale, que sea un boton que diga exportar y cuando apreyas aparezca las 3 opciones". User approved merging the separate export screen into history, retaining PDF, removing the separate menu item and redirecting its old URL. Verify CSV/XLSX/PDF with identical filters, one Exportar menu, legacy URL redirect and unchanged export permission/old backend endpoint output.
S7. "Antes de modificar, revisá cómo está implementado actualmente el módulo Académico, sus endpoints, componentes y modelos. Reutilizá lo existente y evitá duplicar lógica." "No quiero un rediseño general de ESSERI, sino una mejora funcional y visual de esta pantalla. Agregá pruebas para filtros, indicadores y cálculos."

## Tasks
- T1 | S1,S2,S3,S5,S6,S7 | inline, dependent backend unit; no writer trigger | committed; native review approved/acknowledged, broader independent probes documented partial | e742cfb | 987 full and 26 focused backend tests passed; Ruff check/format passed.
- T2 | S1,S2,S3,S4,S6,S7 | inline, depends on T1; no writer trigger | committed; candidate review declined by user | cc139c8 | 498 full workspace and 38 focused frontend tests passed; workspace and isolated candidate lint/format/build passed; visual validation user-reported.
- T3 | S1–S7 | independent verification for items 2/3; inline own checks first | partial proof retained and publication explicitly authorized in L14 | e742cfb, cc139c8 | backend 987 passed; independent scratch UI and exact differential/hash proofs remain incomplete, not PASS.

## Log
L1. Original user request:
> Mejorá la vista **Historial de asistencia** del módulo Académico de ESSERI.
>
> Actualmente la pantalla muestra únicamente una tabla con fecha, alumno, división y estado. Quiero convertirla en una vista más completa, útil para docentes y administración.
>
> ### Cambios requeridos
>
> 1. **Filtros**
>    - Agregar filtro por ciclo lectivo, nivel educativo, año y división, utilizando selectores dependientes.
>    - Mantener el filtro por alumno y rango de fechas.
>    - Agregar filtro por estado de asistencia.
>    - Permitir limpiar filtros.
>    - Respetar el ciclo lectivo seleccionado en el sistema.
>
> 2. **Indicadores de asistencia**
>    Agregar tarjetas de resumen sobre la tabla:
>    - Total de registros.
>    - Presentes.
>    - Ausencias justificadas.
>    - Ausencias injustificadas.
>    - Porcentaje de asistencia del período.
>
>    Los indicadores deben actualizarse según los filtros aplicados y utilizar únicamente datos reales.
>
> 3. **Tabla de historial**
>    - Mantener las columnas fecha, alumno, división y estado.
>    - Agregar ordenamiento por fecha y alumno.
>    - Mostrar primero los registros más recientes.
>    - Incorporar paginación y cantidad de resultados.
>    - Agregar un estado vacío claro cuando no haya registros.
>
> 4. **Visualización**
>    - Mejorar la distribución del espacio: actualmente queda demasiado espacio vacío debajo de la tabla.
>    - Organizar filtros e indicadores de manera compacta.
>    - Mantener los colores, componentes, tipografía y estilo visual actual de ESSERI.
>    - Garantizar una vista responsive.
>    - Usar los componentes reutilizables existentes.
>
> 5. **Lógica y consistencia**
>    - Verificar que los filtros funcionen realmente desde el backend.
>    - Consultar las asistencias por su inscripción, respetando el ciclo lectivo y la división correspondiente a cada registro histórico.
>    - Evitar duplicaciones y garantizar que los indicadores coincidan con los registros.
>    - No utilizar datos simulados.
>
> 6. **Exportación**
>    - Agregar la posibilidad de exportar el historial filtrado a CSV o Excel, reutilizando mecanismos existentes.
>
> ### Importante
> Antes de modificar, revisá cómo está implementado actualmente el módulo Académico, sus endpoints, componentes y modelos. Reutilizá lo existente y evitá duplicar lógica.
>
> No quiero un rediseño general de ESSERI, sino una mejora funcional y visual de esta pantalla. Agregá pruebas para filtros, indicadores y cálculos.
L2. 2026-10-28: User selected "Cadena sobre rama de feature". Proposed slice boundaries: backend query/export plus its tests/docs; UI consumes compatible new API plus its tests/docs. No push/PR authorized. Pre-existing worktree edits remain protected; do not commit unrelated baseline content.
L3. Exploration: existing attendance belongs to Inscripcion (cycle/division), not current roster; existing student helper drops inactive records and caps 100. Preserve it for other screens; use history-specific dependent options. Export requires academico.exportar; do not broaden permissions. Existing presentism includes present+tardy. Previous implementation own checks: backend967/frontend486 passed; independent frontend scratch proof unavailable (duplicate React resolution), no reproduced code defect; cleanup complete.
L4. Implementation: additive /asistencias/consulta, /filtros, /ciclos, /consulta/exportar. One historical query powers all predicates, full-result SQL aggregation, stable ordering/pages and unpaginated exports. Existing API responses remain untouched. Historical options include finalized/baja inscriptions and teacher assignment EXISTS avoids duplicate options. Reuses authorization helpers, existing CSV/XLSX generators, global cycle store, ESSERI primitives, StatTile and PaginadorServidor. Page defaults today; cycle changes clear descendants, and reset preserves global cycle. No live-data mutation, new dependency or migration.
L5. Evidence: initial backend RED 9 failures on missing valid routes; frontend service/hook RED missing modules. Own checks now backend 27 focused passed, Ruff check/format all passed; frontend 494 tests, lint and build passed; bundle-size warning only. Mechanical UI detector returned []. Fixed local JSDOM pointer capability stubs and a test assertion for absent versus undefined filter, without changing global test setup. Full backend suite and independent/browser proof pending. Planned slices exceed the original estimate because tests and explicit state coverage remain intact; do not compress code to fit a line budget. No PR publication authorized.
L6. Luna independent verification: full backend suite 986 passed (199.48s), frontend services/hooks 8 passed in scratch; six page tests failed to execute due to isolated React/Zustand hook resolution. No change-caused product defect reproduced. Independent browser, historical fixture/result differential, rejected-read data hash and baseline endpoint comparisons were not completed; cannot mark S1–S7 independently cleared. Parent reran the exact focused frontend command in the workspace: 14 passed, plus git diff --check passed. Scratch copies removed. No second review sweep or source correction launched on unavailable proof. Work remains implemented but not closed; no commits or publication. Needs decision on bounded isolated-test-environment diagnosis versus retaining pending verification.
L7. 2026-10-28: User answered "si" to bounded environment diagnosis, later "ok" after explanation. Reproduced six UI test failures in a fresh physical frontend copy. Scratch-only identity instrumentation proved the test and externalized Zustand load different React instances: the test resolves the scratch dependency; Zustand resolves the original workspace dependency. Relative executable links and Node createRequire resolution were normal. No application changes made. A bounded Luna command worker is testing one scratch-only dependency-inlining hypothesis; pending, not cleared. Resume already-authorized remaining verification only if the environment is resolved.
L8. Bounded diagnostic outcome: scratch-only Vitest server.deps.inline for Zustand did not unify React identities. No fix established, no repository dependency/config/application edit made. Diagnostic scratch removed and git diff --check passed. Isolated UI proof remains unavailable; do not repeat hypotheses or claim clearance. Next user decision: permit read-only browser verification in original local frontend, or retain pending independent UI proof. Backend independent fixture/baseline/data-hash proofs still pending separately.
L9. 2026-10-28: User said "si esta listo para commit y push hagamoslo" and then "la comporbacion visual ya la hice yo". Treat S4 visual proof as user-reported validation, not an agent browser claim. Commit/push authorized conditional on readiness; remote destination and credential binding still require confirmation before a remote operation. Local origin is https://github.com/jf-arce/esseri-data-core.git; no connection made.
L10. Commit-boundary inspection found the history query depends on an existing uncommitted optional ciclo_lectivo parameter in verificar_acceso_a_division. Include only that narrowly scoped backward-compatible prerequisite with the backend unit; leave other service/router/portal/panel changes unstaged. Validate the isolated staged snapshot, not only the broad dirty worktree. Preserve the prior endpoint contracts and default helper behavior. Source slice is larger than the advisory 400-line commit heuristic because query, tests and security scope belong together; no oversized PR has been created or authorized.
L11. 2026-10-28: User said "si dentro de historial asistencia agregamos lo de exportar , entonces el submodulo exportar asistencias deja de tener sentido" and approved the proposed unification: "dale, que sea un boton que diga exportar y cuando apreyas aparezca las 3 opciones". Reopen T1/T2/T3 for PDF in the filtered exporter, one Exportar dropdown (CSV/Excel/PDF), menu cleanup and legacy URL redirect; keep old backend exports and permission guards intact. Staged backend snapshot passed 25 focused tests and baseline export tests passed 6; independent exact-output/hash probes remain incomplete, no clearance claimed.
L12. Export amendment implemented with existing DropdownMenu primitives and existing PDF generator; the PDF receives the applied date range or actual exported-record dates. Removed unused export page and nav item; old URL uses Navigate under its unchanged export permission guard. New tests observed frontend RED3/PDF RED1, then frontend focused36 and backend focused26 passed. Both layer lints, backend format check and frontend build passed (existing chunk warning). Final full layer suites running in Luna per-action worker; no new native/independent PASS claimed. Staging still contains only the backend history slice and narrow prerequisite; no commit or remote operation yet.
L13. Final amended checks: delegated full backend 987 passed in 200.39s. Delegated frontend failed 215/497 with the same React hook-loading symptom; parent reran that exact full frontend command in the original workspace and all 497 passed. Preserve both observed outcomes, not a fabricated independent PASS. git diff --check and staged diff check passed. Logs retained outside workspace as unify-delegated-frontend.log/backend.log and unify-parent-suite.log. Earlier candidate snapshots and staging patch temporaries removed. Final worker scratch cleanup was denied on its workspace/frontend/node_modules; residual verify-odd-C3k8T6 remains under approved system temp, do not change permissions or force a recovery. No source or repository permission changes attempted. Commit/push still pending readiness/partial-verification acceptance and exact remote credential/destination confirmation.
L14. 2026-10-28: After the local-versus-delegated test outcomes and CI behavior were explained, user explicitly instructed "hagamos commit y push entonces, seria el nuevo panel de dieccion y lo de asistencias". Proceed with those two scopes on the existing feature branch to the previously proposed origin using configured Git credentials; do not include unrelated Portal changes or publish/merge a PR. Human visual validation is retained; independent proof stays partial, not PASS. Plan separate history backend, event producers, panel backend, panel/sidebar UI, and history UI commits with tests/docs alongside each behavior. New panel data depends on pago.registrado and inscripcion.cambio_matricula producers; preserve unrelated PostgreSQL lock fixes unstaged. Review mode remains globally on; no pre-commit hook exists.
L15. Commit e742cfb native review approved and exact acknowledgement returned authority burned (lineage review-5b40d091e1d9c1a7). Non-blocking R3-001: empty PDF with no dates defaults its range to the current day; retained as a separate follow-up, no correction offered. User authorized Luna high for the native reviewer after the default launch failed. No review re-run on the acknowledged target.
L16. Commit 416cf8b adds only payment/enrollment activity producers and their tests/docs (279 additions, 8 deletions). Independent verifier PASS, parent spot-check 12 passed; broader isolated slice 46 passed and Ruff passed. Native four-lens review approved without findings and exact acknowledgement returned authority burned (lineage review-cdc75db2a0255c12). Reviewed boundary now 416cf8b. Panel backend staged separately (7 files); its isolated 10 tests and Ruff pass, permission verifier pending. No push yet.
L17. Delivery reconciliation: ccd8748 contains panel backend (11 isolated tests passed, independent permissions verification found no blockers, prior KPI AST unchanged); user chose "Omitir esta vez" for its native review. 3cbc715 contains panel/sidebar UI; 28 focused tests and isolated lint/format/build passed, independent sidebar source check found no blockers. Its DeepSeek readability/reliability review approved with nonblocking advisories and exact acknowledgement burned authority for review-8668f0b6ca2bdf88. Do not reopen prior candidates.
L18. 2026-10-29: User instruction verbatim: "no uses mas luna, volvio deepseek", then "dale". Use DeepSeek, not Luna. Commit cc139c8 contains only the 12 final attendance frontend paths, including filtered service/hook/page/tests, export menu/redirect/removal and README. Parent observed 38 focused and 498 full frontend tests passing, lint/format/build passing; isolated staged candidate lint/format/build also passed (history-ui-check.OjE0Nm). Existing bundle warning remains. User chose "Omitir esta vez"; exact native invocation returned declined_this_candidate for sha256:7534cb06d775f4aaae1a628c7b558799b71ba3c51d271cdec0554d9d0b731d5b. No application correction or new independent PASS claimed. Final records and authorized non-force push remain pending; unrelated Portal/DESIGN/locking changes remain excluded.
