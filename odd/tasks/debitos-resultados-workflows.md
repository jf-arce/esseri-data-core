# Simulated debit result notifications
Objective: confirm complete simulated CBU renditions and notify the invoice's economic responsible through existing workflows.
Branch: `feat/cobranzas-archivo-simuladas-clean`; baseline: `b0e5480`. Route: inline; delivery: exception-ok (user-approved single local delivery); forecast: approximately 960 authored changed lines. Runners: backend pytest/Ruff; frontend Vitest/ESLint/build.

## Specs
- S1: "Emitir un evento `debito.resultado_registrado` por cada débito procesado." Include `debito_id`, `factura_id`, `lote_id`, `resultado`, `importe`, `codigo_resultado`, `motivo_rechazo` and invoice economic-responsible resolution. Persist atomically and dispatch after commit. Preserve `pago.registrado` without duplicate communications or manual-payment changes.
- S2: "**Nombre:** Notificación de débitos automáticos." Reuse configurable conditions, actions and templates for `resultado = exitoso` and `resultado = rechazado`; emails and persistent portal notices; no fictitious rejected payment.
- S3: "El aviso debe permanecer visible aunque falle el envío del email." Show snapshots in family billing, enforce family isolation using the invoice's economic responsible.
- S4: "Preseleccionar automáticamente todas las facturas elegibles, permitiendo exclusiones manuales." Only simulated CBU files, full-lote rendition required, preserve review/history/audit, clearly identify simulation.
- S5: "No duplicar pagos, eventos o notificaciones al importar nuevamente un archivo." No workflows before confirmation; n8n failures cannot undo payments or remove notices; preserve event/rule execution trace and manual workflows.
- S6: "Factura A: débito exitoso." / "Factura B: débito exitoso." / "Factura C: débito rechazado por fondos insuficientes." Prove two payments, one unpaid invoice, three result events, matching conditions, three test emails and family notices, no duplication on replay, audit trail.
- S7: "Implementá los cambios mínimos necesarios y ejecutá pruebas unitarias y de integración." Report changed files/configuration/checks/demo instructions/limitations. "No realices push ni merge. No agregues integración real con Galicia ni refactorizaciones ajenas al objetivo."

## Tasks
- T1 [S1,S2,S3,S5]: inline — pending; unified event, workflow routing, durable family snapshots, isolation and regressions. Risk: items 2,3,4 (family authorization, shared workflow contracts and concurrent confirmation).
- T2 [S4,S5]: inline — pending; complete CBU rendition, automatic eligible selection and focused regressions. Risk: items 3,4 (existing selection/import contracts).
- T3 [S2,S3,S6,S7]: inline — pending; family billing UI, configurable demo rules, A/B/C integration, documentation, independent verification. Risk: items 2,3 (family data and shared workflow path).

## Log
- L1 — Original authorized request (verbatim):

## Implementación — Workflow de débitos automáticos ESSERI

Quiero que implementes el circuito completo de notificaciones por débitos automáticos simulados de Banco Galicia.

**Rama:** `feat/cobranzas-archivo-simuladas-clean`

Respetá `ARCHITECTURE.md`, `DESIGN.md` y las convenciones del repositorio.

### 1. Disparador

Cuando Administración importa y **confirma** una rendición bancaria simulada:

- Registrar los pagos correspondientes a débitos exitosos.
- Mantener pendientes las facturas cuyos débitos fueron rechazados.
- Emitir un evento `debito.resultado_registrado` por cada débito procesado.
- Incluir en el evento: `debito_id`, `factura_id`, `lote_id`, `resultado`, `importe`, `codigo_resultado`, `motivo_rechazo` y los datos necesarios para resolver el responsable económico.

El evento debe persistirse dentro de la transacción de confirmación y despacharse después del commit.

Conservar el evento `pago.registrado` existente, evitando que se dupliquen las comunicaciones.

### 2. Configuración del workflow

**Nombre:** Notificación de débitos automáticos.

**Disparador:** `debito.resultado_registrado`.

**Condición A: resultado = exitoso**

Acciones:
- Enviar email al responsable económico utilizando una plantilla configurable de cobro exitoso.
- Publicar una notificación en Portal Familia informando que la factura fue pagada correctamente.

**Condición B: resultado = rechazado**

Acciones:
- Enviar email al responsable económico utilizando una plantilla configurable de rechazo.
- Publicar una notificación en Portal Familia indicando factura, importe, motivo y código de rechazo.
- Mantener la factura pendiente sin generar un Pago ficticio.

Reutilizá las condiciones, acciones, plantillas, seeds y mecanismos de ejecución existentes del motor de workflows. No programes las comunicaciones directamente dentro del importador.

### 3. Portal Familia

Mostrar los avisos de débito exitoso o rechazado en Facturación, conservando el snapshot del mensaje y sus datos.

El aviso debe permanecer visible aunque falle el envío del email.

Respetar el aislamiento entre familias y utilizar el responsable económico asociado a la factura.

### 4. Importación y generación

