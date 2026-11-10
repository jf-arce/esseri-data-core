# Solicitudes de ausencia por período
Branch: `feat/solicitudes-ausencia-periodo` · Delivery: ask-on-risk; user chose feature-branch-chain · Tests: pytest and Vitest; PostgreSQL for concurrency.

## Specs
- S1: «Modelo nuevo de solicitudes por período, con FK opcional en asistencia.» «Justificaciones históricas intactas.» Todas las solicitudes nuevas, incluso de un día, usan el modelo nuevo.
- S2: «Aprobación y rechazo exclusivamente por Administración.» «Docentes sin permisos para modificar asistencias justificadas.» «Rectificación administrativa excepcional y auditada.»
- S3: «Una única bandeja administrativa.» Reutilizar motivos, adjuntos y contratos existentes cuando sea posible. No alterar decisiones históricas resueltas; excluir sus fechas de los efectos y de la suspensión del nuevo período. Bloquear solicitudes activas superpuestas y justificaciones individuales pendientes; permitir cancelación familiar de pendientes. «Ese listado y ese botón deben mantenerse.» Dos entradas al mismo formulario: «Justificar» precarga la fecha y permite ampliar el período; «Informar ausencia» permite fecha o rango pasado, presente o futuro. Ambos usan el modelo nuevo y comparten componentes, validaciones y lógica; mantener restricciones existentes del botón, adaptando cobertura y solicitudes existentes. «No duplicar formularios ni eliminar funcionalidades actuales del Portal Familia.»
- S4: «Suspensión de notificaciones desde la presentación de la solicitud.» «No quiero mantener bloqueos transaccionales de PostgreSQL durante llamadas HTTP a n8n.» Conservar eventos y documentar límites de envíos ya iniciados; sin reenvíos históricos masivos.
- S5: «Reutilización máxima del sistema actual.» «Sin refactorizaciones generales ni cambios no relacionados.» Aplicar solo a ausencias reales, sin crear asistencias futuras ni modificar presencias o tardanzas; auditar aplicación, retiro y reaplicación.
- S6: «antes de aplicar migraciones o cambios que puedan afectar datos existentes, verificá sus precondiciones.» «No modifiques datos históricos para hacer pasar las pruebas».

## Tasks
- [x] T0 (S1–S6): isolated development compatibility and baseline checks complete (L2, L5, L9, L10). Deployment preconditions remain open: authorized representative snapshot, duplicate/integrity and client-compatibility checks.
- [ ] T1 (S1, S3, S5, S6): model and additive migration merged in PR #298 (`5952087`); creation/cancellation services, per-student locks and concurrency tests committed locally (`02f1279`, `09202f9`, `fca72dd`). Pending: adapt/coordinate the historical creation endpoint for cross-origin concurrency; native review of the concurrency/services slice.
- [ ] T6 (S1–S3): family API create/list/cancel/download (L31) and read-only administrative tray with filters/pagination (L32) implemented; pending decision/application endpoints and frontend integration. Historical individual endpoints remain unchanged for compatibility.
- [ ] T2 (S1, S2, S5): apply to real attendance and administrative rectification with audit; not implemented.
- [ ] T3 (S4): notification start coordination without PostgreSQL locks during HTTP, existing workflows and tests; design recorded in L6/L19, implementation pending.
- [ ] T4 (S1–S3): family and unified admin interfaces, attachments and tests; not implemented.
- [ ] T5 (S1–S6): PostgreSQL concurrency and end-to-end regression verification; partial evidence only.

## Log
L1 — User request, verbatim:

El checklist está aprobado a nivel funcional y arquitectónico, con una observación técnica antes de implementar.

No quiero mantener bloqueos transaccionales de PostgreSQL durante llamadas HTTP a n8n. Evaluá una estrategia mínima de coordinación e idempotencia que permita liberar los bloqueos antes de realizar operaciones externas, documentando las garantías reales sobre avisos pendientes y envíos ya iniciados.

Mantenemos todas las decisiones acordadas:
- Reutilización máxima del sistema actual.
- Modelo nuevo de solicitudes por período, con FK opcional en asistencia.
- Justificaciones históricas intactas.
- Aprobación y rechazo exclusivamente por Administración.
- Docentes sin permisos para modificar asistencias justificadas.
- Rectificación administrativa excepcional y auditada.
- Una única bandeja administrativa.
- Suspensión de notificaciones desde la presentación de la solicitud.
- Sin refactorizaciones generales ni cambios no relacionados.

