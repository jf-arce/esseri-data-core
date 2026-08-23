# División de tareas - ESSERI Data Core

Este documento reparte los 10 módulos del sistema entre los 4 integrantes, con el detalle de qué tiene que hacer cada uno (backend, frontend, dependencias con otros módulos) y en qué orden conviene arrancar para minimizar tiempos muertos.

---

## Resumen de asignación

| Dev | Módulos |
|---|---|
| **Arce** | Auth (Autenticación y Roles) + Workflows y Notificaciones |
| **Botteri** | Familias y Alumnos + Académico + Auditoría y Trazabilidad |
| **Carreon** | Inscripciones + Facturación y Cobranza + Panel Administrativo |
| **Canu** | Proveedores y Compras + IA/Sugerencias |


## Roadmap por entregas

Estas son las **entregas reales de la cátedra** (Guía de TP 2026, actividades 10, 11, 12 y 13) — no un invento interno. Es lo que se muestra a los profesores en cada corte.

| Entrega | Tope de entrega | Tope de aprobación | Qué se muestra |
|---|---|---|---|
| **1° Informe de Avance** | 8/9/26 | 15/9/26 | Estado de avance + Técnica del Valor Ganado |
| **2° Informe de Avance** | 6/10/26 | 13/10/26 | Ídem, + acumulado |
| **3° Informe de Avance** | 10/11/26 | 17/11/26 | Ídem, **con público invitado** — demo real funcionando, incluye el HITO de entrega del proyecto terminado (17/11) |

**Se sacó "Entrega Final" como milestone aparte** — casi todas sus tareas (documentación, manuales) ocurren temporalmente dentro del período del 3er Informe según el cronograma real, así que viven ahí directamente en vez de en un cuarto milestone casi vacío. El único hito real de cierre (17/11) queda como el cierre del 3er Informe, no un corte separado.

### Antes de la 1° entrega — modelado inicial de la base de datos
Se modelan **las 29 tablas de los 10 módulos de una sola vez**, en conjunto — no CRUD, no lógica de negocio, solo tablas, relaciones (FKs) y migraciones de Alembic. Es trabajo compartido de todo el equipo, tal como lo pide el EDT 1.3 ("Modelo de base de datos en PostgreSQL"). Con esto migrado desde el día 1, nadie depende del modelo de datos de otro módulo para escribir su propio CRUD.

### Qué RF corresponde a cada entrega (según el cronograma real, EDT 1.4)

**Para el 1er Informe de Avance (08/09):**

| RF | Tarea | Dev |
|---|---|---|
| RF-27 | Login JWT | Arce |
| RF-28, 29, 30 | ABM de roles y permisos | Arce |
| RNF-10 | Registro y auditoría de accesos | Arce |
| RF-19 | ABM de proveedores | Canu |
| RF-31 | Panel de Dirección con indicadores | Carreon |
| RF-01 | ABM de familias | Botteri |
| RF-32 | Panel Administrativo | Carreon |
| RF-03 | ABM de alumnos y vinculación con familias | Botteri |
| — | Integración OpenAI para comunicaciones | Canu |
| RF-02 | Búsqueda y filtros de familias/alumnos | Botteri |
| RF-13, RF-14 | Historial de cambios de entidades críticas | Botteri |
| — | Detección de patrones de morosidad/inasistencias | Canu |
| RF-07 | ABM de niveles, años y divisiones | Botteri |
| RF-08 | ABM de materias | Botteri |
| RF-09 | Asignación de docentes | Botteri |
| RF-04 | Registro de asistencia diaria | Botteri |
| RF-05, RF-06 | Historial y % de presencia | Botteri |
| RF-37 | Exportación del historial de asistencias | Botteri |
| RF-10 | Inscripción de nuevos alumnos | Carreon |
| RF-11 | Reinscripción por ciclo lectivo | Carreon |
| RF-12 | Cambio de matrícula y baja | Carreon |

Con esto, **8 de los 10 módulos quedan sustancialmente completos ya en el 1er Informe** — Auth, Familias y Alumnos, Académico, Inscripciones, Proveedores (ABM), Panel Admin (completo) e IA (completo). Solo Facturación y Workflows quedan para después.

*Nota: la última tarea de este grupo (RF-12, cambio de matrícula) termina el 9/9, un día después del tope de entrega oficial (8/9) — igual de justo que en el 3er Informe. Vale la pena adelantar un par de días también acá si pueden.*

