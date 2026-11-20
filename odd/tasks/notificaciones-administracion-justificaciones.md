# Administration notifications for submitted justifications

Objective: notify Administration in its own bell when a family submits an individual
justification. Branch: `feat/notificaciones-administracion-justificaciones`, based on
`97bc833`. Delivery: work-unit commits; publishing is a separate user decision.
Runners: backend `venv/bin/pytest`; frontend `npm run test`, `npm run lint`, `npm run build`.

## Specs

- S1: User request (verbatim): "y en la vista administrativa estaria bueno que le lleguen [pr lo
  menos cuando se manda una justificacion". Recipients (verbatim): "solo admin".
- S2: Each submitted individual justification creates one notice per active account with the
  Administration role, in the same transaction as the submission.
- S3: The notice shows the student, the absence date and the reason, and opens
  `/academico/justificaciones?justificacion=<id>` with that record highlighted.
- S4: The staff inbox is authorized by active Administration role, never by family membership.
  Family and Administration notices never mix in the same listing, counter or read operation.
- S5: Deduplication is per justification and account; a failed insert rolls back the submission.
- S6: Period absence requests and other staff events stay out of scope for this delivery.

## Tasks

- T1 [S1,S2,S5]: inline — completed; domain, recipient resolution, producer and submission integration.
- T2 [S4]: inline — completed; role-aware read authorization and API dependency.
- T3 [S2,S3]: inline — completed; frontend catalog, route, admin bell mount and record focus.
- T4 [S2,S3,S4]: inline — in progress; backend and frontend tests, documentation and evidence.

## Log
- L1 — Original request and role decision quoted in S1. No code written before this document.
- L2 — Mapped state: submitting an individual justification only writes audit; no event or
  notice exists. The notifications API requires an active Familia role, and the administrative
  layout already renders a placeholder bell with no data.
- L3 — Implemented: new `administracion` scope and `administracion.justificacion_pendiente`
  type, created inside the submission transaction for every active administrative account that
  can actually open the institutional inbox. The literal `administracion` role lacks academic
  permissions in the seed, so recipients require an administrative role plus
  `academico.actualizar` (broad or typed); Dirección and Secretaría stay excluded per product
  decision. Reads are role-aware and never mix Family and Administration notices.
- L4 — Evidence: backend `tests/notificaciones` 60 passed (6 PostgreSQL skipped without the
  variable) and `tests/academico` 258 passed; focused frontend 113 passed; lint, Prettier and
  build passed; Ruff clean; facturación and workflows 735 passed.