**Podés comenzar con la etapa 0: verificaciones de compatibilidad, datos históricos y pruebas de referencia.**

Después, avanzá con la implementación siguiendo el orden acordado, pero antes de aplicar migraciones o cambios que puedan afectar datos existentes, verificá sus precondiciones. Si surge un bloqueo real, detené únicamente la etapa afectada y explicá el problema.

Trabajá en cambios pequeños y verificables, ejecutando pruebas de regresión después de cada etapa. No modifiques datos históricos para hacer pasar las pruebas y no agregues complejidad innecesaria.

Al finalizar, entregá un resumen de archivos modificados, migraciones, pruebas ejecutadas, resultados y riesgos pendientes.

L2 — Baseline at 94bb87c: focused backend pytest 90 passed, one deprecation warning, with isolated SQLite test configuration; focused frontend Vitest 5 passed. Initial backend invocation lacked required test configuration and failed before collection; rerun passed. No existing database accessed. Frontend and backend historical endpoint contracts require explicit compatibility checks. PostgreSQL preconditions and concurrency remain unverified.

L3 — User request, verbatim:

Bien, continuemos sobre la rama `feat/solicitudes-ausencia-periodo`.

Quiero que completes la etapa 0 y dejemos las precondiciones verificadas para comenzar la implementación.

Prioridades:

1. **Compatibilidad:** inventariá los consumidores reales de endpoints, schemas y eventos existentes. Identificá cuáles requieren cambios y cuáles deben permanecer intactos.
2. **Datos históricos:** verificá, mediante consultas no destructivas, duplicados, integridad referencial y comportamiento de eliminación. No modifiques ni limpies registros existentes.
3. **PostgreSQL:** ejecutá pruebas de concurrencia reales con transacciones independientes. No consideres suficientes las pruebas SQLite.
4. **Notificaciones:** validá cómo incorporar una reserva transaccional corta al mecanismo de envío existente, sin mantener bloqueos durante llamadas HTTP a n8n. Contemplá reintentos, fallos, reservas abandonadas e idempotencia. Documentá los límites de garantía sin incorporar infraestructura nueva innecesaria.
5. **Regresión:** conservá como referencia las 90 pruebas backend y 5 frontend que ya pasaron.

No quiero ampliar el alcance ni rediseñar componentes existentes.

Actualizá el seguimiento en `odd/tasks/solicitudes-ausencia-periodo.md` con los hallazgos, evidencias y decisiones técnicas.

Cuando termines, indicá claramente:
- Qué verificaciones pasaron.
- Cuáles no pudieron ejecutarse y por qué.
- Qué riesgos reales quedan.
- Si podemos comenzar la etapa 1 de forma segura.

**Si la etapa 0 queda satisfactoriamente completada, avanzá con la etapa 1 (modelo de datos y auditoría), manteniendo la implementación aditiva, los datos históricos intactos y las pruebas correspondientes.**

No ejecutes migraciones sobre bases compartidas o de producción. Si aparece un bloqueo relevante para la etapa 1, detené esa parte y explicá el motivo.

L4 — T0 evidence: backend academic router.py:774–934 and schemas.py:250–299 expose attendance/individual justification IDs; family page and services consume those, while justificaciones-page.tsx:9–35 and :61–68 consume admin list, resolution and attachment paths. These need explicit new-origin integration; historical resolution and attachment routes and meanings must remain valid. `inasistencia.registrada` identifies attendance and `inasistencia.justificada` identifies historical justification (workflows/constants.py, notificaciones_service.py:202–237); do not substitute IDs or change historical event meanings. Existing reminder evaluates any historical justification (acciones_recordatorio_service.py:29–46). `alembic heads` reports 05c0cafefee6.

L5 — PostgreSQL 16 disposable local container: `alembic upgrade head` passed on an empty database only; container removed. Two independent transactions on the actual migrated `asistencia` table both read zero and inserted the same synthetic inscription/date, producing two rows: existing read-then-insert is racy. Synthetic parents were bypassed solely inside this isolated test via session_replication_role=replica. Restoring normal FK enforcement and deleting an attendance referenced by a synthetic historical justification produced ForeignKeyViolation. Empty scratch database returned 0 duplicate attendance groups, 0 duplicate justification groups and 0 orphan justifications; these numbers say nothing about real historical data. Existing database destination, authorization and a sanitized snapshot are not established; no historical data inspected. PostgreSQL test for the proposed new implementation remains pending because it does not yet exist.