**Para el 2do Informe de Avance (06/10):**

| RF | Tarea | Dev |
|---|---|---|
| RF-33 | Búsqueda y filtros de inscripciones | Carreon |
| RF-15 | Generación de facturas | Carreon |
| RF-16 | Registro de pagos | Carreon |
| RF-17 | Panel de deuda por familia | Carreon |
| RF-18 | Alertas automáticas de morosidad | Carreon |
| RF-36 | Exportación de deudas/cobranzas CSV/Excel | Carreon |
| RF-20 | Solicitudes internas de compra | Canu |
| RF-21 | Generación de órdenes de compra | Canu |
| RF-34, RF-35 | Búsqueda de proveedores y órdenes | Canu |
| RF-38 | Exportación proveedores/órdenes CSV/Excel | Canu |
| RF-13, RF-14 | Verificación de registro de auditoría en todos los módulos (refuerzo) | Botteri |

Facturación y Proveedores quedan completos acá.

**Para que nadie quede sin tarea en este período:**
- **Arce** queda libre desde julio (Auth) hasta el 12/10 (arranque oficial de Workflows) — casi dos meses sin nada asignado si se sigue el cronograma al pie de la letra. Este período se cubre con una tarea propia, sin número de RF (es infraestructura, no un requisito funcional):

| Tarea (sin RF) | Qué incluye | Dev |
|---|---|---|
| `[Workflows] Scaffolding del motor` | CRUD de `WORKFLOW_RULE`, conexión básica a n8n, estructura de `WORKFLOW_EXECUTION` — sin triggers reales todavía | Arce |

  Va como issue propio en el board (con label `workflows`, milestone `2do Informe de Avance`), igual que cualquier otra tarea — que no tenga RF no la vuelve invisible. No hace falta esperar a que exista una factura real para arrancar el motor en sí, solo para conectar el primer trigger real más adelante.
- **Botteri** solo tiene la verificación de auditoría (liviana) en este período, con margen libre. Puede sumar: reforzar tests de Familias/Académico, o ayudar a Carreon con el frontend de Facturación si le sobra tiempo.

*Nota: la última tarea de este grupo (RF-38, exportación de proveedores) termina el 9/10 — tres días después del tope de entrega oficial (6/10). Mismo patrón que en las otras dos entregas: el cronograma corre justo, sin margen.*

**Para el 3er Informe de Avance (10/11, con público):**

| RF | Tarea | Dev |
|---|---|---|
| RF-22 | Configuración de reglas de workflow | Arce |
| RF-23 | Historial de ejecuciones de workflows | Arce |
| RF-24 | Envío automático de notificaciones por email | Arce |
| RF-25 | Configuración de plantillas y destinatarios | Arce |
| RF-26 | Log de notificaciones enviadas | Arce |

**Todo Workflows queda para esta entrega** — es intencional: recién acá hay datos reales de Facturación (2do Informe) contra los cuales probar triggers de verdad. Coincide justo con que esta entrega tiene demo en vivo con público — necesitan el flujo completo funcionando (inscribir → facturar → vencer → disparar workflow → verse en Panel Admin).

**Corrección al cronograma original (movimiento, no compresión):** el cronograma original agendaba `RF-13`/`RF-14` "refuerzo" y `RF-37` para el 9-18/11, recién después de terminar Workflows.

- **`RF-37` (exportación de asistencias) se puede mover ya al bloque del 1er Informe** — Asistencia está lista desde agosto, no depende de nada posterior.
- **`RF-13`/`RF-14` "refuerzo" probablemente sea una verificación de que todos los módulos escriben correctamente en `EVENT_LOG`** (no desarrollo nuevo — cada módulo ya llama al helper compartido desde que se escribe, según quedó definido en `ARCHITECTURE.md`). No hace falta esperar a que Workflows termine para verificar esto, alcanza con que Facturación (2do Informe) ya esté generando datos — así que se mueve a **principios de octubre**, apenas cierre el 2do Informe, en vez de a mitad de noviembre.

Con estos dos movimientos — sin comprimir nada, sin trabajar más rápido de lo planificado — la última tarea real del proyecto pasa de terminar el 18/11 a terminar el **3/11** (cuando cierra RF-26, lo último de Workflows).

