# Diccionario de Datos — ESSERI Data Core

## Cómo leer este documento

- Cada módulo tiene sus tablas con: nombre de campo, tipo, si es PK/FK, y una breve descripción.
- Toda decisión que **no sale textual de un RF/RNF** de la Matriz de Requerimientos está marcada como **[DECISIÓN DE DISEÑO]** — hay que poder justificarla si el tutor pregunta.
- Toda duda que sigue sin resolver está en la sección **Preguntas Pendientes** al final — no inventar la respuesta, confirmar con ESSERI o con el tutor.

---

## Entidad base compartida

### `PERSONA`
> [DECISIÓN DE DISEÑO] No la pide ningún RF explícitamente. Centraliza identidad para evitar datos duplicados entre `USUARIO`, `DOCENTE` y `FAMILIA`. Se justifica por RNF-04 (integridad referencial y consistencia de datos).
>
> **[DECISIÓN CONFIRMADA]** `email` NO vive acá — vive en `USUARIO` (credencial de login). `PERSONA` guarda `sexo` en su lugar (dato demográfico). Ver nota en `FAMILIA` sobre cómo esto se resuelve para el envío de notificaciones.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | |
| apellido | string | | |
| dni | string | | |
| telefono | string | | |
| sexo | string | | |

---

## Módulo: Autenticación y Roles

RF cubiertos: RF-27, RF-28, RF-29, RF-30 · RNF-03, RNF-10

### `USUARIO`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| personaId | uuid | FK → PERSONA | 1:1, opcional (no toda persona tiene cuenta) |
| email | string | | Credencial de login. Distinto de `FAMILIA.email` (contacto para notificaciones) |
| passwordHash | string | | Nunca vive en `PERSONA` — separa identidad de credenciales (RNF-15 vs RNF-10) |
| estado | string | | activo / inactivo |
| fechaCreacion | datetime | | |
| ultimoAcceso | datetime | | |

### `ROL`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | dirección, administración, docente, familia |
| descripcion | string | | |

### `USUARIO_ROL` (tabla intermedia)
> Confirmado con el equipo: **un usuario puede tener más de un rol simultáneo** (ej. docente que también es familia).

| Campo | Tipo | Clave |
|---|---|---|
| usuarioId | uuid | FK → USUARIO |
| rolId | uuid | FK → ROL |

### `PERMISO`
> Cubre RF-28: *"permisos diferenciados por módulo y acción"*.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| modulo | string | | ej. "Facturación" |
| accion | string | | ej. "exportar" |

### `ROL_PERMISO` (tabla intermedia)
| Campo | Tipo | Clave |
|---|---|---|
| rolId | uuid | FK → ROL |
| permisoId | uuid | FK → PERMISO |

### `LOG_ACCESO`
> Cubre RF-27: *"intentos fallidos son registrados"*. Distinto de `EVENT_LOG` (que registra cambios de datos, no intentos de login).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| usuarioId | uuid | FK → USUARIO | |
| fecha | datetime | | |
| resultado | string | | exitoso / fallido |
| ipOrigen | string | | |

---

## Módulo: Familias y Alumnos

RF cubiertos: RF-01, RF-02 (parcial), RF-03, RF-13, RF-14

### `FAMILIA`
> **[DECISIÓN CONFIRMADA]** Toda `FAMILIA` debe estar registrada como `USUARIO` (login obligatorio, no opcional como el resto de los casos de `PERSONA`). Por eso no lleva `email` propio — se resuelve vía `FAMILIA.personaId → USUARIO.personaId (misma PERSONA) → USUARIO.email`. Esto resuelve a favor de RF-28 (familia como rol con permisos propios) por sobre la lectura más pasiva de `Entrega_2.2` ("receptoras de notificaciones").
>
> **Nota de integridad, no forzable solo con el diagrama:** `USUARIO.personaId` sigue siendo nullable a nivel de columna (porque `ALUMNO`/`DOCENTE` sin cuenta siguen siendo válidos), pero para el caso específico de `FAMILIA` la regla de negocio exige que exista un `USUARIO` asociado — requiere validación en backend, no solo en el esquema.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| personaId | uuid | FK → PERSONA | 1:1. Cada fila = un responsable/tutor, no un hogar completo |
| estadoDeuda | string | | |

