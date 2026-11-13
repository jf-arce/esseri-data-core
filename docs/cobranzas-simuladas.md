# Simulated file collections — demo format v1

This proprietary format is inspired only by the described header/detail/trailer structure
and semicolon-separated report. The original samples are not included in this change.
It is **not compatible with Payway or Banco Galicia**. No official field positions or
result-code meanings are assumed. No bank connections or bank-account fields exist.
Reported collection is a demo payment, **not evidence of bank settlement**.

## Demo walkthrough

1. Apply the backend migration with `alembic upgrade head` in the configured local environment.
2. Sign in with billing read/create permissions. Open Facturas → Cobranzas por archivo.
3. Select unpaid invoices (pending or overdue); generate and download the request.
4. Select that request, mark some debit references as rejected and download its response.
   During the presentation this prepared file plays the role of the bank-provided response.
5. Upload it under **Importar respuesta de débitos**. Inspect the batch/reference match,
   amounts and each row's applicability. Preview does not register payments.
6. Confirm. Valid collected rows create payments through the existing payment service;
   rejected rows do not. Reimporting the same result does not create another payment.
7. Refresh the economic responsible's Portal Familia: the payment, invoice and balance
   are updated. An invoice is paid only when approved payments cover its complete total.

Operational labels say **Pago registrado**, not bank accreditation. The demo presentation
and this document disclose the prepared files; there is no production bank integration.
Emails are independent: configure an active `pago.registrado` → `notificar` workflow with
the invoice economic responsible and a template, plus the existing n8n mail transport.
This feature does not create a workflow, publish a family communication or send email itself.

## File contract

UTF-8, semicolon-delimited CSV, standard CSV quoting, decimal point and exactly two
decimal places, ISO dates (`YYYY-MM-DD`), UUID references, at most 1 MiB and 500 rows
per file. Download names do not contain demo wording.

Requests are split by platform: debit requests (CBU) and credit requests (card) are
separate flat files, one named column header row plus one row per invoice. Downloaded
names are `ESSERI_DEBITOS_<batch code>.csv` and `ESSERI_CREDITOS_<batch code>.csv`.

| File | Ordered columns |
| --- | --- |
| Debit request (CBU) | `referencia;factura;alumno;periodo;concepto;importe;vencimiento;cbu` |
| Credit request (card) | `referencia;factura;alumno;periodo;concepto;importe;vencimiento;token_tarjeta` |

The `cbu` (22 digits) and `token_tarjeta` (16 digits) values are **fictional and
deterministic per invoice**; they are not real accounts or cards. The response keeps a
single control envelope for the whole batch:

| Record | Ordered columns |
| --- | --- |
| Response header | `H;ESSERI_SIMULADO;1;RESPUESTA;<batch UUID>;ENTIDAD_FICTICIA;<generation date>` |
| Response detail | `D;<debit UUID>;<result>;<reported amount>;<processing date>;<rejection code>;<rejection description>` |
| Response trailer | `T;<detail count>;<reported total>;<collected total>;<rejected total>` |

`COBRADO_SIM` and `RECHAZADO_SIM` are **invented demo results**, not official codes.
Collected rows have empty rejection fields. Rejected rows require both fields; the
sample generator cycles through realistic generic reasons such as `SALDO_INSUF`
(“Saldo insuficiente”), `CBU_INEXISTENTE` (“CBU no encontrado”), `CUENTA_INHABIL` and
`CUENTA_CERRADA`. Rejected amounts represent the requested amount not collected, not a
payment. Trailer reported total includes both.

Assumptions: each reported amount must equal its frozen request amount. No partial
debit results or settlement reconciliation are modeled. Structural failures (including
duplicate references) block the whole file. Semantic failures are shown per row and
block **all** payment registration, including otherwise valid collected rows. Correct
the incidents and upload the corrected file before confirming. Confirmation revalidates
every row against authoritative invoice state before writing any payment or claim.
Successful and rejected results become terminal for their debit reference; a changed
result is a conflict, not a second payment. A new batch does not bypass invoice balances.

## Three-screen lifecycle

The operational UI is **Débitos automáticos**, with Generar lote, Importar resultados
and Historial de lotes tabs, using the existing application shell. Invoice pages contain
25 rows. Selecting all filtered results sends a filter predicate to the server; it does
not render hundreds of invoices. Demo invoice numbers, periods and CBU/card categories
are isolated metadata, not real bank details. The opt-in seed supplies approximately
500 fictional students and a period with 438 eligible invoices.

Export creates an **Exportado** batch and atomically reserves its invoices; it never
registers payments. Only one active reservation per invoice is allowed by the database.
An accepted persisted response creates **Resultados en revisión**, which survives reload
and prevents releasing the batch. Any incident keeps confirmation disabled. A clean
review requires an explicit acknowledgment before atomically registering collected
payments and recording rejections. Confirmed rejections release their invoice reservations.
Re-uploading or confirming again does not register another payment.

Only an exported batch with no imported results can be **Liberado**, with an obligatory
reason and explicit acknowledgment that it was not processed. The actor, time and reason
are retained. A released batch's obsolete response must not register a payment. These
guards are authoritative on the server, not just disabled buttons.

## Replacement boundary

`backend/src/facturacion/formato_cobranza_simulada.py` owns serialization, parsing,
field positions, vocabulary and file control totals. Business orchestration consumes
normalized details and owns request matching and payment registration. Official bank
adapters will need authoritative specifications, confirmed codes, encoding, identity
and account handling, authentication/authorization, operational reconciliation,
settlement rules, security review and fixtures approved by each provider. Do not infer
those contracts from these demo files.
