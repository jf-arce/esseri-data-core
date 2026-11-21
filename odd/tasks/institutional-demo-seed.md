# Institutional demo seed
Branch: `feat/institutional-demo-seed` · Delivery: `ask-on-risk` · Runner: backend pytest + isolated PostgreSQL
Objective: a reproducible school dataset and a live debit rehearsal without external side effects.

## Specs

- S1 — “Incluí datos históricos de 2025, el ciclo lectivo 2026 y reinscripciones para 2027 donde tenga sentido.” Populate supported domains with coherent relations and representative volume.
- S2 — “No alcanza con crear materias y docentes: verificá que las vistas realmente consuman y muestren esos datos.” Prove management, family and teacher calendar visibility through their real read paths.
- S3 — “Prepará los eventos, tipos de acciones, plantillas y datos necesarios, pero no dejes previamente creado el workflow específico que vamos a configurar en vivo.” Export November, generate a matching bank response, then validate actual financial, workflow, communication and audit effects, including reimport.
- S4 — “Prepará los usuarios y relaciones para que este escenario funcione, pero dejá la conversación nueva sin iniciar.” Identify approved, rejected and pending protagonists; verify chat and current agent capabilities without widening permissions.
- S5 — “No hagas cambios destructivos sobre datos existentes ni ejecutes nada en producción.” Provide repeatable seed and isolated reset, without external integrations during historical load.
- S6 — “No alcanza con verificar que los INSERT funcionaron.” Deliver commands, access, checklist, observed evidence, walkthrough and limitations.

## Tasks

- T1 · S1 S2 S4 S5 · inline, atomic dataset and isolation share one seam · implementation and independent guard proof observed · `7764e2a`
- T2 · S3 S4 · inline, export fixture uses T1's invoice names and existing production codec · API lifecycle and capture tested; family-to-administration chat is not implemented · `7764e2a`
- T3 · S2 S3 S4 S6 · inline, runbook and integration proof · calendar, teacher portal, management panels and debit candidates viewed in browser; bank lifecycle exercised via API · `7764e2a`

## Log

### L1 — Original request

