# Communications — stage 1
Objective: persistent institutional drafts, publication and individual family reading. Branch: `feat/comunicaciones-etapa-1`; base: `c377321`. Delivery: exception-ok, single stage-one PR; user accepted size:exception for 2,147 authored lines. No push or PR authorized.
Runner: backend pytest/ruff; frontend npm run test/lint/build. Implementation inline: one cohesive flow, no independent writer units. Risk: items 1, 2, 3 and 4 (migration, authorization, permission vocabulary, publication concurrency).

## Specs
- S1: “Empezá únicamente por la **Etapa 1: Administración publica → Familia recibe → Familia lee**.” Include persisted backend, frontend and tests; no stage 2.
- S2: “Incorporá borradores básicos desde la Etapa 1. Dejá las aprobaciones y el versionado editorial avanzado para la Etapa 4.” Drafts editable by author and never visible to families; published content immutable.
- S3: “Priorizá el modelo mínimo de datos anteriormente justificado. No conviertas automáticamente todas las responsabilidades conceptuales en entidades independientes. Agregá tablas solamente cuando exista una necesidad demostrable.” Use communication plus recipient receipt; audience selection stored on communication, per-recipient student context stored in receipt. No versions, publication, transport or read tables.
- S4: “Antes de editar, verificá la rama de integración, los cambios pendientes, la identidad Usuario/Persona/Familia y los permisos existentes.” Verified clean isolated worktree at fetched origin/main c377321; Familia is a responsible linked through Persona. New own permissions explicitly authorized for Administración/Dirección, family own read only, no teacher publication.
- S5: “Trabajá en una rama aislada, sin alterar desarrollos ajenos. Reutilizá componentes y patrones del repositorio y respetá ARCHITECTURE.md y DESIGN.md.” New communication domain requires updating architectural module inventory; preserve existing notification semantics and other trees.
- S6: “La etapa debe incluir backend, frontend, persistencia y tests, con un flujo completo y demostrable.” Audience options: all enabled responsible links, current enrollment level/division, selected students/responsibles. Deduplicate receipt by responsible. Revalidate current links at access; per-responsible first-read timestamp. Publish draft by ID idempotently; atomic state transition and receipts with audit.
- S7: “Al finalizar, entregá un resumen conciso de cambios, pruebas ejecutadas, resultados y riesgos. No avances a la Etapa 2 sin mi autorización.” Include unavailable checks honestly.

## Tasks
- T1 [S1–S6] inline, implemented and independently verified: API RED 404 then PostgreSQL GREEN (14 tests finally); generated/reviewed migration 131253d235ee applied; full backend 1,271 passed before adding the concurrency regression. Commit pending delivery strategy.
- T2 [S1–S3,S5–S6] inline, implemented and independently verified: frontend RED missing pages then 5 component tests passed; 2 real PostgreSQL-backed browser tests passed (desktop/mobile). Full suite 606 passed/1 failed; fixed only missing new navigation metadata, focused 37 passed. Commit pending delivery strategy.
- T3 [S4–S7] inline plus independent verifier (high-risk items 1/2/3/4), checking: independent S1–S7 met including targeted concurrent-request recheck; native review due/high-risk, consent not yet requested; delivery strategy pending before commit.

## Log
- L1 User request verbatim: “Apruebo el plan general de Comunicaciones ESSERI, con tres ajustes:

1. Priorizá el modelo mínimo de datos anteriormente justificado. No conviertas automáticamente todas las responsabilidades conceptuales en entidades independientes. Agregá tablas solamente cuando exista una necesidad demostrable.

2. Incorporá borradores básicos desde la Etapa 1. Dejá las aprobaciones y el versionado editorial avanzado para la Etapa 4.

3. Para la primera automatización, mantené `inasistencia.registrada` como candidato, pero evaluá una alternativa real si la supresión por justificaciones anticipadas todavía no está implementada. No habilites avisos incorrectos ni uses eventos ficticios.