### `ALUMNO`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| personaId | uuid | FK → PERSONA | 1:1 |
| numeroLegajo | string | | (`legajo` en el drawio) Se actualiza automáticamente ante cambios (RF-12) |
| estado | string | | activo / inactivo / egresado |

### `FAMILIA_ALUMNO` (tabla intermedia)
> Confirmado con el equipo: **un alumno puede tener varias familias responsables** (ej. padres separados, cada uno con su propio registro de `FAMILIA`), y una familia puede tener varios alumnos (hermanos).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| familiaId | uuid | FK → FAMILIA | |
| alumnoId | uuid | FK → ALUMNO | |
| parentesco | string | | [DECISIÓN DE DISEÑO] No pedido por ningún RF explícito |
| responsablePrincipal | boolean | | Sí toca un RF real (RF-15/RF-16) — define a quién facturarle por defecto |

---

## Módulo: Académico

RF cubiertos: RF-04, RF-05, RF-06, RF-07, RF-08, RF-09

### `NIVEL_EDUCATIVO`
| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| nombre | string | |

### `ANIO`
| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| nivelEducativoId | uuid | FK → NIVEL_EDUCATIVO |
| numero | int | |

### `DIVISION`
| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| anioId | uuid | FK → ANIO |
| nombre | string | |

### `MATERIA`
> [DECISIÓN DE DISEÑO] Cuelga de `ANIO`, no de `DIVISION`, siguiendo la letra literal de RF-08 ("materias asociadas a cada año y nivel educativo"). Implica que todas las divisiones de un mismo año comparten las mismas materias. **No confirmado con ESSERI** — podría no servir si hay orientaciones distintas por división dentro del mismo año.

| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| anioId | uuid | FK → ANIO |
| nombre | string | |

### `DOCENTE`
| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| personaId | uuid | FK → PERSONA, 1:1 |
| legajo | string | |

### `ASIGNACION_DOCENTE`
> Cubre RF-09: docente-materia-división por ciclo lectivo.

| Campo | Tipo | Clave |
|---|---|---|
| id | uuid | PK |
| docenteId | uuid | FK → DOCENTE |
| materiaId | uuid | FK → MATERIA |
| divisionId | uuid | FK → DIVISION |
| cicloLectivo | string | |

---

## Módulo: Inscripciones

RF cubiertos: RF-10, RF-11, RF-12, RF-33

### `INSCRIPCION`
> Un alumno acumula muchas inscripciones a lo largo del tiempo (una por ciclo lectivo, más las que genere RF-12). No confundir con duplicación: cada fila es un período real distinto.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| alumnoId | uuid | FK → ALUMNO | |
| divisionId | uuid | FK → DIVISION | |
| cicloLectivo | string | | |
| fechaInscripcion | date | | |
| tipo | string | | nueva / reinscripción / cambio de matrícula / baja |
| estado | string | | activa / finalizada / baja |

### `ASISTENCIA`
> **[CONFIRMADO CON ESSERI]** La asistencia se toma por día, no por materia. Se conecta solo a `INSCRIPCION` (nunca directo a `ALUMNO`, para evitar dato redundante — el alumno se obtiene vía `INSCRIPCION.alumnoId`). No lleva `asignacionDocenteId`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| inscripcionId | uuid | FK → INSCRIPCION | |
| fecha | date | | |
| tipo | string | | presente / ausente justificado / ausente injustificado |

---

## Módulo: Facturación y Cobranza

RF cubiertos: RF-15, RF-16, RF-17, RF-18 (parcial, ver nota), RF-36

### `FACTURA`
> **[CONFIRMADO CON ESSERI]** La facturación es por alumno, no por familia. Por eso `FACTURA` conecta con `INSCRIPCION` (no con `FAMILIA` directo) — mismo criterio que `ASISTENCIA`: el cobro tiene sentido en el contexto de una inscripción activa. El "estado de deuda de la familia" (RF-17) se calcula navegando `FAMILIA → FAMILIA_ALUMNO → ALUMNO → INSCRIPCION → FACTURA`, no se guarda como FK directa.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| inscripcionId | uuid | FK → INSCRIPCION | |
| fechaEmision | date | | |
| fechaVencimiento | date | | |
| montoTotal | decimal | | |
| estado | string | | pendiente / vencida / pagada |

