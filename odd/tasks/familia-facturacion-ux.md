# Family billing UX
Branch: fix/familia-facturacion-api → follow-up frontend branches; delivery: stacked-to-main; runner: frontend npm test, backend pytest.
Objective: Implement the requested family invoice presentation and filtering, preserving unrelated changes.

## Specs
S1. "Destacá \"Saldo pendiente\" (fondo/borde suave con el color de acento, o mayor tamaño). Si el saldo es 0, mostrarlo en estado neutro/positivo."
S2. "Ordená por urgencia: vencidas, pendientes (por vencimiento más próximo), y al final las pagadas." "Mostrá el monto de cada factura a la derecha, junto al badge de estado." "Reemplazá el hash (#6d2712cc) como título principal por un concepto legible (ej. \"Cuota octubre 2026\") si el dato existe; si no, un número secuencial. Dejá el hash corto como dato secundario en el detalle expandido." "Agregá filtros tipo tabs/chips: Todas / Pendientes / Pagadas (y Vencidas si hay). Si hay más de un alumno, agregá filtro por alumno."
S3. "Distinguí \"Vencida\" (rojo, cuando vencimiento < hoy y no está pagada) de \"Pendiente\"." "En pendientes próximas a vencer (≤ 7 días) mostrá \"Vence en N días\"." "Mostrá \"Pago parcial\" con \"Pagado $X de $Y\" si existe esa data en el modelo." "Revisá el contraste de los badges para cumplir WCAG AA."
S4. "Eliminá la línea separadora y el espacio vacío que quedan dentro de cada tarjeta cuando está colapsada." "Toda la fila/tarjeta debe ser clickeable para expandir (no solo el chevron), con aria-expanded y soporte de teclado." "Formato de fecha: \"Vence 10 oct 2026\"." "En las facturas pagadas, mostrá la fecha de pago en el detalle expandido." "Agregá un texto informativo discreto arriba de la lista, tipo: \"Los pagos se acreditan una vez que la administración los registra\", para evitar confusión sobre cómo pagar."
S5. "Opcional (solo si ya existe el endpoint/dato): botón \"Descargar comprobante\" en las pagadas."
S6. "Se mantiene el estilo visual actual (tipografía, radios, colores)." "Responsive en mobile." "Estados vacío y de carga contemplados (sin facturas, filtro sin resultados)." "Sin cambios en la lógica de negocio ni en la API, salvo que falte algún campo imprescindible; en ese caso, avisame antes en vez de inventar datos." User explicitly authorized adding `alumno_id` and the effective due date to the existing response.
S7. "Las cuotas se debitan automáticamente de tu medio de pago adherido." "Se debita el {fecha}", "Se debita hoy", "Se debita mañana". "NO PONGAS REVISA TU MEDIO DE PAGO". "Débito acreditado el {fecha}". "Débitos acreditados". "Sacar cualquier lógica o texto de \"pago parcial\"." "Centralizá los textos de estado/medio de pago en un solo lugar". No manual payment, checkout or cash UI.
S8. "Si existe el dato, mostrá arriba de la lista \"Débito automático · tarjeta/cuenta terminada en XXXX\" (solo últimos 4 dígitos, nunca datos completos). Si no existe, omitilo." "Próximo débito: {fecha} · {monto}". "{monto} sin acreditar".
S9. "SACA LOS BOTONES DE TODAS PAGADAS VENCIDAS, ETC, TIENE QUE SER UN FILTRO, UN FILTRO POR ESTADO POR FECHA Y UN BUSCADOR QUE TE DEJE BUSCAR POR NOMBRE O  ID DE FACTURA". "10 ítems por página." "Fallback de título si falta el concepto: \"Cuota {mes} {año}\"." "Foco visible con teclado en chips y filas; verificar contraste WCAG AA del badge \"Pendiente\"."
S10. "QUE EL ESPACIO EN TRE LOS BOTON DE DESCARGAR Y COMPARTIR CON EL LIMITE INFERIOR DE LA TARJETA"; "CUANDO HAY PAGOS YA ESTA BIEN".
S11. "Volvé a mostrar chips de estado con contador a la vista: Todas · Vencidas · Pendientes · Pagadas"; "Mové \"Desde\", \"Hasta\" y \"Buscar (nombre o ID)\" a un bloque colapsado \"Más filtros\""; "Desde y Hasta deben arrancar VACÍOS"; "Al cambiar cualquier filtro, volver a página 1".
S12. "la factura se llama \"Pagada\" y el débito individual \"Acreditado\""; "Débito automático · 09 oct 2026"; "$ 500.000 vencido"; "Próximo débito: hoy · $ 125.000"; "mañana"; secondary lines 12-13px and overdue contrast WCAG AA.
S13. "Mostrá la sección \"Conceptos\" solo si la factura tiene más de un concepto"; "Reducí el espacio vertical entre el encabezado y \"Factura #xxxxxxxx\"". Review sharing privacy; no public links or new API.