L6 — Notification feasibility, not yet validated end-to-end: current `despacho_service.py:192–253` flushes an execution within the encompassing transaction and `notificaciones_service.py:466–517` invokes HTTP before that transaction commits. Merely adding a flush is not a durable claim. Existing `manuales_service.py:349–399,444–561` provides a prior short durable claim, result reconciliation and lease recovery pattern; its data model and provider protocol must be checked before reuse, and the existing synchronous workflow action cannot simply commit inside its savepoint. A candidate must serialize request confirmation and the persisted start decision on the student, commit before HTTP, recheck coverage at each new claim/retry, preserve identity and fencing across workers, and classify abandoned post-start attempts as uncertain without blind retry. No exactly-once delivery or cancellation after start is promised. The existing manual lease recovery is not proof that the separate workflow transport has the same provider claim protocol. No native implementation or end-to-end validation of this candidate has been performed.

L7 — T0 remains pending: historical integrity/duplicates and deployment contract compatibility have not been checked against an authorized existing snapshot; reservation implementation and concurrent end-to-end probes remain unverified. T1 has not started because the user explicitly conditioned it on satisfactory T0. No shared/production database was accessed and no historical data was changed.

L8 — User correction, verbatim:

No tengo por ahora una ruta confirmada de una copia local anonimizada de la base histórica, así que no quiero que la inventemos ni que utilices conexiones o credenciales sin autorización.

Considero que esto no debería bloquear el desarrollo de la funcionalidad en un entorno aislado.

Separemos claramente:

**1. Validaciones necesarias para desarrollar**
- Utilizar PostgreSQL 16 aislado con migraciones existentes.
- Crear datos sintéticos válidos respetando las claves foráneas.
- Reproducir y resolver la concurrencia de asistencias.
- Implementar migraciones aditivas y probarlas sobre datos de prueba.
- Mantener compatibilidad con los contratos históricos.
- Validar los nuevos servicios con tests unitarios y de integración.

**2. Validaciones obligatorias antes del despliegue**
- Comprobar duplicados e integridad en una copia autorizada de la base real.
- Verificar que las migraciones puedan aplicarse sin alterar datos históricos.
- Resolver cualquier inconsistencia encontrada sin limpieza automática.
- Confirmar la compatibilidad de los clientes existentes.

La ausencia de esa copia debe quedar registrada como una precondición pendiente para despliegue, no como un bloqueo general del desarrollo.

Respecto a las notificaciones, completá el diseño de reserva transaccional corta reutilizando la infraestructura actual. No quiero bloqueos durante HTTP ni reintentos automáticos de envíos con resultado incierto.

**Podés avanzar con la etapa 1 en la rama actual**, siempre que trabajes exclusivamente sobre bases descartables y no modifiques datos reales.

Mantené el principio de mínimo impacto:
- No refactorizar módulos completos.
- No cambiar permisos docentes.
- No migrar justificaciones históricas.
- No introducir tablas adicionales salvo necesidad demostrada.
- Reutilizar servicios, validaciones, motivos, adjuntos y componentes existentes.

Trabajá por etapas, ejecutando las pruebas correspondientes y documentando los resultados en `odd/tasks/solicitudes-ausencia-periodo.md`.

Si encontrás un bloqueo técnico concreto, detené la parte afectada y explicá por qué.

No ejecutes migraciones sobre ninguna base compartida o de producción.

L9 — Supersedes L7's development blocker: actual historical-data checks are a deployment precondition, not a development blocker. Synthetic fixtures must satisfy foreign keys. T1 is explicitly authorized on isolated databases only.

L10 — PostgreSQL 16 isolated, migrated to 05c0cafefee6: valid synthetic persona, alumno, nivel, anio, division and inscripcion with foreign keys enabled. Two independent transactions both observed no attendance then inserted the same inscription/date; two records resulted, no orphan attendance. Concurrency fix remains pending; this is RED evidence, not a fix.

