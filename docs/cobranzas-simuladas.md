# Simulated file collections — demo format v1

This proprietary format is inspired only by the described header/detail/trailer structure
and semicolon-separated report. The original samples are not included in this change.
It is **not compatible with Payway or Banco Galicia**. No official field positions or
result-code meanings are assumed. No bank connections or bank-account fields exist.
Reported collection is a demo payment, **not evidence of bank settlement**.

## Demo walkthrough

1. Apply the backend migration with `alembic upgrade head` in the configured local environment.
   On an existing database, also run `python ../database/seeds/01_seed_grupo_a.py` and
   `python ../database/seeds/03_seed_grupo_b.py`, or the demo seed, so the result event exists.
2. Sign in with billing read/create permissions. Open Facturas → Cobranzas por archivo.
3. Choose a period. All eligible unpaid CBU invoices are selected automatically across
   pages. Exclude individual invoices if needed, then generate and download the request.
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
## Result notifications

The opt-in seed installs **Notificación de débitos automáticos**, an editable rule in the
existing workflow editor. Its trigger is `debito.resultado_registrado`; separate conditions
compare `resultado == exitoso` and `resultado == rechazado`. Each reached branch uses
`notificar` with the corresponding configurable template, the invoice's economic responsible
and the existing n8n email webhook. Re-running the seed preserves edited rules/templates.

Every confirmed instruction emits exactly one result event inside the rendition transaction.
Its payload includes `debito_id`, `factura_id`, `lote_id`, `resultado`, `importe`,
`codigo_resultado`, `motivo_rechazo`, `numero_factura` and `responsable_economico_id`.
`pago.registrado` is retained for successful payments. Only its ordinary `notificar` email to
the family is superseded by the debit-result event, and only when an active applicable result
rule reaches every address the payment notice would reach. Other payment actions,
`pago.rechazado` events, Communications publications and manual payments keep their previous
behavior. Rejected results create no fictitious payment or ledger credit.

After commit, the existing dispatcher evaluates the rule and durably records message
snapshots **before** calling n8n. Family billing exposes those snapshots through
`GET /facturacion/familia/me`, under `avisos_debito`, even when email fails or is uncertain.
The view rechecks the invoice's persisted economic responsible and does not trust IDs in
the event payload for authorization. Multiple email addresses or email attempts do not
produce duplicate portal notices for the same result. Existing Communications publications
and read receipts are unchanged.

### Showing real email delivery

The email is sent by the existing n8n webhook, not by the backend directly. Prepare it before the
demo:

1. Import `infra/n8n/enviar-email.json`, assign the Header Auth credential with
   `Bearer <N8N_WEBHOOK_TOKEN>`, assign a Gmail OAuth2 credential for the sending account, and
   **publish** the workflow. Follow `infra/n8n/README.md`; the Gmail test-mode token expires
   after seven days, so reauthorize it before presenting.
2. Set `N8N_WEBHOOK_URL` to `http://n8n:5678/webhook/enviar-email` inside Docker, or
   `http://localhost:5678/webhook/enviar-email` outside. Set the same `N8N_WEBHOOK_TOKEN`.
3. Seed the debit dataset with an address you control:

```bash
ESSERI_DEMO_EMAIL_BASE=your-demo@gmail.com \
ESSERI_DEMO_PASSWORD='EsseriDemo2026!' \
python ../database/seeds/07_seed_debitos_demo.py
```

   With that variable set, the seed creates three family accounts for the first three eligible
   invoices: `your-demo+debito-1@gmail.com`, `your-demo+debito-2@gmail.com` and
   `your-demo+debito-3@gmail.com`, all with the demo password. Gmail plus-addressing delivers
   all three to the base inbox while keeping distinct `To:` addresses. Without the variable the
   seed creates no accounts and keeps its data-only behavior.
4. In **Generar lote**, choose `2026-11`. The 438 eligible invoices are preselected. Click the
   header checkbox once to clear the selection, then select the three rows for
   `F-202611-0001` to `F-202611-0003`. Export the lot and choose **Preparar respuesta de
   ejemplo**; for a three-invoice lot it leaves one rejection, so the demo gets two successes
   and one rejection.