**Objetivo interno resultante — ajustado por disponibilidad real, no solo por dependencias técnicas:** septiembre **y** octubre son los meses de mayor disponibilidad del equipo — la baja arranca recién a **fines** de octubre, por parciales de otras materias. Conviene aprovechar todo ese margen, no solo septiembre:

- **Setiembre y octubre**: ventana de máxima disponibilidad — usarla para adelantar Workflows todo lo posible (no solo arrancar el scaffolding en septiembre, seguir avanzando en octubre las reglas concretas que no dependen de datos reales de Facturación, como la definición de `WORKFLOW_RULE` para los 4 casos ya identificados).
- **Código funcional completo antes de fines de octubre** (objetivo ideal: última semana de octubre, no el 3/11) — mientras el equipo todavía tiene disponibilidad completa.
- **Los últimos días de octubre en adelante se reservan para testing y ajustes menores**, que exigen menos disponibilidad sostenida que construir features nuevas — es trabajo que se puede hacer en ratos sueltos entre exámenes, a diferencia de programar un módulo entero.
- **Semana del 10/11**: ensayo de la demo, últimos ajustes, entrega oficial.
- **10/11 al 17/11**: colchón real de aprobación del tutor, no trabajo pendiente.

**No tengo la fecha exacta de sus parciales** (varía según qué otras materias estén cursando cada uno) — conviene que el equipo confirme esas fechas puntuales y ajuste el corte de "código completo" en consecuencia, en vez de dejarlo en una fecha genérica.

**Recordatorio: en cada uno de los 3 Informes de Avance, los 4 tienen que tener tarea real asignada** — no solo quien tiene un RF numerado en esa entrega puntual. Ya quedó resuelto arriba en cada bloque (Arce arranca Workflows en paralelo durante el período del 2do Informe en vez de esperar a octubre; Carreon, Botteri y Canu se suman al testing de integración durante el período del 3er Informe en vez de quedar libres una vez que cierran sus propios RF) — el criterio se mantiene igual sin importar cómo se ajusten las fechas exactas por disponibilidad.

**Para que nadie quede sin tarea en este período:** acá el desequilibrio es al revés — Carreon, Botteri y Canu ya no tienen RF propios pendientes, solo Arce sigue construyendo Workflows. En vez de quedar libres, conviene que los tres se sumen al testing de integración (4/11 al 9/11): cada uno prueba que su propio módulo dispare bien los eventos que Workflows necesita (ej. Carreon verifica que `factura.vencida` se dispare correctamente, Botteri que `inasistencia.registrada` lo haga) — es trabajo real de EDT 1.5, no relleno.

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


---

## Arce — Auth + Workflows y Notificaciones

### Auth (Autenticación y Roles)
**RF cubiertos:** RF-27, RF-28, RF-29, RF-30 · RNF-03, RNF-10

**Backend (`src/auth/`):**
- Login con JWT (RF-27), registrando intentos exitosos/fallidos en `LOG_ACCESO`.
- ABM de `Rol` y `Permiso` (RF-28).
- Asignar/modificar rol de un usuario (`USUARIO_ROL`) (RF-29). Un usuario puede tener más de un rol simultáneo (ej. docente que también es familia).
- Middleware/dependency de autorización que restrinja acciones según rol, denegando lo no permitido (RF-30).

**Frontend (`modules/auth/`):**
- Pantalla de login.
- ABM de roles y permisos (vista de administración).
- Selector de rol(es) por usuario.

