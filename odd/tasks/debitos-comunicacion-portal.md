# Publish debit results through Communications
Branch: `feat/debitos-comunicacion-portal`; baseline: `c07b250` (`origin/main`, includes PR #326).
Delivery: `ask-on-risk`; provisional forecast: more than 400 authored lines. Runners: pytest and Vitest.

## Specs

- S1 — “yo en la demo queria crear un workflow que envie un mail y una comunicacion mediante el protal, sobre el resultado del debito”. Provide the approved separate **Publicar comunicación** action with **Portal / Email / Ambos** in the workflow editor for `debito.resultado_registrado`. With **Ambos**, one communication owns both channels; no separate `notificar` action is needed to send its email.
- S2 — “¿Arranco desde `origin/main` en una rama nueva con **Publicar comunicación** y el selector **Portal / Email / Ambos**, dejando intacto el flujo de Compras?” / “dale”. Keep existing `generar_comunicacion` review behavior. Publish only to the invoice's persisted economic family; the student is context, not a recipient.
- S3 — Approved verification: “que solo lo reciba la familia correcta, que reprocesar el evento no duplique la comunicación ni el correo, y que el aviso siga visible si falla el envío.” Reuse the Communications delivery pipeline and verify the success and rejection paths without publishing this branch.

## Tasks

- T1 — S1–S3; inline feature unit, with delegated read-only mapping and independent verification; checking; no commit. Risk: items 2, 3, 4 and 5 (family access, shared publication/dispatch behavior, retries, and migration).

## Log

- L1 — “dale”
- L2 — The preceding proposal defines the authorized change in S2. Created the local branch from `origin/main`; no push or merge. T1 is waiting for the read-only map; no source changes have been made.
- L3 — Implementation reuses the Communications audience and durable delivery; it preserves opt-out and freezes the invoiced student's context. The event lock and deterministic key deduplicate publications across workflow executions; the existing Notifications action for Purchases is unchanged. Alembic `260e3555f2b7` extends the catalog constraint.
- L4 — RED: three backend cases failed on the old action constraint; three frontend channel serialization cases failed on the missing action. GREEN: 154 backend tests passed, 11 skipped; 306 frontend Workflow tests passed; Ruff, ESLint and build passed. Alembic has one head; isolated offline PostgreSQL SQL for upgrade and downgrade inspected. Live database migration and real mail delivery have not been run. Independent verification is pending.
- L5 — Independent verification: S1–S3 met; 13 backend probes and 9 frontend probes passed, and 79 regressions passed both at baseline and on the candidate. Added durable coverage for the disabled family link and the visible channel selector (4 targeted backend tests and 1 targeted frontend test passed). PostgreSQL dialect compilation confirms `FOR NO KEY UPDATE`, not `FOR KEY SHARE`. The communication remains visible in Communications; this change does not populate a separate Billing notice. Live PostgreSQL migration and real email remain unverified.
- L6 — After “ok”, a separate worktree preserves frozen candidate `5e396ca` and tests the confirmed policy: “una sola publicación y que las reglas incompatibles informen el conflicto”. Both conflicting-channel orderings reproduced false success before the fix.
- L7 — PostgreSQL 16 (disposable local database): `bcbf209f8322` → `260e3555f2b7` → `bcbf209f8322` → `260e3555f2b7` succeeded; the final check constraint admits `publicar_comunicacion`. No demo database or real email was used.
- L8 — Channel conflict check preserves the original publication and reports both channels in the losing execution. Both orderings pass; 13 focused debit tests and Ruff passed. This does not change suppression of legacy payment notices when mixed-channel rules coexist.
- L9 — Portal Familia separates invoice status from the debit attempt: `Pendiente`/`Vencida`/`Pagada` stay the invoice state, a rejected attempt shows its reason next to the card, the filter is now “Con débito rechazado”, and “Próximo débito” became “Próximo vencimiento”. GET /facturacion/familia/me gains `ultimo_resultado_debito` projected from the confirmed event, independent of Communications. Focused frontend: 116 passed, lint and build clean.
- L10 — Workflows exposes `debito.resultado_registrado.resultado` as a closed field: `Acreditado` and `Rechazado`. The editor already renders closed fields as a dropdown and the backend rejects other values; no frontend change or migration was needed. Focused suites passed.
- L11 — Delivery preparation: branch consolidated at `3d75088`; frontend full suite 173 files / 1305 tests passed, ESLint and build clean; slice assessment `c07b250..HEAD` medium/under_budget, so no native review is due yet. PR description drafted outside the repository. Full backend suite running.
- L12 — Full backend suite on `71b8b88`: 2097 passed, 40 skipped, 1 failed (`tests/workflows/test_arbol.py::test_resumen_totales_periodos_y_banderas_de_atencion`). Reproduced the same failure on a detached `c07b250` worktree, so it is pre-existing and unrelated to this change.
