# Simulated file collections
Objective: deliver the authorized demo without claiming bank compatibility or settlement. Branch: `feature/cobranzas-archivo-simuladas`; baseline: `076c549`.
Delivery: ask-on-risk → feature-branch-chain (user selected); revised forecast ~3,000–4,000 authored lines for the approved three-screen lifecycle. Runner: backend pytest/Ruff, frontend Vitest/ESLint/build; isolated concurrency and browser probes. No remote publication.

## Specs

### S1 — Complete demo
> Demostrar el recorrido completo:
> 1. Seleccionar facturas pendientes y generar un archivo simulado de solicitud de débito.
> 2. Generar un archivo simulado de respuesta con cobranzas y rechazos.
> 3. Importar la respuesta y mostrar una vista previa.
> 4. Confirmar la importación y registrar los pagos cobrados. Los rechazos no deben generar pagos.

### S2 — Proprietary demo format, realistic operational presentation
> Los archivos deben ser **realistas y estar inspirados en las muestras recibidas**, pero claramente identificados como simulados. No deben presentarse como compatibles con Payway o Banco Galicia.
> Las posiciones exactas y el significado de todos los campos de los TXT **no están confirmados**. No inventes compatibilidad ni consideres oficiales los códigos propuestos para la demo.
> Diseña un formato propio tomando como referencia esos archivos, con una estructura de **cabecera, detalles y cierre**, y campos suficientes para mostrar un circuito realista:
> - **Cabecera:** identificador del lote, entidad simulada, fecha de generación y versión del formato.
> - **Detalle de solicitud:** referencia única del débito, identificador de factura, vencimiento, concepto e importe solicitado. Usa exclusivamente datos ficticios si se necesita representar un medio de pago.
> - **Detalle de respuesta:** referencia del débito, resultado, importe informado, fecha de procesamiento y, ante un rechazo, código y descripción simulados.
> - **Cierre o resumen:** cantidad de registros y totales de control.
> Puedes usar columnas delimitadas en la demo si simplifica el desarrollo y la revisión. Documenta los campos y marca los supuestos. Organiza la generación y lectura por formato, separadas de la lógica de negocio, para que luego se puedan ajustar columnas o incorporar los formatos oficiales sin rehacer el registro de pagos.

Presentation amendment: the prepared response plays the role of a bank-provided file during the demo. Use natural operational labels. Keep the proprietary simulation identifiers in files and disclosure in presentation/documentation; do not claim actual bank compatibility or settlement. The latest approval in S11 overrides the earlier brief's repeated on-screen demo warnings.

Correction (2026-11-13, verbatim):
> En primer lugar, los debitos se cargan en una plataforma y los credito en otra, entonces no tiene sentido que te genere el archivo con ambas, despues ese archivo esta armamndose mal, las columnas y filas estan mal.El total de pagina y elegir todo lo de una pagina sacalo.rranquemos con eso
> despues en motivo informado tiene que decir el motivo, por ejemplo saldo insuficiente, cbu no ecnontrado o algo asi real
> el nombre del archivo que no diga simulado

Confirmed split: débito = CBU, crédito = tarjeta. Each export produces two flat per-platform files (named header row plus one row per invoice, identical columns across rows), downloaded as `ESSERI_DEBITOS_<codigo>.csv` and `ESSERI_CREDITOS_<codigo>.csv`; filenames carry no demo wording. `cbu` (22 digits) and `token_tarjeta` (16 digits) are deterministic fictional values derived per invoice. The response keeps one control envelope for the whole batch, and its rejection reasons use realistic generic motives (e.g. saldo insuficiente, CBU no encontrado) instead of filler text. The `ESSERI_SIMULADO` marker inside the response envelope and the documentation disclosure remain.

### S3 — Validation and atomic idempotency
> Relaciona cada respuesta con la solicitud mediante la referencia única del lote y del débito; no uses nombres ni coincidencias aproximadas.
> Valida estructura, cantidades, totales y resultados antes de aplicar cambios. Muestra los errores y registros ambiguos en la vista previa.
> No registres pagos duplicados al importar nuevamente un resultado, incluso ante reintentos o concurrencia.
> Una factura ya pagada, un importe inválido o un resultado sin solicitud correspondiente debe quedar sin aplicar y señalarse.

### S4 — Existing payment effects and access
> Revisa especialmente `backend/src/facturacion/facturas_service.py`, donde existe `registrar_pago`, y sus tests. Reutiliza la lógica existente y sus validaciones; no crees pagos salteándola.
> Respeta los permisos existentes de facturación. No uses datos bancarios reales ni realices conexiones a bancos.
> nono no pongamos simulado, porque tiene que sentirse real
> es que parqa nostros gtiene que ser como que ese archivo nos lo dio el banco

Use neutral operational labels, not “Acreditado”. Disclosure stays in demo presentation/documentation per the subsequent agreement. Existing Workflows configure emails separately; do not introduce automatic mailing. Persisted payments must be visible in the economic responsible's family portal after refresh.
> No afirmes que un débito informado como cobrado equivale a una acreditación bancaria.

### S5 — Proof and handoff
> Agrega pruebas de generación, importación, cobro, rechazo, validaciones, duplicados y permisos, incluyendo los efectos sobre factura y pago.
> Ejecuta lint y verificaciones proporcionales de las capas modificadas según los comandos documentados.
> Explica cómo ejecutar la demo, qué verificaciones pasaron o quedaron pendientes y qué habría que ajustar cuando lleguen las especificaciones oficiales.

### S6 — Exact approved screen brief
The following user brief is authoritative for layout and behavior, with only the latest S11 amendment taking precedence. The HTML is visual evidence, not reusable application code.