```markdown
# ESSERI Data Core — Seed integral para demo final

Necesito que diseñes, implementes y valides una **seed institucional completa, robusta y realista para la demo final de ESSERI Data Core**.

Tenés acceso al repositorio completo y conocés su arquitectura, modelos, reglas de negocio y funcionalidades. Quiero que uses ese contexto para tomar las decisiones técnicas necesarias.

**No quiero solamente datos aleatorios para poblar tablas. Quiero simular un colegio real que lleva todo el ciclo lectivo funcionando, con información histórica, relaciones consistentes y procesos integrados.**

## 1. Objetivo general

Cuando ingresemos a cualquier módulo del sistema, tiene que haber información suficiente, coherente y representativa.

Esto incluye los paneles de Dirección y Administración, Portal Familia, Portal Docente, calendarios, comunicaciones, facturación, inscripciones, asistencias, compras, workflows, agente IA y auditoría.

La seed debe permitir navegar por el sistema sin encontrar pantallas vacías, siempre que el módulo esté implementado.

## 2. Cobertura funcional completa

Generá datos para todos los módulos existentes:

- Usuarios, roles, permisos y perfiles.
- Familias, responsables, alumnos, hermanos y relaciones familiares.
- Niveles educativos, años, divisiones, cursos y materias.
- Docentes y asignaciones a materias/divisiones.
- Horarios, clases, calendarios y eventos académicos e institucionales.
- Inscripciones vigentes, históricas, bajas y reinscripciones.
- Asistencias, ausencias, justificaciones y estadísticas.
- Facturas, conceptos, cuotas, matrículas, pagos, vencimientos, mora y cuentas corrientes.
- Débitos automáticos, adhesiones, lotes, exportaciones e importaciones.
- Proveedores, solicitudes y órdenes de compra.
- Comunicaciones institucionales, destinatarios, notificaciones y estados de lectura.
- Chats y conversaciones entre familias y administración.
- Workflows, reglas, eventos, ejecuciones y sus historiales.
- Datos necesarios para el agente de IA.
- Auditoría, historial de cambios y actividad del sistema.

Incluí datos históricos de 2025, el ciclo lectivo 2026 y reinscripciones para 2027 donde tenga sentido.

Usá como fecha de referencia noviembre de 2026, pero permití configurarla si es viable.

**Importante:** no generes entidades ficticias que el sistema no soporte. Inspeccioná primero los modelos, migraciones, servicios y funcionalidades reales, y adaptá la implementación.

## 3. Volumen de datos

Como referencia, busco aproximadamente:

- 250 alumnos.
- 180–250 responsables familiares, ajustados para garantizar relaciones familiares realistas.
- 25 docentes.
- Estructura académica completa de inicial, primaria y secundaria.
- Materias, divisiones y asignaciones suficientes para poblar calendarios.
- Historial de clases, eventos y asistencias.
- 1.000 facturas históricas.
- 750 pagos históricos.
- Comunicaciones institucionales de distintos tipos.
- Conversaciones históricas de chat.
- Workflows y registros de auditoría representativos.
- 15 proveedores y operaciones de compras.
- Un lote especial de 30 débitos para procesar durante la demo.

Las cantidades son orientativas. Priorizá consistencia, cobertura funcional y rendimiento por encima del volumen.

## 4. Calendarios y portales

Este punto es fundamental.

Necesitamos que estén completamente relacionadas las materias, los docentes, los cursos, los horarios y las actividades.

El calendario debe mostrar información coherente desde:

- Administración.
- Portal Familia, filtrado por los hijos correspondientes.
- Portal Docente, filtrado por sus asignaciones.

Incluí actividades pasadas, actuales y futuras, horarios semanales y eventos institucionales.

No alcanza con crear materias y docentes: verificá que las vistas realmente consuman y muestren esos datos.

## 5. Comunicaciones y chat

Generá comunicaciones institucionales históricas, por ejemplo:

- Reuniones de padres.
- Actos y eventos escolares.
- Avisos administrativos.
- Vencimientos de cuotas.
- Cambios de horarios.
- Comunicaciones por curso o división.
- Notificaciones financieras.

Respetá destinatarios, permisos, canales, estados y relaciones.

También generá conversaciones históricas representativas para que el chat no esté vacío.

Sin embargo, reservá una conversación especial para iniciarla en vivo durante la demo, relacionada con un débito rechazado.

## 6. Flujo principal de la demo

La seed debe preparar específicamente este recorrido:

**Paso 1 — Crear un workflow**

Durante la presentación vamos a crear un workflow que, a partir de los resultados de débitos automáticos, envíe comunicaciones a las familias.

Prepará los eventos, tipos de acciones, plantillas y datos necesarios, pero no dejes previamente creado el workflow específico que vamos a configurar en vivo.

**Paso 2 — Exportar débitos**

Vamos a exportar un lote de débitos pendientes correspondiente a noviembre de 2026.

Prepará las facturas, responsables, adhesiones y datos necesarios para que la exportación funcione realmente.

**Paso 3 — Importar resultados**

Necesitamos un archivo bancario de prueba compatible con el formato real del sistema y la exportación generada.

Proponé un lote de 30 operaciones:

- 20 aprobadas.
- 5 rechazadas por fondos insuficientes.
- 3 rechazadas por otros motivos válidos.
- 2 pendientes, si el formato y las reglas del sistema admiten ese estado.

Los resultados deben poder importarse utilizando el mecanismo existente.

**Paso 4 — Actualización financiera**

Después de importar, el sistema debe actualizar correctamente:

- Estado de débitos.
- Pagos.
- Facturas.
- Saldos pendientes.
- Cuentas corrientes.
- Indicadores y estadísticas.
- Eventos y ejecuciones de workflows.

No precargues esas consecuencias. Deben producirse realmente durante la importación.

**Paso 5 — Email y Portal Familia**

Elegí una familia protagonista cuyo débito será rechazado.

Queremos mostrar:

- El correo generado por el workflow.
- La comunicación desde el Portal Familia.
- La factura pendiente.
- La situación financiera actualizada.

Usá exclusivamente datos ficticios y casillas de prueba autorizadas.

**Paso 6 — Chat**

Ingresaremos al Portal Familia y consultaremos por el débito rechazado.

Después responderemos desde administración, demostrando el intercambio entre ambos perfiles.

Prepará los usuarios y relaciones para que este escenario funcione, pero dejá la conversación nueva sin iniciar.

**Paso 7 — Agente IA**

Vamos a consultar al agente sobre lo sucedido, por ejemplo:

- ¿Qué pasó con los débitos del último lote?
- ¿Cuántos fueron rechazados?
- ¿Cuáles fueron los principales motivos?
- ¿Qué familias mantienen deudas?
- ¿Qué pasó con el débito de la familia protagonista?
- ¿Qué comunicaciones se realizaron?

Verificá qué consultas puede responder actualmente el agente y qué herramientas o fuentes utiliza. No fabriques respuestas ni agregues accesos que violen permisos.

**Paso 8 — Auditoría**

Queremos cerrar mostrando la trazabilidad del proceso:

- Creación del workflow.
- Exportación e importación de débitos.
- Actualización de información financiera.
- Eventos generados.
- Ejecuciones automáticas.
- Comunicaciones.
- Interacciones del usuario que estén efectivamente auditadas.

La auditoría debe mostrar datos reales producidos por las operaciones, no historiales falsificados para el flujo ejecutado en vivo.

## 7. Familias protagonistas

Prepará al menos tres escenarios identificables y relacionados con todo el sistema:

1. Familia con débito aprobado y factura cancelada después de la importación.
2. Familia con débito rechazado, deuda pendiente, comunicación automática y posibilidad de iniciar un chat.
3. Familia con débito pendiente, sin registrar un pago ni comunicar un rechazo anticipadamente.

Agregá otros casos útiles: hermanos, múltiples responsables, deuda histórica con cuota actual pagada, pagos parciales y reinscripciones.

Documentá exactamente qué alumnos, responsables y usuarios se utilizarán en cada demostración.

## 8. Requisitos técnicos obligatorios

La implementación debe ser:

- **Idempotente:** ejecutar la seed nuevamente no debe duplicar registros.
- **Reproducible:** mismos datos y escenarios con una semilla fija.
- **Segura:** bloqueada en producción salvo un mecanismo explícito y controlado, sin alterar datos reales.
- **Consistente:** respetar FKs, constraints, estados y reglas de negocio.
- **Modular:** reutilizar infraestructura de seeds existente y respetar la arquitectura del proyecto.
- **Verificable:** incluir pruebas de integridad y funcionalidad.
- **Reiniciable:** poder restablecer el escenario de demo sin borrar información ajena.
- **Sin efectos externos accidentales:** no enviar emails reales, ejecutar acciones bancarias ni disparar integraciones externas durante la carga histórica.

El envío de correos del flujo en vivo deberá utilizar un entorno de prueba controlado y destinatarios autorizados.

No modifiques reglas de negocio simplemente para que la seed funcione. Si encontrás un problema real del sistema, identificalo y resolvelo por separado cuando sea necesario y seguro.

## 9. Validación integral

No alcanza con verificar que los INSERT funcionaron.

Comprobá mediante tests, endpoints y, cuando sea posible, pruebas E2E que:

- Los paneles muestran indicadores coherentes.
- Los filtros y listados devuelven los registros esperados.
- Las relaciones alumno–familia–inscripción son correctas.
- Los calendarios muestran materias, docentes y actividades.
- Cada portal respeta los permisos correspondientes.
- Las comunicaciones aparecen para sus destinatarios.
- El lote se exporta e importa correctamente.
- Los resultados financieros coinciden con los débitos procesados.
- El workflow se dispara una sola vez cuando corresponde.
- Reimportar el mismo archivo no duplica pagos ni comunicaciones.
- El chat funciona entre los perfiles previstos.
- El agente puede consultar información real dentro de sus permisos.
- La auditoría refleja los cambios y acciones correspondientes.

## 10. Entregables esperados

Quiero que avances con la implementación, no solamente con un análisis.

Al finalizar, entregá:

1. Seed completa integrada al repositorio.
2. Comandos para ejecutarla y reiniciar el escenario de demo.
3. Archivo de resultados bancarios de prueba compatible con el sistema.
4. Credenciales o mecanismo de acceso para cada perfil de demostración, sin exponer secretos reales.
5. Listado de familias y escenarios protagonistas.
6. Checklist de validación por módulo.
7. Resultados de las pruebas ejecutadas.
8. Guion técnico paso a paso para recorrer la demo.
9. Limitaciones, errores o funcionalidades pendientes identificadas.

**Priorizá una demo funcional y coherente de punta a punta.**

Inspeccioná todo el contexto necesario, planificá internamente el orden de implementación y avanzá con los cambios y las pruebas. Respetá `ARCHITECTURE.md`, `DESIGN.md`, `AGENTS.md` y las convenciones actuales del repositorio.

No hagas cambios destructivos sobre datos existentes ni ejecutes nada en producción.

La meta es que ESSERI se vea como una institución real en funcionamiento y que el flujo bancario demuestre la integración entre sus módulos, las automatizaciones, los portales, las comunicaciones, el agente y la auditoría.
```