### `DETALLE_FACTURA`
> Ya no lleva `inscripcionId` propio — sería redundante ahora que `FACTURA` lo tiene. Sigue permitiendo varios conceptos dentro de una misma factura (ej. cuota + mora).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| facturaId | uuid | FK → FACTURA | |
| tipo | string | | cuota (default) / otro — ver pregunta pendiente #6 |
| descripcion | string | | ej. "Cuota marzo" |
| monto | decimal | | |

### `PAGO`
> Cubre RF-16. Una factura puede tener varios pagos (parciales).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| facturaId | uuid | FK → FACTURA | |
| metodoPagoId | uuid | FK → METODO_PAGO | |
| fecha | date | | |
| monto | decimal | | |
| comprobante | string | | Referencia/archivo, requerido según `METODO_PAGO.requiereComprobante` |

### `METODO_PAGO`
> [DECISIÓN DE DISEÑO] No pedido por ningún RF explícito. Tabla catálogo en vez de campo de texto libre — mismo patrón que `PERMISO` — para poder dar de alta/baja métodos sin tocar código (RNF-06). Version de producción, no MVP mínimo.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | efectivo / transferencia / tarjeta, etc. |
| activo | boolean | | |
| requiereComprobante | boolean | | Define si el frontend pide adjuntar archivo en `PAGO.comprobante` |

**[NOTA] RF-18 (alertas de morosidad) no genera tabla en este módulo.** Se resuelve en el Motor de Workflows (`WORKFLOW_RULE` + `NOTIFICACION`, módulo aún no modelado) reaccionando sobre `FACTURA.estado = vencida`.

---

## Módulo: Proveedores y Compras

RF cubiertos: RF-19, RF-20, RF-21, RF-34, RF-35 (búsquedas, no generan tabla), RF-38

### `PROVEEDOR`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | |
| categoria | string | | |
| estado | string | | activo / inactivo |
| telefono | string | | |
| email | string | | |

### `SOLICITUD_COMPRA`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| usuarioId | uuid | FK → USUARIO | Quién solicitó (no `PERSONA` directo — requiere cuenta del sistema) |
| articulo | string | | |
| cantidad | int | | |
| areaSolicitante | string | | |
| estado | string | | pendiente / aprobada / rechazada |
| fecha | date | | |

### `ORDEN_COMPRA`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| proveedorId | uuid | FK → PROVEEDOR | |
| fecha | date | | |
| estado | string | | |

### `ORDEN_COMPRA_SOLICITUD` (tabla intermedia)
> [DECISIÓN DE DISEÑO — pendiente de confirmar] RF-21 dice "a partir de **solicitudes** aprobadas" (plural). Modelado como muchos a muchos para permitir que una orden agrupe varias solicitudes al mismo proveedor. Si en la práctica es siempre 1 a 1, el modelo sigue funcionando (una fila por orden).

| Campo | Tipo | Clave |
|---|---|---|
| ordenCompraId | uuid | FK → ORDEN_COMPRA |
| solicitudCompraId | uuid | FK → SOLICITUD_COMPRA |

---

## Módulo: Motor de Workflows y Notificaciones

RF cubiertos: RF-22, RF-23, RF-24, RF-25, RF-26

### `CAMPO_EVENTO`
> [DECISIÓN DE DISEÑO] No pedido explícitamente por ningún RF, pero necesario para que RF-25 sea usable por personal no técnico (Dirección/Administración) sin escribir JSON ni placeholders a mano. Catálogo de qué variables están disponibles para cada `TIPO_EVENTO`; alimenta los desplegables de `WORKFLOW_RULE.condicion` y los "chips" insertables en `NOTIFICACION_TEMPLATE.cuerpo`. La UI (dropdowns, editor con chips) es trabajo del módulo de Mockups, no de este DER — pero la tabla que la sostiene sí corresponde acá.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| tipoEventoId | uuid | FK → TIPO_EVENTO | |
| nombreInterno | string | | ej. "diasVencido" — lo que va dentro del JSON/placeholder |
| etiqueta | string | | ej. "Días de deuda" — lo que ve el usuario en pantalla |
| tipoDato | string | | numero / texto / fecha |

### `TIPO_EVENTO`
> [DECISIÓN DE DISEÑO] Catálogo en vez de texto libre en `WORKFLOW_RULE`, mismo patrón que `PERMISO`/`METODO_PAGO` (RNF-06). Acá se cargan valores como "factura.vencida", "inasistencia.registrada", "inscripcion.cambio_matricula".

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | |
| descripcion | string | | |

