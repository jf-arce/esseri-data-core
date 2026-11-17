# Reglas programadas en Workflows

Plan para una PR futura (todavía no implementado). Permite que una regla se ejecute en una fecha y hora, o cada cierto tiempo, además de por evento.

## Contexto

Hoy cada regla tiene un único disparador: un evento de negocio (`WorkflowRule.tipo_evento_id`). Los servicios llaman a `emit_event()` (`backend/src/workflows/eventos_service.py`), eso deja una fila `EventLog` pendiente y el loop de `despacho_job.py` (cada 30 s) la procesa con `despacho_service.procesar_eventos_pendientes`, recorre el árbol (`arbol_service.recorrer_arbol`) y ejecuta acciones.

Lo único que hoy depende del tiempo:
- `generar_recordatorio`: N días **después** de un evento (`procesar_recordatorios_vencidos`).
- El job diario de facturación (00:05, hora Argentina) que emite `factura.vencida`.
- No hay scheduler (ni APScheduler ni Celery ni cron). Son loops asyncio en el lifespan de `main.py`. n8n solo manda emails.

El pedido es poder configurar que una regla corra "cada X tiempo" o en una fecha y hora. Las frecuencias pedidas: una vez, diaria/semanal, mensual y cada N horas.

## Qué le sirve más a la escuela

Hay dos tipos de regla programada:

**A. Recordatorio general.** A la hora pactada ejecuta sus acciones sin ningún registro detrás. Ej.: "lunes 9:00, avisar a preceptores que carguen la asistencia", "día 1 de cada mes, crear tarea a administración: revisar morosos".
- Barato: el motor queda casi igual.
- Valor limitado: es una alarma de calendario. No sabe si la asistencia ya se cargó, ni a quién avisar en concreto, ni puede usar condiciones (no hay campos que evaluar).

**B. Barrido de registros.** A la hora pactada busca registros que cumplan algo y corre la regla por cada uno. Ej.:
- "Todos los días 8:00, por cada cuota que vence en 3 días, avisar a la familia" (hoy no existe nada "antes del vencimiento"; las aclaraciones del cliente marcan vencimiento el día 5).
- "Todos los días, por cada tarea vencida sin resolver hace 2 días, avisar al coordinador" (cubre "Escalar casos por falta de respuesta", pedido explícito en `docs/aclaraciones-cliente-esseri.md`).
- "Lunes 8:00, por cada alumno con 3+ inasistencias sin justificar en el mes, crear tarea al preceptor".
- "Cada 6 horas, solicitudes de compra/inscripción pendientes hace más de N días, escalar".

**Recomendación: B es lo que de verdad le sirve a la escuela**, porque cubre los dos puntos del cliente que hoy no tienen solución ("generar recordatorios" antes de que pase algo y "escalar por falta de respuesta"). A sale casi gratis si B se diseña bien, así que conviene hacerlas juntas como un mismo mecanismo.

La clave para que B no sea un constructor de consultas libre (enorme y riesgoso): **"fuentes" predefinidas en código**, igual que hoy los tipos de evento están en `constants.py` + seed. Cada fuente es una consulta fija con un par de parámetros (ej. "cuotas por vencer" con `dias_antes`) que expone campos como `CampoEvento`. Arrancar con 3 o 4 fuentes y sumar más a demanda.

## Diseño propuesto

Idea central: **una regla programada genera eventos, y el motor actual los procesa sin cambios.** Así se reutilizan condiciones, acciones, destinatarios, aprobación humana, ejecuciones, simulador e historial.

### Backend (`backend/src/workflows/`)

1. **Modelo** (migración vía skill `db-migration`, zona sensible):
   - `WorkflowRule.tipo_disparador`: `evento | programado`.
   - `WorkflowRule.programacion` (JSON): `{frecuencia: una_vez|diaria|semanal|mensual|cada_n_horas, hora, dias_semana[], dia_mes, cada_horas, fecha_hora (una_vez), desde, hasta}`. Siempre en hora Argentina.
   - `WorkflowRule.proxima_ejecucion` (UTC, indexada) y `ultima_ejecucion`.
   - La "fuente" de un barrido se modela como un `TipoEvento` más (ej. `programado.cuota_por_vencer`, `programado.tarea_sin_resolver`, `programado.general`) con sus `CampoEvento`. Así `tipo_evento_id`, condiciones, `EVENTOS_POR_ACCION` y el editor siguen funcionando igual. Los parámetros de la fuente van dentro de `programacion` (`parametros_fuente`).
   - `EventLog` necesita saber qué regla lo generó (columna `workflow_rule_id` nullable) para que `_registrar_evento` solo corra esa regla y no todas las del mismo tipo.
