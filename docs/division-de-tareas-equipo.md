# División de tareas - ESSERI Data Core

Este documento reparte los 10 módulos del sistema entre los 4 integrantes, con el detalle de qué tiene que hacer cada uno (backend, frontend, dependencias con otros módulos) y en qué orden conviene arrancar para minimizar tiempos muertos.

---

## Resumen de asignación

> **Repacto por el alcance nuevo confirmado por el cliente** (19 cambios sobre Revisión Maestra + Aclaraciones del Cliente, ver `docs/aclaraciones-cliente-esseri.md`). Los módulos no cambian de dueño, pero tres de los cuatro roles ganan alcance sustancial: Arce pasa de un motor de 3 tipos de acción a uno de 15, Carreon suma el pipeline completo de Admisiones y la cuenta corriente, Botteri suma el ciclo de justificación de ausencias. Es la razón del recorte al 1er Informe que sigue más abajo.

| Dev | Módulos |
|---|---|
| **Arce** | Auth (Autenticación y Roles, ahora con OAuth Google + 10 roles) + Workflows y Notificaciones (motor de 15 tipos de acción + Tareas/escalamiento) |
| **Botteri** | Familias y Alumnos + Académico (con justificación de ausencias) + Auditoría y Trazabilidad (`AUDIT_LOG` + `EVENT_LOG`) |
| **Carreon** | Admisiones e Inscripciones (pipeline de 7 etapas, nuevo) + Facturación y Cobranza (con cuenta corriente y penalidades) + Panel Administrativo |
| **Canu** | Proveedores y Compras (con catálogo de productos/servicios) + IA/Sugerencias |


## Roadmap por entregas

Estas son las **entregas reales de la cátedra** (Guía de TP 2026, actividades 10, 11, 12 y 13) — no un invento interno. Es lo que se muestra a los profesores en cada corte.

| Entrega | Tope de entrega | Tope de aprobación | Qué se muestra |
|---|---|---|---|
| **1° Informe de Avance** | 8/9/26 | 15/9/26 | Estado de avance + Técnica del Valor Ganado |
| **2° Informe de Avance** | 6/10/26 | 13/10/26 | Ídem, + acumulado |
| **3° Informe de Avance** | 10/11/26 | 17/11/26 | Ídem, **con público invitado** — demo real funcionando, incluye el HITO de entrega del proyecto terminado (17/11) |

**Se sacó "Entrega Final" como milestone aparte** — casi todas sus tareas (documentación, manuales) ocurren temporalmente dentro del período del 3er Informe según el cronograma real, así que viven ahí directamente en vez de en un cuarto milestone casi vacío. El único hito real de cierre (17/11) queda como el cierre del 3er Informe, no un corte separado.

### Antes de la 1° entrega — modelado inicial de la base de datos
Se modelan **las tablas de los 10 módulos de una sola vez** (referencia actual: ~54, ver `database/schema/DER-Esseri.drawio` — no es una meta de diseño, recalcular sobre el DER vigente), en conjunto — no CRUD, no lógica de negocio, solo tablas, relaciones (FKs) y migraciones de Alembic. Es trabajo compartido de todo el equipo, tal como lo pide el EDT 1.3 ("Modelo de base de datos en PostgreSQL"). Con esto migrado desde el día 1, nadie depende del modelo de datos de otro módulo para escribir su propio CRUD.