L11 — T1 in progress, not complete: added period request model and nullable attendance FK, generated additive Alembic revision 5ff26cba86c4. PostgreSQL 16 disposable migration from 05c0cafefee6 preserved an existing FK-valid synthetic attendance (`ausente_pendiente`, new FK null); `alembic check` reported no new operations. New model tests initially failed to import the nonexistent model; after implementation 92 focused backend tests passed, one deprecation warning. Ruff check passed after formatting. Application audit, service integration, concurrency fix and historical-justification migration fixtures are not yet verified or implemented. No real or shared database was accessed. Deploy preconditions: authorized representative snapshot, duplicates and integrity checks, historical preservation and existing-client compatibility.

L12 — User clarification, verbatim:

Quiero aclarar un requisito funcional importante antes de implementar el frontend.

En el Portal Familia, actualmente existe un listado de asistencias del alumno, donde las inasistencias elegibles tienen un botón «Justificar».

**Ese listado y ese botón deben mantenerse. No quiero reemplazarlos por el nuevo formulario de períodos.**

La solución debe ofrecer dos puntos de entrada al mismo formulario:

1. Desde «Justificar» en una inasistencia existente, precargando la fecha y permitiendo opcionalmente ampliar el período.
2. Desde una nueva acción general «Informar ausencia», permitiendo seleccionar una fecha o rango pasado, presente o futuro.

Ambos deben generar solicitudes utilizando el nuevo modelo por período y compartir componentes, validaciones y lógica de negocio.

Conservar las restricciones actuales para mostrar el botón «Justificar» y adaptar únicamente lo necesario para contemplar solicitudes ya existentes o períodos cubiertos.

No duplicar formularios ni eliminar funcionalidades actuales del Portal Familia.

L13 — Independent verifier failed to launch due to a DNS/network error; no verification verdict was returned. T1 and its risk verification remain pending; no commit created.

L14 — Independent verifier completed on retry: no model/migration mismatch or candidate-caused regression identified; 198 academic/inscription tests passed in scratch, compared with 196 on baseline. PostgreSQL checks remain those observed in L11, not independently repeated. Verifier confirmed tests did not detect missing migration. Added regression checks for generated migration shape, pending default, single-day request, inverted dates and invalid state. Focused backend suite: 96 passed, one existing deprecation warning; targeted Ruff check passed. T1 remains incomplete: audit and service integration are not implemented; concurrency RED remains unresolved. Verification scratch was removed.

L15 — Delivery strategy: user selected «Cadena de ramas». This does not authorize publishing, opening PRs, or merging. Slice boundaries remain to be recorded when work units are ready.

L16 — Parent spot-check after test additions: `pytest -q -p no:cacheprovider tests/academico tests/inscripciones` with isolated SQLite test settings: 202 passed, one Starlette deprecation warning. Model/migration is one additive structural work unit; T1 remains open for audit and services. Independent verifier's scratch was removed. PostgreSQL real-data and existing-client checks remain mandatory deployment preconditions.

L17 — Additive structural work unit committed as `ad33435` (`feat(academico): agregar modelo de ausencia por período`), base `94bb87c`. Native assessment high, item 1; requested review granted; review approved and exact acknowledgement consumed. Non-blocking findings: ORM tests do not enforce actual foreign keys; migration mock checks are incomplete; assess attendance-FK index when implementing lookups; assess PostgreSQL lock/validation cost on an authorized representative dataset before deployment. T1 remains open; no PR/push authorized or executed.

L18 — Attendance concurrency: PostgreSQL 16 disposable with valid synthetic FK-backed rows reproduced duplicate single attendance through the actual service (RED: both transactions created a record). Individual registration now locks its student after authorization and before the duplicate lookup; bulk registration locks all involved students in deterministic ID order before processing. PostgreSQL GREEN: six tests passed for single/single, single/bulk, bulk/bulk, reversed bulk order, rejected-command data hashes, and authorization before lock. Existing focused regression: 102 passed, one Starlette deprecation warning; Ruff passed. Independent verification reproduced RED on `ad33435`, GREEN on candidate and 202 existing academic/inscription tests; its scratch was removed. All writers of the same invariants, including future period flows, must use the same student lock; no DB uniqueness guarantee exists. Existing bulk cross-division scoping concern reported by verifier is pre-existing and outside this change; do not expand scope without authorization.

