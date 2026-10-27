# ESSERI Data Core — Backend

API en FastAPI + SQLAlchemy + Alembic. Ver `ARCHITECTURE.md` en la raíz del repo para la explicación completa de la estructura (`src/<modulo>/`, convenciones, testing).

## Requisitos

- Python 3.14 (o compatible; el proyecto se armó con Python 3.14.7 vía [mise](https://mise.jdx.dev/)).
- PostgreSQL corriendo localmente (o vía `infra/docker-compose.yml` desde la raíz del repo).

## Setup local (sin Docker)

Con Postgres ya corriendo (local o `docker compose up -d postgres` desde `infra/`):

```bash
cd backend
cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
./setup.sh                      # venv + deps + migraciones + seeds + levanta el servidor
```

`setup.sh` es idempotente — correrlo de nuevo no rompe nada, solo salta lo que ya esté hecho. Si preferís los pasos manuales (o `setup.sh` falla y querés diagnosticar), son los que siguen abajo.

```bash
cd backend
python -m venv venv
source venv/bin/activate        # venv\Scripts\activate en Windows
pip install -r requirements/dev.txt

cp .env.example .env            # completar DATABASE_URL, JWT_SECRET, etc.
```

La app fija `timezone=UTC` en cada sesión de Postgres (`src/database.py`), así que `func.now()` en columnas `DateTime` sin zona guarda UTC aunque el servidor de base esté en otra zona. No hay variable de entorno para esto.

## Migraciones (Alembic)

Nunca se escribe SQL a mano en `database/` — todo cambio de esquema se genera con Alembic desde acá:

```bash
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

`alembic/env.py` ya está configurado para tomar la URL de conexión de `src.config.settings` (que lee `.env`) y para importar el `models.py` de cada módulo (los 8 que tienen entidades propias — `auditoria` y `panel_admin` no tienen `models.py`, ver `ARCHITECTURE.md`) — no hace falta tocarlo salvo que se agregue un `models.py` nuevo.

## Seeds (catálogos iniciales)

Después de migrar, la base queda vacía — algunos módulos no funcionan sin catálogos mínimos (`ROL`, `METODO_PAGO`, `CONCEPTO_COBRO`, etc.). Ver `database/seeds/README.md` para el detalle completo; scripts disponibles hoy:

```bash
python ../database/seeds/01_seed_grupo_a.py
python ../database/seeds/02_seed_grupo_c.py
python ../database/seeds/03_seed_grupo_b.py
```

Para cargar datos ficticios de recorrido completo en una demo local, ejecutar manualmente:

```bash
ESSERI_DEMO_SEED_ENABLED=true python ../database/seeds/04_seed_demo.py
```

No se incluye en el arranque automático de Docker y está bloqueado cuando
`ENVIRONMENT=production` o `prod`. Ver `database/seeds/README.md`. Además de los datos de
recorrido, crea dos reglas de workflow de mora sobre `factura.vencida` (`crear_tarea` a partir
de los 15 días y `escalar_caso`, con aprobación humana, a partir de los 30), tres de vencimiento
(marcar vencida, alerta a Administración y aviso a la familia) y las cuentas de email que reciben
los avisos.

## Login con Google + primer usuario (RF-27)

Documentado aparte, en `docs/auth-oauth-google.md` — abarca todo el módulo Auth (backend +
frontend), no solo cómo levantar el backend. Ahí está el flujo de OAuth, cómo configurar las
credenciales de Google, y cómo crear el primer usuario administrador
(`database/seeds/00_bootstrap_admin.py`) para poder loguearse.

`POST /auth/login` bloquea la IP tras demasiados fallidos; se ajusta con `LOGIN_MAX_INTENTOS`,
`LOGIN_VENTANA_MINUTOS` y `LOGIN_BLOQUEO_MINUTOS` (ver "Bloqueo por intentos" en ese documento).

## Autorización por permisos (RF-30)

Para proteger un endpoint según módulo y acción, usar `requiere_permiso(...)` de
`src.auth.dependencies` en vez de (o además de) `UsuarioAutenticado` — devuelve el `Usuario`
igual que `UsuarioAutenticado`, así que se puede usar donde ya se usa esa:

```python
from typing import Annotated

from fastapi import Depends

from src.auth.constants import ACCION_LEER, MODULO_ACADEMICO
from src.auth.dependencies import requiere_permiso
from src.auth.models import Usuario

PuedeLeerAcademico = Annotated[Usuario, Depends(requiere_permiso(MODULO_ACADEMICO, ACCION_LEER))]


@router.get("/materias")
def listar_materias(usuario: PuedeLeerAcademico, db: DbSession) -> list[MateriaRead]:
    ...
```

`modulo` y `accion` tienen que ser los strings exactos de `src.auth.constants` (coinciden con
`database/seeds/grupo-b.yaml`). 401 sin sesión, 403 si la sesión no alcanza. El ABM de roles y
permisos vive en `/auth/roles`, `/auth/permisos` y `/auth/usuarios/{id}/roles` — ver
`src/auth/router.py`.

## Levantar el servidor

```bash
uvicorn src.main:app --reload
```

Docs interactivas en `http://localhost:8000/docs`.

### Facturación recurrente automática

El backend recupera períodos pendientes al arrancar y luego corre diariamente a
`FACTURACION_HORA_EJECUCION` en la zona `America/Argentina/Buenos_Aires` (por defecto, `00:05`).
El job no usa una fecha global de emisión: cada regla activa con
`modo_generacion = automatica` define su propio `dia_generacion`. Si una corrida no se completa,
el período sigue pendiente y se reintenta sin duplicar cargos.

Después de facturar, la misma corrida detecta las facturas vencidas (`vencimientos_service.py`) y
emite `factura.vencida` una vez por tramo activo de `REGLA_PENALIDAD` (con el seed, días 1, 6 y 16
de mora). Solo emite el evento: el cambio de estado y la penalidad los hacen las acciones del
workflow. Una `EXCEPCION_VENCIMIENTO` del mismo mes corre la fecha desde la que se cuentan los días.

Para forzar una pasada: `POST /facturacion/vencimientos/procesar`. Con `fecha_referencia` simula
días de mora, y lo emitido así cuenta como ya emitido cuando llegue la fecha real.

Para deshabilitar temporalmente el job, configurar
`FACTURACION_AUTOMATICA_HABILITADA=false`. El flujo manual “Generar ahora” permanece disponible
como respaldo con previsualización.

### Workflows: eventos y despacho

Los módulos avisan al motor de workflows con `emit_event()` (`src/workflows/eventos_service.py`),
que guarda un hecho de negocio en `EVENT_LOG` con estado `pendiente`:

```python
from src.workflows.eventos_service import emit_event

emit_event(
    db,
    tipo="factura.vencida",          # nombre del catálogo `tipo_evento` (ver TipoEventoNombre)
    entidad="factura",
    entidad_id=factura.id,
    payload={"dias_vencido": 6, "monto_deuda": factura.monto_total},
    usuario_id=None,                 # None = lo originó el sistema
)
```

- No hace `commit`: el evento se confirma con la transacción del llamador, igual que `log_audit()`.
- `entidad` tiene que ser la que corresponde al tipo (`ENTIDAD_POR_EVENTO` en `constants.py`, por
  ejemplo `factura.vencida` → `"factura"`, `pago.registrado` → `"pago"`); si no, lanza
  `EntidadDeEventoInvalida`. Las acciones de las reglas operan sobre esa entidad.
- `payload` debería traer los campos que el catálogo declara para ese tipo (`campo_evento`, ver
  `database/seeds/grupo-b.yaml`). Si falta alguno se loggea un warning, el evento se registra igual.
  No incluir datos sensibles innecesarios (RNF-15).
- Un `tipo` que no esté en `tipo_evento` lanza `TipoEventoNoRegistrado`. Para sumar un evento nuevo:
  agregarlo a `TipoEventoNombre` y `ENTIDAD_POR_EVENTO` (`src/workflows/constants.py`), a
  `database/seeds/grupo-a.yaml` y sus campos a `grupo-b.yaml`.

**Cómo fluye un evento**

1. El módulo dueño del hecho (facturación, académico, etc.) llama a `emit_event()` y después hace su
   `commit`. Eso es todo lo que le toca: no espera ni se entera de lo que pase después.
2. `emit_event()` solo inserta la fila en `EVENT_LOG` con estado `pendiente`, dentro de la
   transacción del llamador. Si esa operación se revierte, el evento desaparece con ella, así que
   nunca queda registrado algo que no pasó. El despachador recién ve el evento cuando el llamador
   confirma.
3. El despachador (`procesar_eventos_pendientes`, en `despacho_service.py`) corre solo dentro del backend: al arrancar la app
   se levanta una tarea en segundo plano (`despacho_job.py`) que cada
   `WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` (30 por defecto) toma los eventos `pendiente`, del más
   viejo al más nuevo, y los procesa de a uno, hasta 100 por pasada. Nadie del equipo lo llama. Se
   puede apagar con `WORKFLOWS_DESPACHO_HABILITADO=false` y forzar una pasada con
   `POST /workflows/procesar`.
4. Por cada evento busca las reglas activas de su tipo. Para cada una evalúa su `condicion` contra
   el `payload`: si no se cumple no se crea ninguna ejecución. Si se cumple, revalida el
   `accion_config` contra la allowlist y crea un `WORKFLOW_EXECUTION`. Si la regla tiene
   `requiere_aprobacion_humana`, la ejecución queda `pendiente` y no se ejecuta nada hasta que alguien la apruebe o la rechace
   (ver "Historial, reintentos y aprobaciones"). Si no, corre
   la acción y la ejecución queda `exitoso` o `fallido`. Un evento sin reglas también se marca
   `procesado`.
5. Cada evento se confirma por separado: si uno falla (el evento pasa a `fallido`) no se revierten
   los que ya se procesaron. Una acción que falla no corta las demás reglas del mismo evento.
   Lo mismo vale para una regla que no se puede evaluar (campo ausente o de tipo equivocado en el
   `payload`, config que ya no pasa la allowlist, entidad que no corresponde): su ejecución queda
   `fallido` con un motivo controlado en `error_detail` y las demás reglas siguen. El detalle
   técnico se conserva únicamente en los logs para no persistir ni exponer datos internos.

**Por qué es asíncrono:** así una falla del motor o de n8n no puede romper la operación de negocio
que originó el evento (por ejemplo, el registro de una ausencia), y el estado
`pendiente/procesado/fallido` de `EVENT_LOG` deja registrado qué se procesó y qué falló. Es el
mismo patrón que el job de facturación. El costo es una demora de hasta
`WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` entre el evento y la ejecución de sus reglas. Con varias
instancias del backend, `FOR UPDATE SKIP LOCKED` evita que dos procesen el mismo evento.

**Eventos que faltan emitir**

Ya emiten: Proveedores y Compras, `orden_compra.emitida` (en `crear_orden_compra`) y
`recepcion_compra.registrada` (en `crear_recepcion`); Académico, `inasistencia.registrada` e
`inasistencia.justificada`; Inscripciones, `inscripcion.cambio_matricula` (en
`registrar_cambio_matricula`); y Facturación, `pago.registrado` (en `registrar_pago`). El resto lo
agrega el módulo dueño del hecho:

| Evento | Dónde iría | Payload |
|---|---|---|
| `factura.vencida` | Facturación: `vencimientos_service.py` al entrar la factura en un tramo de mora | `dias_vencido`, `monto_deuda`, `nombre_familia` |
| `inscripcion.confirmada` | Inscripciones: al crear la `INSCRIPCION` nueva desde la solicitud (`matriculas_service.py`) | `alumno_nombre`, `nivel_educativo`, `fecha` |
| `solicitud_compra.aprobada` | Compras: `cambiar_estado_solicitud` cuando pasa a `aprobada` | `item`, `cantidad`, `fecha` |
| `solicitud_inscripcion.aprobada`, `pago.rechazado` | Admisiones y Facturación | ver `grupo-b.yaml` |

En `solicitud_compra.aprobada`, `item` es un solo campo que nunca puede ser nulo: el `articulo` o,
si la solicitud usa `producto_servicio_id`, el nombre del producto. No se agregan `articulo` ni
`area_solicitante` porque pueden ser `None` y `coaccionar_valor` rechaza un texto nulo.

Para `inasistencia.registrada` conviene emitir una sola vez por asistencia (en la carga masiva, al
final del lote) y antes del `commit`. El despacho corre unos segundos después: si la asistencia se
elimina antes, la ejecución queda `fallido` por no encontrar al alumno.

**Historial, reintentos y aprobaciones:** `GET /workflows/ejecuciones` devuelve el historial paginado y permite
filtrar por `estado`; `GET /workflows/ejecuciones/{id}` expone el detalle y el evento que originó
una ejecución sin devolver su `payload`. `POST /workflows/ejecuciones/{id}/reintentar` crea un
intento nuevo y conserva los anteriores. Solo admite el último intento fallido de una regla activa,
y rechaza el reintento si la regla fue editada desde esa ejecución. La operación requiere permiso
`workflows.actualizar` y registra en auditoría quién la solicitó. Cada combinación de regla, evento
y número de intento es única; si dos solicitudes compiten por el mismo intento, una recibe `409`
antes de ejecutar la acción. Cada ejecución del listado incluye `reintentable`, calculado con esas
mismas condiciones, para que el frontend solo ofrezca el botón cuando corresponde; el `POST` vuelve
a validarlas, así que el valor puede quedar viejo entre la carga y el clic.

Las ejecuciones `pendiente` (reglas con `requiere_aprobacion_humana`) se destraban con dos
endpoints, ambos con permiso `workflows.actualizar` y auditoría de quién decidió (`__aprobacion__`
y `__rechazo__`). Los dos responden `409` si la ejecución ya no está `pendiente`; el `FOR UPDATE`
serializa dos decisiones simultáneas, así que solo una prospera.

- `POST /workflows/ejecuciones/{id}/aprobar` revalida la config y corre la acción. Queda `exitoso`
  o `fallido`. Responde `409` si la regla está inactiva o fue editada desde que la ejecución quedó
  pendiente (hay que rechazarla y generar un evento nuevo). Si la acción falla, el `fallido` se
  puede reintentar, pero el reintento vuelve a quedar `pendiente`: un intento nuevo necesita una
  aprobación nueva.
- `POST /workflows/ejecuciones/{id}/rechazar` recibe `{"motivo": "..."}` (obligatorio) y deja la
  ejecución en `rechazado`, con el motivo en `detalle`. No valida la regla, así que una pendiente
  cuya regla cambió siempre se puede cerrar. Una rechazada no es reintentable.

Cada ejecución del listado incluye `aprobable` (`pendiente`, regla activa y sin editar), con la
misma salvedad que `reintentable`.

**Log de notificaciones (RF-26):** `GET /workflows/notificaciones` lista las notificaciones
enviadas, paginadas, con filtros `estado_envio`, `destinatario_tipo` y `workflow_execution_id`.
`GET /workflows/notificaciones/{id}` agrega `cuerpo_snapshot`, que no viaja en el listado porque
puede tener datos personales. Ambos piden `workflows.leer` y no hay rutas de escritura. Cada fila
es el snapshot del envío, así que editar la plantilla o el email después no la cambia. El orden va
por el inicio de la ejecución (la más reciente primero), porque `NOTIFICACION` no tiene `created_at`
y `sent_at` es `NULL` en las fallidas. Un reintento aparece como filas nuevas con su `intento`.

**Estado actual:** `notificar`, `alerta_interna`, `aplicar_vencimiento`, `cambiar_estado`,
`aplicar_penalidad`, `crear_tarea`, `escalar_caso` y `generar_recordatorio` tienen ejecutor real.
Facturación además emite `pago.registrado` al confirmar un pago aprobado, antes de confirmar la misma
transacción que escribe el pago y el movimiento de cuenta corriente. El resto de `ACCIONES`
(`despacho_service.py`) sigue con un stub por dueño que devuelve "acción no implementada", así que una
regla sin aprobación humana queda `fallido`
hasta que su dueño lo reemplace (#199):

| Acción | Archivo | Dueño |
|---|---|---|
| `aplicar_vencimiento`, `cambiar_estado` | `acciones_vencimiento_service.py` | Arce |
| `aplicar_penalidad` | `acciones_penalidad_service.py` | Canu |
| `generar_cargo` | `acciones_admision_service.py` | Carreon |
| `registrar_rechazo` | `acciones_pagos_service.py` | Carreon |
| `generar_orden_compra`, `generar_comunicacion` | `acciones_compras_service.py` | Canu |

**`generar_recordatorio` (#218):** manda el mismo email que `notificar` (misma plantilla y mismos
destinatarios, con la config de `generar_recordatorio`) pero `dias_despues` días después del evento, y
solo si todavía corresponde. Para esperar sin tablas nuevas, el despachador saltea estas reglas al
llegar el evento (`ACCIONES_DIFERIDAS`) y `procesar_recordatorios_vencidos` las ejecuta cuando se
cumple el plazo: que la regla no tenga ejecución para un evento significa "todavía no le toca". Corre
en la misma pasada del job (`despacho_job.py`) y con `POST /workflows/procesar`, que ahora informa
`recordatorios_ejecutados`. Reglas de la búsqueda:

- Solo se miran eventos `procesado` posteriores a la creación de la regla (como cualquier regla,
  no actúa sobre lo anterior) y de los últimos `VENTANA_RECORDATORIOS_DIAS` (7) días después del
  plazo: un evento más viejo (backend caído, regla apagada) ya no se recuerda.
- La `condicion` se evalúa al vencer el plazo, igual que en el despacho; si no se cumple no queda
  ejecución. Una regla con aprobación humana queda `pendiente` como cualquier otra, y un envío que
  falla queda `fallido` y se reintenta desde el historial.
- En eventos de `asistencia` el ejecutor no manda nada (y la ejecución queda `exitoso` con el motivo
  en `detalle`) si la asistencia ya no existe, ya no está `ausente_pendiente` o la familia ya cargó una
  justificación, aunque esté por revisar.

`aplicar_vencimiento` marca la factura `vencida` cuando ya pasó su fecha efectiva: la mayor entre
su vencimiento y las excepciones de la familia del responsable económico. El día exacto todavía no
cuenta como vencida (fecha de Buenos Aires). Con una prórroga vigente la ejecución queda exitosa
sin cambios y se reevalúa recién con el `factura.vencida` del siguiente tramo. `cambiar_estado` aplica el `estado_nuevo` de `accion_config` dentro de
`CAMBIOS_ESTADO_PERMITIDOS` (hoy solo `factura → vencida`), sin mirar fechas ni excepciones.
Ninguna modifica una factura pagada o ya vencida.

`aplicar_penalidad` registra la penalidad como un `MOVIMIENTO` de debe en la cuenta corriente del
alumno, con el concepto del tramo y el `event_log_id` del evento. El tramo sale de
`facturacion/penalidades_service.py`: el activo de mayor `desde_dia_vencido` que alcanzó el
`dias_vencido` del evento (pasado el último, se mantiene el último), o el `regla_penalidad_id` de
`accion_config` si la regla lo fija. Los tramos no se suman: la penalidad total de la factura es el
porcentaje del tramo sobre su `monto_total`, y se cobra solo la diferencia con lo ya registrado
(20 % en 6–15 días, otro 10 % al pasar a 16–30). Por eso es idempotente: el mismo tramo no se cobra
dos veces. Solo penaliza facturas en estado `vencida`: fechas y prórrogas las decide
`aplicar_vencimiento`, así que la regla de vencimiento tiene que correr antes. Nace con aprobación
humana porque mueve dinero.

**Tramos y prórrogas (#238):** `GET/POST /facturacion/penalidades`, `PUT /facturacion/penalidades/{id}`
y `PATCH /facturacion/penalidades/{id}/estado` (baja lógica) administran `REGLA_PENALIDAD`; dos tramos
activos no pueden superponerse (409). `GET/POST /facturacion/familias/{familia_id}/excepciones-vencimiento`
lista y otorga prórrogas, y `POST /facturacion/excepciones-vencimiento/{id}/anular` las anula: no se
editan ni se borran, y una anulada deja de postergar el vencimiento.

Contrato del ejecutor: recibe `(db, regla, evento, ejecucion)`, nunca hace `commit` (corre dentro
de un savepoint) y devuelve un `ResultadoAccion` (`detalle`, `error`). Con `error` la ejecución
queda `fallido` pero se conservan las filas que escribió. Cada dueño edita solo su archivo: el
registro, la allowlist y los seeds ya están. Los stubs importan `ResultadoAccion` de `schemas.py` y
el mensaje de `constants.py`, nunca de `despacho_service.py`.

Tres acciones no se implementan y siguen sin ejecutor: `registrar_pago` y
`actualizar_cuenta_corriente` (el pago y el libro de movimientos los escribe Facturación al
registrar el pago, el motor no los duplica) y `crear_registro_relacionado` (el alta de alumno y
familia desde la solicitud ya la hace Admisiones). Una regla con alguna de ellas queda `fallido`.

`pago.rechazado` y su ejecutor `registrar_rechazo` quedan pendientes de la integración de retorno
del débito automático: el flujo manual actual solo confirma pagos aprobados y no inventa rechazos.
Cuando el banco devuelva su archivo de resultados, la importación deberá registrar el rechazo con su
referencia y motivo, emitir `pago.rechazado` y recién entonces resolver si `registrar_rechazo` aporta
una acción adicional sin duplicar la actualización que ya hace Facturación.

**Reglas y allowlist de `accion_config`**

`condicion` y `accion_config` son datos, nunca código. Al crear o editar una regla (y de nuevo al
despachar) el backend los valida contra una lista cerrada; lo que no esté declarado se rechaza con
422. `accion_config = null` equivale a `{}`, y lo que se guarda es la config normalizada con sus
defaults.

- **`condicion`**: `{}` (siempre se cumple) o `{"campo", "operador", "valor"}`. `campo` tiene que ser
  un campo del evento de la regla (`GET /workflows/tipos-evento`). Operadores: `==`, `!=`, `>`, `>=`,
  `<`, `<=` para número y fecha (ISO); `==`, `!=`, `contiene` para texto (sin distinguir mayúsculas).
- **`accion_config`**: un modelo por acción en `schemas.py` (`CONFIG_POR_ACCION`), con claves
  extra prohibidas. Los eventos en los que puede usarse cada acción están en `EVENTOS_POR_ACCION`
  (`constants.py`): solo `notificar`, `alerta_interna`, `generar_recordatorio`, `generar_comunicacion`,
  `crear_tarea` y `escalar_caso` valen para cualquier evento; las que escriben sobre la entidad del
  evento o mueven dinero tienen una lista cerrada (`generar_orden_compra` solo con
  `solicitud_compra.aprobada`, `generar_cargo` con `inscripcion.confirmada` o `pago.rechazado`).
  Solo las cuatro que arman un mensaje admiten `notificacion_template_id`.
- `GET /workflows/tipos-accion` devuelve, por acción, el default de aprobación humana, los eventos
  permitidos, si admite plantilla y el JSON Schema de su config.
- Para habilitar una acción en otro evento, o `cambiar_estado` sobre otra entidad
  (`CAMBIOS_ESTADO_PERMITIDOS`), se edita la constante y se actualiza la nota de `WORKFLOW_RULE` del
  diccionario de datos.

Las reglas se administran en `/workflows/reglas` y el catálogo de eventos con sus campos en
`/workflows/tipos-evento`. Los emails los envía n8n vía el webhook `N8N_WEBHOOK_URL` (ver
`infra/n8n/README.md`).

**Plantillas y destinatarios:** el CRUD de plantillas vive en `/workflows/plantillas`. Una
plantilla puede reutilizarse entre tipos de evento, pero al asociarla a una regla sus placeholders
`{{nombre_campo}}` deben existir en el catálogo de campos de ese evento. El listado acepta
`tipo_evento_id` para devolver solo plantillas compatibles. Una plantilla referenciada por una
regla o una sugerencia de IA no se puede eliminar.

Los destinatarios configurables de una regla se consultan y reemplazan de forma atómica con
`GET`/`PUT /workflows/reglas/{id}/destinatarios`. Pueden ser roles y usuarios puntuales. Para las
acciones `notificar`, `generar_recordatorio` y `generar_comunicacion`, la regla debe usar
`accion_config.destinatario = "destinatarios_regla"`; `alerta_interna`, `crear_tarea` y
`escalar_caso` siempre los usan (en las dos últimas son las personas a quienes se asigna la tarea). Los usuarios inactivos ya configurados se conservan para mantener la trazabilidad,
pero no se pueden agregar como destinatarios nuevos.

**Envío de `notificar` (RF-24):** `notificaciones_service.ejecutar_notificar` renderiza la
plantilla de la regla con el payload del evento, resuelve los destinatarios según
`accion_config.destinatario`, crea una fila `NOTIFICACION` por destinatario (con snapshot de
destinatario, asunto y cuerpo) y le pide a n8n el envío (`n8n_client.enviar_email`). La fila queda
`enviado` con `sent_at`, o `fallido` si ese envío falla.

**`alerta_interna`:** `notificaciones_service.ejecutar_alerta_interna` reutiliza el mismo envío, pero
siempre a los `destinatarios_regla`. El cuerpo sale de la plantilla de la regla si tiene una y, si
no, de `accion_config.mensaje` (asunto `Alerta interna: <nombre de la regla>`). Sin ninguno de los
dos la ejecución falla.

**Tareas (#89):** `tareas_service.py` ejecuta `crear_tarea` y `escalar_caso`. `TAREA` tiene un único
responsable (`usuario_id`), así que ambas crean una tarea por cada usuario activo de la regla (directo
o por rol, sin repetir). Sin usuarios activos la ejecución queda `fallido`, igual que si superan
`MAX_DESTINATARIOS_POR_EJECUCION`.

- `crear_tarea` crea tareas `pendiente` con el `titulo`, la `descripcion` y la `prioridad` de la
  config; `dias_para_vencer` fija `fecha_vencimiento`. `entidad`/`entidad_id` salen del evento.
- `escalar_caso` busca las tareas abiertas (`pendiente` o `en_progreso`) de la misma entidad, las pasa
  a `escalada` y crea una tarea nueva `pendiente` por cada usuario de la regla, con la prioridad de la
  config y encadenada con `tarea_id` a la más reciente de las escaladas. Sin tareas abiertas crea la
  tarea sin antecesora. `escalar_caso` nace con aprobación humana (#15): la ejecución queda
  `pendiente` hasta que alguien la apruebe (ver "Historial, reintentos y aprobaciones"); con
  `requiere_aprobacion_humana = false` corre sola.
- Un reintento no duplica trabajo: los usuarios que ya tienen una tarea de esa regla y ese evento no
  reciben otra, y las tareas que creó la propia regla no se vuelven a escalar.

La bandeja (`GET /workflows/tareas`, `GET /workflows/tareas/{id}`, `PATCH /workflows/tareas/{id}/estado`
y `PATCH /workflows/tareas/{id}/asignado`) es de cada persona: cualquiera con sesión y rol activo ve las
tareas que se le asignaron, aunque su rol no tenga permisos de Workflows. Con `workflows.leer` se ven las
de todos (`solo_mias=true` filtra las propias) y con `workflows.actualizar` además se pueden avanzar las
ajenas. Una tarea ajena para quien no tiene permiso responde `404`. El listado admite `estado`,
`prioridad`, `usuario_id` (el responsable), `pagina` y `tamanio_pagina`; sin `workflows.leer`, `usuario_id`
no amplía lo que se ve y `solo_mias` prevalece sobre él. El detalle incluye la cadena de escalamiento.
Una persona solo puede avanzar la tarea (`pendiente → en_progreso → completada`): `escalada` la pone el
motor y `completada` no se reabre. Cada cambio de estado queda en `AUDIT_LOG`.

**Reasignar (#215):** `PATCH /workflows/tareas/{id}/asignado` con `{"usuario_id": ...}` pasa una tarea a
otro usuario. Exige `workflows.actualizar` (`403` si no): reasignar es una decisión de gestión, así que
ni el responsable actual puede hacerlo sin ese permiso. Solo admite tareas abiertas (`pendiente` o
`en_progreso`; `completada` y `escalada` responden `409`), un usuario `activo` (`422` si no existe o
está inactivo) y distinto del actual (`409`). No cambia el estado ni la cadena de escalamiento, y queda
en `AUDIT_LOG` (`campo = usuario_id`, con el id anterior y el nuevo). Un reintento de la ejecución que
creó la tarea mira quién ya tiene una, así que tras reasignar podría crearle otra a la persona original;
solo se reintentan las ejecuciones `fallido`, que no crean tareas.

- `destinatarios_regla`: usuarios y roles de la regla, solo los activos.
- `responsables_habilitados`: familias del alumno con `recibe_comunicaciones`.
- `responsable_economico`: para facturas y pagos, el de la factura aunque ya no esté vigente; para
  el resto, el vigente del alumno.
- Los dos últimos necesitan un alumno, que se deduce de la entidad del evento. Por eso la regla se
  rechaza sobre `solicitud_inscripcion.aprobada`, que no lo tiene.
- `Persona` no tiene email: el de una familia sale de las cuentas activas (`USUARIO.persona_id`) de
  su persona. Una familia sin cuenta se cuenta en el `detalle` y solo hace fallar la ejecución si no
  queda ningún destinatario.

La ejecución queda `fallido` si no hay plantilla, si falta un campo del payload, si no hay
destinatarios con email, si hay más de `MAX_DESTINATARIOS_POR_EJECUCION` (50) o si algún envío
falla. Al reintentar desde el historial (#67) se reenvían solo las filas `fallido` del intento
anterior, con los snapshots originales: editar la plantilla o el email entre intentos no cambia lo
que se manda.

Limitaciones conocidas:

- **Sin idempotencia:** si n8n envía el email pero la respuesta se pierde (timeout), la notificación
  queda `fallido` y un reintento lo manda otra vez.
- **HTTP dentro de la transacción:** los envíos van en serie dentro de la transacción del evento
  (timeout de 10 s cada uno). Si n8n no está configurado o no responde, el resto de las
  notificaciones se registra `fallido` sin intentar el envío. Un despachador separado (filas
  `pendiente` + job de envío) queda para `generar_comunicacion`, donde aparecen los envíos masivos;
  no requiere cambios de esquema.

### Comprobantes y PDF de factura

El detalle de una factura permite registrar pagos parciales o totales. Los comprobantes de métodos
que los requieran se guardan junto al pago en la base de datos; se aceptan PDF, JPG y PNG de hasta
5 MB. La descarga de la factura se genera bajo demanda como PDF, sin almacenar una copia adicional.

## Fechas y horas en la API

En Auth, Workflows y Facturación los instantes salen en ISO 8601 UTC con `Z` (`2026-10-26T13:00:00Z`) y las fechas de solo día como `YYYY-MM-DD`. Los esquemas usan `InstanteUtc` (`src/fechas.py`), que agrega la zona al serializar.

Las columnas `DateTime` sin zona de esos módulos guardan UTC: la sesión de Postgres está fijada en UTC (`func.now()` ya devuelve UTC) y las escrituras desde Python usan `ahora_utc()`, nunca `datetime.now()`.

Todavía no lo cubre `academico`, `inscripciones`, `familias_alumnos`, `proveedores_compras` ni `AUDIT_LOG` (`log_audit` escribe con `datetime.now()` aunque lo llamen Auth y Workflows).

Las filas de `finished_at`, `sent_at` y `fecha_vencimiento` de Workflows grabadas antes de este cambio con el backend corriendo en el host quedaron en hora local, y ahora se ven corridas (las tareas abiertas con esa marca vencen antes de tiempo). No hay migración de datos: si tu base de desarrollo se pobló así, volvé a poblarla.

## Tests

```bash
pytest
```

Los tests usan una base SQLite en memoria (ver `tests/conftest.py`), no la base de `DATABASE_URL` — así corren sin depender de Postgres. Si el equipo prefiere testear contra un Postgres real, ajustar `TEST_DATABASE_URL` en `tests/conftest.py`.

## Lint y formato

```bash
ruff check src/ tests/
ruff format src/ tests/
ruff format --check src/ tests/   # solo verifica, no modifica
```

## Con Docker

Desde la raíz del repo, usar `infra/docker-compose.yml` (levanta Postgres + backend + frontend + n8n juntos, migra y carga seeds automáticamente antes de arrancar `uvicorn`). El build context del backend es la raíz del repo, no `backend/` — necesita copiar también `database/seeds/`. Para buildear solo esta imagen:

```bash
cd ..   # raíz del repo
docker build -f backend/Dockerfile -t esseri-backend .
docker run --env-file backend/.env -p 8000:8000 esseri-backend
```

## Estructura

Un paquete por módulo en `src/<modulo>/` (`router.py`, `schemas.py`, `models.py`, `service.py`, y lo que cada módulo necesite — ver la tabla de "Notas por módulo específico" en `ARCHITECTURE.md`). Lo compartido entre 2+ módulos vive en `src/config.py`, `src/database.py`, `src/models.py` y `src/exceptions.py`.