**Modelo v1.0 ya está congelado** (ver banner en `docs/diccionario-de-datos-esseri.md`): `requiere_aprobacion_humana` decidido por acción (pregunta #15) y vistas del MVP con dueño confirmado (tabla más abajo). Recién a partir de acá se puede generar la migración inicial — es la única ventana del proyecto con cero costo de refactor.

### Qué RF corresponde a cada entrega (según el cronograma real, EDT 1.4)

**Para el 1er Informe de Avance (08/09):**

> **Recorte respecto del roadmap anterior:** el pipeline de Admisiones (cambio 6) se mueve al 2do Informe — es alcance nuevo sin RF asociado, no debería competir por tiempo con las ~20 tareas que ya tiene este período. `EVENT_LOG`/`emit_event()` (cambio 1) se mantiene acá porque Botteri, Carreon y Canu lo necesitan desde el día uno para emitir eventos de negocio.

| RF | Tarea | Dev |
|---|---|---|
| RF-27 | Login vía Google Identity/OAuth + JWT interno (cambio 2 — zona sensible `src/auth/`, modo plan) | Arce |
| RF-28, 29, 30 | ABM de roles (10 valores, cambio 18) y permisos (con `tipo_informacion`) | Arce |
| RNF-10 | Registro y auditoría de accesos | Arce |
| — | `EVENT_LOG` (eventos de negocio, transversal) + helper `emit_event()`; `log_audit()`/`AUDIT_LOG` (ex `EVENT_LOG`) (cambio 1) | Arce |
| RF-19 | ABM de proveedores | Canu |
| RF-31 | Panel de Dirección con indicadores | Carreon |
| RF-01 | ABM de familias | Botteri |
| RF-32 | Panel Administrativo | Carreon |
| RF-03 | ABM de alumnos y vinculación con familias (`FAMILIA_ALUMNO.recibe_comunicaciones`, cambio 5) | Botteri |
| — | Integración OpenAI para comunicaciones | Canu |
| RF-02 | Búsqueda y filtros de familias/alumnos | Botteri |
| RF-13, RF-14 | Historial de cambios de entidades críticas (contra `AUDIT_LOG`) | Botteri |
| — | Detección de patrones de morosidad/inasistencias | Canu |
| RF-07 | ABM de niveles, años y divisiones | Botteri |
| RF-08 | ABM de materias (con `division_id` nullable por orientación, cambio 16) | Botteri |
| RF-09 | Asignación de docentes | Botteri |
| RF-04 | Registro de asistencia diaria — presente/ausente/**tardanza**, `ausente_pendiente` (cambio 5) | Botteri |
| RF-05, RF-06 | Historial y % de presencia | Botteri |
| RF-37 | Exportación del historial de asistencias | Botteri |
| RF-10 | Inscripción de nuevos alumnos | Carreon |
| RF-11 | Reinscripción por ciclo lectivo | Carreon |
| RF-12 | Cambio de matrícula y baja | Carreon |

Con esto, **7 de los 10 módulos quedan sustancialmente completos ya en el 1er Informe** — Auth (ahora con OAuth y 10 roles), Familias y Alumnos, Académico, Inscripciones (el tramo ya modelado, sin Admisiones todavía), Proveedores (ABM), Panel Admin (completo) e IA (completo). Facturación, Workflows y el pipeline de Admisiones quedan para después.

*Nota: la última tarea de este grupo (RF-12, cambio de matrícula) termina el 9/9, un día después del tope de entrega oficial (8/9) — igual de justo que en el 3er Informe. Vale la pena adelantar un par de días también acá si pueden.*

**Para el 2do Informe de Avance (06/10):**

> **Es el informe que más creció con las aclaraciones del cliente.** Carreon suma de punto el pipeline completo de Admisiones (7 etapas confirmadas) y toda la cuenta corriente; Arce arranca el motor de 15 tipos de acción en vez de esperar a noviembre.

| RF / Cambio | Tarea | Dev |
|---|---|---|
| — (cambio 6) | Pipeline de Admisiones: `SOLICITUD_INSCRIPCION` + `ETAPA_SOLICITUD` + `DOCUMENTO_SOLICITUD`, 7 etapas confirmadas con historial | Carreon |
| RF-33 | Búsqueda y filtros de inscripciones | Carreon |
| RF-15 | Generación de facturas | Carreon |
| — (cambio 8) | `RESPONSABLE_ECONOMICO` con vigencia temporal | Carreon |
| — (cambio 12) | Catálogo `CONCEPTO_COBRO` (10 conceptos confirmados) — reemplaza `DETALLE_FACTURA.tipo` | Carreon |
| — (cambio 13) | Motor de penalidades por tramos (`REGLA_PENALIDAD`, `EXCEPCION_VENCIMIENTO`) | Carreon |
| — (cambio 14) | `CUENTA_CORRIENTE`/`MOVIMIENTO` — libro inmutable, saldo siempre calculado, nunca persistido | Carreon |
| RF-16 | Registro de pagos, con `PAGO.estado`/`referencia_transaccion` (cambio 15) | Carreon |
| RF-17 | Panel de deuda por familia — ahora derivado de `CUENTA_CORRIENTE`, no de `FAMILIA.estado_deuda` | Carreon |
| RF-18 | Alertas automáticas de morosidad (`aplicar_vencimiento`/`aplicar_penalidad`) | Carreon + Arce |
| RF-36 | Exportación de deudas/cobranzas CSV/Excel | Carreon |
| RF-20 | Solicitudes internas de compra, con referencia a `PRODUCTO_SERVICIO` (cambio 7) | Canu |
| RF-21 | Generación de órdenes de compra (con `ORDEN_COMPRA_DETALLE`) | Canu |
| — (cambio 17) | Recepción de compras completa: `RECEPCION_COMPRA` + `RECEPCION_COMPRA_DETALLE`, con pendientes automáticos ante recepción parcial | Canu |
| RF-34, RF-35 | Búsqueda de proveedores y órdenes | Canu |
| RF-38 | Exportación proveedores/órdenes CSV/Excel | Canu |
| RF-13, RF-14 | Verificación de registro de auditoría en todos los módulos (refuerzo, contra `AUDIT_LOG`) | Botteri |
| — (cambio 10) | Motor de acciones — arranque de los 15 tipos con `accion_config` + allowlist + `requiere_aprobacion_humana` | Arce |

Facturación y Proveedores quedan completos acá — con bastante más alcance del que tenían en el roadmap anterior.

**Para que nadie quede sin tarea en este período:**
- **Botteri** solo tiene la verificación de auditoría (liviana) en este período, con margen libre. Puede sumar: reforzar tests de Familias/Académico, avanzar el ciclo de justificación de ausencias (cambio 5, ver 3er Informe) antes de tiempo si le sobra margen, o ayudar a Carreon con el frontend de Facturación.

*Nota: la última tarea de este grupo (RF-38, exportación de proveedores) termina el 9/10 — tres días después del tope de entrega oficial (6/10). Mismo patrón que en las otras dos entregas: el cronograma corre justo, sin margen. Con el pipeline de Admisiones y la cuenta corriente sumados a este período, conviene que Carreon arranque este bloque apenas cierre el 1er Informe, no esperar al 06/10 nominal.*

**Para el 3er Informe de Avance (10/11, con público):**

| RF / Cambio | Tarea | Dev |
|---|---|---|
| RF-22 | Configuración de reglas de workflow — de 2 a **15 tipos de acción** (cambio 10), con `accion_config` validado contra allowlist | Arce |
| RF-23 | Historial de ejecuciones de workflows, trazable con reintentos (`WORKFLOW_EXECUTION.event_log_id`/`intento`/`error_detail`, cambio 3) | Arce |
| RF-24 | Envío automático de notificaciones por email | Arce |
| RF-25 | Configuración de plantillas y destinatarios (`REGLA_DESTINATARIO`, rol o usuario puntual — cambio 19a) | Arce |
| RF-26 | Log de notificaciones enviadas, con snapshot inmutable y destinatario genérico familia/usuario (cambio 4/19a) | Arce |
| — (cambio 19b) | `TAREA` + cadena de escalamiento (`crear_tarea`/`escalar_caso`) | Arce |
| — (cambio 5) | Ciclo completo de justificación de ausencias: `JUSTIFICACION_INASISTENCIA` + `MOTIVO_JUSTIFICACION`, notificación a todos los responsables habilitados | Botteri |

**Todo Workflows queda para esta entrega** — es intencional: recién acá hay datos reales de Facturación (2do Informe) contra los cuales probar triggers de verdad. Coincide justo con que esta entrega tiene demo en vivo con público — necesitan el flujo completo funcionando, ahora con tres loops en vez de uno (ver más abajo).

**Corrección al cronograma original (movimiento, no compresión):** el cronograma original agendaba `RF-13`/`RF-14` "refuerzo" y `RF-37` para el 9-18/11, recién después de terminar Workflows.

- **`RF-37` (exportación de asistencias) se puede mover ya al bloque del 1er Informe** — Asistencia está lista desde agosto, no depende de nada posterior.
- **`RF-13`/`RF-14` "refuerzo" probablemente sea una verificación de que todos los módulos escriben correctamente en `AUDIT_LOG`** (no desarrollo nuevo — cada módulo ya llama al helper `log_audit()` compartido desde que se escribe, según quedó definido en `ARCHITECTURE.md`). No hace falta esperar a que Workflows termine para verificar esto, alcanza con que Facturación (2do Informe) ya esté generando datos — así que se mueve a **principios de octubre**, apenas cierre el 2do Informe, en vez de a mitad de noviembre.

Con estos dos movimientos — sin comprimir nada, sin trabajar más rápido de lo planificado — la última tarea real del proyecto en el bloque de Workflows pasa de terminar el 18/11 a terminar antes del cierre — el margen real se recalcula con el alcance nuevo (13 tipos de acción más que el roadmap anterior), así que conviene tratar el 3/11 como piso optimista, no como fecha fija.

**Objetivo interno resultante — ajustado por disponibilidad real, no solo por dependencias técnicas:** septiembre **y** octubre son los meses de mayor disponibilidad del equipo — la baja arranca recién a **fines** de octubre, por parciales de otras materias. Conviene aprovechar todo ese margen, no solo septiembre:

- **Setiembre y octubre**: ventana de máxima disponibilidad — usarla para adelantar Workflows todo lo posible (no solo arrancar el scaffolding en septiembre, seguir avanzando en octubre las reglas concretas que no dependen de datos reales de Facturación, como la allowlist de las 15 acciones y `requiere_aprobacion_humana` por acción — preguntas #15/#16, decisión de equipo que conviene cerrar temprano).
- **Código funcional completo antes de fines de octubre** (objetivo ideal: última semana de octubre, no el 3/11) — mientras el equipo todavía tiene disponibilidad completa.
- **Los últimos días de octubre en adelante se reservan para testing y ajustes menores**, que exigen menos disponibilidad sostenida que construir features nuevas — es trabajo que se puede hacer en ratos sueltos entre exámenes, a diferencia de programar un módulo entero.
- **Semana del 10/11**: ensayo de la demo, últimos ajustes, entrega oficial.
- **10/11 al 17/11**: colchón real de aprobación del tutor, no trabajo pendiente.

**No tengo la fecha exacta de sus parciales** (varía según qué otras materias estén cursando cada uno) — conviene que el equipo confirme esas fechas puntuales y ajuste el corte de "código completo" en consecuencia, en vez de dejarlo en una fecha genérica.

**Recordatorio: en cada uno de los 3 Informes de Avance, los 4 tienen que tener tarea real asignada** — no solo quien tiene un RF numerado en esa entrega puntual. Ya quedó resuelto arriba en cada bloque (Arce arranca Workflows en paralelo durante el período del 2do Informe en vez de esperar a octubre; Carreon, Botteri y Canu se suman al testing de integración durante el período del 3er Informe en vez de quedar libres una vez que cierran sus propios RF) — el criterio se mantiene igual sin importar cómo se ajusten las fechas exactas por disponibilidad.

**Para que nadie quede sin tarea en este período:** acá el desequilibrio es al revés — Carreon y Canu ya no tienen RF propios pendientes; Arce sigue construyendo Workflows y Botteri suma el ciclo de justificación de ausencias (ver tabla arriba). En vez de quedar libres, Carreon y Canu se suman al testing de integración de los **tres loops closed-loop** (4/11 al 9/11): cada uno prueba que su propio módulo dispare bien los eventos que Workflows necesita —

- **Loop A (Admisión)**, Carreon + Arce: `SOLICITUD_INSCRIPCION` aprobada → crear alumno/familia → `RESPONSABLE_ECONOMICO` → `INSCRIPCION` → cargo de matrícula → pago → confirmación → bienvenida.
- **Loop B (Inasistencia)**, Botteri + Arce: `ausente_pendiente` → notificación a responsables habilitados → `JUSTIFICACION_INASISTENCIA` → revisión → `ausente_justificado`/`ausente_injustificado`.
- **Loop C (Mora)**, Carreon + Arce: `factura.vencida` → `aplicar_penalidad` según tramo → `MOVIMIENTO` en `CUENTA_CORRIENTE` → alerta + notificación → pago o rechazo.

Es trabajo real de EDT 1.5, no relleno — y es lo que se muestra en la demo con público del 3er Informe.

Adelantarse al cronograma no requiere Solicitud de Cambio (044) — esa plantilla es para atrasos, no para terminar antes.

**Tareas de cierre (sin RF), van también al milestone "3er Informe de Avance":**

| Tarea (sin RF) | Fechas del cronograma | Dev sugerido* |
|---|---|---|
| Documentación de arquitectura, APIs y modelo de datos | 28-30/10 | — |
| Manual de usuario, perfil Dirección y Administración | 2-4/11 | — |
| Manual de instalación y configuración del sistema | 5-6/11 | — |
| Manual de usuario, perfil Docentes y Familias | 9-10/11 | — |
| Consolidación del código fuente final en el repositorio | 13/11 | — |
| **HITO** — Entrega del proyecto terminado | 17/11 | — |

*El cronograma original asigna estas tareas a un rol "Analista Funcional" y "DevOps" que no existen como tales en la división actual del equipo — falta decidir quién las toma, igual que quedó pendiente con los RNF sin dueño.

### Vistas del MVP por perfil — asignación explícita

Antes del alcance nuevo, estas vistas no tenían dueño formal en ningún documento. **Confirmada por el equipo** — cierra el criterio "cada vista del MVP tiene responsable" de Modelo v1.0.

| Vista | Contenido mínimo | Dueño propuesto |
|---|---|---|
| Docente → Inicio / Mis grupos | Grupos asignados, acceso rápido a asistencia | Botteri |
| Docente → Tomar asistencia | Presente/ausente/tardanza, justificación solo informativa (el docente no decide la justificación) | Botteri |
| Familia → Inicio | Hijos, comunicaciones, estado de cuenta, justificaciones pendientes | Botteri (combina 3 módulos → vive en `src/pages/`, no en `modules/<modulo>/pages/`) |
| Familia → Justificar ausencia | Motivo del catálogo (`MOTIVO_JUSTIFICACION`), adjunto, estado de revisión | Botteri |
| Familia → Facturación | Facturas, extracto de cuenta corriente, pagos, comprobantes | Carreon |
| Admisiones e Inscripciones | Pipeline de 7 etapas con historial, documentación/contrato | Carreon |
| Workflows y Tareas | Reglas, historial de ejecuciones, bandeja de tareas y escalamiento | Arce |

---

## Arce — Auth + Workflows y Notificaciones

> **Es, con diferencia, el rol más cargado tras las aclaraciones del cliente** — el motor pasa de 3 tipos de acción a 15, y se suma OAuth + 10 roles al ya exigente RF-27. 

### Auth (Autenticación y Roles)
**RF cubiertos:** RF-27, RF-28, RF-29, RF-30 · RNF-03, RNF-10

**Backend (`src/auth/` — zona sensible, `AGENTS.md`/`CLAUDE.md`: cambios ahí en modo plan):**
- Login vía **Google Identity/OAuth**: el backend valida la identidad y emite el JWT interno (RF-27, cambio 2). El JWT no se va — sigue protegiendo endpoints y sesiones igual que antes. `USUARIO.password_hash` pasa a nullable (fallback explícito), `+auth_provider`/`+provider_subject`.
- ABM de `Rol` (**10 valores**, cambio 18: dirección, administración, docente, familia, secretaría, coordinación académica, bienestar/orientación, admisiones/comercial, compras, administrador del sistema) y `Permiso` (**+`tipo_informacion`**, acota el permiso a un subtipo de dato sensible).
- Asignar/modificar rol de un usuario (`USUARIO_ROL`) (RF-29). Un usuario puede tener más de un rol simultáneo (ej. docente que también es familia) — confirmado por el cliente (respuesta 17): una única identidad por persona, no cuentas duplicadas por rol.
- Middleware/dependency de autorización que restrinja acciones según rol, denegando lo no permitido (RF-30).
- Registrar en `.env.example` (backend y frontend) las variables nuevas de Google Cloud/Workspace, y anotar la dependencia de infraestructura externa en el Plan de Gestión de Riesgos.

**Frontend (`modules/auth/`):**
- Pantalla de login con botón de Google (Google Identity Services).
- ABM de roles y permisos (vista de administración) — la matriz rol×permiso crece proporcionalmente con 10 roles en vez de 4.
- Selector de rol(es) por usuario.

**Resuelto (decisión de equipo, Pregunta #4 del diccionario de datos):** si un usuario tiene varios roles con permisos conflictivos en un mismo módulo, **gana el permiso más permisivo** — si cualquiera de sus roles habilita la acción, se permite.

---

### Workflows y Notificaciones
**RF cubiertos:** RF-22, RF-23, RF-24, RF-25, RF-26

**Backend (`src/workflows/`):**
- CRUD de `WORKFLOW_RULE` (evento disparador, condición en JSON, `tipo_accion`, `accion_config`, `criticidad`, `requiere_aprobacion_humana`).
- Motor de ejecución — **15 tipos de acción** (cambio 10, ver enum completo en el diccionario), no solo notificar/alerta_interna: `cambiar_estado`, `crear_tarea`, `generar_cargo`, `aplicar_vencimiento`, `aplicar_penalidad`, `registrar_pago`, `registrar_rechazo`, `actualizar_cuenta_corriente`, `generar_recordatorio`, `escalar_caso`, `crear_registro_relacionado`, `generar_orden_compra`, `generar_comunicacion`, además de los 2 que ya existían.
- **La allowlist es la pieza de seguridad central de este módulo**: el backend valida `accion_config` contra una lista cerrada de entidades/campos/estados permitidos antes de ejecutar — el motor no puede escribir arbitrariamente sobre cualquier tabla. Acciones sensibles (disciplinarias, legales, excepciones económicas) quedan con `requiere_aprobacion_humana = true`.
- `EVENT_LOG` (nuevo, append-only, transversal en `src/models.py`) + helper `emit_event()` — infraestructura que el resto del equipo necesita desde el 1er Informe. No confundir con `AUDIT_LOG` (ex `EVENT_LOG`, de Botteri).
- `WORKFLOW_EXECUTION` trazable: referencia el `EVENT_LOG` que la disparó, número de intento, `started_at`/`finished_at`, `error_detail` (RF-22, RF-23).
- Integración con n8n vía webhook genérico para el envío real de emails (Gmail/Google Workspace) — el backend resuelve destinatario y contenido antes de llamarlo. n8n **no** reemplaza al `EVENT_LOG` ni al motor.
- `NOTIFICACION` con destinatario genérico (`destinatario_tipo`: familia o usuario interno) y snapshot inmutable (`destinatario_snapshot`/`asunto_snapshot`/`cuerpo_snapshot`) — la evidencia histórica no cambia si después se edita la plantilla o el email de la familia (RF-26).
- CRUD de `NOTIFICACION_TEMPLATE` (plantillas con placeholders tipo `{{nombre_familia}}`).
- `TAREA` + cadena de escalamiento (`escalada_de_tarea_id`), cubre `crear_tarea`/`escalar_caso`.
- `REGLA_DESTINATARIO`: una regla puede avisar a un rol completo, a un usuario puntual, o a ambos.

**Reglas concretas mínimas a implementar y probar** (arrancar por estas, ampliar con las de Carreon/Botteri en 2do/3er Informe):
1. `factura.vencida` → `aplicar_vencimiento` + `alerta_interna` (cubre RF-18, morosidad).
2. `factura.vencida` → `notificar` (email a la familia).
3. `inasistencia.registrada` → `notificar` a todos los responsables habilitados.
4. `inscripcion.cambio_matricula` → `notificar`.
5. `solicitud_inscripcion.aprobada` → `crear_registro_relacionado` (dispara el Loop A completo).

**Frontend (`modules/workflows/`):**
- ABM de reglas de workflow (selector de evento, editor de condición, editor de plantilla con chips insertables de `CAMPO_EVENTO`, selector de criticidad y aprobación humana).
- Historial de ejecuciones (RF-23), con filtro por estado.
- Bandeja de tareas y escalamiento.

**Resuelto (decisión de equipo, Pregunta #15):** `requiere_aprobacion_humana = true` por defecto en las acciones que mueven dinero o escalan un caso — `generar_cargo`, `aplicar_penalidad`, `registrar_pago`, `registrar_rechazo`, `escalar_caso`, `generar_orden_compra`. El resto arranca automático. Es un valor inicial, ajustable por regla una vez que el motor esté corriendo.

**Sigue pendiente (Pregunta #16, no bloquea arrancar el módulo):** la especificación campo por campo de la allowlist de `accion_config` — qué entidad/campo puede tocar cada una de las 15 acciones. Arce la define a medida que implementa cada tipo de acción.

---

## Botteri — Familias y Alumnos + Académico + Auditoría

### Familias y Alumnos
**RF cubiertos:** RF-01, RF-02 (parcial), RF-03, RF-13, RF-14

**Backend (`src/familias_alumnos/`):**
- ABM de `Familia` (RF-01). `Familia.estado_deuda` deja de ser fuente de verdad — se calcula desde `Cuenta_corriente`/`Movimiento` de Carreon.
- ABM de `Alumno` (RF-03).
- Vincular/desvincular alumno↔familia (`FAMILIA_ALUMNO`, con `parentesco`, `responsable_principal` y **`recibe_comunicaciones`** — cambio 5, separa quién paga de quién recibe avisos).
- Búsqueda/filtro por nombre, DNI, nivel educativo, estado de deuda, estado de inscripción (RF-02).
- **Importante:** cada operación de escritura sobre `Familia`/`Alumno` tiene que llamar al helper compartido `log_audit()` (documentado en `src/models.py`) — sin esto, la Auditoría (también de Botteri) no tiene nada que mostrar.

**Frontend (`modules/familias-alumnos/`):**
- Listado + búsqueda/filtro.
- Formularios de alta/edición de familia y alumno.
- Ficha de alumno/familia — acá se inserta el componente compartido de Auditoría (`<HistorialCambios entidad="ALUMNO" entidadId={id} />`).

**Cerrado:** el responsable económico (a nombre de quién se emite la factura) ya no depende de `responsable_principal` — lo resuelve la tabla `RESPONSABLE_ECONOMICO` de Carreon (cambio 8), con vigencia temporal. `responsable_principal` sigue existiendo para responsabilidad parental general, pero no define facturación.

---

### Académico
**RF cubiertos:** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09

**Backend (`src/academico/`):**
- ABM de `NivelEducativo`, `Anio`, `Division` (RF-07).
- ABM de `Materia` — **ahora con `division_id` nullable** (cambio 16, cerrado por aclaración del cliente): nulo = común al año, con valor = específica de la división/orientación (RF-08).
- Asignar/desasignar `Docente` a `Materia`+`Division` por ciclo lectivo (RF-09).
- Registrar asistencia diaria por alumno — **presente / ausente / tardanza** (RF-04, cambio 5: el docente ya no decide si la ausencia está justificada, solo marca el hecho). Ante un `ausente`, el estado pasa a `ausente_pendiente` y dispara notificación automática a todos los responsables con `recibe_comunicaciones = true`.
- **Nuevo (cambio 5):** ciclo de justificación — `JUSTIFICACION_INASISTENCIA` + catálogo `MOTIVO_JUSTIFICACION` (7 motivos confirmados, con adjunto opcional). La familia presenta la justificación; el rol institucional autorizado (Secretaría/Dirección según corresponda, no un rol fijo) la aprueba o rechaza — el docente no participa de esta decisión. Resultado: `ausente_justificado` / `ausente_injustificado`.
- Consultar historial de asistencias por período (RF-05).
- Calcular % de presencia por alumno/período, justificadas vs. injustificadas (RF-06).

**Frontend (`modules/academico/`):**
- ABM de estructura curricular (niveles → años → divisiones → materias, con materias específicas por división cuando corresponda).
- Asignación docente-materia-división por ciclo lectivo.
- Registro de asistencia diaria por división (presente/ausente/tardanza).
- Bandeja de revisión de justificaciones (Secretaría/Dirección).
- Panel de historial + % de presencia por alumno.

**Cerrado por el cliente** (antes eran preguntas pendientes #5 y #11, ya no bloquean el esquema):
- Sí puede haber materias distintas entre divisiones del mismo año (orientaciones) — resuelto con `division_id` nullable.
- Estructura curricular: 3 niveles confirmados (Inicial/Primario/Secundario) y jerarquía Nivel → Año/Sala → División/Orientación → Materias → Docentes confirmada; la tabla maestra con los valores concretos ya fue entregada por el cliente — falta transcribirla a la precarga (`database/seeds/`, Grupo C).

**Atención — sin dueño formal todavía:** RNF-15 (Ley 25.326) toca de lleno este módulo — `JUSTIFICACION_INASISTENCIA` maneja motivos médicos de menores de edad. Es el RNF más importante de los pendientes (ver tabla al final del documento); dado que el módulo es de Botteri, es candidato natural a tomarlo.

---

### Auditoría y Trazabilidad
**RF cubiertos:** RF-13, RF-14 · RNF-05 — **no genera tablas de negocio propias, salvo `EVENT_LOG`** (transversal), consulta tablas ya construidas en otros módulos.

> **Cambio de fondo (cambio 1):** la tabla `EVENT_LOG` que existía hasta ahora respondía "¿quién cambió qué dato?" — eso es auditoría. Se **renombra a `AUDIT_LOG`** (helper `log_audit()`) y se crea un `EVENT_LOG` **nuevo**, append-only, de hechos de negocio (helper `emit_event()`, infraestructura de Arce que consume el motor de Workflows). No confundir las dos.

**Backend (`src/auditoria/`):**
- `GET /auditoria/{entidad}/{entidadId}` — historial de cambios de una entidad contra `AUDIT_LOG`, ordenado cronológicamente (RF-14).

**Frontend (`modules/auditoria/`):**
- Componente compartido `<HistorialCambios entidad entidadId />`, reutilizado dentro de las pantallas de otros módulos (ficha de familia, alumno, factura, etc.) — **no es una pantalla propia**, coordinar con Carreon el contrato de este componente antes de que lo integre en sus pantallas.

**Arranca desde el día 1, con backend real:** se cargan a mano un puñado de filas de prueba en `AUDIT_LOG` (fechas, campos y usuarios inventados, insertadas directo en la tabla que ya existe desde el modelado inicial) y se escribe el endpoint real contra esas filas — el frontend consume ese endpoint desde el principio, sin mockear nada en el componente.

---

## Carreon — Admisiones e Inscripciones + Facturación + Panel Administrativo

> **Es el segundo rol más cargado tras las aclaraciones** — Facturación pasa de 4 tablas a 10, y se suma el pipeline completo de Admisiones (alcance nuevo, sin RF asociado). 

### Admisiones e Inscripciones
**RF cubiertos:** RF-10, RF-11, RF-12, RF-33 · más el pipeline de Admisiones, alcance nuevo sin RF (cambio 6)

**Backend (`src/inscripciones/` — sigue siendo un solo módulo, no se crea un módulo 11):**
- **Nuevo — pipeline de Admisiones** (`SOLICITUD_INSCRIPCION`), **7 etapas confirmadas por el cliente**: consulta/lead → entrevista → postulación → evaluación/aprobación → reserva de vacante/matrícula → documentación y contrato → inscripción confirmada/alumno activo. Cada etapa queda registrada con fecha, estado y responsable en `ETAPA_SOLICITUD` (historial completo, no solo la etapa actual).
- Workflow de aprobación (respuesta 8 del cliente): crear persona/alumno → vincular familia y responsables → **asignar responsable económico** → generar inscripción → generar cargo de matrícula → `DOCUMENTO_SOLICITUD` (solicitar/validar documentación y contrato) → registrar pago → confirmar inscripción → enviar bienvenida. La creación de alumno/familia puede ser automática, pero la confirmación no — depende de documentación y pago validados.
- Registrar inscripción de alumno nuevo, vinculado a familia y nivel educativo (RF-10) — es el punto donde `INSCRIPCION.solicitud_inscripcion_id` se completa (solo para `tipo = nueva`).
- Registrar reinscripción para el siguiente ciclo lectivo (RF-11) — no pasa por el pipeline de admisiones, el alumno ya está adentro.
- Registrar cambio de matrícula (nivel, división o baja), actualizando el legajo automáticamente (RF-12).
- Búsqueda/filtro de inscripciones por estado, nivel, ciclo lectivo, alumno (RF-33).

**Frontend (`modules/inscripciones/`):**
- Pantalla "Admisiones e Inscripciones": pipeline de 7 etapas con historial, formulario de entrevista/postulación, checklist de documentación.
- Formulario de inscripción/reinscripción.
- Formulario de cambio de matrícula.
- Listado con filtros (RF-33).

**Nota:** las tablas de `Familia`/`Alumno`/`Academico` ya existen desde el modelado inicial, así que el CRUD de inscripciones (no admisiones) se puede escribir sin esperar a Botteri.

---

### Facturación y Cobranza
**RF cubiertos:** RF-15, RF-16, RF-17, RF-18, RF-36

**Backend (`src/facturacion/`):**
- Generar y administrar facturas por alumno (RF-15). Facturación sigue siendo **por alumno**, no por familia.
- **Nuevo — `RESPONSABLE_ECONOMICO` con vigencia temporal** (cambio 8, cierra la pregunta #3): a nombre de quién se emite la factura cuando hay varios responsables. Fila vigente (`vigencia_hasta IS NULL`) + historial cerrado; cambios se informan antes del día 10, aplican desde el período siguiente. Designar un responsable económico **no libera** a los demás de sus obligaciones.
- **Nuevo — `CONCEPTO_COBRO`** (cambio 12, catálogo confirmado de 10 conceptos): reemplaza `DETALLE_FACTURA.tipo` (texto libre) por una FK a un catálogo configurable sin desarrollo.
- **Nuevo — motor de penalidades por tramos** (cambio 13): `REGLA_PENALIDAD` (0–5 días: 0% · 6–15: 20% · 16–30: 30%, confirmado) + `EXCEPCION_VENCIMIENTO` por familia (fecha excepcional autorizada).
- **Nuevo — `CUENTA_CORRIENTE`/`MOVIMIENTO`** (cambio 14): libro de movimientos **inmutable** por alumno — cada cargo, pago y penalidad es una fila que nunca se edita; un error se corrige con un movimiento de ajuste nuevo. El saldo **nunca se persiste**, se calcula sumando movimientos en cada consulta.
- Registrar pagos (RF-16), con **`PAGO.estado`/`referencia_transaccion`/`fecha_operacion`** (cambio 15, cierra la pregunta #10): débito directo, tarjeta de débito, tarjeta de crédito, transferencia (esta última con comprobante obligatorio).
- Visualizar estado de deuda por familia: pendientes, vencidas, pagadas (RF-17) — **ahora derivado de `CUENTA_CORRIENTE`/`MOVIMIENTO`**, ya no de un recorrido de `FACTURA`/`PAGO` ni de una columna `FAMILIA.estado_deuda` separada.
- Generar alertas de morosidad — dispara el workflow de Arce (`aplicar_vencimiento`/`aplicar_penalidad`), coordinar los eventos `factura.vencida`/`pago.registrado`/`pago.rechazado` con él (RF-18).
- Exportación de deudas/cobranzas CSV/Excel (RF-36).

**Frontend (`modules/facturacion/`):**
- Generación de factura, con conceptos de cobro del catálogo.
- Registro de pago, con estado de transacción.
- Extracto de cuenta corriente por alumno (pantalla "Familia → Facturación", ver tabla de vistas del MVP).
- Panel de estado de deuda por familia (pendientes/vencidas/pagadas).

**Cerrado por el cliente** (antes eran preguntas pendientes #6 y #10, ya no bloquean el esquema): 10 conceptos de cobro confirmados; métodos de pago confirmados (débito directo, tarjeta de débito, tarjeta de crédito, transferencia).

---

### Panel Administrativo
**RF cubiertos:** RF-31, RF-32 — **no genera tablas propias**, es consumo directo de datos ya modelados por otros módulos.

**Backend (`src/panel_admin/`):** endpoints de agregación, sin modelo propio:
- Alumnos activos (`ALUMNO.estado = activo`).
- Deuda pendiente total — saldo agregado de `CUENTA_CORRIENTE`/`MOVIMIENTO` (reemplaza el `SUM(FACTURA.monto_total)` del diseño anterior).
- Inasistencias del día (`ASISTENCIA WHERE fecha = hoy AND tipo LIKE ausente%`, incluye `ausente_pendiente`).
- Solicitudes de compra abiertas (`SOLICITUD_COMPRA WHERE estado = pendiente`).
- Tareas pendientes/escaladas (`TAREA`, de Arce).

**Frontend (`modules/panel-admin/`):**
- Panel de Dirección con los indicadores (RF-31).
- Panel de Administración con accesos rápidos a Familias, Facturación y Proveedores (RF-32) — solo navegación, sin dato nuevo.

**Arranca desde el día 1, con backend real:** se cargan a mano un puñado de filas de prueba en `ALUMNO`, `FACTURA`, `ASISTENCIA` y `SOLICITUD_COMPRA` (ya existen desde el modelado inicial, vía `database/seeds/` o insertadas a mano), y se escriben los queries de agregación reales contra esos datos. El frontend llama al endpoint real desde el primer día — no hay nada que "cambiar" más adelante, solo van a cambiar los números a medida que el resto del equipo cargue datos reales en vez de los de prueba.

---

## Canu — Proveedores y Compras + IA/Sugerencias

### Proveedores y Compras
**RF cubiertos:** RF-19, RF-20, RF-21, RF-34, RF-35, RF-38

**Backend (`src/proveedores_compras/`):**
- ABM de `Proveedor` (datos de contacto, categoría, estado) (RF-19).
- **Nuevo — catálogo `PRODUCTO_SERVICIO`** (cambio 7, cierra la pregunta #7 de fondo): reemplaza el texto libre de `SOLICITUD_COMPRA.articulo` por una referencia controlada, con `PRODUCTO_PROVEEDOR` (M:N con proveedores) y `PRECIO_PRODUCTO` (histórico por proveedor). `articulo` se conserva nullable solo para excepciones fuera de catálogo. **El catálogo inicial normalizado todavía no llegó** (pregunta pendiente #17) — no inventar valores de ejemplo como precarga real, esperar a que el cliente lo entregue.
- Registrar solicitudes internas de compra, con estado actualizable y referencia a `PRODUCTO_SERVICIO` (RF-20).
- Generar orden de compra a partir de solicitud(es) aprobada(s) del mismo proveedor, asociada a un proveedor, con `ORDEN_COMPRA_DETALLE` por ítem (RF-21) — el cliente confirmó (respuesta 14) que una orden puede agrupar varias solicitudes, cada una conserva su ID original.
- **Nuevo — recepción de compras completa** (cambio 17, cierra la pregunta #14): `RECEPCION_COMPRA` + `RECEPCION_COMPRA_DETALLE`, total o parcial — una recepción parcial deja pendiente automáticamente la cantidad restante (`cantidad_pedida - SUM(cantidad_recibida)`, calculado, no columna).
- Búsqueda de proveedores y órdenes (RF-34, RF-35), exportación CSV/Excel (RF-38).

**Frontend (`modules/proveedores-compras/`):**
- ABM de proveedores.
- Catálogo de productos/servicios con precios por proveedor.
- Formulario de solicitud de compra (con selector del catálogo) + listado con estado.
- Generación de orden de compra desde solicitudes aprobadas, agrupando por proveedor.
- Registro de recepción (total/parcial) con detalle por ítem.

**Cerrado por el cliente** (antes era la pregunta pendiente #7): una orden de compra sí puede agrupar varias solicitudes al mismo proveedor — el modelo M:N (`ORDEN_COMPRA_SOLICITUD`) ya existente queda validado sin cambios.

**Pendiente — bloquea solo precarga, no esquema:** catálogo inicial normalizado de productos/servicios (pregunta #17), el cliente confirmó que lo va a entregar.

---

### IA/Sugerencias
> **Advertencia de cobertura documental:** a diferencia de los demás módulos, este no tiene ningún RF con código en la Matriz de Requerimientos — es interpretación del equipo sobre la descripción de alto nivel del enunciado del alcance. Presentarlo con esa salvedad si el tutor pregunta.

**Backend (`src/ia_sugerencias/`):**
- Detectar patrón (morosidad, inasistencias) vía OpenAI, guardar en `IA_SUGERENCIA` con `estado = pendiente_revision`.
- Generar borrador de comunicación institucional vía OpenAI, mismo flujo de revisión.
- Aprobar sugerencia — si es de tipo comunicación, crea la `NOTIFICACION_TEMPLATE` correspondiente.
- Rechazar sugerencia.
- Listar sugerencias pendientes de revisión.

**Regla no negociable, reforzada por el cliente (respuesta 16):** si `requiere_control_humano = true`, la sugerencia **nunca** pasa directo a `ejecutada_automaticamente` sin pasar por `pendiente_revision`. IA acotada: patrones por reglas/SQL, LLM solo para redactar o sugerir — nada de ML entrenado (cambio 11).

**Frontend (`modules/ia-sugerencias/`):**
- Bandeja de sugerencias pendientes con botones de aprobar/rechazar.
- Vista de detalle de una sugerencia (contexto + contenido generado).
- Historial de sugerencias resueltas.

**Coordinar con Arce:** una sugerencia de comunicación aprobada genera una `NOTIFICACION_TEMPLATE` — la misma tabla que usa `WORKFLOW_RULE.notificacion_template_id` de Workflows. Acordar el contrato de esa tabla antes de que cada uno la use por su lado.

---

## RNF pendientes de revisión (sin dueño asignado todavía)

Además de los RF, hay 6 RNF de la Matriz de Requerimientos que **no quedan cubiertos automáticamente** por el diseño ya definido y necesitan revisión antes del cierre del proyecto. Quién se hace cargo de cada uno se decide más adelante — por ahora quedan anotados acá para que no se pierdan:

| RNF | Qué falta revisar/hacer |
|---|---|
| RNF-01 | Testing de performance — confirmar que las consultas administrativas responden en menos de 5 segundos |
| RNF-02 | Testing cross-browser — Chrome, Edge, Firefox, Safari (desktop y móvil) |
| RNF-08 | Estrategia de backup y recuperación de PostgreSQL — hoy no tiene dueño en la división actual |
| RNF-11 | Que el sistema se mantenga disponible durante las demos (ligado a cómo quede levantado `infra/` en producción) |
| RNF-14 | Logs estructurados de errores — ya existe `logging.ini` en el backend, falta que se use activamente |
| RNF-15 | Cumplimiento de la Ley 25.326 (datos personales) — restringir datos sensibles en logs, exportaciones (RF-36/37/38) y en el `payload` de `EVENT_LOG`, según rol. El más importante de los pendientes, toca datos de menores de edad — con `JUSTIFICACION_INASISTENCIA` (motivos médicos, cambio 5) se vuelve más concreto todavía. **Dueño confirmado: Botteri**, ya era dueño del módulo Académico donde vive esa tabla |

RNF-12 (migraciones sin pérdida de datos) y RNF-13 (código documentado) ya están parcialmente cubiertos por Alembic y por `ARCHITECTURE.md`/`AGENTS.md` respectivamente — igual conviene pasarlos por un checklist final antes de la entrega, no darlos por hechos sin revisar.

**Dependencias de infraestructura externa nuevas, sin registrar todavía en el Plan de Gestión de Riesgos:** Google Cloud/Workspace (OAuth, cambio 2) y n8n (motor de workflows) — ambas convienen resolverse juntas, mismo tipo de riesgo (disponibilidad de un servicio de terceros del que ahora depende el login o el envío de notificaciones).

---



- **Rotación de referente:** el referente ante el tutor rota en cada actividad, independientemente de quién sea dueño técnico de qué módulo.
- **Asunto de mail:** formato estricto "Proyecto 2026- Grupo 15- Actividad xx".
- **Días de entrega:** no se aceptan entregas en fines de semana, feriados o recesos.
- **Convención de ramas — corregido:** GitHub Flow, **`main` como única rama larga** (branch protection ya configurado, PR obligatorio, CI por capa, review antes de mergear — confirmado en `README.md` y `ARCHITECTURE.md`), `feature/<modulo>-<descripcion>` por tarea. *Este documento mencionaba antes una rama `develop` de integración que no existe en ningún otro documento del proyecto — era una contradicción de este archivo, no una rama real; se corrige acá, el flujo de trabajo no cambia.* Ver `ARCHITECTURE.md` / `AGENTS.md` en el repo para el detalle técnico completo de estructura de carpetas y convenciones de código.
