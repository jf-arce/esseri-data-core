# Internal notifications: Communications and Billing delivery
Objective: second authorized delivery. Branch: `feat/notificaciones-comunicaciones-facturacion` from `main`.
Runner: backend `venv/bin/pytest`, Ruff; frontend package scripts; isolated PostgreSQL for concurrency.

## Specs

### S1. Communications
Notify a new institutional communication published for the portal, reusing the existing recipient
resolution and receipts. Only `tipo == "institucional"` and channel `portal` or `ambos`.
One notification per family account, deduplicated by communication. Notification read never writes
`ReciboComunicacion.leida_at`; opening the communication keeps its own read semantics.

### S2. Billing issuance
Notify every invoice issued by any productive path: manual `crear_factura_en_transaccion`,
batch `generar_facturacion`, and workflow `generar_cargo`. One notification per active family-role
account of the invoice's persisted economic-responsible family. Deduplicate by invoice.
Do not change invoice state, balances, ledger or events.

### S3. Payment registered
Notify a payment approved by Administration, without claiming bank accreditation. Recipient is the
economic-responsible family of the invoice. Deduplicate by payment. Do not change the payment,
ledger or event contracts.

### S4. Upcoming due
One reminder per invoice and family account when the effective due date is within today..today+3
inclusive, the invoice is not paid, and the pending balance is positive. Run even when automatic
invoice generation is disabled. Do not mutate invoices. Downtime outside the window is not
backfilled. A later extension does not produce a second reminder.

### S5. Authorization and history
Extend the generic read predicate for communications and billing destinations:
communications require an existing receipt for the notification's family and a published
communication; billing requires the invoice/payment to belong to the persisted economic-responsible
family. Keep academic rules unchanged. Notifications remain historical after resource changes.

### S6. Out of scope
No family receipt upload, no payment approval/rejection circuit, no pending/rejected payment notices,
no Communications/Billing email changes, no n8n changes, no new infrastructure.

## Tasks

- T1 — S1–S6 — backend domain, producers and job — completed; focused 253 tests, full suite 1973 passed / 40 skipped.
- T2 — S1–S6 — frontend destinations and tests — completed; 164 files / 1226 tests, lint and build passed.
- T3 — integration, tests, docs, commits — completed locally; backend and frontend verification passed; PR pending.

## Log

### L1. Original request
> dale, pero ya esta todo mergeado lo otro?

User authorized the second delivery described in the approved impact analysis:
Communications (institutional published for portal), Billing (invoice issued), Payments (registered
and approved by Administration, no bank accreditation) and unique upcoming-due reminders (3-day
window, pending balance, effective date, independent of automatic generation).
Out of scope: family receipt upload, payment approval/rejection circuit, pending/rejected notices.

### L2. Implemented policies
Communications: only institutional type and portal/ambos channel; one notice per family account;
notification read never writes the communication receipt. Billing: economic-responsible family,
deduplicated by invoice/payment. Upcoming due: one reminder per invoice/account, effective date
in today..today+3, positive balance, separate always-on job. Generic read authorization extended
by domain; academic rules unchanged. No schema migration required.

### L3. Verification and commits
Backend full suite: 1973 passed / 40 environment-gated skips; notifications module on PostgreSQL:
62 passed. Frontend full suite: 1229 tests; lint and build passed. Commits: `68b24ea` domain,
`68932be` communications, `b3bf981` billing/job, `ea66ee4` frontend destinations, `92c3ad9` docs,
`5beeb81` exact invoice navigation, `10c04dd` clear stale focus.