### `WORKFLOW_RULE`
> [DECISIÓN DE DISEÑO — pendiente de confirmar con el equipo] RF-22 describe un motor genérico ("acción resultante", sin limitarla), pero RF-24/25/26 solo detallan notificaciones. Modelado con `tipoAccion` abierto por fidelidad a RF-22 y a la arquitectura orientada a eventos del proyecto; si en la práctica solo van a implementar notificaciones, se puede simplificar sacando `tipoAccion` y dejando `plantillaId` obligatorio.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| tipoEventoId | uuid | FK → TIPO_EVENTO | |
| nombre | string | | |
| condicion | jsonb | | **No es código ejecutable.** Estructura fija `{campo, operador, valor}`, ej. `{"campo":"diasVencido","operador":">","valor":30}`. El backend interpreta estos valores con lógica propia — nunca ejecuta el contenido del campo directamente (evita riesgo de inyección de código, equivalente a SQL injection pero en lógica de aplicación) |
| tipoAccion | string | | "notificar" (único implementado) u otro a futuro |
| plantillaId | uuid | FK → NOTIFICACION_TEMPLATE | Opcional, solo si tipoAccion = "notificar" |
| activo | boolean | | |

**[NOTA — decisión revisada]** Se evaluó agregar `n8nWorkflowId` por fila, pero se descartó: todas las reglas con `tipoAccion = "notificar"` llaman al mismo webhook genérico de n8n (backend ya resuelve destinatario y contenido antes de llamarlo), así que guardarlo por regla sería dato repetido sin necesidad. La URL del webhook es config del sistema, no un atributo de `WORKFLOW_RULE`. Si en el futuro aparece un `tipoAccion` que use un flujo de n8n distinto, se mapea por tipo de acción (tabla chica aparte), no por regla individual.

**[NOTA — arquitectura, no cambia el DER]** El envío real (Gmail/Google Workspace) se ejecuta vía n8n en vez de código propio de integración; `WORKFLOW_EXECUTION`/`NOTIFICACION` en PostgreSQL siguen siendo la fuente de verdad (RNF-05), n8n es solo el ejecutor. **Pendiente:** documentar esta dependencia de infraestructura externa en el Plan de gestión de riesgos, y su impacto (probable reducción de horas de desarrollo) en el Plan de gestión del presupuesto.

### `NOTIFICACION_TEMPLATE`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| nombre | string | | |
| asunto | string | | |
| cuerpo | string | | Texto plano con placeholders tipo `{{nombreFamilia}}`, `{{montoDeuda}}`, `{{mesCuota}}`. El backend los reemplaza por datos reales al momento de generar la `NOTIFICACION` — no es código, solo texto con marcadores a sustituir |

### `WORKFLOW_EXECUTION`
> Cubre RF-23.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| workflowRuleId | uuid | FK → WORKFLOW_RULE | |
| fecha | datetime | | |
| estado | string | | exitoso / fallido / pendiente |
| detalle | string | | |

### `NOTIFICACION`
> Cubre RF-26. Solo para destinatario externo (`FAMILIA`). Las alertas internas (RF-18) **no generan fila acá** — quedan cubiertas por `WORKFLOW_EXECUTION` (ver nota abajo). `familiaId` ya funciona como destinatario — la dirección de envío se resuelve vía `FAMILIA.personaId → USUARIO.personaId → USUARIO.email` (toda familia tiene cuenta registrada, ver decisión en `FAMILIA`).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| workflowExecutionId | uuid | FK → WORKFLOW_EXECUTION | |
| familiaId | uuid | FK → FAMILIA | Destinatario |
| fecha | datetime | | |
| estadoEnvio | string | | |

**[NOTA — reparto de responsabilidades]** `WORKFLOW_RULE.tipoAccion` define dos caminos posibles a partir del mismo evento:
- `"notificar"` → genera `WORKFLOW_EXECUTION` + `NOTIFICACION` (email real a una familia).
- `"alerta_interna"` → genera **solo** `WORKFLOW_EXECUTION` (sin plantilla, sin notificación), consultable vía RF-23 y mostrado en tiempo real en el Panel Administrativo (RF-31). Cubre RF-18 sin necesidad de "enviar" nada a nadie.