> Implementá el módulo "Débitos automáticos" de ESSERI Data Core, siguiendo
> las capturas/HTML de referencia adjuntos (3 pantallas). La referencia es
> VISUAL: no copies su HTML. Reutilizá los componentes, el layout
> (sidebar + topbar) y las convenciones del proyecto. Si falta un componente,
> /Users/hilario/Downloads/ESSERI\ Data\ Core\ –\ Débitos\ automáticos.html creá uno chico y consistente con los existentes.
>
> ANTES DE ESCRIBIR CÓDIGO: listame los archivos que vas a crear o modificar
> y el modelo de datos propuesto. Esperá mi OK.
>
> ESTILO (ERP escolar sobrio, tablas densas, sin sombras pesadas)
> - Fondo #F6F5F8, superficies #FDFCFE, bordes #E4E0EA
> - Sidebar #241E2E; ítem activo fondo #3D2F4E, texto #D9B8F0
> - Acción principal #7C24A3, texto #14111A, texto secundario #5B5468
> - Tipografía Geist (fallback Inter/system-ui), 13px base
> - Importes y fechas con tabular-nums, importes alineados a la derecha
> - Formato argentino: $ 172.000,00 y fechas dd/mm/aaaa
> - Navegación del módulo en 3 pestañas: 1 · Generar lote, 2 · Importar
>   resultados, 3 · Historial de lotes

### S7 — Batch lifecycle and generation
> MODELO Y ESTADOS
> - Lote: id (LD-AAAA-MM-NNN), fecha de exportación, período, facturas,
>   importe total, estado.
> - Estados del lote: Exportado (sin resultados) → Resultados en revisión →
>   Pagos registrados. Alternativa: Liberado.
> - Una factura que está en un lote exportado y no liberado NO puede
>   incluirse en otro lote. Si el lote se libera o la factura es rechazada,
>   vuelve a "pendiente sin lote".
>
> PANTALLA 1 · GENERAR LOTE
> - Filtros: período, medio de débito (CBU/tarjeta), estado (por defecto
>   "Pendientes sin lote") y búsqueda por alumno o número de factura.
> - Tabla paginada (25 filas por página), checkbox por fila y de cabecera.
> - El checkbox de cabecera selecciona SOLO la página visible. Al hacerlo,
>   mostrar una barra: "Seleccionaste las N facturas de esta página" con el
>   enlace "Seleccionar las M facturas que coinciden con los filtros".
>   Si se elige todo el filtrado, la selección persiste al cambiar de página
>   y el texto pasa a "Seleccionaste las M facturas...".
>   Cambiar filtros o búsqueda limpia la selección.

Correction (2026-11-13, verbatim):
> El total de pagina y elegir todo lo de una pagina sacalo
> pero si tiene que estar el boton que seleccione todas de una
> el boton de seleccionar todas, tiene quye ser un checkbox, como era el de marcar todas las de la pagina