- Preseleccionar automáticamente todas las facturas elegibles, permitiendo exclusiones manuales.
- Trabajar exclusivamente con archivos simulados por CBU.
- Exigir rendición completa del lote para confirmar.
- Conservar la revisión previa, historial y auditoría.
- Identificar claramente que se trata de una simulación, no de una integración bancaria real.

### 5. Garantías

- No duplicar pagos, eventos o notificaciones al importar nuevamente un archivo.
- No disparar los workflows antes de confirmar la importación.
- Un fallo de n8n no debe revertir pagos ni eliminar avisos.
- No afectar pagos manuales ni sus workflows existentes.
- Mantener trazabilidad de ejecución por evento y por regla.

### 6. Prueba integral

Preparar un escenario con tres facturas:

- Factura A: débito exitoso.
- Factura B: débito exitoso.
- Factura C: débito rechazado por fondos insuficientes.

Verificar:
1. Dos pagos registrados y una factura pendiente.
2. Tres eventos `debito.resultado_registrado`.
3. Ejecución de la condición correspondiente a cada evento.
4. Tres correos dirigidos a casillas de prueba.
5. Tres avisos visibles en Portal Familia.
6. Ninguna duplicación al reprocesar la rendición.
7. Registro de auditoría de los resultados y ejecuciones.

### 7. Entrega

Implementá los cambios mínimos necesarios y ejecutá pruebas unitarias y de integración.

Al finalizar, informame:
- Archivos modificados.
- Eventos, condiciones y acciones configurados.
- Pruebas ejecutadas y resultados.
- Cómo ejecutar la demo paso a paso.
- Limitaciones pendientes.

No realices push ni merge. No agregues integración real con Galicia ni refactorizaciones ajenas al objetivo.

Si aparece algún bloqueo arquitectónico, explicalo antes de introducir cambios importantes.

- L2 — Branch verified at baseline; pre-existing untracked `backend/venv` preserved. CodeGraph unavailable in this worktree; filesystem fallback. No remote instance, credentials or real mailbox inspection authorized.
- L3 — Baseline: 26 existing lot/import tests passed. Observed RED for incomplete rendition (`puede_confirmar` was true), unified result events (0 instead of 3), automatic selection (0 instead of 438), and portal snapshots (not rendered). GREEN observed for import tests (16), unified event replay test (1), selection hook tests (8), A/B/C success and n8n-failure integration (2), and portal component tests (18). Later manual-payment regression is included in the running domain suite.
- L4 — Implemented inline, no writer trigger: existing workflow tree supports both result branches in one rule. Existing notification snapshots are projected into family billing, with persisted invoice-family authorization and one portal notice per result across addresses/attempts. No new notification table or migration. Preserve the payment event and suppress only linked debit payments' family communication actions; manual payment actions remain unchanged.
- L5 — Source normalizers precede verification. Frontend dependency setup used `npm ci` without manifest/lock changes. Backend and frontend domain suites, lint and build delegated per-action; results pending. Email integration uses isolated capture, not a running n8n or real mailbox delivery.
- L6 — Full Engram mirror pending. Forecast now approximately 900 authored lines including tests/docs; delivery strategy remains ask-on-risk before any work-unit commit. No push, merge, or commit performed yet.
- L7 — Full mirror saved/read back as Engram #791. Domain checks: backend 719 passed and 4 stale assertions failed; frontend 396 passed and 5 stale assertions failed. Corrected the requested contract assertions, then observed 36 backend and 11 generation-page tests pass. Final frontend lint/build/format pass; UI detector returned no findings. Independent verification of S1-S7 and named high-risk items 2,3,4 is pending.
- L8 — 2026-11-18 user choice (verbatim): "Una entrega por excepción". One local delivery on the requested branch; no PR, push or merge. Approximately 960 authored lines excluding the tracker; exception accepted before any commit.
- L9 — Independent verifier found blocker B1: suppressing `pago.registrado` family notices on the mere existence of a result event lost the legacy notice when the result rule was inactive. Fixed by gating suppression on an active, applicable, non-deferred, non-approval action with the same destination and an unfailed result event. Added B1 and rollback regressions. Final observed checks: backend `tests/facturacion tests/workflows` 726 passed; frontend `src/modules/facturacion src/modules/workflows` 401 passed; frontend lint/build clean; backend Ruff clean; Prettier check clean; UI detector returned no findings. Frontend suite covers portal structured fields for invoice, amount, reason and code.
- L10 — Native review started with four lenses at tier medium. Both grouped collection attempts were refused by the OpenCode review transport with `opencode_review_transport_relay_refused (reason: provider_failed)`; STATUS still reoffers the same four bound reviewer slots. No PASS, receipt or approval is claimed. Retrying beyond the single reoffered attempt was stopped to avoid a blind loop.
- L11 — Commit local `e7a723c` contiene la entrega completa (T1-T3), sus pruebas y documentación. Sin push ni merge. El bloqueo de revisión nativa sigue abierto por fallo del transporte, no por un hallazgo del código.