5. Import, review and confirm. The backend dispatcher runs every
   `WORKFLOWS_DESPACHO_INTERVALO_SEGUNDOS` (30 by default), so wait for the next pass. For a
   controlled moment, call `POST /workflows/procesar` with a workflow-update session, or keep
   the interval short for the demo.
6. Show the base inbox: two messages with subject `Débito automático confirmado: factura
   F-202611-...` and one with `Débito automático rechazado: factura F-202611-...` including
   `Saldo insuficiente` and `SALDO_INSUF`. Then show the three notices in the family portal.

If no email arrives, inspect the n8n execution and `NOTIFICACION.estado_envio`; a `fallido` state
means the transport failed and the portal notice is still available. The backend never rolls back
a confirmed payment because of an email failure.

### Safe A/B/C demonstration

Run this automated scenario from `backend/`, with the virtual environment activated:

```bash
pytest -q tests/facturacion/test_debitos_resultados_workflow.py
```

The integration scenario creates three isolated synthetic invoices and test-family accounts
at `example.test`, confirms A/B successfully and rejects C with `SALDO_INSUF`
(`Saldo insuficiente`). It runs the actual event dispatcher and both workflow conditions,
captures three emails in an isolated transport, authenticates each family to read its notice,
and replays both upload and confirmation. A second run simulates n8n failure; notices and
payments remain. A manual-payment regression verifies its ordinary workflow is unchanged.
**Captured test emails are not proof of delivery through a running n8n or a real mailbox.**

For a browser demonstration against a separate demo database:

1. Apply migrations and run `python ../database/seeds/07_seed_debitos_demo.py`
   from `backend/`. It installs the editable workflow.
2. Prepare three unpaid CBU invoices assigned to economic-responsible families that have
   active test accounts. The bulk 500-invoice seed does not provision family login accounts.
3. In **Débitos automáticos → Generar lote**, select the period, keep those three invoices
   selected and exclude the others (or use a search matching those three).
4. Generate the lot and its simulated response with only C rejected. Confirm the response
   contains all three references; missing, duplicate or unknown references block confirmation.
5. Under **Importar resultados**, review the two successes and the rejection; confirm explicitly.
6. Let the configured workflow job run, or invoke the authenticated
   `POST /workflows/procesar` with workflow-update permission.
7. Check two payments, C still unpaid, three result events and three matching rule executions
   in the existing histories. Open each responsible's **Portal Familia → Facturación**
   to see the frozen notice. Reimport and confirm again; counts must remain unchanged.
8. For real test email delivery, configure the existing
   [n8n transport](../infra/n8n/README.md) with authorized sending credentials and explicit
   test mailboxes before step 6. Do not use production recipients or blindly replay uncertain
   provider executions. No new n8n workflow is required.

Email failure never rolls back the already-confirmed payment. HTTP success means provider
acceptance, not inbox delivery. The legacy workflow transport cannot promise exactly-once
external delivery; uncertain attempts are retained and are not automatically resent.

## File contract

UTF-8, semicolon-delimited CSV, standard CSV quoting, decimal point and exactly two
decimal places, ISO dates (`YYYY-MM-DD`), UUID references, at most 10 MiB per file and
no row limit. Download names do not contain demo wording.

New batches in this demo accept CBU only. The request is a flat file with one named
column-header row and one row per invoice: `ESSERI_DEBITOS_<batch code>.csv`.
Legacy card serialization remains readable for historical fixtures; new card batches fail
without creating reservations. No card integration is enabled.

| File | Ordered columns |
| --- | --- |
| Debit request (CBU) | `referencia;factura;alumno;periodo;concepto;importe;vencimiento;cbu` |

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

The rendition must contain exactly one result for every original debit in the lot, including
rejected results. Completeness is checked in the review and again under the confirmation lock;
an incomplete review cannot register payments or release reservations.

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
and Historial de lotes tabs, using the existing application shell. Every batch belongs to
a single billing period and has no invoice-count cap. Invoice pages contain 25 rows.
Selecting all filtered results sends a filter predicate to the server; it does
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