Supersedes the page-scope selection bullet above: the page total and page-wide selection are removed. The header checkbox stays and now represents the whole filtered result (tri-state: empty, partial, all), selecting all matching invoices in one action; no page-only selection exists. Row checkboxes select individual invoices; filtered mass selection persists across pagination and clears on filter/search changes.
> - Fila de total al pie de la tabla (página visible / selección).
> - Panel de resumen: cantidad de facturas, importe total, desglose por
>   medio, alcance de la selección ("solo esta página" / "todos los
>   filtrados") y cuántas facturas están ocultas por estar en otro lote.
> - Botón "Exportar N solicitudes (demo)": genera el archivo, crea el lote
>   y marca las facturas como "en lote". Exportar NO registra pagos.
> - Aviso visible: archivos de demostración, no enviar al banco.

### S8 — Durable preview and explicit confirmation
> PANTALLA 2 · IMPORTAR RESULTADOS
> - Subir archivo, validarlo y mostrar vista previa SIN registrar nada.
> - Identificar a qué lote corresponde el archivo.
> - Resumen: procesados, cobrados, rechazados y errores (cantidad e
>   importe). Los totales deben cerrar.
> - Detalle paginado con filtros (botones) por resultado y búsqueda; por
>   defecto mostrar lo que requiere revisión, con el motivo informado.
> - Errores a detectar: factura inexistente, fuera del lote, ya pagada,
>   importe que no coincide. Los errores no se procesan.
> - Botón para descargar rechazados y errores (CSV demo).
> - Panel de confirmación: "Vista previa: todavía no se registró ningún
>   pago", qué pasará al confirmar, y un checkbox "Revisé el resumen y el
>   detalle" que habilita "Confirmar y registrar N pagos".
> - Al confirmar: registrar solo los cobrados, en una transacción atómica.
>   La importación es idempotente: reimportar el mismo archivo (hash o id
>   de lote) no duplica pagos. Los rechazados vuelven a "pendiente sin lote".

### S9 — History and release
> PANTALLA 3 · HISTORIAL DE LOTES
> - Tabla de lotes: lote, fecha de exportación, período, facturas, importe,
>   resultados, estado y acciones. Filtros por período y estado, y búsqueda.
> - Acciones según estado: "Importar resultados" (sin resultados),
>   "Continuar revisión" (en revisión), "Ver detalle" (registrado/liberado).
> - "Liberar lote": solo disponible si el lote NO tiene resultados
>   importados. Pide un motivo obligatorio y un checkbox de confirmación
>   ("el banco no procesó este lote"). Al liberar, las facturas vuelven a
>   "pendiente sin lote". Guardar usuario, fecha y motivo, y mostrarlos
>   en un registro de liberaciones.

### S10 — Dataset, architecture and acceptance
> DATOS Y ARQUITECTURA
> - Por ahora, mocks/seed con ~500 alumnos y archivos simulados.
> - Aislá el parseo y la generación de archivos en un módulo reemplazable:
>   los formatos bancarios oficiales todavía no están definidos.
> - Ninguna acción registra pagos antes de la confirmación explícita.
>
> CRITERIOS DE ACEPTACIÓN
> - Seleccionar todo el filtrado no renderiza cientos de filas.
> - Con 438 facturas la tabla sigue fluida.
> - Una factura en un lote exportado no aparece en nuevos lotes.
> - Reimportar el mismo archivo no duplica pagos.
> - Liberar un lote con resultados importados no es posible.
> - Resuelvan y muestren estados de carga, error y vacío en cada pantalla.

### S11 — Latest approval and all-or-nothing correction
> Sí, tenés OK general al modelo y al alcance propuesto. Reutilizá lo que ya está implementado para lotes, importación y prevención de duplicados, sin descartar ese trabajo.
>
> Haría un ajuste: si la importación tiene errores pendientes, no registremos todavía ningún pago. Mostremos las incidencias para resolverlas y habilitemos la confirmación cuando el archivo esté listo. Quiero que la confirmación sea una operación clara y atómica para la demo.
>
> Mantené la selección masiva para los aproximadamente 500 alumnos y verificá que no duplique débitos ni pagos ante reintentos o importaciones concurrentes. Las etiquetas operativas pueden ser naturales; la aclaración de que los archivos son de demo queda en la documentación y presentación, como acordamos.

No partial application: any structural or semantic error blocks the entire confirmation, including otherwise valid collected rows. Revalidation must happen before any payment/claim writes. Persisting preview/incident metadata is allowed; preview never changes invoice/payment/ledger state. Valid rejection is not an error. Final confirmation registers collected rows, records rejections and releases their reservations atomically; errors leave the batch in review and no payments applied.

### Approved implementation contract (technical, parent-owned)
Keep `/facturacion/cobranzas` as UI URL and `/facturacion/cobranzas-simuladas` as API root. Natural UI labels; no repeated demo banner/button suffix after S11. Retain file markers and document no bank compatibility/settlement. Existing payment helper, ledger, audit and `pago.registrado` event remain authoritative; no mail workflow changes.

Demo metadata is isolated per invoice (`factura_id`, visible `numero`, `periodo` YYYY-MM, `medio` cbu/tarjeta), preserving existing real invoice data. Extend existing batch/debit models; new import header + raw/resolved detail rows (keyed by import + line, not unique invoice), audited release. UUID internal keys, human batch code unique, and database-enforced active invoice reservation. Use one common selection query for listing/summary/export; selection request is `{modo: 'pagina'|'filtrados', factura_ids: string[], filtros: {periodo?, medio?, estado?, buscar?}, excluir_ids?: string[]}`. Page checkbox affects visible page only; `filtrados` is a predicate resolved in backend, never render/download all matches for selection.

API contract, JSON money values are decimal strings and dates ISO (UI formats Argentine):
- `GET /opciones` → `{periodos: string[], medios: string[]}`.
- `GET /facturas-elegibles` filters `periodo,medio,estado,buscar,pagina,tamanio` (25 default) → `{items:[{id,numero,alumno_nombre,curso,periodo,medio,fecha_vencimiento,importe,estado,en_lote}],total,pagina,tamanio,total_pagina,ocultas_en_lote}`. State defaults `pendientes_sin_lote`; other accepted values `en_lote,todas`.
- `POST /resumen-seleccion` body `{seleccion}` → `{cantidad,importe_total,por_medio:{cbu:{cantidad,importe},tarjeta:{cantidad,importe}},alcance,ocultas_en_lote}`. Same selection for export.
- `POST /` body `{seleccion,periodo}` → full batch. Preserve legacy `factura_ids` where safe, without weakening exclusivity.
- Batch summary fields `{id,codigo,fecha_exportacion,periodo,cantidad_facturas,importe_total,estado,resultados_importados,importacion_id,liberacion}`. States `exportado,en_revision,pagos_registrados,liberado`. `liberacion` is null or `{usuario_id,usuario_nombre,fecha,motivo}`.
- `GET /` history filters `periodo,estado,buscar,pagina,tamanio` → `{items: BatchSummary[],total,pagina,tamanio}`.
- `GET /{id}` → summary plus existing `items` and `solicitudes:[{nombre,contenido}]` (one flat file per platform present in the batch) for re-download/detail. List must not include every debit detail.
- Existing `POST /{id}/respuesta` returns `{nombre,contenido}`; preserve reference selection and support optional `rechazos_cantidad` for a mixed response sample without rendering all batch details. This remains the replaceable demo adapter, not a bank integration.
- `POST /previsualizar` body `{contenido}` → import read. Valid header-associated files persist a review, keyed by batch/file hash; structurally invalid files return global errors without changing batch/payment state. Re-upload same file recovers review, never resets confirmed state.
- Import read fields `{id,lote_id,lote_codigo,estado,archivo_hash,errores:string[],puede_confirmar,resumen,items,total,pagina,tamanio}`. `resumen` has `procesados,cobrados,rechazados,errores`, each `{cantidad,importe}`. `items` is paginated raw/resolved detail `{linea,referencia,factura_id,numero_factura,alumno_nombre,resultado,importe,estado,mensaje,pago_id}`. Outcomes `COBRADO_SIM,RECHAZADO_SIM`, detail states `listo,aplicado,rechazado,duplicado,error`; import state `en_revision,confirmada`. For malformed envelope, `id`/batch fields may be null.
- `GET /importaciones/{id}` supports `resultado=revision|cobrados|rechazados|errores|todos,buscar,pagina,tamanio`; default `revision` (rejected + error). Global summary unaffected by pagination/filter.
- `GET /importaciones/{id}/incidencias` → `{nombre,contenido}` CSV export of rejected/error rows (not filtered current page).
- `POST /confirmar` body `{importacion_id,revision_confirmada:true}` → ImportRead. Require explicit acknowledgment, reject/block any errors and revalidate all rows before payment writes. Repeated confirmation returns the confirmed import, no new payments. If authoritative invoice state changed, return review with incidents and zero applied payments.
- `POST /{id}/liberar` body `{motivo,confirmacion_no_procesado:true}` → BatchSummary. Only exportado with no persisted accepted import; lock and guard against concurrent preview/confirm/release. Audit actor/time/reason.
- `GET /liberaciones` → paginated `{items:[{lote_id,codigo,cantidad_facturas,usuario_id,usuario_nombre,fecha,motivo}],total,pagina,tamanio}`.

Exact key names above are the seam contract. Backend/frontend may add optional fields, not silently rename/remove these. Parent owns cross-unit changes. All endpoints keep existing billing authorization (no family access to administrative lists). Fixture seed is opt-in/idempotent, ~500 synthetic students/invoices, including a period with 438 eligible invoices and other reserved/history examples, never deletes unrelated data. Raise the current 100-record codec limit to support this authorized dataset; bound payload size. New migration additive/autogenerated/reviewed; never apply to a shared database without authorization.
### S12 — Ventanas de ausencias del portal familia
Justificar: solo ausencias de los últimos 45 días (hoy incluido) y nunca fechas futuras. El límite es configurable con `ACADEMICO_DIAS_LIMITE_JUSTIFICACION` (default 45) en `backend/.env`; el backend valida con ese valor y lo expone en `GET /academico/familia/configuracion-ausencias` para que el formulario use el mismo rango y texto. Informar: hoy o una fecha futura, solo dentro del ciclo lectivo actual.

## Tasks
- T1 [S2,S3] inline, complete: proprietary codec/tests/docs, commits7543535/f559a07. RED missing module; GREEN14tests after total-width fix. Native codec candidate explicitly declined. Risk: none.
- T2 [S1,S3,S4,S5] inline foundation, preserved/extended by T5 in c591182; earlier manual/SQLite proof retained. Risk: items1,3,4.
- T3 [S1,S2,S4,S5] inline foundation, preserved/extended by T6; portal label tests remain green.
- T4 [S1–S5] independent foundation verification complete on SQLite; expanded verification tracked under T7, PostgreSQL still unavailable.
- T5 [S3,S4,S7–S11] delegated, implementation/SQLite checks/independent verification passed, commit c591182: backend lifecycle, selection, durable review, atomic no-errors confirm, guarded releases, opt-in500 seed, tests/docs. Route reason: long-session context backstop; one bounded writer at a time. Risk: items1,3,4. PostgreSQL proof remains unavailable; native assessment/review pending.
- T6 [S6–S11] delegated, implementation/checks/browser/seam proof passed: exact three-tab frontend, selection/pagination/resume/history/release, tests/docs. Route reason: long-session context backstop; sequential writer, disjoint frontend surfaces. Commit pending.
- T7 [S1–S11] parent+independent verifier, partial: current seam/browser/SQLite concurrency and isolated SQLite migration proof passed; PostgreSQL-specific proof unavailable and native review pending. No publishing.
- T9 [S6] inline, completed with checks: side-sheet detail redesign (readable invoice number + alumno, concept once in header, conditional Resultado column, fixed header/summary/footer, list-only scroll with sticky thead, search, inline liberación) and history table without horizontal scroll with per-row ⋯ actions menu.
- T8 [S2,S6,S7] inline, completed with checks: per-platform flat files (débitos=CBU, créditos=tarjeta), filenames without demo wording, realistic rejection motives, page-total/page-wide selection removal with filtered select-all tri-state header checkbox, batch detail as right side sheet at half screen. Backend 204 billing tests + Ruff; frontend 94 billing tests + ESLint + build; browser verified 50% sheet, aligned table, two-file API. Risk: item 3 (export contract shape). Native review of the earlier c591182 candidate is superseded by these uncommitted backend changes; no review started.
- T10 [S12] inline, complete: 45-day justification window, ciclo-lectivo bound for future notices, and configurable `ACADEMICO_DIAS_LIMITE_JUSTIFICACION` read by backend validation and the portal form through a family config endpoint. Backend 670 passed/23 skipped + scoped Ruff; frontend 55 tests + ESLint + build; browser proved 45 and a configured 10 end-to-end. Risk: items 3,6.

## Log

### L1 — Original request
Necesito implementar para la demo de ESSERI Data Core un flujo de cobranzas por archivo. Los archivos serán **simulados**: no son compatibles con bancos reales y no deben presentarse como una integración bancaria terminada.

## Objetivo

Poder demostrar este recorrido completo:

1. Seleccionar facturas pendientes y generar un archivo de solicitud de débito simulado.
2. Preparar o descargar un archivo de respuesta simulado que incluya cobranzas y rechazos.
3. Importar ese archivo y mostrar una vista previa de los resultados.
4. Confirmar la importación para registrar los pagos cobrados en el sistema. Los rechazos no deben generar pagos.

El formato simulado debe ser sencillo y estar claramente identificado como tal. Organiza la lectura y generación para que luego se pueda reemplazar el formato y cambiar columnas sin rehacer la lógica de pagos.

## Antes de implementar

- Lee `AGENTS.md` y `ARCHITECTURE.md` y revisa el estado del repositorio. Conserva los cambios existentes.
- Inspecciona el flujo actual de facturas y pagos, permisos, auditoría y cuenta corriente.
- Revisa especialmente `backend/src/facturacion/facturas_service.py`, donde existe `registrar_pago`, y sus tests. Reutiliza la lógica existente para mantener sus validaciones y efectos; no crees pagos salteándola.
- Define un plan breve y continúa con la implementación, salvo que encuentres una decisión de negocio que no pueda resolverse sin inventar requisitos.

## Reglas de seguridad y comportamiento

- Identifica cada resultado mediante una referencia inequívoca a la solicitud generada; no relaciones pagos por nombre ni por coincidencia aproximada.
- Valida el archivo antes de aplicar cambios y muestra claramente los errores o coincidencias ambiguas.
- Evita que importar dos veces el mismo resultado registre pagos duplicados, incluso ante reintentos o concurrencia.
- Una factura ya pagada, un importe inválido o un resultado que no corresponda a la solicitud debe quedar sin aplicar y señalarse.
- No afirmes que un débito informado como cobrado equivale a una acreditación bancaria.
- Respeta los permisos existentes de facturación. No uses datos bancarios reales ni realices conexiones a bancos.
- La interfaz debe distinguir visiblemente que se trata de una simulación para la demo.

## Verificación y entrega

- Agrega pruebas para generación, importación, cobro, rechazo, validaciones, duplicados y permisos, incluyendo los efectos observables sobre factura y pago.
- Usa los comandos documentados por el proyecto y ejecuta lint y verificaciones proporcionales de las capas modificadas.
- Al finalizar, explica qué funciona, cómo ejecutar la demo, qué verificaciones pasaron o quedaron pendientes y qué falta para conectar formatos bancarios reales.

### L2 — User amendment (2026-11-11)
Full latest request is represented verbatim by S1–S5 above except the following sample context and preflight instructions:
> Se analizaron cuatro archivos:
> - `DEBLIMC.txt`: solicitud Payway, texto de ancho fijo con líneas de 100 caracteres; contiene cabecera, detalles y cierre.
> - `RDEBLIMC`: respuesta Payway, texto de ancho fijo con líneas de 300 caracteres; contiene cabecera, detalles y cierre. Se observaron posibles códigos de resultado, pero no está confirmado su significado.
> - `PUB_DEBITOS_PD`: solicitud Galicia, texto de ancho fijo con líneas de 350 caracteres; contiene cabecera, detalles y cierre.
> - `Reporte de Cobros.csv`: respuesta Galicia separada por `;`, con movimientos y líneas de resumen. Incluye identificador, fechas, referencia, concepto, importes cobrados y rechazados y observaciones. En la muestra, la referencia permitía relacionar cada movimiento con una línea de la solicitud.
> Lee `AGENTS.md` y `ARCHITECTURE.md`, revisa el estado del repositorio y conserva los cambios existentes.
> Inspecciona el flujo actual de facturas, pagos, permisos, auditoría y cuenta corriente.
> Define un plan breve y continúa, salvo que encuentres una decisión de negocio que no pueda resolverse sin inventar requisitos.

### L3 — Routing and evidence
Clean main at baseline; parent created feature branch. Mapping worker completed read-only; implementation remains inline (no writer trigger). Review mode on, global. User selected “Sobre una rama de feature”; no remote publication authorized. Samples themselves have not been supplied; only user descriptions are evidence. Codec uses a proprietary semicolon format and demo-only outcomes, never inferred official codes. Preview is read-only; confirmation must revalidate authoritative invoice state. Mirror and checks pending.

### L4 — T1 proof
Format tests observed RED (missing module), then 13 passed; targeted Ruff check passed after formatting. No meaningful existing-command differential for the new standalone codec. Engram mirror created as observation #585. Local Docker executable exists but the explicit default local socket is unavailable; do not probe remote contexts.

### L5 — Validation pause and explicit resumption (2026-11-11)
User: “la idea era validar la idea antes”. Implementation stopped; commit 7543535 and untracked API tests preserved. Subsequent user messages, verbatim:
> o sea basicamente yo podria exportar un archivo con los debitos a realizar y luego poder exportar un archivo con los debitos realizados, que seria lo q me devuleve el bano y actua;lizar el siistema automaticamente
> perfecto
> y generaria aviso, comunicacion o mail para el responsable economico?
> o sea el envio del mail , deberia configurarlo en los workflos?
> el pago si queda registrado no?o sea en el portal familia se vera actualizado
> nono no pongamos simulado, porque tiene que sentirse real
> es que parqa nostros gtiene que ser como que ese archivo nos lo dio el banco
> dale
Assistant: “Queda validado así. ¿Retomo ahora la implementación con este criterio?”
User: “si”. Resumption authorized; no remote publication authorized. S2/S4 updated only. Workflows email remains separately configured. Local plan is authoritative over stale mirror #585; mirror synchronization pending.

### L6 — Implementation and own checks
API RED: POST creation returned 404 before implementation. Current API tests: 21 passed, including ledger/event/audit/payment/invoice effects, portal visibility, rollback and simultaneous HTTP confirmations with separate SQLite sessions. Codec: 14 passed; a new RED exposed aggregate totals exceeding individual amount width and was corrected. Migration fb836637c05a generated against an isolated baseline SQLite schema; reviewed as two additive tables and a dedicated method, upgrade passed there. Original manual registrar_pago callers preserve the default commit; batch uses the same function with confirmar=False.

Frontend RED: missing CobranzasPage import. New page: 3 passed. Command worker: module 42/43 initially passed; the one failure was the explicitly changed “Acreditado” label expectation. Corrected test and its full file now 14/14 passed. Frontend lint and production build passed (existing chunk-size warning). Parent spot-check npm run lint passed. Backend command worker ses_e33d51484ffedT9pbRDCcwUzuv: full billing suite 149 passed, Ruff all src/tests passed. Third-party Starlette/httpx deprecation warning only. Browser and PostgreSQL-specific proof remain pending. No shared/remote database touched.

### L7 — Exact three-screen reference and approval
The replacement user brief is captured verbatim in S6–S10. Parent unpacked the supplied nested HTML manifests/templates read-only and confirmed all three screens; no HTML copied into application source. Explorer ses_e33b12c18ffehxfge0owxEvRSA mapped schema/helpers. Earlier native codec review was explicitly declined for its exact candidate (not globally disabled). Existing backend/API and frontend work is preserved. Independent verification of that foundation passed all149 billing tests, manual-payment differential, isolated migration apply/rollback, and retries/concurrency on SQLite; a CAS-conflict classification advisory was fixed with observed RED/GREEN and bounded independent recheck. Additional tests now24 API cases. No PostgreSQL lock proof exists yet. The previous user preview is at127.0.0.1:5173/API8012 with isolated synthetic SQLite data, not the normal DB.

Latest user instruction, verbatim:
> Sí, tenés OK general al modelo y al alcance propuesto. Reutilizá lo que ya está implementado para lotes, importación y prevención de duplicados, sin descartar ese trabajo.
>
> Haría un ajuste: si la importación tiene errores pendientes, no registremos todavía ningún pago. Mostremos las incidencias para resolverlas y habilitemos la confirmación cuando el archivo esté listo. Quiero que la confirmación sea una operación clara y atómica para la demo.
>
> Mantené la selección masiva para los aproximadamente 500 alumnos y verificá que no duplique débitos ni pagos ante reintentos o importaciones concurrentes. Las etiquetas operativas pueden ser naturales; la aclaración de que los archivos son de demo queda en la documentación y presentación, como acordamos.

S11 supersedes prior partial-confirmation behavior and on-screen demo warnings. Added T5–T7; T2/T3 are preserved foundation, not final acceptance of the replacement brief. Backend and frontend writers run sequentially (never concurrently in one worktree), with exact surfaces and the parent-owned API seam above. Mirrors/checks must record observed outcomes, not assumptions.

### L8 — T5/T6 implementation results
Backend writer ses_e339a6794ffedtvEm1a9KFygqo: RED missing FacturaCobranzaDemo import; GREEN70 focused tests and184 billing tests. New additive migration91553e2163be autogen/review, isolated SQLite apply/check/downgrade/re-upgrade passed. Seed500/438eligible idempotency covered. Writer reported partial because it ran expanded `ruff check src/ tests/ .`, including unrelated pre-existing Alembic lint. Parent re-ran the actual documented/authorized `venv/bin/ruff check src/ tests/`: all checks passed. No unrelated migration cleanup authorized.

Frontend writer ses_e3379da96ffedN3GTJHrky14N4: RED missing new imports and old page expectations; GREEN87 billing frontend tests +32 nav tests, lint/build passed (existing chunk warning). Exact contract matched; no backend edits or dependencies. Parent native assessment over current declared untracked inventory: high risk, explicit item4 concurrent reservation/review/payment/release;67paths/8926changedlines including preserved foundation. No new review START or candidate consent yet. Larger coherent units are accepted under the advisory size heuristic; no code golf or test omission. Independent verification, browser/seam proof, PostgreSQL-specific proof and work-unit commits remain pending.

### L9 — Independent proof and scoped corrections
Independent verifier ses_e33589512ffeoFCn3j8N3KyyI2:71 focused backend tests and16 independent HTTP probes passed; manual payment response/effects identical to076c549; isolated SQLite migration apply/rollback/reapply preserved prior row. Found S7 filter A→B→A resurrected old selection. Writer observed RED2failed→GREEN16 focused tests; bounded independent recheck confirmed filter/search resets and preserved global pagination. No remaining functional blockers in that recheck. All16 independent HTTP probes promoted to test_cobranzas_regresion_independiente.py and passed. Advisory: legacy pre-915 duplicate reservations require explicit resolution rather than silent data changes; no legacy terminal-state normalization; persisted invalid files require corrected file content for a new hash. PostgreSQL binaries/server unavailable; no ambient or remote database used.

Browser QA ses_e334081d8ffeG8MZAKWMt3anTY used separate5013/5174? Correction: actual QA endpoints are API8013/frontend5174, user preview API8012/frontend5173. Actual500student dataset:438eligible and25DOMrows; page25→all438 selected without extra rows, pagination retains global selection, filters/search clear it. Export LD-2026-11-002 reserved438 and no sampled payment before confirm. Uploaded downloaded response:438processed,435collected ($23,912,500.00),3rejected ($161,250.00),0errors, total$24,073,750.00. Explicit unchecked acknowledgment disabled confirm; UI confirmation registered exactly435, re-upload and URL reload retained same confirmed import and435paid invoices. Sample invoice had1payment. Family portal showed paid invoice, registered payment and zero balance. Mixed valid+invalid amount file had2valid collections+1error; confirm stayed disabled even with acknowledgment and paid total stayed435. Accepted/confirmed batch release409; separate2invoice export reduced October eligibility50→48 and audited release restored50. No financial actions on user preview.

First browser visual round found desktop/mobile overflow and15px cells. Scoped module containment/13px correction, no global styles/logic changes; independent visual recheck desktop1440andmobile390 on all3tabs found documentwidth exactly viewport, tables scroll within cards, TD/TH/controls13px and dialogs contained. Evidence .playwright-mcp/page-2026-11-11T23-03-51-416Z.png and page-2026-11-11T23-03-59-462Z.png. Expected401login and intentional409/405QAprobes were classified; oldFacturas landing syntheticstaff lacked family-module read and produced403, outside new module behavior.

Final source normalization included only owned foundation migrationfb836637c05a. Final command worker ses_e33269f71ffevdPDB4JqLOSY7b observed201billing backend tests,126billing/nav frontend tests, backend src/tests Ruff, both owned migrations+seed Ruff and frontend ESLint pass. Latest frontend production build passed before the migration-only formatting change; not redundantly rerun. Warnings: third-party Starlette/httpx deprecation and existing large Vite chunk. No dependency/infra changes. Native review and PostgreSQL proof are not claimed.

### L10 — Work-unit boundary
Backend work unit committed as c591182 (20files,5011insertions/6deletions), preserving behavior/tests/docs together. Larger than the advisory heuristic because the approved durable batch/import/reservation/atomic-confirm lifecycle is one coherent API unit, including foundation and independent regression coverage; no tests removed or code compressed to meet a counter. Backend worktree matches committed tested bytes. Next native review candidate is this commit against f559a07, not the accumulated branch. Frontend remains uncommitted but tested, awaiting its own unit. No push/PR/merge. PostgreSQL-specific proof is unavailable, not passed.

### L11 — Correction round: platform split, layout, selection and sheet
Verbatim user corrections this round:
> "En primer lugar, los debitos se cargan en una plataforma y los credito en otra, entonces no tiene sentido que te genere el archivo con ambas, despues ese archivo esta armamndose mal, las columnas y filas estan mal.El total de pagina y elegir todo lo de una pagina sacalo.rranquemos con eso"
> "pero si tiene que estar el boton que seleccione todas de una"
> "el boton de seleccionar todas, tiene quye ser un checkbox, como era el de marcar todas las de la pagina"
> "fijate que la tabla esta quedando desfasa, usa playwirght si queres"
> "despues en motivo informado tiene que decir el motivo, por ejemplo saldo insuficiente, cbu no ecnontrado o algo asi real"
> "el nombre del archivo que no diga simulado"
> "El ver detalle del lote tine que ser un side sheet del lado derecho que aparezca"
> "quedo horrible el side sheett del detalle, tiene que ocupar la mitad de la pantalla, que quede bien"
> "cuando apreto ver detalle se queda en blanco"
> "hasta que vuelva open ai usa glm 5.3 flash como orquestador" / "ahora el orquestador es deepseek" / "con glm flash orquesta nomas, para el resto segui usando deepseek" (model routing only; no code effect)

Confirmed split débito=CBU / crédito=tarjeta (native question answered "Sí, dejalo así"). Codec: flat per-platform request files with named header row (`referencia;factura;alumno;periodo;concepto;importe;vencimiento;cbu|token_tarjeta`), deterministic fictional 22-digit CBU and 16-digit token per invoice; response envelope unchanged, rejection motives now realistic generic catalog (saldo insuficiente, CBU no encontrado, cuenta inhabilitada, cuenta cerrada, débito cuestionado, convenio vencido) assigned deterministically. Filenames: `ESSERI_DEBITOS_<codigo>.csv`, `ESSERI_CREDITOS_<codigo>.csv`, `ESSERI_RESPUESTA_<codigo>.csv`, `ESSERI_INCIDENCIAS...` (no demo wording). API detail now `solicitudes:[...]`; frontend shows one download button per platform file, no automatic download. Removed page total and page-wide selection; header checkbox is tri-state over the whole filtered result (empty/partial/all) and selects all matching invoices in one action; individual rows remain, filtered selection persists across pagination, filters/search clear it. Table alignment fixed (kept the leading checkbox column). Batch detail moved from dialog to right Sheet, half screen (`data-[side=right]:sm:w-1/2`), solid background, full badge, 4-column summary, contained table; backend `_nombre_usuario` no longer prints "None None". Blank detail was the old preview backend serving `solicitud` against the new `solicitudes` UI; preview restarted with current code.

Checks: backend 204 billing tests + Ruff pass; frontend 94 billing tests + ESLint + production build pass; browser: header checkbox tri-state, aligned table, sheet exactly 50% at 1280px without document overflow, liberación shows user email, two download buttons, console clean. Preview user API 8012 restarted twice with the new code; synthetic data preserved. No PostgreSQL proof; no push/PR; frontend and docs remain uncommitted; the c591182 native review consent is stale for the new backend diff and must be re-assessed when resumed.

### L12 — Side-sheet detail and history table refinements
Verbatim user request:
> "Ajustes al side sheet "Detalle de lote": 1. Lista de facturas: columnas Factura (número legible, no hash), Alumno, Vencimiento, Importe. Sacar la columna Concepto de las filas y mostrarlo una vez en el encabezado ("Concepto: Cuota 2026-10"). Mostrar Resultado solo si el lote tiene resultados importados; si no, omitir la columna. 2. Layout: header y resumen fijos; scroll SOLO en la lista, con encabezado de tabla sticky; búsqueda por alumno/factura arriba de la lista. 3. Pie fijo con total del lote y los botones de descarga (CBU / tarjeta). 4. Liberación como una línea de texto, sin tarjeta con borde. 5. Eliminar el subtítulo descriptivo del header. 6. Tabla principal de lotes: sin scroll horizontal; mover las acciones de cada fila a un menú "⋯" para que todas las filas tengan la misma altura."

Backend additive contract: `DebitoRead` now carries `numero` and `alumno_nombre` (nullable) from a shared `_filas_lote` join reused by the detail and the request files. Sheet: header (title, estado, `Concepto:` línea), fixed summary (Exportado/Período/Facturas), liberación as plain text, 40px search filtering by número/alumno within loaded items, list-only scroll with sticky thead (raw table + border-separate to make sticky work in Chromium), fixed footer with total and per-platform downloads. `Resultado` column only when `resultados_importados`. History table: removed the 1100px minimum and the per-row buttons; single ⋯ dropdown per row (same actions per state); card now full width below 2xl so no horizontal scroll; compact estado badge variant. Preview backend restarted (current code) — items now show F-… numbers and alumnos.

Checks: backend 204 billing tests + Ruff; frontend 95 billing tests + ESLint + build; browser at 1280px: history table 960/960 no scroll and rows 40px equal, ⋯ menus, sheet 50%, sticky thead pinned at 1px while scrolling, fixed footer with total + downloads, search 20→1 row, liberación single line, no subtitle, no Resultado column on a batch without imported results (unit test asserts it appears with results).'

### L13 — Tab labels and hierarchy
User request: remove tab numbering ("no pongas 1/generar lote") and give the three sections more visual hierarchy. Tabs now read "Generar lote", "Importar resultados", "Historial de lotes" (mobile: Generar/Importar/Historial), at 15px semibold with larger padding, violet active underline and a separated bar; page-level override only, global Tabs untouched. Tests updated (3 tab tests), 95 billing tests + ESLint + build pass; verified in the browser.

### L14 — Wording and layout-shift fixes
User reports: rejection text "Rechazo informado: SIM01 — Rechazo ficticio…" is unclear; switching tabs moves the system header, its buttons/bars and "Volver a facturas". Fixes: backend helper `_mensaje_rechazo` now renders "Motivo informado: <descripción> (código <código>). No se registra pago." at preview, review revalidation and confirmation; clarified sample rejection reasons remain the realistic catalog. Root cause of the movement: classic scrollbars toggling when tab content height crosses the viewport; added `scrollbar-gutter: stable` on html (global base rule) so the gutter is always reserved and the topbar no longer shifts horizontally between tabs. Existing persisted reviews keep their stored historical message; new imports get the new wording. Checks: 15 import tests + Ruff; frontend lint/build; computed scrollbar-gutter stable verified in the browser; duplicate/inline measurements across tabs and viewports (1024/1280/1440, 720/780/900) show stable positions.

### L15 — Batch detail pagination that fits the available height
User request: "hasta una cantidad que no requiera scroll". The detail sheet no longer uses a fixed page size: a ResizeObserver measures the list area, header row and row height, and renders exactly the rows that fit (no vertical scroll), recalculating on resize, search and tab changes. Search still covers the whole batch and resets to page 1; paginator, total and platform downloads stay in the fixed footer. Cell padding reduced to 8px so the five columns fit at 1280px (no horizontal overflow there); on mobile the list scrolls horizontally inside its own wrapper. Verified in Chromium: 7 rows at 1280x720, 12 at 1440x900, 4 at 1280x600, always fitting vertically with no horizontal overflow on desktop; 18 history tests + ESLint + build pass, including a fake-ResizeObserver test that shrinks and grows the available height.

### L16 — Detail sheet hierarchy and unified downloads
User request: move the batch total to the top with stronger visual hierarchy, and move both download buttons up unified into a single dropdown. The sheet now leads with "Total del lote" at title-size weight beside one "Descargar" dropdown (Débitos (CBU) / Créditos (tarjeta)), followed by the compact meta line (exportado, período, facturas), search and the fit-to-height list; the footer keeps only the paginator. 18 history tests, ESLint and build pass; browser verified the top total and the two menu items.

### L17 — Currency decimals and detail meta fields
User request: keep Exportado/Período/Facturas in the batch detail and stop showing ",00" when the amount has no cents. Restored the labelled three-field summary under the prominent total, and changed the billing currency formatter to omit decimals for whole amounts while keeping two decimals when cents exist. This applies across billing displays that already use the module formatter. 101 billing tests, ESLint and build pass; browser confirmed labels plus "$ 24.073.750" / "$ 60.000" rendering without ",00".

### L18 — Minimalist meta cards in batch detail
Exportado, Período and Facturas now render as three minimal tiles (`rounded-card-sm`, `bg-lienzo`, small label, semibold tabular value) under the prominent total. 18 history tests, ESLint and build pass; verified in the browser, with the fit-to-height list recalculating to 6 rows at 1280x720.

### L19 — Family portal: sorting, formatting, components and home data
Family invoices can be sorted by due date (nearest/farthest) or issue date (newest) using the DESIGN.md FilterDropdown instead of raw selects; the Alumno filter uses the same component. Invoice titles convert "Cuota 2026-11" to "Cuota noviembre 2026" and all portal dates render as dd/mm/aaaa. Payment methods from the simulated platform show as "Débito automático" or "Tarjeta de crédito" according to the invoice medium (API now exposes `medio` per family invoice). The home replaces the stale "Información de la familia / Próximamente" card with a linked-student ficha and a minimalist Comunicaciones card that shows the real unread count ("2 sin leer") or "Estás al día", linking to /familia/comunicaciones. Demo data: multirrol family has 3 published communications (2 unread) seeded in the preview DB, plus the synthetic user demo.multirrol@esseri.local with Administración and Familia roles, 6 pending invoices and 19 eligible invoices. Checks: backend 204 tests + Ruff; frontend 195 tests + ESLint + build; browser verified the home card counter and the new ficha.

### L20 — Family billing selector placement and student shortcut
The Alumno selector moved to the top-right of the Facturación header (only when the family has more than one student) and now syncs with the URL (`?alumno=<id>`); the student ficha on the portal home links "Facturación" preselecting that student. Removed the duplicated "Estado de cuenta" card from the home. Verified: 16 portal billing tests, ESLint and build; browser shows the selector at top right and "Cuota noviembre 2026" titles.

### L21 — Ventanas de ausencias: 45 días configurables y aviso futuro dentro del ciclo
Pedidos del usuario, verbatim:
> "despues en la parte de justifcar asistencias, noesta bueno que no tenga limite de tiempo pra justifcar una inasitencia que paso meses, o que pueda cargar una justifiacion del a;o siguiente"
> "pero lo de informar ausencia futura tiene que quedar pero tiene q ser del mismo clo lectivo"
> "tiene que haber alguna forma facil de congurar el limite de dias pasados para justificar"

Regla elegida (respuesta del usuario: "ultimos 45 dias"): justificar acepta solo los últimos 45 días con hoy incluido y nunca fechas futuras; informar acepta hoy o futuro solo dentro del ciclo lectivo actual. El límite se configura con `ACADEMICO_DIAS_LIMITE_JUSTIFICACION` (default 45) en `backend/.env`; el backend valida con ese valor y lo expone en `GET /academico/familia/configuracion-ausencias` para que el formulario del portal arme su `min`, texto de ayuda y error con el mismo número.

Implementación: guard en `crear_solicitud_periodo` (mensaje dinámico, día operativo argentino), router/schemas/config/.env.example; servicio frontend `obtenerConfiguracionAusencias`, el formulario lo consulta con fallback 45, y el `max` de informar sale de `useCicloLectivoStore`; se fijó el día operativo 2027 en seis módulos de tests preexistentes para que la nueva regla de ciclo no invalide sus fixtures.

Checks: backend `tests/academico tests/workflows` 670 passed/23 skipped + Ruff acotado; frontend 55 tests académico/portal + ESLint + build; navegador: formulario por defecto con min 2026-09-29 / max 2026-11-13 y "últimos 45 días"; reiniciando el backend con `ACADEMICO_DIAS_LIMITE_JUSTIFICACION=10` el mismo formulario pasó a min 2026-11-03 y "últimos 10 días"; restaurado a 45. Risk: items 3 y 6, cubiertos por tests.
