# Diccionario de Datos — ESSERI Data Core

> **Modelo v1.0 — congelado.** Diccionario y DER coinciden campo por campo (54 tablas, verificado), ninguna pregunta pendiente bloquea esquema (solo precarga: #11 parcial, #17), las preguntas de decisión de equipo están cerradas (#4: gana el permiso más permisivo · #15: allowlist de acciones con aprobación humana decidida), cada vista del MVP tiene responsable confirmado (`docs/division-de-tareas-equipo.md`), RNF-15 tiene dueño (Botteri), y los tres `.env.example` reflejan las dependencias nuevas. **Recién a partir de acá se puede generar la primera migración de Alembic** (zona sensible, modo plan) — este documento y el DER son la fuente de verdad.

## Cómo leer este documento

- Cada módulo tiene sus tablas con: nombre de campo, tipo, si es PK/FK, y una breve descripción.
- Toda decisión que **no sale textual de un RF/RNF** de la Matriz de Requerimientos está marcada como **[DECISIÓN DE DISEÑO]** — hay que poder justificarla si el tutor pregunta.
- Toda respuesta que sale textual de `docs/aclaraciones-cliente-esseri.md` (las 19 aclaraciones directas del cliente) está marcada como **[ACLARACIÓN CLIENTE]** — misma autoridad que un RF, más reciente.
- Toda duda que sigue sin resolver está en la sección **Preguntas Pendientes** al final — no inventar la respuesta, confirmar con ESSERI o con el tutor.
- **[DECISIÓN DE DISEÑO] Orden de campos, estandarizado en todas las tablas:** `id` (PK) primero → atributos propios → atributos de control (`created_at`/`updated_at`) → claves foráneas al final. `id` se llama siempre así, sin prefijo del nombre de tabla. `created_at`/`updated_at` se agregaron a las entidades mutables con `id` propio que no tenían ya un campo equivalente (ej. `fecha`, `fecha_emision`, `fecha_solicitud`) — quedaron afuera las tablas append-only/inmutables por diseño (`AUDIT_LOG`, `EVENT_LOG`, `LOG_ACCESO`, `MOVIMIENTO`, `NOTIFICACION`, `WORKFLOW_EXECUTION`, que ya tienen su propio timestamp de cierre) y las tablas de detalle/línea sin ciclo de vida propio (`DETALLE_FACTURA`, `ORDEN_COMPRA_DETALLE`, `RECEPCION_COMPRA_DETALLE`). No se agregó `fecha_baja`: donde hace falta soft-delete ya existe `activo` (boolean) o `estado`, y duplicarlo violaría RNF-04 (dos fuentes para el mismo dato).
- **[DECISIÓN DE DISEÑO] Todas las tablas intermedias/puente tienen su propia PK `id`** (`USUARIO_ROL`, `ROL_PERMISO`, `FAMILIA_ALUMNO`, `PRODUCTO_PROVEEDOR`, `ORDEN_COMPRA_SOLICITUD`) en vez de usar la combinación de las dos FK como clave compuesta — permite referenciar una fila puntual de la relación (por ejemplo, para auditoría o para borrar/actualizar una asociación específica sin depender de conocer ambas FK) y es consistente con el resto del modelo, que siempre usa `id` uuid como PK. No llevan `created_at`/`updated_at`: son registros de asociación simple, sin ciclo de vida propio más allá de existir o no.
- **[DECISIÓN DE DISEÑO] Nombre de toda FK = nombre singular de la tabla que referencia + `_id`, sin ningún otro texto** (ej. `usuario_id` → `USUARIO`, `familia_id` → `FAMILIA`), para que sea inmediato reconocer a qué tabla apunta cada FK con solo leer el nombre del campo. **Única excepción, forzada por colisión de nombres:** `SOLICITUD_INSCRIPCION` tiene dos FK a `PERSONA` (el aspirante y quien consulta si no es el aspirante) — no pueden llamarse ambas `persona_id` porque una tabla no puede tener dos columnas con el mismo nombre. Se resolvieron como `aspirante_persona_id` y `contacto_persona_id`, siempre con la tabla referenciada (`persona`) como sufijo de la FK.

---

## Entidad base compartida

### `PERSONA`
> [DECISIÓN DE DISEÑO] No la pide ningún RF explícitamente. Centraliza identidad para evitar datos duplicados entre `USUARIO`, `DOCENTE` y `FAMILIA`. Se justifica por RNF-04 (integridad referencial y consistencia de datos).
>
> **[DECISIÓN CONFIRMADA]** `email` NO vive acá — vive en `USUARIO` (credencial de login). `PERSONA` guarda `sexo` en su lugar (dato demográfico). Ver nota en `FAMILIA` sobre cómo esto se resuelve para el envío de notificaciones.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| apellido | string |  |  |
| dni | string |  |  |
| telefono | string |  |  |
| sexo | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

---

## Módulo: Autenticación y Roles

RF cubiertos: RF-27, RF-28, RF-29, RF-30 · RNF-03, RNF-10

### `USUARIO`
> **[ACLARACIÓN CLIENTE]** Login principal pasa a Google Identity/OAuth: el backend valida la identidad y sigue emitiendo un JWT interno propio para proteger endpoints y sesiones — el JWT **no se va**. Motivo del cambio: alinea con Workspace-first (Blueprint) sin abandonar la arquitectura de permisos ya diseñada. Una única identidad por persona resuelve múltiples roles (respuesta 17), no cuentas duplicadas por rol — ver `USUARIO_ROL`.
>
> **`src/auth/` es zona sensible (`AGENTS.md`) — cambios ahí en modo plan, sin cambios grandes de una sola vez.**

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| email | string | UQ | Credencial de login. Distinto de `FAMILIA.email` (contacto para notificaciones). **[IMPLEMENTACIÓN RF-27]** `UNIQUE` + índice: es la columna por la que buscan los dos caminos de login, y con duplicados el resultado sería no determinístico |
| password_hash | string |  | `[ACLARACIÓN CLIENTE]` Ya no obligatorio: con Google Identity como login principal, queda como fallback explícito. Nulo en las cuentas que nacieron por Google |
| auth_provider | string |  | `[ACLARACIÓN CLIENTE]` google / local. **[IMPLEMENTACIÓN RF-27]** Marca el método **principal**, no una exclusión — ver la nota de abajo sobre cuentas vinculadas |
| provider_subject | string |  | `[ACLARACIÓN CLIENTE]` Identificador estable que devuelve Google Identity. Nulo mientras la cuenta no haya entrado nunca por Google |
| estado | string |  | activo / inactivo |
| fecha_creacion | datetime |  |  |
| ultimo_acceso | datetime |  |  |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| persona_id | uuid | FK | 1:1, opcional (no toda persona tiene cuenta) |

**[IMPLEMENTACIÓN RF-27] Cómo conviven los dos logins.** `auth_provider` indica el método principal, no una exclusión — una cuenta puede terminar con las dos vías habilitadas:

| `auth_provider` | `password_hash` | `provider_subject` | Entra por |
|---|---|---|---|
| `google` | nulo | el `sub` de Google | Solo botón de Google |
| `local` | hash bcrypt | nulo | Solo email + contraseña |
| `google` | hash bcrypt | el `sub` de Google | Ambos (cuenta vinculada) |

La tercera fila aparece cuando una cuenta creada como `local` entra por Google por primera vez: se le guarda el `provider_subject` y pasa a `google`, **sin borrarle el `password_hash`**, que es justamente el fallback. Por eso la condición del login con contraseña es `password_hash IS NOT NULL` y no `auth_provider = 'local'`: si fuera lo segundo, vincular la cuenta mataría el fallback. La vinculación exige que Google reporte el email como verificado.

**[IMPLEMENTACIÓN RF-27] No hay auto-registro.** Un email de Google que no está en `USUARIO` se rechaza (403) y el intento queda en `LOG_ACCESO`. Google autentica; habilitar la cuenta es decisión del sistema. La carga de usuarios la hacen los ABM (familias, inscripciones) — un `USUARIO` creado al vuelo no tendría `persona_id`, ni roles, ni vínculo con `FAMILIA`. El primer administrador se crea desde afuera con `database/seeds/00_bootstrap_admin.py`.

**Dependencia de infraestructura externa nueva:** Google Cloud/Workspace. Registrar en el Plan de Gestión de Riesgos (mismo tratamiento pendiente que ya tenía n8n).

### `ROL`
> **[ACLARACIÓN CLIENTE]** (respuesta 18): pasa de 4 a 10 valores. Ver precarga actualizada más abajo.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  | dirección, administración, docente, familia, secretaría, coordinación académica, bienestar/orientación, admisiones/comercial, compras, administrador del sistema |
| descripcion | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `USUARIO_ROL` (tabla intermedia)
> Confirmado con el equipo: **un usuario puede tener más de un rol simultáneo** (ej. docente que también es familia). **[ACLARACIÓN CLIENTE]** (respuesta 17) lo reafirma: una única identidad/cuenta por persona con múltiples roles, no cuentas duplicadas por rol.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| usuario_id | uuid | FK |  |
| rol_id | uuid | FK |  |

### `PERMISO`
> Cubre RF-28: *"permisos diferenciados por módulo y acción"*.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| modulo | string |  | ej. "Facturación" |
| accion | string |  | ej. "exportar" |
| tipo_informacion | string |  | `[ACLARACIÓN CLIENTE]` (respuesta 18). Permite acotar el permiso a un subtipo de dato dentro del módulo (ej. datos médicos de un alumno), no solo a módulo × acción |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `ROL_PERMISO` (tabla intermedia)
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| rol_id | uuid | FK |  |
| permiso_id | uuid | FK |  |

### `LOG_ACCESO`
> Cubre RF-27: *"intentos fallidos son registrados"*. Distinto de `AUDIT_LOG` (que registra cambios de campos) y de `EVENT_LOG` (que registra hechos de negocio).
>
> **[IMPLEMENTACIÓN RF-27]** `usuario_id` pasa a **nullable**. Un intento de login con un email que no existe en `USUARIO` no tiene a quién apuntar, y es justo uno de los casos que el RF pide registrar — con la FK obligatoria era irrepresentable.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | datetime |  |  |
| resultado | string |  | exitoso / fallido |
| ip_origen | string |  |  |
| usuario_id | uuid | FK | Nulo cuando el email del intento no corresponde a ningún usuario del sistema |

**Pregunta abierta para el equipo:** con `usuario_id` nulo, de un intento fallido de un desconocido solo queda la IP — no *qué* email se probó. Registrarlo requeriría un campo `email_intento` nuevo, que es un cambio de esquema sobre el modelo congelado y no se tomó por cuenta propia.

---

## Módulo: Familias y Alumnos

RF cubiertos: RF-01, RF-02 (parcial), RF-03, RF-13, RF-14

### `FAMILIA`
> **[DECISIÓN CONFIRMADA]** Toda `FAMILIA` debe estar registrada como `USUARIO` (login obligatorio, no opcional como el resto de los casos de `PERSONA`). Por eso no lleva `email` propio — se resuelve vía `FAMILIA.persona_id → USUARIO.persona_id (misma PERSONA) → USUARIO.email`. Esto resuelve a favor de RF-28 (familia como rol con permisos propios) por sobre la lectura más pasiva de `Entrega_2.2` ("receptoras de notificaciones").
>
> **Nota de integridad, no forzable solo con el diagrama:** `USUARIO.persona_id` sigue siendo nullable a nivel de columna (porque `ALUMNO`/`DOCENTE` sin cuenta siguen siendo válidos), pero para el caso específico de `FAMILIA` la regla de negocio exige que exista un `USUARIO` asociado — requiere validación en backend, no solo en el esquema.
>
> **[ACLARACIÓN CLIENTE]** La designación de un responsable económico (`RESPONSABLE_ECONOMICO`) **no libera** a los demás responsables parentales de sus obligaciones con ESSERI — dato relevante para cobranza legal, no cambia este esquema.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| estado_deuda | string |  | **[ACLARACIÓN CLIENTE]** Deja de ser fuente de verdad. Se calcula navegando `FAMILIA → FAMILIA_ALUMNO → ALUMNO → CUENTA_CORRIENTE → MOVIMIENTO` (reemplaza el recorrido anterior por `FACTURA`/`PAGO`) — ver `CUENTA_CORRIENTE` en el módulo de Facturación y Cobranza |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| persona_id | uuid | FK | 1:1. Cada fila = un responsable/tutor, no un hogar completo |

### `ALUMNO`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| numero_legajo | string |  | (`legajo` en el drawio) Se actualiza automáticamente ante cambios (RF-12) |
| estado | string |  | activo / inactivo / egresado |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| persona_id | uuid | FK | 1:1 |

### `FAMILIA_ALUMNO` (tabla intermedia)
> Confirmado con el equipo: **un alumno puede tener varias familias responsables** (ej. padres separados, cada uno con su propio registro de `FAMILIA`), y una familia puede tener varios alumnos (hermanos).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| parentesco | string |  | [DECISIÓN DE DISEÑO] No pedido por ningún RF explícito |
| responsable_principal | boolean |  | Sí toca un RF real (RF-15/RF-16) — define a quién facturarle por defecto |
| recibe_comunicaciones | boolean |  | `[ACLARACIÓN CLIENTE]` (respuesta 11). Separa explícitamente "quién paga" (`RESPONSABLE_ECONOMICO`) de "quién recibe avisos". Ante una ausencia, por ejemplo, se notifica a **todos** los responsables con este campo en `true`, no solo al responsable económico |
| familia_id | uuid | FK |  |
| alumno_id | uuid | FK |  |

---

## Módulo: Académico

RF cubiertos: RF-04, RF-05, RF-06, RF-07, RF-08, RF-09

### `NIVEL_EDUCATIVO`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `ANIO`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| numero | int |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| nivel_educativo_id | uuid | FK |  |

### `DIVISION`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| anio_id | uuid | FK |  |

### `MATERIA`
> **[ACLARACIÓN CLIENTE]** (respuesta 2) cierra la pregunta pendiente #5 que dejaba esta tabla sin resolver: **sí** puede haber materias distintas entre divisiones de un mismo año (orientaciones). `division_id` pasa a nullable: nulo = materia común a todo el año (comportamiento anterior, sigue siendo el caso general); con valor = materia específica de esa división/orientación.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| tipo | string |  | `[ACLARACIÓN CLIENTE]` respuesta 2 — materia / taller |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| anio_id | uuid | FK |  |
| division_id | uuid | FK | `[ACLARACIÓN CLIENTE]` respuesta 2. Nulo = común al año; con valor = específica de la división/orientación |

### `DOCENTE`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| legajo | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| persona_id | uuid | FK |  |

### `ASIGNACION_DOCENTE`
> Cubre RF-09: docente-materia-división por ciclo lectivo.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| ciclo_lectivo | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| docente_id | uuid | FK |  |
| materia_id | uuid | FK |  |
| division_id | uuid | FK |  |

### `MOTIVO_JUSTIFICACION`
> **[ACLARACIÓN CLIENTE]** (respuesta 10). Catálogo configurable de motivos de ausencia — antes el modelo no distinguía motivos, o los dejaba como texto libre. Mismo patrón que `METODO_PAGO`/`CONCEPTO_COBRO`: alta y baja sin tocar código (RNF-06).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  | enfermedad / certificado_medico / turno_estudio_medico / viaje_familiar / motivo_familiar_personal / actividad_autorizada_esseri / otro |
| activo | boolean |  | Baja lógica |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `JUSTIFICACION_INASISTENCIA`
> **[REVISIÓN MAESTRA]** + **[ACLARACIÓN CLIENTE]** (respuesta 9). La familia carga la justificación; el rol institucional autorizado (Secretaría/Dirección, según corresponda) la resuelve. El docente **no** participa de esta decisión — solo marca presente/ausente/tardanza en `ASISTENCIA`.
>
> **Cardinalidad con `ASISTENCIA`:** `[DECISIÓN DE DISEÑO — propuesta]` **1:N** — una justificación rechazada permite volver a presentar una nueva para la misma ausencia.
>
> **[NOTA — RNF-15, Ley 25.326]** Motivos médicos de menores de edad — restringir exposición en logs, exportaciones y en el `payload` del `EVENT_LOG` asociado.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| observacion | string |  | Texto libre de la familia |
| archivo | string |  | Referencia al adjunto (certificado). Confirmado que se permiten adjuntos |
| estado | string |  | pendiente / aprobada / rechazada |
| fecha_carga | datetime |  | Fecha de presentación |
| fecha_resolucion | datetime |  | Nulo mientras esté pendiente |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| asistencia_id | uuid | FK | La ausencia que se está justificando |
| familia_id | uuid | FK | Quién presenta la justificación |
| motivo_justificacion_id | uuid | FK | Antes era texto libre, ahora catálogo cerrado configurable |
| usuario_id | uuid | FK | *"rol institucional autorizado (Secretaría/Dirección según corresponda)"* — se modela como cualquier `USUARIO` con el permiso, no un rol fijo hardcodeado |

---

## Módulo: Inscripciones

RF cubiertos: RF-10, RF-11, RF-12, RF-33

### `SOLICITUD_INSCRIPCION`
> **[REVISIÓN MAESTRA]** + **[ACLARACIÓN CLIENTE]** (respuestas 7 y 8). Pipeline comercial previo a la inscripción — cubre "Admisiones", que hoy no existe en ningún documento del proyecto: es todo lo que pasa **antes** de que la persona sea alumno del colegio (consulta → entrevista → postulación → aprobación). Al aprobarse dispara el workflow completo de admisión (crear persona/alumno, vincular familia, asignar responsable económico, generar inscripción, cargo de matrícula, documentación/contrato, pago, confirmación, bienvenida).
>
> `[DECISIÓN DE DISEÑO]` Vive dentro de `inscripciones/`, no en un módulo nuevo — **no se crea un módulo 11** (regla 2 de `AGENTS.md`; el PDF agrupa ambos dominios bajo una sola vista "Admisiones e Inscripciones").
>
> **Es el primer paso solo para inscripciones `tipo = nueva`.** Una reinscripción, un cambio de división o una baja no pasan por consulta ni entrevista.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| ciclo_lectivo | string |  | Mismo tipo que en `INSCRIPCION` |
| etapa | string |  | Etapa actual — ver enum en Enumeraciones. El historial completo por etapa vive en `ETAPA_SOLICITUD` |
| estado | string |  | en_proceso / aprobada / rechazada / desistida |
| fecha_solicitud | date |  | Cuándo entró la consulta |
| fecha_resolucion | date |  | Nulo mientras esté en proceso |
| observaciones | string |  | Notas de la entrevista |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| aspirante_persona_id | uuid | FK | El aspirante. Se reusa `PERSONA` en vez de duplicar contacto |
| contacto_persona_id | uuid | FK | Quién consulta, si no es el aspirante |
| nivel_educativo_id | uuid | FK | Nivel al que aspira |
| usuario_id | uuid | FK | Quién del colegio atiende la solicitud |

**El alumno no se considera definitivamente inscripto solo por consultar o entrevistarse** — la FK de trazabilidad en `INSCRIPCION` solo se completa al llegar a la etapa final.

### `ETAPA_SOLICITUD`
> **[ACLARACIÓN CLIENTE]** (respuesta 7): *"cada etapa debe quedar registrada con fecha, estado y responsable"* — más estricto que solo guardar la etapa actual, así que el campo `etapa` de `SOLICITUD_INSCRIPCION` es la etapa vigente y esta tabla es el historial completo.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| etapa | string |  | Mismo enum que `SOLICITUD_INSCRIPCION.etapa` |
| estado | string |  | en_proceso / completada / rechazada |
| fecha | datetime |  | Cuándo se registró el paso por esta etapa |
| observaciones | string |  |  |
| solicitud_inscripcion_id | uuid | FK |  |
| usuario_id | uuid | FK | Quién gestionó este paso |

### `DOCUMENTO_SOLICITUD`
> **[ACLARACIÓN CLIENTE]** (respuesta 8): *"solicitar/validar documentación y contrato"* es un paso explícito del workflow de aprobación de admisión, y la inscripción no queda confirmada hasta cumplirlo — la creación de alumno/familia puede ser automática, pero la confirmación no.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| tipo_documento | string |  | `[DECISIÓN DE DISEÑO]` ej. DNI, contrato de matrícula, certificado de estudios |
| archivo | string |  | Referencia al adjunto |
| estado | string |  | pendiente / validado / rechazado |
| fecha_carga | datetime |  |  |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| solicitud_inscripcion_id | uuid | FK |  |
| usuario_id | uuid | FK |  |

### `INSCRIPCION`
> Un alumno acumula muchas inscripciones a lo largo del tiempo (una por ciclo lectivo, más las que genere RF-12). No confundir con duplicación: cada fila es un período real distinto.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| ciclo_lectivo | string |  |  |
| fecha_inscripcion | date |  |  |
| tipo | string |  | nueva / reinscripción / cambio de matrícula / baja |
| estado | string |  | activa / finalizada / baja |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| alumno_id | uuid | FK |  |
| division_id | uuid | FK |  |
| solicitud_inscripcion_id | uuid | FK | `[ACLARACIÓN CLIENTE]` Solo la completan las de `tipo = nueva`. Mismo criterio de nullable que ya usa `USUARIO.persona_id` |

### `ASISTENCIA`
> **[CONFIRMADO CON ESSERI]** La asistencia se toma por día, no por materia. Se conecta solo a `INSCRIPCION` (nunca directo a `ALUMNO`, para evitar dato redundante — el alumno se obtiene vía `INSCRIPCION.alumno_id`). No lleva `asignacion_docente_id`.
>
> **[ACLARACIÓN CLIENTE]** (respuestas 9, 10, 11) cambia la semántica del flujo: el docente **ya no decide** si una ausencia es justificada — solo registra presente/ausente/tardanza. Ante una ausencia el sistema pasa a `ausente_pendiente`, dispara notificación automática a **todos los responsables con `FAMILIA_ALUMNO.recibe_comunicaciones = true`** (no solo al responsable económico), y espera que la familia presente `JUSTIFICACION_INASISTENCIA`, que resuelve el rol institucional autorizado. El registro original de la ausencia y la justificación posterior se conservan como entidades separadas — la justificación no pisa el registro original.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | date |  |  |
| tipo | string |  | presente / tardanza / ausente_pendiente / ausente_justificado / ausente_injustificado — ver flujo completo arriba |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| inscripcion_id | uuid | FK |  |

---

## Módulo: Facturación y Cobranza

RF cubiertos: RF-15, RF-16, RF-17, RF-18 (parcial, ver nota), RF-36

### `FACTURA`
> **[CONFIRMADO CON ESSERI]** La facturación es por alumno, no por familia. Por eso `FACTURA` conecta con `INSCRIPCION` (no con `FAMILIA` directo) — mismo criterio que `ASISTENCIA`: el cobro tiene sentido en el contexto de una inscripción activa. El "estado de deuda de la familia" (RF-17) se calcula navegando `FAMILIA → FAMILIA_ALUMNO → ALUMNO → CUENTA_CORRIENTE → MOVIMIENTO` (ver nota de `FAMILIA.estado_deuda`), no se guarda como FK directa.
>
> **[ACLARACIÓN CLIENTE]** (respuesta 1) resuelve la pregunta pendiente #3 (a nombre de quién se emite el cobro cuando hay varios responsables): a nombre del `RESPONSABLE_ECONOMICO` vigente al momento de `fecha_emision`, tabla nueva más abajo. Esto **ratifica** "facturación por alumno" — no la contradice, resuelve *a nombre de quién*, no *sobre qué entidad*.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha_emision | date |  |  |
| fecha_vencimiento | date |  |  |
| monto_total | decimal |  |  |
| estado | string |  | pendiente / vencida / pagada |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| inscripcion_id | uuid | FK |  |

### `DETALLE_FACTURA`
> Ya no lleva `inscripcion_id` propio — sería redundante ahora que `FACTURA` lo tiene. Sigue permitiendo varios conceptos dentro de una misma factura (ej. cuota + mora).
>
> **[ACLARACIÓN CLIENTE]** (respuesta 3) cierra la pregunta pendiente #6: `tipo` (string libre) se reemplaza por `concepto_cobro_id`, FK al catálogo configurable `CONCEPTO_COBRO`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| descripcion | string |  | ej. "Cuota marzo" |
| monto | decimal |  |  |
| factura_id | uuid | FK |  |
| concepto_cobro_id | uuid | FK | `[ACLARACIÓN CLIENTE]` respuesta 3 — reemplaza el `tipo` string libre anterior |

### `PAGO`
> Cubre RF-16. Una factura puede tener varios pagos (parciales).
>
> **[ACLARACIÓN CLIENTE]** (respuesta 4) agrega resultado de transacción — antes el modelo asumía que todo pago registrado ya estaba confirmado.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | date |  |  |
| monto | decimal |  |  |
| comprobante | string |  | Referencia/archivo. `[ACLARACIÓN CLIENTE]` Obligatorio solo si `METODO_PAGO.requiere_comprobante = true` (ej. transferencia) |
| estado | string |  | `[ACLARACIÓN CLIENTE]` respuesta 4 — aprobado / rechazado / pendiente (ej. resultado de un débito directo o un stop debit) |
| referencia_transaccion | string |  | `[ACLARACIÓN CLIENTE]` respuesta 4 — identificador que devuelve el medio de pago |
| fecha_operacion | datetime |  | `[ACLARACIÓN CLIENTE]` respuesta 4 — cuándo se procesó realmente la operación, puede diferir de `fecha` de carga |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| factura_id | uuid | FK |  |
| metodo_pago_id | uuid | FK |  |

### `METODO_PAGO`
> [DECISIÓN DE DISEÑO] Tabla catálogo en vez de campo de texto libre — mismo patrón que `PERMISO` — para poder dar de alta/baja métodos sin tocar código (RNF-06).
>
> **[ACLARACIÓN CLIENTE]** (respuesta 4) cierra la pregunta pendiente #10: **débito directo, tarjeta de débito, tarjeta de crédito, transferencia** — la transferencia solo para casos excepcionales, con comprobante obligatorio. Pasa del Grupo B al Grupo A de precarga (ver más abajo).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  | debito_directo / tarjeta_debito / tarjeta_credito / transferencia |
| activo | boolean |  |  |
| requiere_comprobante | boolean |  | Define si el frontend pide adjuntar archivo en `PAGO.comprobante`. Solo `transferencia` lo requiere |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `CONCEPTO_COBRO`
> **[ACLARACIÓN CLIENTE]** (respuesta 3). Catálogo de todo lo que ESSERI cobra, configurable sin desarrollo — cierra la pregunta pendiente #6.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  | Cuota educativa, Matrícula, Servicio Nutricional, ESSERI Experience, ESSERI Conecta, Transporte, Penalidad por mora, Penalidad por stop debit, Daños y reparaciones, Extraordinario |
| categoria | string |  | `[DECISIÓN DE DISEÑO]` agrupador para reportes |
| activo | boolean |  | Baja lógica |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `RESPONSABLE_ECONOMICO`
> **[ACLARACIÓN CLIENTE]** (respuesta 1). Reemplaza las tres opciones (A/B/C — booleano en `FAMILIA_ALUMNO`, FK simple en `ALUMNO`, FK por factura) que la versión anterior de este documento dejaba sin decidir, porque ninguna registraba correctamente la vigencia temporal que pidió el cliente: *"cada alumno puede tener más de un responsable parental, pero debe tener un responsable económico/de pago definido a cuyo nombre se emite la facturación. Ese responsable queda fijo hasta que la familia solicite un cambio [...] Los cambios deben informarse antes del día 10 y se aplican a partir del período siguiente"*.
>
> Un alumno tiene **una fila vigente** (`vigencia_hasta IS NULL`) y, opcionalmente, historial de filas anteriores cerradas — se valida en backend, no en el esquema. Una factura se emite consultando qué fila estaba vigente en su `fecha_emision`, y ese valor se **cristaliza** (no se recalcula después), mismo criterio de snapshot que `NOTIFICACION`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| vigencia_desde | date |  |  |
| vigencia_hasta | date |  | Nulo = vigente actual |
| fecha_solicitud_cambio | date |  | Cuándo la familia pidió el cambio (debe ser antes del día 10 para aplicar el período siguiente — regla de negocio en backend) |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| alumno_id | uuid | FK |  |
| familia_id | uuid | FK | Quién es responsable económico durante esta vigencia |

### `REGLA_PENALIDAD`
> **[ACLARACIÓN CLIENTE]** (respuesta 5). Parametriza los tramos de mora — nada hardcodeado, según el criterio general del cliente de que las reglas de negocio sean configurables.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| desde_dia_vencido | int |  |  |
| hasta_dia_vencido | int |  | Nulo = sin límite superior |
| porcentaje | decimal |  |  |
| activo | boolean |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| concepto_cobro_id | uuid | FK | A qué concepto se imputa la penalidad generada |

**Precarga confirmada:** 0–5 días vencido: 0% (normal, sin penalidad) · 6–15: 20% · 16–30: 30%.

### `EXCEPCION_VENCIMIENTO`
> **[ACLARACIÓN CLIENTE]** (respuesta 5): *"salvo que exista una fecha excepcional previamente autorizada por ESSERI para esa familia"*.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha_vencimiento_excepcional | date |  |  |
| motivo | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| familia_id | uuid | FK |  |
| usuario_id | uuid | FK |  |

### `CUENTA_CORRIENTE`
> **[ACLARACIÓN CLIENTE]**. Resuelve la contradicción que traía este documento: `FAMILIA.estado_deuda` existía como columna al mismo tiempo que el diccionario decía que se calculaba navegando facturas — dos fuentes del mismo dato. La respuesta 16 confirma que el cliente asume la cuenta corriente como concepto de negocio propio (*"actualizar cuentas corrientes"* es una de las 15 acciones que debe poder disparar el motor de workflows), no solo un cálculo agregado sobre facturas.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| alumno_id | uuid | FK, UK | Una cuenta corriente por alumno |

### `MOVIMIENTO`
> **[ACLARACIÓN CLIENTE]** — libro de movimientos **inmutable**. Cada cargo, pago y penalidad es una fila que nunca se edita; un error se corrige con un movimiento de ajuste nuevo. **El saldo no se persiste como columna**: se calcula sumando movimientos en el momento de la consulta — así no hay un campo `saldo` separado que alguien tenga que mantener sincronizado. `FAMILIA.estado_deuda` termina de resolverse acá.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | datetime |  |  |
| tipo | string |  | debe / haber |
| monto | decimal |  |  |
| observacion | string |  |  |
| cuenta_corriente_id | uuid | FK |  |
| concepto_cobro_id | uuid | FK |  |
| factura_id | uuid | FK | Si el movimiento nace de una factura |
| pago_id | uuid | FK | Si nace de un pago |
| event_log_id | uuid | FK | Si lo generó el motor de workflows |

**[NOTA TÉCNICA — performance]** Índice sugerido `(cuenta_corriente_id, fecha)` — el saldo se calcula sumando por esta clave en cada consulta.

**[NOTA] RF-18 (alertas de morosidad) no genera tabla en este módulo.** Se resuelve en el Motor de Workflows (`WORKFLOW_RULE` + `NOTIFICACION`/`TAREA`) reaccionando sobre `CUENTA_CORRIENTE`/`MOVIMIENTO` y sobre `REGLA_PENALIDAD`.

---

## Módulo: Proveedores y Compras

RF cubiertos: RF-19, RF-20, RF-21, RF-34, RF-35 (búsquedas, no generan tabla), RF-38

### `PROVEEDOR`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| categoria | string |  |  |
| estado | string |  | activo / inactivo |
| telefono | string |  |  |
| email | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `PRODUCTO_SERVICIO`
> **[REVISIÓN MAESTRA]** + **[ACLARACIÓN CLIENTE]** (respuesta 12). Catálogo de lo que el colegio compra. Reemplaza el texto libre de `SOLICITUD_COMPRA.articulo`: con texto libre, "resma A4", "Resma A4" y "resmas oficio" son tres cosas distintas para la base, y no se puede responder cuánto se gastó en un insumo ni comparar precios entre proveedores.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  | ej. "Resma A4 75g" |
| categoria | string |  | ej. "Librería" |
| unidad | string |  | Unidad de medida |
| tipo | string |  | producto / servicio |
| activo | boolean |  | Baja lógica |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

**Precarga:** Grupo C ("dato operativo real de ESSERI, no inventar") — el cliente confirmó (respuesta 12) que va a entregar información de proveedores y compras para construir el catálogo inicial. **No inventar el catálogo antes de recibirla** (pregunta pendiente #17).

### `PRODUCTO_PROVEEDOR` (tabla intermedia)
> **[ACLARACIÓN CLIENTE]** (respuesta 12): *"cada producto/servicio debería tener un ID propio y poder relacionarse con uno o varios proveedores"*.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| producto_servicio_id | uuid | FK |  |
| proveedor_id | uuid | FK |  |

### `PRECIO_PRODUCTO`
> **[ACLARACIÓN CLIENTE]** (respuesta 12): *"...y precios históricos"*. Sin esto, el precio queda solo en cada `SOLICITUD_COMPRA` puntual y no se puede comparar en el tiempo ni entre proveedores.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| precio | decimal |  |  |
| vigencia_desde | date |  |  |
| vigencia_hasta | date |  | Nulo = precio vigente actual |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| producto_servicio_id | uuid | FK |  |
| proveedor_id | uuid | FK |  |

### `SOLICITUD_COMPRA`
> **[ACLARACIÓN CLIENTE]** (respuesta 12) agrega la referencia controlada al catálogo. `articulo` se conserva como texto libre para casos excepcionales que todavía no están en `PRODUCTO_SERVICIO` — **regla dura de backend: debe existir uno de los dos** (`producto_servicio_id` o `articulo`, nunca ninguno).

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| articulo | string |  | Texto libre — solo para excepciones fuera del catálogo. Ver regla dura arriba |
| cantidad | int |  |  |
| area_solicitante | string |  |  |
| estado | string |  | pendiente / aprobada / rechazada |
| fecha | date |  |  |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| usuario_id | uuid | FK | Quién solicitó (no `PERSONA` directo — requiere cuenta del sistema) |
| producto_servicio_id | uuid | FK | `[ACLARACIÓN CLIENTE]` respuesta 12 |

### `ORDEN_COMPRA`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | date |  |  |
| estado | string |  |  |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| proveedor_id | uuid | FK |  |

### `ORDEN_COMPRA_SOLICITUD` (tabla intermedia)
> **[ACLARACIÓN CLIENTE]** (respuesta 14) cierra la pregunta pendiente #7: una orden de compra **puede agrupar varias solicitudes**, siempre que sean del mismo proveedor y compatibles de agrupar; cada solicitud original conserva su ID y queda vinculada a la orden. Confirma exactamente el modelo M:N ya modelado acá — no hace falta cambiar esta tabla.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| orden_compra_id | uuid | FK |  |
| solicitud_compra_id | uuid | FK |  |

### `ORDEN_COMPRA_DETALLE`
> **[ACLARACIÓN CLIENTE]** (respuesta 13). Necesaria para poder comparar cantidad pedida contra recibida por producto — antes `ORDEN_COMPRA` no tenía ítems propios.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| cantidad_pedida | decimal |  |  |
| orden_compra_id | uuid | FK |  |
| producto_servicio_id | uuid | FK |  |

### `RECEPCION_COMPRA`
> **[ACLARACIÓN CLIENTE]** (respuesta 13) cierra la pregunta pendiente #14: recepción completa, no solo un cambio de estado en `ORDEN_COMPRA`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| fecha | date |  |  |
| tipo | string |  | total / parcial |
| observaciones | string |  |  |
| remito | string |  | Referencia al adjunto |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| orden_compra_id | uuid | FK |  |
| usuario_id | uuid | FK | Quién recibe |

### `RECEPCION_COMPRA_DETALLE`
> **[ACLARACIÓN CLIENTE]** (respuesta 13): *"una recepción parcial debe dejar pendiente automáticamente la cantidad restante"*.
>
> **[NOTA]** `cantidad_pendiente` **no es columna**: se calcula como `ORDEN_COMPRA_DETALLE.cantidad_pedida − SUM(cantidad_recibida)` de todas las recepciones asociadas a ese detalle — mismo criterio de derivado sin cache que `CUENTA_CORRIENTE`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| cantidad_recibida | decimal |  |  |
| recepcion_compra_id | uuid | FK |  |
| orden_compra_detalle_id | uuid | FK |  |

---

## Módulo: Motor de Workflows y Notificaciones

RF cubiertos: RF-22, RF-23, RF-24, RF-25, RF-26

### `CAMPO_EVENTO`
> [DECISIÓN DE DISEÑO] No pedido explícitamente por ningún RF, pero necesario para que RF-25 sea usable por personal no técnico (Dirección/Administración) sin escribir JSON ni placeholders a mano. Catálogo de qué variables están disponibles para cada `TIPO_EVENTO`; alimenta los desplegables de `WORKFLOW_RULE.condicion` y los "chips" insertables en `NOTIFICACION_TEMPLATE.cuerpo`. La UI (dropdowns, editor con chips) es trabajo del módulo de Mockups, no de este DER — pero la tabla que la sostiene sí corresponde acá.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre_interno | string |  | ej. "dias_vencido" — lo que va dentro del JSON/placeholder |
| etiqueta | string |  | ej. "Días de deuda" — lo que ve el usuario en pantalla |
| tipo_dato | string |  | numero / texto / fecha |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| tipo_evento_id | uuid | FK |  |

### `TIPO_EVENTO`
> [DECISIÓN DE DISEÑO] Catálogo en vez de texto libre en `WORKFLOW_RULE`, mismo patrón que `PERMISO`/`METODO_PAGO` (RNF-06). Acá se cargan valores como "factura.vencida", "inasistencia.registrada", "inscripcion.cambio_matricula", y desde las aclaraciones también "solicitud_inscripcion.aprobada", "inasistencia.justificada", "pago.registrado", "pago.rechazado".

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| descripcion | string |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `WORKFLOW_RULE`
> [DECISIÓN DE DISEÑO — pendiente de confirmar con el equipo] RF-22 describe un motor genérico ("acción resultante", sin limitarla). **[ACLARACIÓN CLIENTE]** (respuesta 16) confirma y amplía esto de forma sustancial: el cliente enumera 13 tipos de acción concretos que las automatizaciones deben poder ejecutar (además de los 2 que ya existían: notificar, alerta_interna) — ver enum completo en Enumeraciones.
>
> **El límite, que sigue siendo la parte importante:** cada acción se configura en `accion_config` (jsonb, separado de `condicion`), y el backend valida contra una **allowlist** de entidades, campos, estados y tipos de acción permitidos antes de ejecutar. El motor **no puede ejecutar arbitrariamente cualquier acción sobre cualquier entidad** — eso sería una vía de escritura sin control sobre todo el Data Core. Con 15 valores de `tipo_accion` en total, la allowlist deja de ser un detalle de implementación y pasa a ser la pieza de seguridad central de este módulo.
>
> **Respaldo directo del cliente para el límite** (respuesta 16): *"las decisiones sensibles, disciplinarias, legales o excepciones económicas deben mantener intervención/aprobación humana"* — de ahí `requiere_aprobacion_humana`.
>
> **[DECISIÓN DE EQUIPO — cierra la pregunta pendiente #15]** `requiere_aprobacion_humana = true` (por defecto) para las acciones que mueven dinero o escalan un caso: `generar_cargo`, `aplicar_penalidad`, `registrar_pago`, `registrar_rechazo`, `escalar_caso`, `generar_orden_compra`. El resto arranca en `false`: `notificar`, `alerta_interna`, `generar_recordatorio`, `cambiar_estado`, `crear_tarea`, `crear_registro_relacionado`, `aplicar_vencimiento`, `actualizar_cuenta_corriente`, `generar_comunicacion`. Es el valor por defecto por `tipo_accion`, no un hardcode — el campo sigue siendo configurable por regla, así que el equipo puede ajustar caso por caso una vez que el motor esté corriendo. **Sigue abierta la pregunta #16**: la allowlist campo por campo de `accion_config` (qué entidad/campo puede tocar cada acción) todavía no tiene el detalle completo.
>
> **[NOTA — decisión revisada]** Se evaluó agregar `n8nWorkflowId` por fila, pero se descartó: todas las reglas con `tipo_accion = "notificar"` llaman al mismo webhook genérico de n8n (backend ya resuelve destinatario y contenido antes de llamarlo), así que guardarlo por regla sería dato repetido sin necesidad. La URL del webhook es config del sistema, no un atributo de `WORKFLOW_RULE`.
>
> **[NOTA — arquitectura, no cambia el DER]** El envío real (Gmail/Google Workspace) se ejecuta vía n8n en vez de código propio de integración; `WORKFLOW_EXECUTION`/`NOTIFICACION`/`MOVIMIENTO`/`TAREA` en PostgreSQL siguen siendo la fuente de verdad (RNF-05), n8n es solo el ejecutor. n8n no reemplaza al `EVENT_LOG` ni al motor.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| condicion | jsonb |  | **No es código ejecutable.** Estructura fija `{campo, operador, valor}`, ej. `{"campo":"dias_vencido","operador":">","valor":30}`. El backend interpreta estos valores con lógica propia — nunca ejecuta el contenido del campo directamente |
| tipo_accion | string |  | Ver los 15 valores en Enumeraciones |
| accion_config | jsonb |  | `[ACLARACIÓN CLIENTE]` Config específica de la acción (ej. qué entidad/campo cambia, qué `REGLA_PENALIDAD` aplica). Validada contra la allowlist del backend, nunca ejecutada como código |
| criticidad | string |  | `[ACLARACIÓN CLIENTE]` respuesta 15 — baja / media / alta / critica |
| requiere_aprobacion_humana | boolean |  | `[ACLARACIÓN CLIENTE]` respuesta 16. Si `true`, la acción queda en estado intermedio (similar a `IA_SUGERENCIA.pendiente_revision`) hasta que un usuario la confirme, en vez de ejecutarse sola |
| activo | boolean |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| tipo_evento_id | uuid | FK |  |
| notificacion_template_id | uuid | FK | Solo si `tipo_accion` genera una notificación |

### `NOTIFICACION_TEMPLATE`
| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| nombre | string |  |  |
| asunto | string |  |  |
| cuerpo | string |  | Texto plano con placeholders tipo `{{nombre_familia}}`, `{{monto_deuda}}`, `{{mes_cuota}}`. El backend los reemplaza por datos reales al momento de generar la `NOTIFICACION` — no es código, solo texto con marcadores a sustituir |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |

### `WORKFLOW_EXECUTION`
> Cubre RF-23. **[REVISIÓN MAESTRA]**: debe poder demostrar ciclo cerrado, reintentos y evidencia de qué evento disparó qué — antes no referenciaba el hecho que la originó ni cuánto tardó ni si fue un reintento.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| intento | int |  | Número de reintento (1 = primer intento) |
| started_at | datetime |  | Reemplaza al campo `fecha` anterior |
| finished_at | datetime |  | Nulo mientras esté en curso |
| estado | string |  | exitoso / fallido / pendiente |
| detalle | string |  |  |
| error_detail | string |  | Detalle del error cuando `estado = fallido` |
| workflow_rule_id | uuid | FK |  |
| event_log_id | uuid | FK | El hecho de negocio que disparó esta ejecución |

### `NOTIFICACION`
> Cubre RF-26. **[ACLARACIÓN CLIENTE]** (respuesta 15) reabre lo que antes estaba cerrado "por diseño": ya no es exclusiva de `FAMILIA`. El cliente confirma que hace falta aviso activo hacia usuarios internos (Dirección/Administración/rol que corresponda), además de lo que ya se ve en el Panel (RF-31) — cubre también `alerta_interna` cuando corresponde generar un aviso real, no solo un registro consultable.
>
> **[REVISIÓN MAESTRA]** (evidencia): las plantillas son editables (`NOTIFICACION_TEMPLATE`, ABM de Arce), así que reconstruir el contenido en vivo desde `WORKFLOW_EXECUTION → WORKFLOW_RULE → NOTIFICACION_TEMPLATE` haría que una notificación de septiembre "cambie" si alguien edita la plantilla en octubre. Lo mismo con el destinatario si la familia cambia de mail después. Por eso se persiste un **snapshot** al momento del envío — la evidencia histórica no se reescribe.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| destinatario_tipo | string |  | `[ACLARACIÓN CLIENTE]` familia / usuario |
| canal | string |  | `[ACLARACIÓN CLIENTE]` email (único implementado) u otro a futuro |
| destinatario_snapshot | string |  | Dirección/identificador real al momento del envío, congelado |
| asunto_snapshot | string |  | Asunto ya renderizado, congelado |
| cuerpo_snapshot | string |  | Cuerpo ya renderizado (placeholders reemplazados), congelado |
| estado_envio | string |  | enviado / fallido / pendiente |
| sent_at | datetime |  | Fecha real de envío — distinta de la fecha de creación de la fila |
| workflow_execution_id | uuid | FK |  |
| familia_id | uuid | FK | Destinatario externo, cuando `destinatario_tipo = familia` |
| usuario_id | uuid | FK | `[ACLARACIÓN CLIENTE]` Destinatario interno, cuando `destinatario_tipo = usuario` |

### `TAREA`
> **[ACLARACIÓN CLIENTE]** (respuesta 16). Cubre `crear_tarea` y `escalar_caso`, dos de los 15 valores de `WORKFLOW_RULE.tipo_accion`. Habilita que el motor asigne trabajo a una persona, no solo que le avise algo.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| entidad | string |  | Sin FK real, mismo criterio que `EVENT_LOG.entidad` |
| entidad_id | uuid |  |  |
| titulo | string |  |  |
| descripcion | string |  |  |
| estado | string |  | pendiente / en_progreso / completada / escalada |
| prioridad | string |  | baja / media / alta |
| fecha_vencimiento | datetime |  |  |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| usuario_id | uuid | FK |  |
| workflow_execution_id | uuid | FK | Si la creó el motor |
| tarea_id | uuid | FK | Encadena el historial de escalamiento |

### `REGLA_DESTINATARIO` (tabla intermedia)
> **[ACLARACIÓN CLIENTE]** (respuesta 15): *"el nivel de criticidad y los destinatarios deben ser configurables"*. Permite que una `WORKFLOW_RULE` avise a un rol completo, a un usuario puntual, o a ambos.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| destinatario_tipo | string |  | rol / usuario |
| created_at | datetime |  | Fecha y hora de creación del registro. |
| updated_at | datetime |  | Fecha y hora de la última modificación del registro. |
| workflow_rule_id | uuid | FK |  |
| rol_id | uuid | FK |  |
| usuario_id | uuid | FK |  |

**[NOTA — reparto de responsabilidades]** `WORKFLOW_RULE.tipo_accion` sigue definiendo el camino a partir de un evento, ahora con 15 valores posibles en vez de 2 (ver Enumeraciones). `notificar` y `generar_recordatorio` generan `NOTIFICACION`; `alerta_interna` genera `WORKFLOW_EXECUTION` y, cuando corresponde, también `NOTIFICACION` a un `USUARIO` interno (cambio respecto de la versión anterior, que la dejaba sin notificación real).

---

## Módulo: Auditoría y Trazabilidad

RF cubiertos: RF-13, RF-14 · RNF-05

> **No genera tablas de negocio propias, salvo `EVENT_LOG`** (transversal, ver abajo). Es una capa de consulta/presentación sobre tablas ya construidas en otros módulos, cada una con propósito distinto — evita duplicar lógica de auditoría (RNF-06). RF-14 ("consultar historial de una entidad, ordenado cronológicamente") se resuelve con una pantalla/consulta sobre estas tablas, no con un modelo nuevo.
>
> **[REVISIÓN MAESTRA]**: la tabla `EVENT_LOG` que existía hasta ahora en este módulo respondía *"¿quién cambió qué dato y cuándo?"* — eso es **auditoría**, no un log de eventos de negocio. Se **renombra a `AUDIT_LOG`** y se crea un `EVENT_LOG` nuevo, append-only, que responde *"¿qué pasó en el negocio?"* (ej. "factura vencida", "solicitud aprobada") y es lo que consume el motor de workflows. El criterio general del cliente (última sección de `aclaraciones-cliente-esseri.md`) lo pide textual: *"trazabilidad: cada modificación o acción relevante debe registrar qué ocurrió, cuándo, quién la realizó —usuario o automatización— y cuál fue el resultado"*.

| Tabla | Qué audita | Módulo de origen |
|---|---|---|
| `AUDIT_LOG` (ex `EVENT_LOG`) | Cambios de datos (crear/editar/borrar) en cualquier entidad. Lo escribe `log_audit()` | Transversal (`backend/src/models.py`) |
| `EVENT_LOG` (nuevo) | Hechos de negocio append-only (ej. `factura.vencida`, `inasistencia.registrada`). Lo escribe `emit_event()`, lo consume el motor de Workflows | Transversal (`backend/src/models.py`) |
| `LOG_ACCESO` | Intentos de login (éxito/fallo) | Autenticación y Roles |
| `WORKFLOW_EXECUTION` | Disparos de reglas de automatización, con reintentos y errores | Motor de Workflows |
| `NOTIFICACION` | Comunicaciones efectivamente enviadas, a familias y a usuarios internos | Motor de Workflows |
| `CUENTA_CORRIENTE` / `MOVIMIENTO` | Historial financiero inmutable por alumno | Facturación y Cobranza |
| `TAREA` | Trabajo asignado y escalado por el motor | Motor de Workflows |

**Las dos cadenas quedan así, en paralelo:**

```text
módulo de negocio → EVENT_LOG → WORKFLOW_RULE → WORKFLOW_EXECUTION → NOTIFICACION / TAREA / MOVIMIENTO / ...

operación CRUD → AUDIT_LOG
```

### `AUDIT_LOG` (ex `EVENT_LOG`)

> Cubre RF-13 y RF-14. Genérica (no una tabla de log por módulo) para no duplicar lógica de auditoría en cada equipo de desarrollo — alineado con RNF-06 (escalabilidad modular). Mismos campos que la tabla anterior, solo cambia el nombre y a qué se aplica la excepción a RNF-04 (ver nota abajo, ahora compartida con `EVENT_LOG`).
>
> **[EXCEPCIÓN CONSCIENTE A RNF-04 — compartida con `EVENT_LOG`, ya no única en el DER]** `usuario_id` es una FK real y validada por PostgreSQL (siempre apunta a `USUARIO`). `entidad` + `entidad_id` **no tienen FK real** — no pueden tenerla, porque `entidad` puede referirse a cualquiera de las ~49 tablas del sistema, y PostgreSQL no permite una FK condicional según el valor de otra columna. La alternativa (una columna FK por cada entidad posible) generaría una tabla dispersa casi siempre en NULL, y perdería la genericidad que motivó esta tabla en primer lugar. La validación de que `entidad_id` exista realmente en la tabla que indica `entidad` queda a cargo del backend, no de la base de datos.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| entidad | string |  | nombre de la tabla afectada (ej. "FAMILIA") |
| entidad_id | uuid |  | id de la fila afectada |
| campo | string |  | campo modificado |
| valor_anterior | string |  |  |
| valor_nuevo | string |  |  |
| fecha | datetime |  |  |
| usuario_id | uuid | FK |  |

**[NOTA TÉCNICA — performance]** Requiere índice compuesto `(entidad, entidad_id, fecha)`. Sin este índice, las consultas de RF-14 se degradan a medida que crece el volumen, porque cada modificación en el sistema genera un INSERT adicional acá.

### `EVENT_LOG` (nuevo — eventos de negocio)

> **[REVISIÓN MAESTRA]** Log **append-only** de hechos de negocio. Es la fuente que consume el motor de workflows. **No confundir con `AUDIT_LOG`**, que registra cambios de campos para auditoría humana.
>
> `[DECISIÓN DE DISEÑO]` Ubicación: `backend/src/models.py` (transversal — lo escriben todos los módulos, lo lee Workflows), no dentro de `workflows/`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| entidad | string |  | Tabla sobre la que ocurrió (ej. "FACTURA"). Sin FK real, misma excepción a RNF-04 que `AUDIT_LOG` |
| entidad_id | uuid |  | Fila afectada. Sin FK real |
| actor_tipo | string |  | `[DECISIÓN DE DISEÑO]` usuario / sistema |
| timestamp | datetime |  | Cuándo ocurrió el hecho |
| payload | jsonb |  | Snapshot mínimo del evento. **No es código ejecutable**. No guardar datos sensibles innecesarios (RNF-15) |
| estado | string |  | pendiente / procesado / fallido |
| tipo_evento_id | uuid | FK | Qué clase de hecho ocurrió — reusa el catálogo existente |
| usuario_id | uuid | FK | Nulo cuando `actor_tipo = sistema` |

**[NOTA TÉCNICA — performance]** Índice sugerido `(estado, timestamp)`.

**[NOTA — append-only]** `estado` es la única excepción operativa, no de negocio: las filas no se editan salvo para avanzar este campo.

---

## Módulo: Panel Administrativo

RF cubiertos: RF-31, RF-32

> **No genera tablas propias.** Es consumo directo de datos ya modelados.

| Indicador (RF-31, perfil Dirección) | Fuente |
|---|---|
| Alumnos activos | `ALUMNO.estado = "activo"` |
| Deuda pendiente total | Saldo agregado de `CUENTA_CORRIENTE`/`MOVIMIENTO` (reemplaza el `SUM(FACTURA.monto_total)` anterior — ver `CUENTA_CORRIENTE` en Facturación y Cobranza) |
| Inasistencias del día | `ASISTENCIA WHERE fecha = hoy AND tipo LIKE "ausente%"` (incluye `ausente_pendiente`) |
| Solicitudes de compra abiertas | `SOLICITUD_COMPRA WHERE estado = "pendiente"` |
| Tareas pendientes/escaladas | `TAREA WHERE estado IN ("pendiente", "escalada")` |

RF-32 (perfil Administración): accesos rápidos a Familias, Facturación y Proveedores — navegación, sin dato nuevo.

---

## Módulo: Capa de Inteligencia Artificial

> **[ADVERTENCIA DE COBERTURA DOCUMENTAL]** A diferencia de los otros módulos, este no tiene ningún RF con código ni criterio de aceptación en la Matriz de Requerimientos. Solo está descripto a nivel EDT y en el enunciado del alcance (`Entrega_2.2`, `Entrega_3.0`): *"generación de comunicaciones institucionales, detección de patrones (morosidad, inasistencias) y asistencia en análisis operativo... control humano configurable sobre las acciones automáticas"*. **[ACLARACIÓN CLIENTE]** (respuesta 16) coincide punto por punto con la regla ya vigente de `IA_SUGERENCIA.requiere_control_humano` — no cambia el esquema, solo confirma el alcance: patrones detectados por reglas/SQL, LLM solo para redactar o sugerir, nada de ML entrenado.

### `IA_SUGERENCIA`
> Cubre tanto "detección de patrones" como "generación de comunicaciones" con una sola tabla, mismo patrón genérico que `EVENT_LOG`/`AUDIT_LOG` para `entidad`/`entidad_id`.

| Campo | Tipo | Clave | Descripción |
|---|---|---|---|
| id | uuid | PK |  |
| tipo | string |  | "patron_detectado" / "comunicacion" |
| entidad | string |  | Sin FK real, mismo criterio que `EVENT_LOG` |
| entidad_id | uuid |  | Familia/alumno afectado por el patrón detectado |
| contenido_generado | string |  | Texto generado por OpenAI (descripción del patrón o borrador de mensaje) |
| requiere_control_humano | boolean |  | Si true, queda en "pendiente_revision" hasta aprobación manual — nunca se ejecuta sola |
| estado | string |  | pendiente_revision / aprobada / rechazada / ejecutada_automaticamente |
| fecha_generacion | datetime |  |  |
| fecha_revision | datetime |  |  |
| usuario_id | uuid | FK | Quién aprobó/rechazó |
| notificacion_template_id | uuid | FK | Solo se completa si `tipo = "comunicacion"` y `estado = "aprobada"` — la sugerencia se convirtió en plantilla reutilizable |

---

## Enumeraciones (valores fijos por campo)

> Todo campo `string` que en la práctica solo acepta un set cerrado de valores. Recomendación de implementación: usar `CHECK constraint` o tipo `ENUM` nativo de PostgreSQL en vez de dejarlo como texto libre sin validar — así la base de datos rechaza valores inválidos en vez de confiar en que el backend siempre valide bien (refuerza RNF-04).

| Tabla.Campo | Valores | Origen |
|---|---|---|
| `USUARIO.estado` | activo, inactivo | [DECISIÓN DE DISEÑO] |
| `USUARIO.auth_provider` | google, local | [DECISIÓN DE DISEÑO] — **NUEVO** por cambio 2 |
| `ALUMNO.estado` | activo, inactivo, egresado | [DECISIÓN DE DISEÑO] |
| `FAMILIA.estado_deuda` | al_dia, con_deuda, en_mora | El corte entre "con_deuda" y "en_mora" ya no está pendiente: **[ACLARACIÓN CLIENTE]** respuesta 5 — mora desde el día 6 de vencimiento (tramos 6–15 y 16–30, ver `REGLA_PENALIDAD`) |
| `INSCRIPCION.tipo` | nueva, reinscripcion, cambio_matricula, baja | RF-10, RF-11, RF-12 |
| `INSCRIPCION.estado` | activa, finalizada, baja | [DECISIÓN DE DISEÑO] |
| `ASISTENCIA.tipo` | presente, **tardanza**, ausente_pendiente, ausente_justificado, ausente_injustificado | **MODIFICADO** — `[ACLARACIÓN CLIENTE]` respuesta 9 (antes: presente, ausente_justificado, ausente_injustificado) |
| `SOLICITUD_INSCRIPCION.etapa` | consulta_lead, entrevista, postulacion, evaluacion_aprobacion, reserva_matricula, documentacion_contrato, inscripcion_confirmada | **NUEVO, ya no bloqueado** — `[ACLARACIÓN CLIENTE]` respuestas 7 y 8 |
| `SOLICITUD_INSCRIPCION.estado` | en_proceso, aprobada, rechazada, desistida | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `ETAPA_SOLICITUD.estado` | en_proceso, completada, rechazada | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `DOCUMENTO_SOLICITUD.estado` | pendiente, validado, rechazado | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `MOTIVO_JUSTIFICACION.nombre` | enfermedad, certificado_medico, turno_estudio_medico, viaje_familiar, motivo_familiar_personal, actividad_autorizada_esseri, otro | `[ACLARACIÓN CLIENTE]` respuesta 10 — **NUEVO** |
| `JUSTIFICACION_INASISTENCIA.estado` | pendiente, aprobada, rechazada | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `MATERIA.tipo` | materia, taller | `[ACLARACIÓN CLIENTE]` respuesta 2 — **NUEVO** |
| `FACTURA.estado` | pendiente, vencida, pagada | RF-17 (textual) |
| `PROVEEDOR.estado` | activo, inactivo | RF-19 (textual) |
| `SOLICITUD_COMPRA.estado` | pendiente, aprobada, rechazada | RF-20 (implícito en "estado actualizable") |
| `ORDEN_COMPRA.estado` | emitida, recibida, cancelada | Propuesta del equipo, no confirmada por ningún RF |
| `RECEPCION_COMPRA.tipo` | total, parcial | `[ACLARACIÓN CLIENTE]` respuesta 13 — **NUEVO** |
| `PRODUCTO_SERVICIO.tipo` | producto, servicio | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `PAGO.estado` | aprobado, rechazado, pendiente | `[ACLARACIÓN CLIENTE]` respuesta 4 — **NUEVO** |
| `MOVIMIENTO.tipo` | debe, haber | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `LOG_ACCESO.resultado` | exitoso, fallido | RF-27 (textual) |
| `WORKFLOW_EXECUTION.estado` | exitoso, fallido, pendiente | RF-23 (textual) |
| `NOTIFICACION.estado_envio` | enviado, fallido, pendiente | Propuesta del equipo |
| `NOTIFICACION.destinatario_tipo` | familia, usuario | `[ACLARACIÓN CLIENTE]` respuesta 15 — **NUEVO** |
| `WORKFLOW_RULE.tipo_accion` | notificar, alerta_interna, cambiar_estado, crear_tarea, generar_cargo, aplicar_vencimiento, aplicar_penalidad, registrar_pago, registrar_rechazo, actualizar_cuenta_corriente, generar_recordatorio, escalar_caso, crear_registro_relacionado, generar_orden_compra, generar_comunicacion | **MODIFICADO — de 2 a 15 valores** — `[ACLARACIÓN CLIENTE]` respuesta 16 |
| `WORKFLOW_RULE.criticidad` | baja, media, alta, critica | [DECISIÓN DE DISEÑO] — `[ACLARACIÓN CLIENTE]` respuesta 15 pide que sea configurable |
| `TAREA.estado` | pendiente, en_progreso, completada, escalada | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `TAREA.prioridad` | baja, media, alta | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `EVENT_LOG.actor_tipo` | usuario, sistema | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `EVENT_LOG.estado` | pendiente, procesado, fallido | [DECISIÓN DE DISEÑO] — **NUEVO** |
| `CAMPO_EVENTO.tipo_dato` | numero, texto, fecha | [DECISIÓN DE DISEÑO] |
| `IA_SUGERENCIA.tipo` | patron_detectado, comunicacion | [DECISIÓN DE DISEÑO] |
| `IA_SUGERENCIA.estado` | pendiente_revision, aprobada, rechazada, ejecutada_automaticamente | [DECISIÓN DE DISEÑO] |

**`DETALLE_FACTURA.tipo` se elimina como enum**: reemplazado por la FK `concepto_cobro_id → CONCEPTO_COBRO` (catálogo configurable, no set cerrado en código). Ver tabla `CONCEPTO_COBRO`.

---

## Tablas Catálogo — Datos a Precargar

> Estas tablas no sirven vacías: el sistema no funciona hasta que tengan al menos las filas mínimas cargadas. Separadas en 3 grupos según qué tan segura es la carga inicial.

### Grupo A — Confirmado por RF o por el cliente, se puede cargar ya sin validar más con ESSERI

**`ROL`** (RF-28 + **[ACLARACIÓN CLIENTE]** respuesta 18 — pasa de 4 a 10 valores, confirmado)
| nombre |
|---|
| dirección |
| administración |
| docente |
| familia |
| secretaría |
| coordinación académica |
| bienestar/orientación |
| admisiones/comercial |
| compras |
| administrador del sistema |

**`METODO_PAGO`** (**[ACLARACIÓN CLIENTE]** respuesta 4 — confirmado, pasa del Grupo B a este grupo)
| nombre | requiere_comprobante |
|---|---|
| debito_directo | false |
| tarjeta_debito | false |
| tarjeta_credito | false |
| transferencia | true |

**`CONCEPTO_COBRO`** (**[ACLARACIÓN CLIENTE]** respuesta 3 — confirmado, 10 valores)
| nombre |
|---|
| Cuota educativa |
| Matrícula |
| Servicio Nutricional |
| ESSERI Experience |
| ESSERI Conecta |
| Transporte |
| Penalidad por mora |
| Penalidad por stop debit |
| Daños y reparaciones |
| Extraordinario |

**`MOTIVO_JUSTIFICACION`** (**[ACLARACIÓN CLIENTE]** respuesta 10 — confirmado, 7 valores)
| nombre |
|---|
| enfermedad |
| certificado_medico |
| turno_estudio_medico |
| viaje_familiar |
| motivo_familiar_personal |
| actividad_autorizada_esseri |
| otro |

**`REGLA_PENALIDAD`** (**[ACLARACIÓN CLIENTE]** respuesta 5 — confirmado, 3 tramos)
| desde_dia_vencido | hasta_dia_vencido | porcentaje |
|---|---|---|
| 0 | 5 | 0% |
| 6 | 15 | 20% |
| 16 | 30 | 30% |

**`TIPO_EVENTO`** (RF-24, ejemplos textuales + eventos nuevos de las aclaraciones)
| nombre | descripcion |
|---|---|
| inasistencia.registrada | Se registró una ausencia |
| inasistencia.justificada | `[ACLARACIÓN CLIENTE]` Se resolvió una justificación de ausencia |
| factura.vencida | Una factura pasó a estado vencida |
| inscripcion.cambio_matricula | Cambio de nivel, división o baja |
| solicitud_inscripcion.aprobada | `[ACLARACIÓN CLIENTE]` Una solicitud de admisión llegó a etapa aprobada |
| pago.registrado | `[ACLARACIÓN CLIENTE]` Se confirmó un pago |
| pago.rechazado | `[ACLARACIÓN CLIENTE]` Un pago fue rechazado (ej. stop debit) |

### Grupo B — Decisión razonable del equipo, pero conviene validar antes de cargar en producción

**`PERMISO`** — se arma como producto de (módulo × acción) para cada uno de los módulos del sistema, ahora también con `tipo_informacion` opcional (`[ACLARACIÓN CLIENTE]` respuesta 18) para acotar permisos a subtipos de dato sensible. Acciones sugeridas por módulo: `crear`, `leer`, `actualizar`, `eliminar`, y `exportar` donde aplique (Facturación, Proveedores, Asistencias según RF-36/37/38). Antes de precargar, el equipo debe decidir la matriz completa de qué rol tiene qué permiso — no es dato que salga de un RF, es configuración institucional que debería revisar Dirección. Con 10 roles en vez de 4, esta matriz crece proporcionalmente.

**`CAMPO_EVENTO`** — depende de qué `TIPO_EVENTO` carguen. Ejemplo para `factura.vencida`: `dias_vencido` (número), `monto_deuda` (número), `nombre_familia` (texto). Hay que repetir este ejercicio por cada evento del Grupo A.

### Grupo C — Dato operativo real de ESSERI, NO inventar

**`NIVEL_EDUCATIVO`, `ANIO`, `DIVISION`, `MATERIA`** — la estructura curricular real del colegio. **[ACLARACIÓN CLIENTE]** (respuesta 6) confirma 3 niveles (Inicial/Primario/Secundario) y la jerarquía `Nivel → Año/Sala → División/Orientación → Materias → Docentes`, y el equipo ya recibió del cliente la tabla maestra con los valores concretos (ver `docs/aclaraciones-cliente-esseri.md`) — la precarga puede transcribirse a partir de esa tabla, no hace falta seguir tratándola como bloqueada.

**`PRODUCTO_SERVICIO`** — catálogo de compras. **[ACLARACIÓN CLIENTE]** (respuesta 12): el cliente va a entregar información de proveedores y compras para construir el catálogo inicial. **Sigue bloqueado** hasta recibir y normalizar esa información (pregunta pendiente #17) — no inventar valores de ejemplo como precarga real.

---

## Confirmado con ESSERI

| Pregunta | Respuesta | Impacto en el modelo |
|---|---|---|
| ¿La asistencia se toma por división o por materia? | **Por día/división.** | `ASISTENCIA` sin `asignacion_docente_id`, confirmado. |
| ¿La facturación es por familia o por alumno? | **Por alumno.** | `FACTURA` conecta con `INSCRIPCION`, no con `FAMILIA`. Deuda de familia = suma agregada vía `FAMILIA_ALUMNO` → `CUENTA_CORRIENTE`. |
| ¿Todas las familias tienen cuenta de acceso al sistema? | **Sí, registro obligatorio.** | `FAMILIA` no lleva `email` propio — se resuelve vía `USUARIO.email` (misma `PERSONA`). Decisión del equipo, no de ESSERI — resuelve a favor de RF-28 por sobre la lectura pasiva de `Entrega_2.2`. |
| Con varios responsables por alumno, ¿a nombre de quién se factura? | **Responsable económico fijo, con vigencia temporal, hasta que la familia pida un cambio.** No libera a los demás responsables de sus obligaciones. | Tabla nueva `RESPONSABLE_ECONOMICO`. |
| ¿Materias distintas entre divisiones del mismo año? | **Sí, configurable.** | `MATERIA.division_id` nullable — nulo = común al año, con valor = específica de la división. |
| ¿Qué conceptos de cobro maneja ESSERI? | **10 conceptos confirmados, catálogo configurable.** | Tabla nueva `CONCEPTO_COBRO`, reemplaza `DETALLE_FACTURA.tipo`. |
| ¿Una orden de compra agrupa varias solicitudes? | **Sí, del mismo proveedor, con trazabilidad del ID original.** | `ORDEN_COMPRA_SOLICITUD` (M:N) queda validado sin cambios. |
| ¿Hace falta aviso activo a Dirección, o alcanza con el panel? | **Ambas cosas — aviso activo y panel.** | `NOTIFICACION` deja de ser exclusiva de `FAMILIA`; suma `destinatario_tipo = usuario`. |
| ¿El motor solo notifica o también ejecuta acciones? | **15 tipos de acción en total** (13 nuevos + los 2 existentes), con `accion_config` + allowlist + aprobación humana para las sensibles. | `WORKFLOW_RULE.tipo_accion` ampliado; `accion_config`, `criticidad`, `requiere_aprobacion_humana` nuevos. |
| ¿Qué métodos de pago acepta ESSERI? | **Débito directo, tarjeta de débito, tarjeta de crédito, transferencia** (esta última solo excepcional, con comprobante). | `METODO_PAGO` pasa a precarga Grupo A. |
| ¿Estructura curricular real del colegio? | **3 niveles confirmados y jerarquía confirmada; tabla maestra con los valores concretos ya entregada por el cliente.** | Precarga de `NIVEL_EDUCATIVO`/`ANIO`/`DIVISION`/`MATERIA` deja de estar bloqueada — pasa a transcribirse en el bloque de implementación. |
| ¿A partir de cuántos días es "morosidad"? | **Día 6 en adelante; tramos de penalidad 6–15 (20%) y 16–30 (30%).** | Tabla nueva `REGLA_PENALIDAD`; cierra el enum `FAMILIA.estado_deuda`. |
| ¿Etapas exactas del pipeline de admisiones? | **7 etapas confirmadas**, con historial por etapa (fecha, estado, responsable). | Tablas nuevas `SOLICITUD_INSCRIPCION`, `ETAPA_SOLICITUD`, `DOCUMENTO_SOLICITUD`. |
| ¿Cómo registran la recepción de una orden de compra? | **Recepción completa, con detalle, total o parcial; lo no recibido queda pendiente automáticamente.** | Tablas nuevas `RECEPCION_COMPRA`, `RECEPCION_COMPRA_DETALLE`, `ORDEN_COMPRA_DETALLE`. |
| ¿El docente decide si una ausencia está justificada? | **No.** El docente marca presente/ausente/tardanza; la justificación la resuelve Secretaría/Dirección según corresponda. | `ASISTENCIA.tipo` suma `tardanza` y `ausente_pendiente`; tabla nueva `JUSTIFICACION_INASISTENCIA` + `MOTIVO_JUSTIFICACION`. |
| ¿A quién se notifica ante una ausencia? | **A todos los responsables habilitados para recibir comunicaciones, no solo al económico.** | `FAMILIA_ALUMNO.recibe_comunicaciones` nuevo. |
| Login: ¿email/contraseña o algo distinto? | **Google Identity/OAuth como login principal; JWT interno se mantiene.** | `USUARIO.auth_provider`/`provider_subject` nuevos; `password_hash` pasa a nullable. |

## Preguntas Pendientes de Validar con ESSERI

> De las 12 preguntas que traía la versión anterior de este documento, **12 quedaron cerradas** — 10 por las aclaraciones del cliente, y #4 y #15 por decisión del equipo (ver `docs/division-de-tareas-equipo.md`). Solo quedan #16 (decisión de equipo, no bloquea esquema) y #17 (bloquea únicamente la precarga de `PRODUCTO_SERVICIO`).

| # | Pregunta | Por qué importa | Módulo afectado | Bloquea |
|---|---|---|---|---|
| 16 | Especificación campo por campo de la allowlist de `accion_config` (qué entidades/campos puede tocar cada una de las 15 acciones) | Necesaria antes de implementar el motor — `requiere_aprobacion_humana` ya está decidido por acción (ver abajo), pero la allowlist en sí (qué puede tocar cada una) todavía no tiene el detalle campo por campo | Motor de Workflows | Decisión de equipo, no esquema |
| 17 | Catálogo inicial normalizado de productos/servicios | El cliente confirmó (respuesta 12) que va a entregar la información base — falta recibirla y normalizarla | Proveedores y Compras | Solo precarga de `PRODUCTO_SERVICIO` |

**Cerradas por decisión de equipo (no de ESSERI):**

- **#4 — roles con permisos conflictivos:** gana el permiso más permisivo. Si cualquiera de los roles que tiene el usuario habilita la acción, se permite — no hace falta que todos coincidan.
- **#15 — qué acciones requieren `requiere_aprobacion_humana = true`:** las que mueven dinero o escalan un caso — `generar_cargo`, `aplicar_penalidad`, `registrar_pago`, `registrar_rechazo`, `escalar_caso`, `generar_orden_compra`. El resto (`notificar`, `alerta_interna`, `generar_recordatorio`, `cambiar_estado`, `crear_tarea`, `crear_registro_relacionado`, `aplicar_vencimiento`, `actualizar_cuenta_corriente`, `generar_comunicacion`) corre automático. **Es una decisión inicial, no definitiva** — el equipo puede ajustar caso por caso una vez que el motor esté corriendo y se vea el comportamiento real en la demo.

---

## Changelog del documento

| Fecha | Cambio |
|---|---|
| — | Versión inicial: módulos Autenticación y Roles, Familias y Alumnos, Académico, Inscripciones |
| — | Agregado Facturación y Cobranza, Proveedores y Compras |
| — | Confirmado con ESSERI: asistencia por día, facturación por alumno |
| — | Agregado Motor de Workflows y Notificaciones (incluye `CAMPO_EVENTO`, `condicion` como jsonb, decisión de ejecución vía n8n sin cambios al modelo) |
| — | Formalizado Auditoría y Trazabilidad (consolida `EVENT_LOG`, `LOG_ACCESO`, `WORKFLOW_EXECUTION`, `NOTIFICACION`; documentada excepción a RNF-04 en `EVENT_LOG`) |
| — | Agregado Panel Administrativo (sin tablas propias) y Capa de IA (`IA_SUGERENCIA`) — DER completo, 9 módulos, 29 tablas |
| — | Corregida FK faltante entre `IA_SUGERENCIA` y `NOTIFICACION_TEMPLATE` (`notificacion_template_id`) |
| — | Agregada sección de Enumeraciones (18 campos) y Tablas Catálogo a Precargar (3 grupos según nivel de confianza); completados 3 valores que habían quedado sin definir (`FAMILIA.estado_deuda`, `ORDEN_COMPRA.estado`, `NOTIFICACION.estado_envio`); sumadas preguntas pendientes #10, #11, #12 |
| — | Estandarizado el orden de campos en las 54 tablas (`id` → propiedades → `created_at`/`updated_at` → FKs al final) y agregados `created_at`/`updated_at` a las entidades mutables que no tenían un timestamp equivalente — ver criterio en "Cómo leer este documento". DER (`database/schema/DER-Esseri.drawio`) regenerado en el mismo orden, verificado campo por campo contra este archivo (0 discrepancias) |
| — | Todos los nombres de campo compuestos pasados de camelCase a snake_case (`personaId` → `persona_id`, etc.), en tablas y en el texto narrativo. Timestamps de control renombrados de `fecha_creacion`/`fecha_actualizacion` a `created_at`/`updated_at`. Agregada PK `id` propia a las 5 tablas puente (`USUARIO_ROL`, `ROL_PERMISO`, `FAMILIA_ALUMNO`, `PRODUCTO_PROVEEDOR`, `ORDEN_COMPRA_SOLICITUD`), que antes usaban la combinación de las dos FK como clave. DER regenerado con relaciones ancladas exactamente en las filas PK/FK reales (no en puntos aproximados) y mucho más espaciado entre tablas para que las líneas no se amontonen |
| — | Estandarizado el nombre de toda FK como `<tabla_singular>_id` (14 renombres: `revisor_usuario_id`/`autorizado_por_usuario_id`/`validado_por_usuario_id`/`asignado_usuario_id`/`actor_usuario_id`/`usuario_revisor_id` → `usuario_id`; `responsable_id` → `familia_id`; `plantilla_id`/`plantilla_generada_id` → `notificacion_template_id`; `evento_origen_id` → `event_log_id`; `escalada_de_tarea_id` → `tarea_id`). Única excepción, documentada: `SOLICITUD_INSCRIPCION.aspirante_persona_id`/`contacto_persona_id`, porque ambas FK apuntan a `PERSONA` y no pueden compartir nombre |
| — | **Ejecutados los 19 cambios de la Revisión Maestra Consolidada + las Aclaraciones del Cliente** (`docs/aclaraciones-cliente-esseri.md`; el plan de ejecución que guió este cambio quedó documentado en el historial de git). Renombrado `EVENT_LOG` → `AUDIT_LOG`; creado `EVENT_LOG` nuevo de eventos de negocio; login vía Google Identity/OAuth + JWT interno; `WORKFLOW_EXECUTION` trazable con reintentos; `NOTIFICACION` con snapshot y destinatario genérico (familia/usuario); ciclo completo de justificación de ausencias (`JUSTIFICACION_INASISTENCIA`, `MOTIVO_JUSTIFICACION`, `tardanza`/`ausente_pendiente`); pipeline de admisiones (`SOLICITUD_INSCRIPCION`, `ETAPA_SOLICITUD`, `DOCUMENTO_SOLICITUD`); catálogo `PRODUCTO_SERVICIO` + `PRODUCTO_PROVEEDOR` + `PRECIO_PRODUCTO`; `RESPONSABLE_ECONOMICO` con vigencia; deuda derivada de `CUENTA_CORRIENTE`/`MOVIMIENTO`; motor de acciones ampliado a 15 tipos con `accion_config` + allowlist + `requiere_aprobacion_humana`; `CONCEPTO_COBRO`, `REGLA_PENALIDAD`, `EXCEPCION_VENCIMIENTO`; `PAGO` con estado de transacción; `MATERIA` por división/orientación; recepción de compras completa (`RECEPCION_COMPRA`, `RECEPCION_COMPRA_DETALLE`, `ORDEN_COMPRA_DETALLE`); `ROL` de 4 a 10 valores + `PERMISO.tipo_informacion`; `TAREA` + `REGLA_DESTINATARIO`. Modelo pasa de 29 a **~49 tablas de referencia** (no meta de diseño — recalcular sobre el DER vigente). 10 de 12 preguntas pendientes cerradas; ninguna bloquea esquema. |
| — | **Modelo v1.0 congelado.** Decisiones de equipo que cerraban las últimas preguntas pendientes de esquema/lógica: pregunta #4 (roles conflictivos → gana el permiso más permisivo), pregunta #15 (`requiere_aprobacion_humana` decidido por acción: `generar_cargo`/`aplicar_penalidad`/`registrar_pago`/`registrar_rechazo`/`escalar_caso`/`generar_orden_compra` requieren aprobación, el resto es automático). Vistas del MVP confirmadas y RNF-15 con dueño (Botteri) en `docs/division-de-tareas-equipo.md`. Quedan abiertas solo #16 (allowlist campo por campo, no bloquea) y #17 (catálogo de productos, bloquea solo precarga). |