A partir de ahora quiero avanzar con la implementación incremental.

Utilizá ODD y Engram según las capacidades reales de Gentle AI, evitando documentación y exploraciones redundantes.

Empezá únicamente por la **Etapa 1: Administración publica → Familia recibe → Familia lee**.

Antes de editar, verificá la rama de integración, los cambios pendientes, la identidad Usuario/Persona/Familia y los permisos existentes.

Trabajá en una rama aislada, sin alterar desarrollos ajenos. Reutilizá componentes y patrones del repositorio y respetá ARCHITECTURE.md y DESIGN.md.

La etapa debe incluir backend, frontend, persistencia y tests, con un flujo completo y demostrable.

Delegá únicamente trabajo independiente a subagentes; evitá exploraciones repetidas y conflictos de edición.

Al finalizar, entregá un resumen conciso de cambios, pruebas ejecutadas, resultados y riesgos. No avances a la Etapa 2 sin mi autorización.”
- L2 User authorized fetch: “dale”. Fetch found eight commits; fast-forward isolated clean branch to c377321, original dirty checkout untouched.
- L3 User approved own permissions for Administración/Dirección and family own read: “dale te doy permiso”.
- L4 Existing Familia represents one responsible, linked by persona_id. Existing active-role permission dependency reused. No separate transport or notification integration in stage 1.
- L5 Added only two domain tables. Existing roles receive explicitly approved grants in migration/seed; active-role dependency and family identity helper reused. Publication locks the draft; receipt uniqueness and atomic first-reading update prevent duplicates. Published content immutable, HTML displayed as plain text.
- L6 Verification: PostgreSQL 13 passed; backend full suite 1,271 passed; backend lint/format passed; frontend lint/build passed (large-bundle warning). Real backend/browser E2E desktop/mobile 2 passed with persisted publications/read receipts. Isolated PostgreSQL container esseri-comunicaciones-etapa1 port50079, backend8017/frontend5177; only synthetic test data.
- L7 Environment incident: cloned dependencies contained nested node_modules/node_modules symlink to original checkout, splitting React identity. Cleared copied cache (insufficient), then removed only isolated nested link (focused 5 passed). Frontend full recheck 606 passed and one new nav entry missing modulo; parent reproduced RED then added existing family palette metadata; focused navigation+module 37 passed. Original checkout source unchanged.
- L8 Remaining: independent verifier in scratch copy, migration existing-role/concurrency probes, native risk/review when applicable, delivery size strategy before any commit. No stage2 authorized.
- L9 Independent verifier confirmed S1–S5/S7 and migration grants/two tables in scratch; marked S6 unverified because concurrent HTTP requests were not executed. Added one PostgreSQL-only regression using two authenticated requests with independent sessions for draft creation, publication and first read; no product-code change needed. Own check: 14 PostgreSQL tests passed, including the concurrent request pairs and exactly one receipt/publication/read audit. Dedicated database communications_stage1_tests preserves demo data. Targeted verifier recheck pending; no new full review sweep.
- L10 Targeted independent recheck passed the real PostgreSQL concurrency test; S6 met. Parent reran that same test after handoff: 1 passed. No verifier blockers remain. Native assessment high/review_due=true with explicit security escalation; no START or consent invocation yet. Staged authored count 2,146 lines before this log update. One honest slicing pass identifies draft management and published family delivery as possible units, but both need shared permissions/migration/UI and would still exceed the review budget; prefer a maintainer-approved size exception for the coherent end-to-end stage, otherwise choose a chain before committing. No commit, push or PR performed.
- L11 User selected “PR único con excepción”. Strategy: exception-ok, one coherent stage-one work unit including behavior/tests/docs/migration. Explicit selection authorizes local commits only, not push/PR. User was given the running isolated visual-test URLs/accounts; ports responded 200. Native review consent remains separate.