---

## Módulo: Auditoría y Trazabilidad

RF cubiertos: RF-13, RF-14 · RNF-05

> **No genera tablas propias.** Es una capa de consulta/presentación sobre 4 tablas ya construidas en otros módulos, cada una con propósito distinto — evita duplicar lógica de auditoría (RNF-06). RF-14 ("consultar historial de una entidad, ordenado cronológicamente") se resuelve con una pantalla/consulta sobre estas tablas, no con un modelo nuevo.

| Tabla | Qué audita | Módulo de origen |
|---|---|---|
| `EVENT_LOG` | Cambios de datos (crear/editar/borrar) en cualquier entidad | Familias y Alumnos |
| `LOG_ACCESO` | Intentos de login (éxito/fallo) | Autenticación y Roles |
| `WORKFLOW_EXECUTION` | Disparos de reglas de automatización (incluye alertas internas) | Workflows |
| `NOTIFICACION` | Emails efectivamente enviados a familias | Workflows |

### `EVENT_LOG`

> Cubre RF-13 y RF-14. Genérica (no una tabla de log por módulo) para no duplicar lógica de auditoría en cada equipo de desarrollo — alineado con RNF-06 (escalabilidad modular).
>
> **[EXCEPCIÓN CONSCIENTE A RNF-04 — única en todo el DER]** `usuarioId` es una FK real y validada por PostgreSQL (siempre apunta a `USUARIO`). `entidad` + `entidadId` **no tienen FK real** — no pueden tenerla, porque `entidad` puede referirse a cualquiera de las ~20 tablas del sistema (FAMILIA, ALUMNO, FACTURA, etc.), y PostgreSQL no permite una FK condicional según el valor de otra columna. La alternativa (una columna FK por cada entidad posible: `familiaId`, `alumnoId`, `facturaId`...) generaría una tabla dispersa con ~20 columnas casi siempre en NULL, y perdería la genericidad que motivó esta tabla en primer lugar. La validación de que `entidadId` exista realmente en la tabla que indica `entidad` queda a cargo del backend, no de la base de datos.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| entidad | string | | nombre de la tabla afectada (ej. "FAMILIA") |
| entidadId | uuid | | id de la fila afectada |
| campo | string | | campo modificado |
| valorAnterior | string | | |
| valorNuevo | string | | |
| usuarioId | uuid | FK → USUARIO | |
| fecha | datetime | | |

**[NOTA TÉCNICA — performance]** Requiere índice compuesto `(entidad, entidadId, fecha)`. Sin este índice, las consultas de RF-14 se degradan a medida que crece el volumen, porque cada modificación en el sistema genera un INSERT adicional acá.

---

## Módulo: Panel Administrativo

RF cubiertos: RF-31, RF-32

> **No genera tablas propias.** Es consumo directo de datos ya modelados.

| Indicador (RF-31, perfil Dirección) | Fuente |
|---|---|
| Alumnos activos | `ALUMNO.estado = "activo"` |
| Deuda pendiente total | `SUM(FACTURA.montoTotal) WHERE estado != "pagada"` |
| Inasistencias del día | `ASISTENCIA WHERE fecha = hoy AND tipo LIKE "ausente%"` |
| Solicitudes de compra abiertas | `SOLICITUD_COMPRA WHERE estado = "pendiente"` |

RF-32 (perfil Administración): accesos rápidos a Familias, Facturación y Proveedores — navegación, sin dato nuevo.

---

## Módulo: Capa de Inteligencia Artificial

> **[ADVERTENCIA DE COBERTURA DOCUMENTAL]** A diferencia de los otros 7 módulos, este no tiene ningún RF con código ni criterio de aceptación en la Matriz de Requerimientos. Solo está descripto a nivel EDT y en el enunciado del alcance (`Entrega_2.2`, `Entrega_3.0`): *"generación de comunicaciones institucionales, detección de patrones (morosidad, inasistencias) y asistencia en análisis operativo... control humano configurable sobre las acciones automáticas"*. Todo lo modelado acá es interpretación del equipo sobre esa descripción de alto nivel, no un RF confirmado — presentarlo con esa salvedad si el tutor pregunta.