2. **Cálculo de la próxima corrida**: `programacion_service.py` con una función pura `proxima_ejecucion(programacion, desde)`, generalizando `proxima_corrida_diaria_argentina` (`facturacion/calendario_facturacion.py`). Mensual con día 31 → último día del mes. `una_vez` → `None` tras correr.
3. **Loop**: agregar `procesar_reglas_programadas` al mismo ciclo de `despacho_job.py` (sin librería nueva ni contenedor). Toma reglas activas con `proxima_ejecucion <= ahora` con `FOR UPDATE SKIP LOCKED`, corre la fuente, emite un `EventLog` por registro (o uno solo para `general`) y avanza `proxima_ejecucion`. Corridas perdidas (backend caído): se ejecuta una sola vez y se salta a la próxima futura, sin ponerse al día.
4. **Fuentes**: `fuentes_programadas.py` con un registro `{nombre_tipo_evento: funcion_consulta}`, cada una devuelve `(entidad, entidad_id, payload)`. Las consultas leen de otros módulos por sus servicios, no por SQL directo.
5. **Anti spam**: en barridos, opción "no repetir para el mismo registro" (no volver a emitir para `(regla, entidad_id)` si ya hubo ejecución exitosa). Para `cada_n_horas`, mínimo 1 hora.
6. **Schemas/validación**: `WorkflowRuleCreate/Update` aceptan `tipo_disparador` y `programacion` con un modelo Pydantic estricto por frecuencia. El tipo de evento elegido debe coincidir con el tipo de disparador.

### Frontend (`frontend/src/modules/workflows/`)

- `PanelDisparador` (`components/inspector-nodo.tsx`): selector "Por evento / Programada". Programada muestra fuente (con sus parámetros) y frecuencia con campos según el caso (hora, días de la semana como toggles, día del mes, cada N horas, fecha y hora puntual, rango opcional desde/hasta).
- `BorradorFlujo` y `payloadDesdeBorrador` / `borradorDesdeRegla` (`utils-grafo.ts`) suman `tipoDisparador` y `programacion`.
- `nodo-disparador.tsx` y `lineasRegla`: texto tipo "Todos los lunes a las 09:00, por cada cuota que vence en 3 días:". Mostrar "Próxima ejecución: …" en el panel y en el listado de reglas (formateado con `frontend/src/lib/fechas.ts`, zona Argentina).
- Simulador: para programadas, en lugar de "eventos recientes" ofrece "previsualizar": corre la fuente en modo lectura y muestra qué registros entrarían hoy.

### Docs

`ARCHITECTURE.md` (sección workflows), `docs/diccionario-de-datos-esseri.md` (nuevas columnas y tipos de evento), seed `database/seeds/grupo-a.yaml`, y `backend/README.md` si se agrega alguna variable.

## Etapas sugeridas

1. Infraestructura: columnas, `proxima_ejecucion`, loop, fuente `programado.general` (recordatorio sin registro) y UI de frecuencia. Ya es usable.
2. Primeras fuentes de barrido: cuotas por vencer y tareas sin resolver. Anti spam y previsualización.
3. Más fuentes según lo que pida la escuela (inasistencias acumuladas, solicitudes pendientes).

## Puntos a decidir antes de implementar

- Qué fuentes de barrido entran en la etapa 2 (propuesta: cuotas por vencer y tareas sin resolver).
- Qué acciones se permiten en `programado.general` (sin registro no aplican `cambiar_estado` ni las que necesitan entidad; quedan notificar a roles/usuarios y crear tarea).
- Si una regla `una_vez` se desactiva sola después de correr.

## Verificación

- Tests unitarios de `proxima_ejecucion` (cada frecuencia, fin de mes, rango desde/hasta, corridas perdidas).
- Tests en `tests/workflows/` del loop: emite el `EventLog` correcto, solo corre la regla dueña, no duplica con dos workers (SKIP LOCKED), anti spam.
- Tests de las funciones de mapeo en `utils-grafo.test.ts` y del panel de programación.
- Prueba manual con skill `run-infra`: crear una regla "cada 1 hora" o "una vez dentro de 2 minutos", forzar con `POST /workflows/procesar` y ver la ejecución en el historial.