## Tasks
- [x] T1 S2,S6 — inline: add authorized student identifier and effective date; backend 114 passed; commit 31cc8a3.
- [x] T2 S1-S6 — inline: family billing presentation and tests; independent verifier completed; commit pending.
- [ ] T3 S1-S10 — inline: native review and delivery strategy pending; commit pending.
- [x] T4 S7-S10 — inline: automatic-debit copy, filters, ten-item pagination and conditional card spacing; frontend 672 passed; commit pending.
- [x] T5 S11-S13 — inline: restore state chips, collapse extra filters, refine debit copy and expanded detail, verify share privacy and contrast; 674 frontend tests, lint and build passed; commit pending.

## Log
L1. User request verbatim: "Cambios a implementar, en este orden de prioridad:

1. Jerarquía en las tarjetas resumen
   - Destacá "Saldo pendiente" (fondo/borde suave con el color de acento, o mayor tamaño). Si el saldo es 0, mostrarlo en estado neutro/positivo.

2. Lista de facturas
   - Ordená por urgencia: vencidas, pendientes (por vencimiento más próximo), y al final las pagadas.
   - Mostrá el monto de cada factura a la derecha, junto al badge de estado.
   - Reemplazá el hash (#6d2712cc) como título principal por un concepto legible (ej. "Cuota octubre 2026") si el dato existe; si no, un número secuencial. Dejá el hash corto como dato secundario en el detalle expandido.
   - Agregá filtros tipo tabs/chips: Todas / Pendientes / Pagadas (y Vencidas si hay). Si hay más de un alumno, agregá filtro por alumno.

3. Estados
   - Distinguí "Vencida" (rojo, cuando vencimiento < hoy y no está pagada) de "Pendiente".
   - En pendientes próximas a vencer (≤ 7 días) mostrá "Vence en N días".
   - Mostrá "Pago parcial" con "Pagado $X de $Y" si existe esa data en el modelo.
   - Revisá el contraste de los badges para cumplir WCAG AA.

4. Pulido visual
   - Eliminá la línea separadora y el espacio vacío que quedan dentro de cada tarjeta cuando está colapsada.
   - Toda la fila/tarjeta debe ser clickeable para expandir (no solo el chevron), con aria-expanded y soporte de teclado.
   - Formato de fecha: "Vence 10 oct 2026".
   - En las facturas pagadas, mostrá la fecha de pago en el detalle expandido.
   - Agregá un texto informativo discreto arriba de la lista, tipo: "Los pagos se acreditan una vez que la administración los registra", para evitar confusión sobre cómo pagar.

5. Opcional (solo si ya existe el endpoint/dato): botón "Descargar comprobante" en las pagadas.

Criterios de aceptación:
- Se mantiene el estilo visual actual (tipografía, radios, colores).
- Responsive en mobile.
- Estados vacío y de carga contemplados (sin facturas, filtro sin resultados).
- Sin cambios en la lógica de negocio ni en la API, salvo que falte algún campo imprescindible; en ese caso, avisame antes en vez de inventar datos.

Al terminar, resumime qué archivos cambiaste y qué decisiones tomaste donde el modelo de datos no alcanzaba."
L2. User: "pero la facutra no corresponde a un alumno?"; after explanation and explicit request to add alumno_id: "dale".
L3. User authorized adding effective due date after explanation about exceptions: "DALE".
L4. User: "Contexto: pantalla \"Facturación\" del portal de familias (español rioplatense, voseo). Las cuotas se cobran por DÉBITO AUTOMÁTICO. No hay pago manual ni checkout desde el sistema. La pantalla es de consulta. No agregues botones de pagar. Por ahora NO se contemplan pagos en efectivo." User specified debit wording, status, card summaries, 10 items per page, search and filters, centralized text, and conditional no-payment spacing; exact requested fragments are preserved in S7–S10. User subsequently replaced status chips: "SACA LOS BOTONES DE TODAS PAGADAS VENCIDAS, ETC, TIENE QUE SER UN FILTRO, UN FILTRO POR ESTADO POR FECHA Y UN BUSCADOR QUE TE DEJE BUSCAR POR NOMBRE O  ID DE FACTURA".
L5. Independent verifier confirmed family authorization and exception scoping, AA contrast for status badges, and mobile disclosure behavior. Its reports that the earlier PDF route, removal of account statement, and zero-cent formatting were out of scope are inapplicable: each was explicitly requested earlier in this session. It independently confirmed the missing bottom spacing, corrected in T4. Real iOS share remains unverified.
L6. Backend: 114 facturación tests passed, Ruff check and format passed. Frontend: 672 tests passed, ESLint and build passed; Vite emitted a chunk-size warning. Latest browser check used the isolated demo with 14 invoices. Native review has not completed its intended-untracked selection.
L7. User correction: "NO PONGAS REVISA TU MEDIO DE PAGO".
L8. User: "DENTRO DE LA TARJETA HAY QUE HACER ALGO PARA QUE SE DIFERENCIE UN POCO LO QUE SERIA PAGOS RESTRIDOS DE LO QUE SERIA EL DETALLE." Added a concepts heading and a divider before debits within expanded cards. Focused frontend tests: 11 passed; lint passed.
L9. User: "LOS BOTONES DE DESCARGAR Y COMPARTIR TIENEN QUE ESTAR ABAJO A LA DERECHA DE LA TARJETA". Moved invoice actions after debits, aligned right, preserving bottom padding. Focused tests: 12 passed; lint passed.
L10. User requests state chips and count, collapsed additional filters with empty initial dates, debit terminology, overdue contrast, conditional concepts, tighter expanded layout, and verification that sharing never creates public links. Verbatim: "Desde y Hasta deben arrancar VACÍOS (sin filtrar por fecha). Hoy vienen precargados con la fecha actual y ocultan facturas. Corregí ese bug." Code initializes both to empty strings; tests must verify no date filtering on mount. Sharing fetches the authenticated family PDF and uses navigator.share with a File, not a URL.
L11. T5 checks: focused frontend 15 passed, full frontend 674 passed, lint and build passed (Vite chunk warning). Browser at 390px: no horizontal overflow, initial date values empty, 14 invoices shown across two pages. Overdue text contrast 5.75:1 light and 5.97:1 dark. The displayed overdue amount sums invoice totals as explicitly requested, not the outstanding balance after payments. No public sharing link is created. Native review still pending.
L12. User requested commits, push and PRs in Spanish, selected stacked-to-main, and authorized the configured GitHub session and Git credentials for origin. Backend API slice committed as 31cc8a3; native assessment high risk and preflight requests intended-untracked selection. Frontend changes remain uncommitted.