### `IA_SUGERENCIA`
> Cubre tanto "detección de patrones" como "generación de comunicaciones" con una sola tabla, mismo patrón genérico que `EVENT_LOG` para `entidad`/`entidadId`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK | |
| tipo | string | | "patron_detectado" / "comunicacion" |
| entidad | string | | Sin FK real, mismo criterio que `EVENT_LOG` |
| entidadId | uuid | | Familia/alumno afectado por el patrón detectado |
| contenidoGenerado | string | | Texto generado por OpenAI (descripción del patrón o borrador de mensaje) |
| requiereControlHumano | boolean | | Si true, queda en "pendiente_revision" hasta aprobación manual — nunca se ejecuta sola |
| estado | string | | pendiente_revision / aprobada / rechazada / ejecutada_automaticamente |
| usuarioRevisorId | uuid | FK → USUARIO, opcional | Quién aprobó/rechazó |
| fechaGeneracion | datetime | | |
| fechaRevision | datetime | | |
| plantillaGeneradaId | uuid | FK → NOTIFICACION_TEMPLATE, opcional | Solo se completa si `tipo = "comunicacion"` y `estado = "aprobada"` — la sugerencia se convirtió en plantilla reutilizable |

Antes decía "relación opcional" sin columna real — corregido: la FK vive en `IA_SUGERENCIA`, no en `NOTIFICACION_TEMPLATE` (una plantilla puede existir sin haber salido de una sugerencia de IA, así que no correspondía poner la FK del otro lado).

---

## Enumeraciones (valores fijos por campo)

> Todo campo `string` que en la práctica solo acepta un set cerrado de valores. Recomendación de implementación: usar `CHECK constraint` o tipo `ENUM` nativo de PostgreSQL en vez de dejarlo como texto libre sin validar — así la base de datos rechaza valores inválidos en vez de confiar en que el backend siempre valide bien (refuerza RNF-04).

| Tabla.Campo | Valores | Origen |
|---|---|---|
| `USUARIO.estado` | activo, inactivo | [DECISIÓN DE DISEÑO] |
| `ALUMNO.estado` | activo, inactivo, egresado | [DECISIÓN DE DISEÑO] |
| `FAMILIA.estadoDeuda` | al_dia, con_deuda, en_mora | **[COMPLETADO AHORA — antes sin definir]** Propuesta del equipo; el corte entre "con_deuda" y "en_mora" depende de la regla de morosidad de RF-18 (X días), que también está pendiente de confirmar con ESSERI |
| `INSCRIPCION.tipo` | nueva, reinscripcion, cambio_matricula, baja | RF-10, RF-11, RF-12 |
| `INSCRIPCION.estado` | activa, finalizada, baja | [DECISIÓN DE DISEÑO] |
| `ASISTENCIA.tipo` | presente, ausente_justificado, ausente_injustificado | RF-04 (textual) |
| `FACTURA.estado` | pendiente, vencida, pagada | RF-17 (textual) |
| `DETALLE_FACTURA.tipo` | cuota (único confirmado) | Pendiente #6 — puede crecer según respuesta de ESSERI |
| `PROVEEDOR.estado` | activo, inactivo | RF-19 (textual) |
| `SOLICITUD_COMPRA.estado` | pendiente, aprobada, rechazada | RF-20 (implícito en "estado actualizable") |
| `ORDEN_COMPRA.estado` | emitida, recibida, cancelada | **[COMPLETADO AHORA — antes sin definir]** Propuesta del equipo, no confirmada por ningún RF |
| `LOG_ACCESO.resultado` | exitoso, fallido | RF-27 (textual) |
| `WORKFLOW_EXECUTION.estado` | exitoso, fallido, pendiente | RF-23 (textual) |
| `NOTIFICACION.estadoEnvio` | enviado, fallido, pendiente | **[COMPLETADO AHORA — antes sin definir]** Propuesta del equipo |
| `WORKFLOW_RULE.tipoAccion` | notificar, alerta_interna | [DECISIÓN DE DISEÑO] |
| `CAMPO_EVENTO.tipoDato` | numero, texto, fecha | [DECISIÓN DE DISEÑO] |
| `IA_SUGERENCIA.tipo` | patron_detectado, comunicacion | [DECISIÓN DE DISEÑO] |
| `IA_SUGERENCIA.estado` | pendiente_revision, aprobada, rechazada, ejecutada_automaticamente | [DECISIÓN DE DISEÑO] |