**Pendiente de validar con ESSERI:** si un usuario tiene varios roles con permisos conflictivos en un mismo módulo, ¿cuál gana? (Pregunta #4 del diccionario de datos — afecta la lógica de RF-30).

---

### Workflows y Notificaciones
**RF cubiertos:** RF-22, RF-23, RF-24, RF-25, RF-26

**Backend (`src/workflows/`):**
- CRUD de `WORKFLOW_RULE` (evento disparador, condición en JSON, tipo de acción).
- Motor de ejecución: evalúa condiciones y dispara la acción (notificar o alerta interna), registrando en `WORKFLOW_EXECUTION` (RF-22, RF-23).
- Integración con n8n vía webhook genérico para el envío real de emails (Gmail/Google Workspace) — el backend resuelve destinatario y contenido antes de llamarlo.
- Registro de `NOTIFICACION` (solo para destinatarios externos/familias) con estado de envío (RF-26).
- CRUD de `NOTIFICACION_TEMPLATE` (plantillas con placeholders tipo `{{nombreFamilia}}`).

**Reglas concretas mínimas a implementar y probar** (sobre los 3 eventos confirmados en RF-24):
1. `factura.vencida` → `alerta_interna` (cubre RF-18, morosidad — se ve en Panel Admin, sin email).
2. `factura.vencida` → `notificar` (email a la familia).
3. `inasistencia.registrada` → `notificar`.
4. `inscripcion.cambio_matricula` → `notificar`.

**Frontend (`modules/workflows/`):**
- ABM de reglas de workflow (selector de evento, editor de condición, editor de plantilla con chips insertables de `CAMPO_EVENTO`).
- Historial de ejecuciones (RF-23), con filtro por estado.

**Pendiente de validar (no cerrar el alcance sin esto):**
- **Pregunta #9:** ¿el motor solo dispara notificaciones, o también debe ejecutar otras acciones automáticas (cambiar estado de una factura, generar una orden de compra sola)? Define si el modelo actual (`tipoAccion` abierto) se mantiene o se simplifica.
- **Pregunta #12:** ¿a partir de cuántos días de deuda vencida se considera "morosidad"? Define el valor por defecto de la condición de la regla de morosidad.

---

## Botteri — Familias y Alumnos + Académico + Auditoría

### Familias y Alumnos
**RF cubiertos:** RF-01, RF-02 (parcial), RF-03, RF-13, RF-14

**Backend (`src/familias_alumnos/`):**
- ABM de `Familia` (RF-01).
- ABM de `Alumno` (RF-03).
- Vincular/desvincular alumno↔familia (`FAMILIA_ALUMNO`, con `parentesco` y `responsablePrincipal`).
- Búsqueda/filtro por nombre, DNI, nivel educativo, estado de deuda, estado de inscripción (RF-02).
- **Importante:** cada operación de escritura sobre `Familia`/`Alumno` tiene que llamar al helper compartido de `EVENT_LOG` (documentado en `src/models.py`) — sin esto, la Auditoría (también de Botteri) no tiene nada que mostrar.

**Frontend (`modules/familias-alumnos/`):**
- Listado + búsqueda/filtro.
- Formularios de alta/edición de familia y alumno.
- Ficha de alumno/familia — acá se inserta el componente compartido de Auditoría (`<HistorialCambios entidad="ALUMNO" entidadId={id} />`).

**Pendiente de validar con ESSERI:** si hay más de una familia vinculada a un alumno, ¿a nombre de cuál se emite la factura? ¿Alcanza con `responsablePrincipal`? (Pregunta #3 — se volvió más urgente al confirmarse "factura por alumno").

---

### Académico
**RF cubiertos:** RF-04, RF-05, RF-06, RF-07, RF-08, RF-09

**Backend (`src/academico/`):**
- ABM de `NivelEducativo`, `Anio`, `Division` (RF-07).
- ABM de `Materia` (RF-08).
- Asignar/desasignar `Docente` a `Materia`+`Division` por ciclo lectivo (RF-09).
- Registrar asistencia diaria por alumno — presente/ausente justificado/injustificado (RF-04). **Nota:** `ASISTENCIA` se conecta a `INSCRIPCION`, no directo a `ALUMNO` — la tabla ya existe desde el modelado inicial, así que este endpoint se puede escribir sin esperar a Carreon; solo para **probarlo con datos reales** hace falta que exista al menos una inscripción cargada.
- Consultar historial de asistencias por período (RF-05).
- Calcular % de presencia por alumno/período, justificadas vs. injustificadas (RF-06).

**Frontend (`modules/academico/`):**
- ABM de estructura curricular (niveles → años → divisiones → materias).
- Asignación docente-materia-división por ciclo lectivo.
- Registro de asistencia diaria por división.
- Panel de historial + % de presencia por alumno.

**Pendiente de validar con ESSERI (no se puede resolver por criterio propio del equipo):**
- **Pregunta #5:** ¿puede haber materias distintas entre divisiones de un mismo año (orientaciones)? Define si `Materia` cuelga de `Año` (como está ahora) o de `División`. Conviene cerrar esto antes de escribir el modelo.
- **Pregunta #11:** estructura curricular real de ESSERI (niveles, años, divisiones, nombres) — dato operativo real del colegio, no se puede inventar ni proponer un default.

---

### Auditoría y Trazabilidad
**RF cubiertos:** RF-13, RF-14 · RNF-05 — **no genera tablas propias**, consulta 4 tablas ya construidas en otros módulos (`EVENT_LOG`, `LOG_ACCESO`, `WORKFLOW_EXECUTION`, `NOTIFICACION`).

**Backend (`src/auditoria/`):**
- `GET /auditoria/{entidad}/{entidadId}` — historial de cambios de una entidad, ordenado cronológicamente (RF-14).

**Frontend (`modules/auditoria/`):**
- Componente compartido `<HistorialCambios entidad entidadId />`, reutilizado dentro de las pantallas de otros módulos (ficha de familia, alumno, factura, etc.) — **no es una pantalla propia**, coordinar con Carreon el contrato de este componente antes de que lo integre en sus pantallas.

**Arranca desde el día 1, con backend real:** se cargan a mano un puñado de filas de prueba en `EVENT_LOG` (fechas, campos y usuarios inventados, insertadas directo en la tabla que ya existe desde el modelado inicial) y se escribe el endpoint real contra esas filas — el frontend consume ese endpoint desde el principio, sin mockear nada en el componente.

---

## Carreon — Inscripciones + Facturación + Panel Administrativo

### Inscripciones
**RF cubiertos:** RF-10, RF-11, RF-12, RF-33

**Backend (`src/inscripciones/`):**
- Registrar inscripción de alumno nuevo, vinculado a familia y nivel educativo (RF-10).
- Registrar reinscripción para el siguiente ciclo lectivo (RF-11).
- Registrar cambio de matrícula (nivel, división o baja), actualizando el legajo automáticamente (RF-12).
- Búsqueda/filtro de inscripciones por estado, nivel, ciclo lectivo, alumno (RF-33).

**Frontend (`modules/inscripciones/`):**
- Formulario de inscripción/reinscripción.
- Formulario de cambio de matrícula.
- Listado con filtros (RF-33).

**Nota:** las tablas de `Familia`/`Alumno`/`Academico` ya existen desde el modelado inicial, así que este CRUD se puede escribir sin esperar a Botteri — para **probarlo con datos reales** conviene coordinar quién carga primero algún registro de prueba.

---

### Facturación y Cobranza
**RF cubiertos:** RF-15, RF-16, RF-17, RF-18

**Backend (`src/facturacion/`):**
- Generar y administrar facturas/conceptos de cobro por alumno (RF-15). Facturación es **por alumno**, no por familia — la deuda de familia se calcula agregando vía `FAMILIA_ALUMNO`.
- Registrar pagos, actualizando estado de deuda (RF-16).
- Visualizar estado de deuda por familia: pendientes, vencidas, pagadas (RF-17).
- Generar alertas de morosidad configuradas — esto dispara el workflow de Arce, coordinar el evento `factura.vencida` con él (RF-18).

**Frontend (`modules/facturacion/`):**
- Generación de factura/conceptos de cobro.
- Registro de pago.
- Panel de estado de deuda por familia (pendientes/vencidas/pagadas).

**Pendiente de validar con ESSERI:**
- **Pregunta #6:** qué conceptos de cobro maneja ESSERI además de la cuota mensual (matrícula, materiales, seguro, comedor, etc.) — define si `DETALLE_FACTURA` queda genérica o se puede acotar.
- **Pregunta #10:** qué métodos de pago acepta realmente ESSERI (efectivo, transferencia, tarjeta, Mercado Pago, cheque) y cuáles requieren comprobante.

---

### Panel Administrativo
**RF cubiertos:** RF-31, RF-32 — **no genera tablas propias**, es consumo directo de datos ya modelados por otros módulos.

**Backend (`src/panel_admin/`):** endpoints de agregación, sin modelo propio:
- Alumnos activos (`ALUMNO.estado = activo`).
- Deuda pendiente total (`SUM(FACTURA.montoTotal) WHERE estado != pagada`).
- Inasistencias del día (`ASISTENCIA WHERE fecha = hoy AND tipo LIKE ausente%`).
- Solicitudes de compra abiertas (`SOLICITUD_COMPRA WHERE estado = pendiente`).

**Frontend (`modules/panel-admin/`):**
- Panel de Dirección con los 4 indicadores (RF-31).
- Panel de Administración con accesos rápidos a Familias, Facturación y Proveedores (RF-32) — solo navegación, sin dato nuevo.

**Arranca desde el día 1, con backend real:** se cargan a mano un puñado de filas de prueba en `ALUMNO`, `FACTURA`, `ASISTENCIA` y `SOLICITUD_COMPRA` (ya existen desde el modelado inicial, vía `database/seeds/` o insertadas a mano), y se escriben los 4 queries de agregación reales contra esos datos. El frontend llama al endpoint real desde el primer día — no hay nada que "cambiar" más adelante, solo van a cambiar los números a medida que el resto del equipo cargue datos reales en vez de los de prueba.

---

## Canu — Proveedores y Compras + IA/Sugerencias

### Proveedores y Compras
**RF cubiertos:** RF-19, RF-20, RF-21

**Backend (`src/proveedores_compras/`):**
- ABM de `Proveedor` (datos de contacto, categoría, estado) (RF-19).
- Registrar solicitudes internas de compra, con estado actualizable (RF-20).
- Generar orden de compra a partir de solicitud(es) aprobada(s), asociada a un proveedor (RF-21).

**Frontend (`modules/proveedores-compras/`):**
- ABM de proveedores.
- Formulario de solicitud de compra + listado con estado.
- Generación de orden de compra desde solicitudes aprobadas.

**Pendiente de validar con ESSERI:** ¿una orden de compra siempre corresponde a una sola solicitud, o puede agrupar varias al mismo proveedor? (Pregunta #7 — define si hace falta una tabla intermedia muchos-a-muchos o alcanza con una FK simple).

---

### IA/Sugerencias
> **Advertencia de cobertura documental:** a diferencia de los demás módulos, este no tiene ningún RF con código en la Matriz de Requerimientos — es interpretación del equipo sobre la descripción de alto nivel del enunciado del alcance. Presentarlo con esa salvedad si el tutor pregunta.

**Backend (`src/ia_sugerencias/`):**
- Detectar patrón (morosidad, inasistencias) vía OpenAI, guardar en `IA_SUGERENCIA` con `estado = pendiente_revision`.
- Generar borrador de comunicación institucional vía OpenAI, mismo flujo de revisión.
- Aprobar sugerencia — si es de tipo comunicación, crea la `NOTIFICACION_TEMPLATE` correspondiente.
- Rechazar sugerencia.
- Listar sugerencias pendientes de revisión.

**Regla no negociable:** si `requiereControlHumano = true`, la sugerencia **nunca** pasa directo a `ejecutada_automaticamente` sin pasar por `pendiente_revision` — está confirmado en el enunciado del alcance ("control humano configurable").

**Frontend (`modules/ia-sugerencias/`):**
- Bandeja de sugerencias pendientes con botones de aprobar/rechazar.
- Vista de detalle de una sugerencia (contexto + contenido generado).
- Historial de sugerencias resueltas.

**Coordinar con Arce:** una sugerencia de comunicación aprobada genera una `NOTIFICACION_TEMPLATE` — la misma tabla que usa `WORKFLOW_RULE.plantillaId` de Workflows. Acordar el contrato de esa tabla antes de que cada uno la use por su lado.

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
| RNF-15 | Cumplimiento de la Ley 25.326 (datos personales) — restringir datos sensibles en logs y exportaciones (RF-36/37/38) según rol. El más importante de los pendientes, toca datos de menores de edad |

RNF-12 (migraciones sin pérdida de datos) y RNF-13 (código documentado) ya están parcialmente cubiertos por Alembic y por `ARCHITECTURE.md`/`AGENTS.md` respectivamente — igual conviene pasarlos por un checklist final antes de la entrega, no darlos por hechos sin revisar.

---



- **Rotación de referente:** el referente ante el tutor rota en cada actividad, independientemente de quién sea dueño técnico de qué módulo.
- **Asunto de mail:** formato estricto "Proyecto 2026- Grupo 15- Actividad xx".
- **Días de entrega:** no se aceptan entregas en fines de semana, feriados o recesos.
- **Convención de ramas:** `main` protegida (branch protection ya configurado), `develop` de integración, `feature/<modulo>-<descripcion>` por tarea — ver `ARCHITECTURE.md` / `AGENTS.md` en el repo para el detalle técnico completo de estructura de carpetas y convenciones de código.
