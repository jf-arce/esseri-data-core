# Simulated file collections — demo format v1

This proprietary format is inspired only by the described header/detail/trailer structure
and semicolon-separated report. The original samples are not included in this change.
It is **not compatible with Payway or Banco Galicia**. No official field positions or
result-code meanings are assumed. No bank connections or bank-account fields exist.
Reported collection is a demo payment, **not evidence of bank settlement**.

## File contract

UTF-8, semicolon-delimited CSV, standard CSV quoting, decimal point and exactly two
decimal places, ISO dates (`YYYY-MM-DD`), UUID references. One header, 1–100 details,
one trailer, at most 1 MiB. Downloaded names contain `SIMULADO`.

| Record | Ordered columns |
| --- | --- |
| Header, both directions | `H;ESSERI_SIMULADO;1;SOLICITUD\|RESPUESTA;<batch UUID>;ENTIDAD_FICTICIA;<generation date>` |
| Request detail | `D;<debit UUID>;<invoice UUID>;<due date>;<concept>;<requested amount>` |
| Request trailer | `T;<detail count>;<requested total>` |
| Response detail | `D;<debit UUID>;<result>;<reported amount>;<processing date>;<rejection code>;<rejection description>` |
| Response trailer | `T;<detail count>;<reported total>;<collected total>;<rejected total>` |

`COBRADO_SIM` and `RECHAZADO_SIM` are **invented demo results**, not official codes.
Collected rows have empty rejection fields. Rejected rows require both fields; the
generator uses `SIM01` / `Rechazo ficticio para demostración`. Rejected amounts represent
the requested amount not collected, not a payment. Trailer reported total includes both.

Assumptions: a response may contain a subset of a batch; each reported amount must
equal its frozen request amount. No partial debit results or settlement reconciliation
are modeled. Structural failures (including duplicate references) block the whole file;
semantic failures are shown per row and never applied. Confirmation revalidates state.
Successful and rejected results become terminal for their debit reference; a changed
result is a conflict, not a second payment. A new batch does not bypass invoice balances.

## Replacement boundary

`backend/src/facturacion/formato_cobranza_simulada.py` owns serialization, parsing,
field positions, vocabulary and file control totals. Business orchestration consumes
normalized details and owns request matching and payment registration. Official bank
adapters will need authoritative specifications, confirmed codes, encoding, identity
and account handling, authentication/authorization, operational reconciliation,
settlement rules, security review and fixtures approved by each provider. Do not infer
those contracts from these demo files.
