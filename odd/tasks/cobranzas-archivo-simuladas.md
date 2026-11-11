# Simulated file collections
Objective: deliver the authorized demo without claiming bank compatibility or settlement. Branch: `feature/cobranzas-archivo-simuladas`; baseline: `076c549`.
Delivery: ask-on-risk → feature-branch-chain (user selected); forecast ~1,400 authored lines. Runner: backend pytest/Ruff, frontend Vitest/ESLint/build; PostgreSQL concurrency probes.

## Specs

### S1 — Complete demo
> Demostrar el recorrido completo:
> 1. Seleccionar facturas pendientes y generar un archivo simulado de solicitud de débito.
> 2. Generar un archivo simulado de respuesta con cobranzas y rechazos.
> 3. Importar la respuesta y mostrar una vista previa.
> 4. Confirmar la importación y registrar los pagos cobrados. Los rechazos no deben generar pagos.

### S2 — Explicit proprietary simulation
> Los archivos deben ser **realistas y estar inspirados en las muestras recibidas**, pero claramente identificados como simulados. No deben presentarse como compatibles con Payway o Banco Galicia.
> Las posiciones exactas y el significado de todos los campos de los TXT **no están confirmados**. No inventes compatibilidad ni consideres oficiales los códigos propuestos para la demo.
> Diseña un formato propio tomando como referencia esos archivos, con una estructura de **cabecera, detalles y cierre**, y campos suficientes para mostrar un circuito realista:
> - **Cabecera:** identificador del lote, entidad simulada, fecha de generación y versión del formato.
> - **Detalle de solicitud:** referencia única del débito, identificador de factura, vencimiento, concepto e importe solicitado. Usa exclusivamente datos ficticios si se necesita representar un medio de pago.
> - **Detalle de respuesta:** referencia del débito, resultado, importe informado, fecha de procesamiento y, ante un rechazo, código y descripción simulados.
> - **Cierre o resumen:** cantidad de registros y totales de control.
> Puedes usar columnas delimitadas en la demo si simplifica el desarrollo y la revisión. Documenta los campos y marca los supuestos. Organiza la generación y lectura por formato, separadas de la lógica de negocio, para que luego se puedan ajustar columnas o incorporar los formatos oficiales sin rehacer el registro de pagos.

### S3 — Validation and atomic idempotency
> Relaciona cada respuesta con la solicitud mediante la referencia única del lote y del débito; no uses nombres ni coincidencias aproximadas.
> Valida estructura, cantidades, totales y resultados antes de aplicar cambios. Muestra los errores y registros ambiguos en la vista previa.
> No registres pagos duplicados al importar nuevamente un resultado, incluso ante reintentos o concurrencia.
> Una factura ya pagada, un importe inválido o un resultado sin solicitud correspondiente debe quedar sin aplicar y señalarse.

### S4 — Existing payment effects and access
> Revisa especialmente `backend/src/facturacion/facturas_service.py`, donde existe `registrar_pago`, y sus tests. Reutiliza la lógica existente y sus validaciones; no crees pagos salteándola.
> Respeta los permisos existentes de facturación. No uses datos bancarios reales ni realices conexiones a bancos.
> La interfaz debe indicar visiblemente que los archivos son simulados.
> No afirmes que un débito informado como cobrado equivale a una acreditación bancaria.

### S5 — Proof and handoff
> Agrega pruebas de generación, importación, cobro, rechazo, validaciones, duplicados y permisos, incluyendo los efectos sobre factura y pago.
> Ejecuta lint y verificaciones proporcionales de las capas modificadas según los comandos documentados.
> Explica cómo ejecutar la demo, qué verificaciones pasaron o quedaron pendientes y qué habría que ajustar cuando lleguen las especificaciones oficiales.

## Tasks
- T1 [S2,S3] inline, complete: format codec, validation, regression tests and format documentation; commit recorded in next log entry. RED: missing codec import; GREEN: 13 tests; Ruff passed. Risk: none.
- T2 [S1,S3,S4,S5] inline, pending: durable requests, guarded preview/confirm API, migration, payment reuse and tests; commit pending. Risk: items 1,3,4 (schema, shared payment path, concurrency).
- T3 [S1,S2,S4,S5] inline, pending: billing UI, services, tests, demo guide; commit pending.
- T4 [S1–S5] independent verifier, pending after own checks: full feature proof and PostgreSQL concurrency; native review according to mode/assessment.

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