---

## Tablas Catálogo — Datos a Precargar

> Estas tablas no sirven vacías: el sistema no funciona hasta que tengan al menos las filas mínimas cargadas. Separadas en 3 grupos según qué tan segura es la carga inicial.

### Grupo A — Confirmado por RF, se puede cargar ya sin validar con ESSERI

**`ROL`** (RF-28, textual: *"dirección, administración, docente, familia"*)
| nombre |
|---|
| dirección |
| administración |
| docente |
| familia |

**`TIPO_EVENTO`** (RF-24, ejemplos textuales)
| nombre | descripcion |
|---|---|
| inasistencia.registrada | Se registró una ausencia |
| factura.vencida | Una factura pasó a estado vencida |
| inscripcion.cambio_matricula | Cambio de nivel, división o baja |

### Grupo B — Decisión razonable del equipo, pero conviene validar antes de cargar en producción

**`METODO_PAGO`** — valores propuestos: efectivo, transferencia, tarjeta. **No confirmado con ESSERI qué medios de pago aceptan realmente** (ver pregunta pendiente nueva #10 abajo).

**`PERMISO`** — se arma como producto de (módulo × acción) para cada uno de los 9 módulos del sistema. Acciones sugeridas por módulo: `crear`, `leer`, `actualizar`, `eliminar`, y `exportar` donde aplique (Facturación, Proveedores, Asistencias según RF-36/37/38). Antes de precargar, el equipo debe decidir la matriz completa de qué rol tiene qué permiso — no es dato que salga de un RF, es configuración institucional que debería revisar Dirección.

**`CAMPO_EVENTO`** — depende de qué `TIPO_EVENTO` carguen. Ejemplo para `factura.vencida`: `diasVencido` (número), `montoDeuda` (número), `nombreFamilia` (texto). Hay que repetir este ejercicio por cada evento del Grupo A.

### Grupo C — Dato operativo real de ESSERI, NO inventar

**`NIVEL_EDUCATIVO`, `ANIO`, `DIVISION`, `MATERIA`** — esto no es un catálogo técnico, es la estructura curricular real del colegio (¿tienen Inicial/Primario/Secundario? ¿cuántos años cada nivel? ¿cuántas divisiones por año, con qué nombres — A/B/C o por color, por ejemplo?). **Ninguno de los documentos del proyecto trae este dato** — es información que se debe relevar directamente con ESSERI (parte de la actividad de "Relevamiento de procesos institucionales" de la EDT), no algo que el equipo pueda completar por su cuenta ni siquiera como propuesta razonable, porque es 100% específico de la institución.

---

## Confirmado con ESSERI

| Pregunta | Respuesta | Impacto en el modelo |
|---|---|---|
| ¿La asistencia se toma por división o por materia? | **Por día/división.** | `ASISTENCIA` sin `asignacionDocenteId`, confirmado. |
| ¿La facturación es por familia o por alumno? | **Por alumno.** | `FACTURA` conecta con `INSCRIPCION`, no con `FAMILIA`. Deuda de familia = suma agregada vía `FAMILIA_ALUMNO`. |
| ¿Todas las familias tienen cuenta de acceso al sistema? | **Sí, registro obligatorio.** | `FAMILIA` no lleva `email` propio — se resuelve vía `USUARIO.email` (misma `PERSONA`). Decisión del equipo, no de ESSERI — resuelve a favor de RF-28 por sobre la lectura pasiva de `Entrega_2.2`. |

## Preguntas Pendientes de Validar con ESSERI

| # | Pregunta | Por qué importa | Módulo afectado |
|---|---|---|---|
| 3 | Un alumno puede tener varias familias responsables (`FAMILIA_ALUMNO`). Ahora que la factura es **por alumno**: si hay más de una familia vinculada, ¿a nombre de cuál se emite el cobro? ¿Alcanza con `responsablePrincipal`, o necesitan poder elegir por factura? | **Se volvió más urgente tras confirmar "factura por alumno"** — antes quedaba implícito, ahora hay que decidirlo si o si para poder emitir una sola factura por alumno | Facturación / Familias y Alumnos |
| 4 | Si un usuario tiene varios roles con permisos superpuestos o conflictivos en un mismo módulo, ¿cuál gana? | Afecta la lógica de RF-30 (denegar acciones no permitidas) | Autenticación y Roles |
| 5 | ¿Puede haber materias distintas entre divisiones de un mismo año (ej. orientaciones)? | Valida si `MATERIA` debe colgar de `ANIO` o de `DIVISION` | Académico |
| 6 | ¿Qué conceptos de cobro maneja ESSERI además de la cuota mensual (matrícula, materiales, seguro, indumentaria, comedor, etc.)? | RF-15 dice "facturas o **conceptos de cobro**" (plural implícito), pero ningún documento lista conceptos concretos. Define si `DETALLE_FACTURA` debe quedar genérica o si alcanza con renombrarla `CUOTA` | Facturación y Cobranza |
| 7 | ¿Una orden de compra siempre corresponde a una sola solicitud, o puede agrupar varias solicitudes aprobadas al mismo proveedor? | RF-21 usa plural ("solicitudes aprobadas"). Define si `ORDEN_COMPRA_SOLICITUD` es realmente necesaria como muchos a muchos o alcanza con una FK simple | Proveedores y Compras |
| 8 | El equipo decidió: alertas de morosidad (RF-18) = registro interno vía `WORKFLOW_EXECUTION`, sin notificación enviada; notificación real por email (RF-24) = solo a familias. ¿ESSERI espera además algún aviso activo (push/email) hacia Dirección o Administración, o alcanza con verlo reflejado en el panel (RF-31)? | Confirma que no hace falta reabrir `NOTIFICACION` a destinatarios internos | Workflows / Panel Administrativo |
| 9 | ¿El motor de workflows (RF-22) solo dispara notificaciones, o también debe ejecutar otras acciones automáticas (ej. cambiar estado de una factura, generar una orden de compra sola)? | Define si conviene mantener `WORKFLOW_RULE.accion` genérico o si alcanza con acotarlo solo a notificaciones | Motor de Workflows |
| 10 | ¿Qué métodos de pago acepta ESSERI en la práctica (efectivo, transferencia, tarjeta, Mercado Pago, cheque)? ¿Cuáles requieren comprobante adjunto? | Precarga de `METODO_PAGO` — hoy son valores propuestos por el equipo, sin confirmar | Facturación y Cobranza |
| 11 | ¿Cuál es la estructura curricular real de ESSERI (niveles, cantidad de años por nivel, divisiones por año y cómo se nombran)? | Precarga de `NIVEL_EDUCATIVO`/`ANIO`/`DIVISION`/`MATERIA` — dato operativo real, no se puede inventar ni proponer un default razonable | Académico |
| 12 | ¿A partir de cuántos días de deuda vencida se considera "morosidad" (RF-18)? | Define el corte entre `FAMILIA.estadoDeuda = con_deuda` vs `en_mora`, y el valor por defecto de la condición en `WORKFLOW_RULE` para la regla de morosidad | Facturación / Workflows |

---

## Changelog del documento

| Fecha | Cambio |
|---|---|
| — | Versión inicial: módulos Autenticación y Roles, Familias y Alumnos, Académico, Inscripciones |
| — | Agregado Facturación y Cobranza, Proveedores y Compras |
| — | Confirmado con ESSERI: asistencia por día, facturación por alumno |
| — | Agregado Motor de Workflows y Notificaciones (incluye `CAMPO_EVENTO`, `condicion` como jsonb, decisión de ejecución vía n8n sin cambios al modelo) |
| — | Formalizado Auditoría y Trazabilidad (consolida `EVENT_LOG`, `LOG_ACCESO`, `WORKFLOW_EXECUTION`, `NOTIFICACION`; documentada excepción a RNF-04 en `EVENT_LOG`) |
| — | Agregado Panel Administrativo (sin tablas propias) y Capa de IA (`IA_SUGERENCIA`) — **DER completo, 9 módulos, 29 tablas** |
| — | Corregida FK faltante entre `IA_SUGERENCIA` y `NOTIFICACION_TEMPLATE` (`plantillaGeneradaId`) |
| — | Agregada sección de Enumeraciones (18 campos) y Tablas Catálogo a Precargar (3 grupos según nivel de confianza); completados 3 valores que habían quedado sin definir (`FAMILIA.estadoDeuda`, `ORDEN_COMPRA.estado`, `NOTIFICACION.estadoEnvio`); sumadas preguntas pendientes #10, #11, #12 |