L19 — Notification transport analysis: existing attendance workflow calls the legacy n8n protocol without a durable provider claim or idempotency; manual delivery has short claims and uncertainty handling but its delivery rows require a communication and receipt, so they cannot be reused unchanged for attendance. The existing n8n manual claim protocol and result classification are potential building blocks; its compatibility with the attendance workflow and exact durable intent representation remain to be designed and tested. Do not hold database locks during HTTP or blindly retry uncertain attempts. Full notification implementation is pending.

L20 — User request, verbatim: «CORRIJAMOS». The user explicitly authorizes correcting the two independently reproduced pre-existing defects: bulk access to another division and the race where bulk overwrites an approved historical justification. These fixes are separate from the native review whose authority remains unverifiable; do not represent that review as resolved.

L21 — Follow-up fixes in progress, not committed: public API RED reproduced bulk cross-division request returning 200 and writing instead of denying; new validation rejects a whole batch containing a different division before writes and rechecks after student locks. PostgreSQL 16 RED reproduced historical approval finishing while bulk had already read attendance; historical resolution and individual update now acquire the same student lock and refresh state, and resolution returns 409 if the attendance is no longer pending absent. GREEN: seven isolated PostgreSQL concurrency tests and 104 focused SQLite regression tests passed, one existing deprecation warning; targeted Ruff passed. Independent verification of security, concurrency, contracts and both execution orders remains pending. The previously stopped native review remains unresolved and is not replaced by these checks.

L22 — Independent verifier reproduced both baseline bugs and found no blocking defect in the targeted fixes, but identified a regression risk: the new guard made a historical pending justification impossible to reject after attendance changed to present. Added a PostgreSQL RED test for that case, then limited the 409 guard to approval; rejection now records the decision without overwriting non-pending attendance. The seven PostgreSQL tests pass after this correction. Targeted independent recheck remains pending. No real data or native review state was modified.

L23 — Independent recheck of L22 completed without blockers: PostgreSQL 16 scratch tests covered pending justification against present, tardiness, justified and unjustified attendance; rejection preserved the attendance, recorded one audit and one event, and approval returned 409 without writes. A second resolution returned 409. Parent added durable parametrized regressions; 15 PostgreSQL tests passed on an isolated disposable database with FKs enabled. After the final code change, the focused SQLite academic/workflow suite passed 104 tests, one existing Starlette warning; targeted Ruff passed. The independently verified changes remain uncommitted. Full feature, frontend, authorized historical snapshot and the previously stopped native review remain pending. No shared or real database was accessed.

L24 — T1 in progress: added an as-yet-unrouted family period-creation service with family/student authorization, existing attachment validation and reason catalog, per-student lock, overlap and legacy-pending conflict detection, and transactional audit. Service tests RED initially (module missing), then 32 focused SQLite tests passed including creation, conflict, historic preservation, permissions and attachment. Sixteen PostgreSQL tests passed on disposable PG16 including simultaneous new periods (one created, one 409); Ruff passed. The existing historical creation endpoint is not yet adapted or coordinated, so cross-origin concurrency is NOT guaranteed. Period creation is not reachable from API/UI; cancellations, decisions, applications and suppression are not implemented. Independent verification pending; no real database used.

L25 — Independent verification of the unrouted creation service found no scoped blockers; reproduced authorization, conflict, attachment, historical preservation, transaction rollback, and a real PostgreSQL student-lock wait. Added durable tests for missing actor, conflict states, audit rollback, conflict identity and PostgreSQL FK metadata; 37 focused SQLite and 17 PostgreSQL tests passed after those additions, with one existing warning. The old endpoint and cross-origin locking remain pending; service is not yet exposed. Native review of the earlier commit remains stopped; no new review has been started. No real database used.

L26 — Added an unrouted family cancellation operation to the period service; it verifies family ownership and student link, locks the student, refreshes the request, permits only pending requests and records the actor and transition in the same transaction. RED (missing function) preceded implementation; 39 focused SQLite tests and 18 PostgreSQL tests passed, including concurrent cancellations yielding one cancellation and one 409, with one existing warning. Security/concurrency verification of this new operation is pending. No API/UI integration or real data access.

L27 — Independent verification found a real family-link revocation race during creation/cancellation. Both now recheck and lock the family/student link after acquiring the student lock, and an isolated PostgreSQL probe tests revocation before the lock for both operations. Independent targeted recheck found no blockers and confirmed lock order, revocation serialization and unchanged data on denial. Parent checks after the final change: 39 focused SQLite tests and 20 PostgreSQL tests passed; Ruff passed; one existing Starlette warning. Services remain unrouted; cross-origin legacy concurrency, admin decisions, applications, notifications, UI and authorized-snapshot deployment checks remain pending. No real database touched.

