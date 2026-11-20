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
- [ ] T2 · S4, S7–S8 · inline, depends on T1 · family and Administration surfaces
- [ ] T3 · S5, S7–S8 · inline, follows T2 · private attachments
- [ ] T4 · S5–S8 · inline, follows T3 · notifications
- [ ] T5 · S1–S8 · inline, depends on prior tasks · integration and regression

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
