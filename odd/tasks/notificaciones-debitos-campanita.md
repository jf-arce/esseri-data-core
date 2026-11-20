# Debit results in the family notification bell

Objective: surface confirmed automatic-debit results in the internal notification bell without
changing emails, workflow snapshots or the billing view. Branch: `feat/notificaciones-debitos-campanita`
based on `97bc833`. Delivery: work-unit commits; publishing is a separate user decision.
Runners: backend `venv/bin/pytest`; frontend `npm run test`, `npm run lint`, `npm run build`.

## Specs

- S1: Each confirmed debit result produces one bell notice per active Family account of the
  invoice's economic-responsible family. Successful and rejected results both appear.
  Assumption A1: the user did not explicitly answer whether rejected results should appear in
  the bell; the reversible default is both, matching the billing view and the email rule.
- S2: A debit-linked payment must not produce the generic payment notice whose text affirms
  "Fue aprobado por Administración"; an automatic debit is not an Administration approval.
  Manual Administration payments keep that notice unchanged.
- S3: The rejected notice shows the reason only. User requirement (verbatim): "el codigo de
  rechazo no tiene sentido mostrarle al usuario".
- S4: Deduplication is per debit and account. Replaying or concurrently confirming the same
  rendition neither duplicates notices nor leaves a partial confirmation: an unexpected insert
  failure rolls back payments, events and notices together.
- S5: The notice opens the exact invoice, already supported by
  `/familia/facturacion?factura=<id>` with the card expanded and highlighted.
- S6: No migration: `notificacion_interna` is generic; the new combinations are validated in the
  application layer.

## Tasks

- T1 [S1,S2,S3]: inline — completed; domain, producer and confirmation integration.
- T2 [S1,S2,S4]: inline — completed; A/B/C, API read, replay and rollback regressions.
- T3 [S1,S5]: inline — completed; frontend types and styles; destination already routes to the invoice.
- T4 [S6]: inline — in progress; documentation, full checks and evidence.

## Log
- L1 — Original request (verbatim): "termine el merge". Preceded by the agreed next step:
  "cuando esa sesión termine el merge, volvés acá y seguimos con la campanita", and the earlier
  proposal "un único aviso en la campanita por resultado —exitoso o rechazado— que abra la
  factura desplegada".
- L2 — Merge verified: `origin/main` at `97bc833` (PR #334). Both notification modules present,
  `registrar_pago_aprobado` retained, invoice deep links retained, single Alembic head
  `260e3555f2b7`. Local `main` fast-forwarded.
- L3 — Observed defect before changes: debit success calls `registrar_pago(confirmar=False)`,
  which publishes the Administration payment notice for an automatic debit, and rejected debits
  publish nothing in the bell.
- L4 — Implemented inline: two types (`facturacion.debito_exitoso`, `facturacion.debito_rechazado`)
  with strict, separate contexts; one notice per debit and account through the existing
  `publicar` key; `registrar_pago(notificar=False)` on the debit path only. The first schema
  shared one `motivo` field and the strict read predicate rejected empty strings; the focused API
  read test surfaced it, so éxito and rechazo now use different schemas.
- L5 — Focused evidence: backend `tests/facturacion/test_debitos_resultados_workflow.py` plus
  `tests/notificaciones` 69 passed (62 on PostgreSQL); backend domain sweep `tests/facturacion
  tests/notificaciones tests/workflows` 791 passed; frontend 173 files / 1306 tests; lint, Prettier
  and build passed; Ruff check and format passed. Full backend suite was started and stopped:
  another session was concurrently editing this checkout, so its result would describe a mixed
  tree.
- L6 — Work isolation: the shared checkout switched to another session's `feat/paneles-rol` and
  my first three commits inherited its `832ece6`. The other session's HEAD was restored, its
  uncommitted files were preserved, and this branch was recreated in
  `../esseri-data-core-worktrees/notif-debitos-campanita` on `97bc833` with only the three
  delivery commits.
- L7 — Full backend suite in this worktree: 2120 passed, 11 skipped, 7 failed. The seven failures
  are all in `tests/academico/test_solicitud_periodo_concurrencia_postgres.py` and reproduce
  identically on base `97bc833` ("La ausencia debe pertenecer al ciclo lectivo actual"), so they
  are pre-existing and unrelated to this delivery. Manual browser checks: successful and rejected
  notices, exact invoice opening, technical code absent, unread counter.