L28 — PR slicing plan, commits remain local and unpushed:
- PR 1, `feat/ausencias-pr1-modelo`: `ad33435` — additive model and migration, native review acknowledged.
- PR 2, `feat/ausencias-pr2-concurrencia`: `c6212c4` — attendance serialization, bulk scope correction and their regression tests, separated from period services.
- PR 3, `feat/ausencias-pr3-servicios`: `b3b4e42` after splitting the out-of-scope attendance corrections, containing only period creation/cancellation and tests; its native review is due and not yet granted.
- Later slices `feat/ausencias-pr4-api`, `pr5-bandeja`, `pr6-aplicacion`, `pr7-avisos`, `pr8-frontend`: not implemented.
Every branch chains on the previous one. Historical-snapshot and deployment checks remain open.

L29 — PR 1 published with explicit user authorization: branch `feat/ausencias-pr1-modelo` (commit `ad33435`) pushed to `jf-arce/esseri-data-core`; pull request https://github.com/jf-arce/esseri-data-core/pull/298 targets `main`. Pre-publication checks: 29 focused tests passed, Ruff passed, and `git merge-tree` reported no conflict with `origin/main`. No merge performed and no later slice published. PR 2 and PR 3 remain local and unpublished.

L30 — User authorization, 2026-11-09: continuar la implementación completa sobre `feat/solicitudes-ausencia-periodo`, en cortes pequeños y verificables, con la cadena de ramas/PRs acordada y sin merge automático. Reconciliación previa: PR #298 quedó mergeada en `main` como `5952087`; la revisión nativa `review-bc586dd7e09e3a57` fue aprobada y su acknowledgement se consumió, por lo que no se reingresa ni se inicia otra revisión. La rama se rebasó sobre `5952087` y quedó 5 commits adelante (`02f1279`, `09202f9`, `fca72dd`, `5cfb4ae`, `e9e2571`), sin conflictos. Próximos cortes: compatibilidad del endpoint histórico y APIs, bandeja administrativa, aplicación/rectificación auditadas, avisos y frontend. La publicación de PR 2 en adelante requiere autorización explícita; no se mergea nada. Siguen abiertas las precondiciones de despliegue: copia histórica autorizada y representativa, duplicados e integridad, preservación de datos, compatibilidad de clientes y costo de bloqueo/validación de la migración. No se accedió a bases compartidas o reales.

L31 — Family API slice implemented: added `SolicitudAusenciaPeriodoResponse` and family endpoints under `/academico/familia/solicitudes-ausencia` for creation (single day or range, optional attachment), listing by student, cancellation of pending requests and attachment download. They reuse `crear_solicitud_periodo`/`cancelar_solicitud_periodo`, the existing motive catalog, attachment validation, per-student locks and audit; the historical individual-justification endpoints remain unchanged for contract compatibility. Tests: new router suite 9 passed; focused academic/inscripciones suite 261 passed, 20 PostgreSQL tests skipped by configuration; Ruff check and format passed. Pending: administrative tray and decision/application endpoints (T2), notification coordination (T3), frontend switch of "Justificar"/"Informar ausencia" to the new endpoint (T4), native review and publication of this slice. No migration or real/shared database change.

L32 — Administrative tray read-only slice: added `GET /academico/solicitudes-ausencia` with filters (alumno, estado, búsqueda, rango de fechas por solapamiento), paginación, resumen por estado y contexto del alumno, reutilizando el permiso existente `academico.actualizar:justificaciones` y los patrones de paginación/búsqueda de la bandeja de justificaciones. Los filtros por nivel/año/división se difieren deliberadamente porque la solicitud guarda `alumno_id` pero no una inscripción/división; derivarlas de la inscripción activa sería ambiguo para rangos pasados o futuros. Pruebas: 7 pruebas nuevas de router administrativo aprobadas; suite focalizada de académico/inscripciones 268 aprobadas, 20 pruebas PostgreSQL omitidas por configuración; Ruff check y format aprobados. Pendiente: servicio de aprobación/rechazo y aplicación a asistencias reales con auditoría (T2), integración de la bandeja en el frontend, revisión nativa y publicación. Sin migraciones ni acceso a bases reales/compartidas.