- L2 — Base `a26a30c`, clean sibling worktree to preserve the original communications edits; no publishing. Forecast exceeds 400 authored lines, but no PR strategy selection is needed until publication is requested.
- L3 — Native response format allows terminal results only and requires the entire lot. Export 28 for rendition (20 approvals, 8 rejections) and reserve 2 in a separate unprocessed lot.
- L4 — PostgreSQL 16 provisioned from scratch: Alembic head and canonical catalogs; full seed followed by no-op; `250|1013|750|15|96|1` students, invoices, payments, vendors, suggestions and workflow executions. No original DB was used.
- L5 — Observed RED on missing cohort seed, finance seed, response generation and mail capture. The capture also reproduced a connection reset after a `403` header with no disclosed body length; explicit zero length fixed it. GREEN: 9 focused tests; 60 unchanged, related debit tests passed in the previous run on the same backend code. Existing HTTP tests require development cookies over their non-TLS test client. Ruff and diff checks passed.
- L6 — Real frontend against the seeded API rendered Bruno Acuña's classes and the Feria de ciencias for the week of 16 November. The in-memory SQLite browser harness crashed under concurrent requests; a temporary file-backed harness then rendered 3 assigned divisions and 50 students for Docente, both management dashboards, and 30 eligible November invoices in the debit UI. This was browser smoke coverage, not the full bank journey through UI gestures.
- L7 — Ran the documented `bank-response` command against a CBU CSV exported over the real HTTP API in the disposable harness. The file was accepted, confirmed with 20 payments, eight rejections and zero errors, and its reimport returned the same import ID.
- L8 — Independent verifier found no blockers. Added its CLI destination and capture probes; documented `NO_PROXY` and tested the real loopback transport with an HTTP proxy configured. Invalid capture startup leaves no output. Final focused suite: 13 passed; Ruff check and formatting passed. The browser smoke did not check font loading (the scratch frontend used symlinked dependencies).
- L9 — Work-unit commit `7764e2a` keeps the seed, capture, integration tests and runbook together as one runnable behavior. Risk: item 2 (DB isolation and notification guard). Native assessment returned `high`, `review_due=true`; local verification is independent of native review.
- L10 — Human granted the native review. Lineage `review-2da106aa173d3f84` froze four lens slots. The OpenCode reviewer relay refused `review-risk` twice with `opencode_review_transport_relay_refused (reason: provider_failed)` before any output; the agent config and model exist in the host. Recorded the exact slot as unachievable; Go stopped with `unachievable_lens_slot`. Not transient, so no withdraw and no new lineage. Native review is incomplete, not approved. Decision left to the human: retry the relay later, or disable reviews for this clone.
- L11 — The risk reviewer completed after the stop. Withdrew that declaration with the exact bound command, re-consulted STATUS, and captured all four lens results through `review capture-result --input`. Go approved lineage `review-2da106aa173d3f84`; the exact acknowledgement burned authority (`gentle-ai.review-acknowledged/v1`). Warnings only; no blockers.
- L12 — Closed concrete warnings in a follow-up commit: per-run disposable Postgres password in the guide, capture file removed when the bind fails, reference-date clamp so attendance and enrollment never precede the term, named payment/rejection constants, and SQLAlchemy errors reported as clean CLI refusals. Added tests for bind failure and the March boundary. 15 focused tests and the 60 debit regressions pass; this follow-up commit is outside the approved candidate `7764e2a`.
- L13 — Rebased the three commits onto `origin/main` (`37cfec9`, 64 commits ahead, no conflicts). Main now ships contextual family↔administration conversations (`conversacion_contextual`) and Assistant debit tools (`resumen_debitos`, `lotes_debito`, `facturas_para_debitar`). Added `seed_conversations`: three backdated historical threads on explained absences with audit rows, and no protagonist thread so the rejected-debit chat starts live. Updated the runbook step 6, step 7 and limitations. Focused suite still 15 passed; 75 passed including the 60 debit regressions.
