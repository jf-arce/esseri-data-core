# Contextual conversations
Branch: `feat/conversaciones-contextuales`, baseline `e1923f5` (`feat/paneles-rol`, required for Administration's existing justification permission).
Delivery: `ask-on-risk`; forecast over 400 authored lines. Runners: pytest, PostgreSQL, Vitest, Playwright.

## Specs

- S1: “La familia y Administración deben poder iniciar una conversación desde un trámite existente, siempre que tengan permisos.” “Débito rechazado: la familia puede consultar sobre el rechazo y Administración puede responder.” “Justificación presentada: la familia puede iniciar una consulta o Administración puede solicitar aclaraciones.” “Nunca permitir conversaciones sin un trámite concreto.” “Mantener una única conversación por registro, reutilizable mediante reapertura.”
- S2: “Quiero que la funcionalidad contemple ambos escenarios cuando exista una entidad persistente adecuada para vincular la conversación. Si requieren modelos o políticas diferentes, proponé e implementá la solución de menor impacto, sin duplicar hilos ni modificar las reglas de justificación.”
- S3: “Conversaciones asociadas al trámite.” “Mensajes bidireccionales persistentes.” “Estados y reapertura de conversaciones.” “Auditoría y permisos estrictos.”
- S4: “Integración con Portal Familia.” “Integración con las vistas administrativas correspondientes.” “Bandeja administrativa de conversaciones pendientes.”
- S5: “Adjuntos privados con autorización.” “Todos los permisos deben validarse en backend, incluyendo la descarga de archivos y el envío de avisos.”
- S6: “Notificaciones mediante los mecanismos existentes.” “Mantener el comportamiento actual de notificaciones de ausencia y facturación.”
- S7: “Las conversaciones no deben modificar el estado de los pagos ni de las justificaciones.” “Respetar los vínculos familiares y evitar que una familia vea conversaciones de otra, aunque compartan alumno.”
- S8: “No implementar chat general, WebSockets, SLA, asignación de agentes, prioridades ni IA.” “No hagas rediseños generales ni refactorizaciones ajenas a esta funcionalidad.”

## Tasks

- [x] T1 · S1–S3, S7–S8 · inline, dependent core · model, API, permissions, migration and tests · `fcda116`; Risk: items 2 and 4 (family isolation and serialized thread mutations)
- [x] T2 · S4, S7–S8 · inline, depends on T1 · family and Administration surfaces · `c724f24`
- [x] T3 · S5, S7–S8 · inline, follows T2 · private attachments · `3d7ac66`, independent verification passed · Risk: item 2 (private-file authorization)
- [ ] T4 · S5–S8 · inline, follows T3 · notifications · `ab9987d`, independent verification pending · Risk: items 2 and 3 (email boundary and shared transport)
- [x] T5 · S1–S8 · inline, depends on prior tasks · integration and regression · `6dee77b`; date-dependent academic concurrency tests excluded as pre-existing (see log)

## Log

### L1

El análisis está aprobado en términos generales. Quiero avanzar con la implementación de conversaciones contextuales, respetando la arquitectura propuesta y las convenciones del repositorio.

Antes de implementar, incorporá estos ajustes:

**1. Inicio de conversaciones**

La familia y Administración deben poder iniciar una conversación desde un trámite existente, siempre que tengan permisos.

- Débito rechazado: la familia puede consultar sobre el rechazo y Administración puede responder.
- Justificación presentada: la familia puede iniciar una consulta o Administración puede solicitar aclaraciones.
- Nunca permitir conversaciones sin un trámite concreto.
- Mantener una única conversación por registro, reutilizable mediante reapertura.

**2. Justificaciones por períodos**

Revisá cómo se representan actualmente las justificaciones individuales y las solicitudes que cubren rangos de fechas.

Quiero que la funcionalidad contemple ambos escenarios cuando exista una entidad persistente adecuada para vincular la conversación. Si requieren modelos o políticas diferentes, proponé e implementá la solución de menor impacto, sin duplicar hilos ni modificar las reglas de justificación.

**3. Alcance funcional**

Implementar:
- Conversaciones asociadas al trámite.
- Mensajes bidireccionales persistentes.
- Adjuntos privados con autorización.
- Estados y reapertura de conversaciones.
- Notificaciones mediante los mecanismos existentes.
- Integración con Portal Familia.
- Integración con las vistas administrativas correspondientes.
- Bandeja administrativa de conversaciones pendientes.
- Auditoría y permisos estrictos.

No implementar chat general, WebSockets, SLA, asignación de agentes, prioridades ni IA.

**4. Integridad y seguridad**

Las conversaciones no deben modificar el estado de los pagos ni de las justificaciones. Todos los permisos deben validarse en backend, incluyendo la descarga de archivos y el envío de avisos.

Respetar los vínculos familiares y evitar que una familia vea conversaciones de otra, aunque compartan alumno.

Mantener el comportamiento actual de notificaciones de ausencia y facturación.

**5. Implementación**

Trabajá incrementalmente, siguiendo el plan propuesto:

- Primero, modelo de datos, endpoints, permisos y pruebas.
- Después, Portal Familia y Administración.
- Luego, adjuntos y notificaciones.
- Finalmente, pruebas de integración y regresión.

Trabajá sobre la rama correcta del repositorio, verificando primero el estado actual y evitando sobrescribir cambios existentes.

Respetá estrictamente `ARCHITECTURE.md`, `DESIGN.md` y `AGENTS.md`.

No hagas rediseños generales ni refactorizaciones ajenas a esta funcionalidad.

Al finalizar, entregá un resumen de los cambios, archivos modificados, migraciones, pruebas ejecutadas, resultados y cualquier limitación pendiente.

Si encontrás un impedimento arquitectónico o de negocio importante, documentalo antes de continuar con una solución que pueda comprometer los datos o las reglas actuales.

### L2

- The ranges have a first-class `solicitud_ausencia_periodo` identity. Anchor one thread to the range, not one per covered attendance row.
- `main` still grants the typed justification permission to Dirección. The selected base already grants it to Administración; do not introduce an alternate access path or roll the unrelated panel branch into this unit.
- Both authorized sides can open a thread for an eligible record; the debit flow specifically supports a family inquiry and an administrative reply.
- RED: both period API probes returned 404 instead of 200 on the base routes.
- Alembic autogenerate against an isolated PostgreSQL 16 database detected only the two new tables and their indexes.
- GREEN: five focused PostgreSQL tests passed (including concurrent opens); Communications suite: 95 passed, 2 skipped. Ruff check and format check passed; Alembic upgrade and `alembic check` passed on the isolated database.
- Independent verification found no blockers (13 additional probes). Retained API permission, pagination, replay and storage constraints in the regression suite; seven focused PostgreSQL tests pass after readback. The core commit exceeds the slice heuristic because the tested API, permission policy and migration form one usable unit.
- Native review granted for lineage `review-56db7acff637ec39`, but remains pending: this runtime only exposes background delegation, not the required foreground group with provider capture. Independent verification passed; no review receipt claimed.
- T2: RED missing detail page and missing `debito_id`; GREEN 426 frontend tests, frontend TypeScript and lint, 13 billing API tests. Existing staff lot read already exposes the debit ID as `referencia`.
- T3: RED multipart route missing; GREEN 20 backend probes, 70 frontend tests, TypeScript and lint, both Alembic schema checks. Fail closed if the existing Communications scanner cannot validate a file; no mutation or quarantine row is left by the send.
- T4: RED no inbox entry for the first administrative message; GREEN 89 passed and 6 skipped across conversation, inbox and existing correlated email tests; 111 frontend tests, TypeScript and lint. Reuse `EnvioNotificacion` with mutually exclusive origin foreign keys instead of editable workflow rules or one-way publications; no new n8n workflow or infrastructure. Delivery transport was stubbed in automated tests, with current family linkage rechecked before dispatch and before the provider claim.
- T5 browser: one Chromium test passed against an isolated seeded PostgreSQL, real FastAPI and Vite. Family used the existing period-request detail, Administration used the pending queue, Family followed the new bell destination; resolving/reopening preserved the request state. Dedicated preview is loopback only (`127.0.0.1:5187`/`:8187`), scheduler and email transport disabled.
- Independent T3 verification found no blocker: 20 focused tests, 8 additional probes, baseline-compatible publication download headers. Retained byte-mismatch replay regression; contextual downloads preserve the already authorized attachment name.
- Chromium also displayed and opened the exact rejected debit's conversation composer in the seeded preview. No message was sent in that smoke check.
- T5: E2E passed twice in sequence (`--repeat-each=2`). Frontend: 1320 tests, lint and production build passed; backend focused slices passed; full backend suite run excluding `tests/academico/test_solicitud_periodo_concurrencia_postgres.py` (see next line).
- Pre-existing, not caused by this branch: those seven academic concurrency tests hardcode 2027 dates while `solicitud_periodo_service` rejects years after the current one; identical code exists at the base commit.
- Full backend suite (excluding that file): 2124 passed, 41 skipped, 5 errors. All five errors are `infra/tests/test_railway_proxy.py` requiring a local Nginx binary (`NGINX_BINARY`), which this environment lacks; no infra file changed.
- Advisory not fixed (pre-existing shared helper): `frontend/src/lib/descargar-export.ts` reads only the ASCII `filename=` header, so other exports may fall back to a generic name. Contextual attachments now save under their already-authorized stored name.
- Preview: `esseri_preview` database in the disposable container, loopback Vite/FastAPI only, schedulers and email transport off. Not a production configuration.
