# Communications — consolidated plan

Read [STATUS.md](STATUS.md) first for the verified checkout, evidence and blockers.
This document is the recovery entry point for “Implementá la Etapa 3 de Comunicaciones”.
It consolidates approved scope. The user subsequently authorized incremental stage-3
implementation and the file controls below. Stage 4 remains unauthorized. See STATUS for
actual implementation and proof; authorization is not completion.

## Recovery contract

1. Resolve the current repository with Engram `mem_current_project`; canonical project:
   `esseri-data-core`. Search `comunicaciones/context-recovery` and read these two files.
2. Check branch, dirty files and worktrees against STATUS before making changes. Do not
   infer current implementation from the checkout directory name or an agent's summary.
3. Reuse the existing ODD stage records on the integrated baseline. Their logs are
   chronological: old “uncommitted/no PR authorized” entries are not current delivery status.
4. On a later explicit implementation request, create the stage-3 ODD task using these
   acceptance criteria and only refresh evidence that has changed. Preserve required
   migration/security verification and native Gentle AI gates. Do not alter managed
   prompts, model assignments or configuration; delegate only genuinely independent work.
5. Update STATUS with actual commands, outcomes and commits after each delivery; keep
   Engram as an index to repository evidence, not a second full copy of this plan.

## Six-stage reference plan

| Stage | Approved scope | Exit condition |
|---|---|---|
| 1 | Administration publishes → Family receives and reads; basic author-owned drafts included | Persisted publication, authorized receipt and individual first read, idempotency and isolation proven |
| 2 | Teachers create/publish to assigned courses or their students in an explicit cycle | Revalidate assignments on create/edit/preview/publish; own history; role and course isolation |
| 3 | Real email through existing n8n infrastructure and secure PDF/JPG/PNG attachments | All ten criteria below, including crash/timeout behavior and PostgreSQL/browser proof |
| 4 | Institutional drafts, revisions and approvals | Extend existing basic drafts; configurable role/sensitivity approval and editorial revision policy; detailed policy still to specify |
| 5 | Automatic communications through real Workflows | Reuse domain and transport; real events only; `inasistencia.registrada` remains a candidate, blocked until advance-justification suppression is proven, otherwise evaluate a real alternative |
| 6 | Integration, stabilization, regression and demo readiness | Cross-module flows, security, transport recovery and reproducible demo evidence; detailed demo scope still to specify |

The earlier unapproved five-phase proposal is not the reference plan. Later approved
adjustments: minimal model, basic drafts in stage 1, advanced revisions/approvals in
stage 4, and no incorrect absence notices. Sources: ODD stage 1 specs/log and Engram #310.

## Approved architecture and rules already implemented

- One Communications domain: `backend/src/comunicaciones/` and
  `frontend/src/modules/comunicaciones/`. Workflows owns notification infrastructure;
  n8n executes transport, not business recipient/permission decisions.
- Two domain tables in stages 1–2: `comunicacion` stores author, idempotency key/request
  hash, plain-text content, audience, type, draft/published state and timestamps;
  `recibo_comunicacion` stores communication/responsible, frozen student IDs and first read.
  No separate version, publication or read entities. Add entities only for demonstrated needs.
- `Familia` represents one responsible: Usuario → Persona → Familia. Resolve enabled
  `FamiliaAlumno.recibe_comunicaciones` links; deduplicate siblings/multiple links by
  responsible. Access requires a persisted receipt and a still-enabled original student
  link; a new unrelated link does not grant an old publication.
- Drafts are author-owned; published content is immutable. Row locking, uniqueness and
  atomic first-read updates preserve idempotent publication/reading and audit.
- Institutional authoring uses administrative active-role guards. Course authoring uses
  typed teacher routes, own assignments and active enrollments in the selected cycle.
  Typed permission matching alone is insufficient: explicit context guards remain mandatory.
- Administration cannot see teacher course drafts; published course messages remain
  administratively accessible. Teachers only see their own course history. System
  Administrator has explicit management grants, not a bypass of teacher/family guards.
- Preserve `ARCHITECTURE.md` and `DESIGN.md` on the integrated baseline. Reuse the current
  form/detail/list, Dropzone and semantic states. Portals use top navigation; do not
  restore sidebars or the communication-link underlines rejected by the user.

## Stage 3 — required behavior

### Email and publication

- Select Portal Familia, email, or both; persist the selection and transport intentions.
  Publication, receipt resolution and intentions must commit atomically before dispatch.
  Portal availability must never depend on n8n success.
- Reuse Workflows notification services/client/job patterns. Do not introduce a second
  notification engine or synthetic `WorkflowExecution` rows for manual publications.
- Preserve communication → responsible/address → durable intention → individual attempt
  correlation, immutable snapshots, timestamps and controlled results/errors per channel.
- Persist attempts before external calls; claim work safely across concurrent workers,
  recover abandoned claims after process failure, and bound retries with backoff.
- Distinguish pending, processing, accepted/submitted, definite failure and uncertain
  outcomes. Do not label a webhook acknowledgment or Gmail submission as mailbox delivery.
  A timeout after a request may have reached n8n is uncertain, not proof of failure.
- Stable logical-send idempotency keys survive retries; attempt IDs change. Reconcile
  uncertain outcomes before resending. Database uniqueness alone cannot guarantee
  exactly-once external email across a send/acknowledgment crash window.
- Missing email addresses must produce an explicit controlled outcome, never silent
  success. Transport history and sensitive errors are available only to authorized roles.

### Attachments

- Allow PDF, JPG/JPEG and PNG; validate actual content, declared type, safe name, bounded
  bytes, count and total request size server-side. Browser validation is only convenience.
- Store privately and associate with a communication, with author/active-role scope for
  upload/removal and communication-scoped authenticated downloads. Never trust a supplied
  responsible ID, filename/path, attachment ID alone or a public static URL.
- Family downloads reuse receipt/current-link authorization; teacher and Administration
  access reuse their context guards. Freeze the attachment set at publication.
- Address rollback, failed uploads, abandoned drafts and orphan cleanup explicitly.
  Return safe download headers (`attachment`, `nosniff`, private/no-store); do not execute
  uploaded content. MIME/signature checks alone are not malware scanning.
- Reuse neutral validation/download mechanisms where warranted, not academic justification
  models or admissions business rules.

### Proposed implementation, not yet an approved schema

1. Extend the existing notification infrastructure with a real manual-communication origin,
   durable outbox/intent and per-attempt history. Prefer one shared transport seam and
   preserve Workflow-origin queries/contracts. `Notificacion.workflow_execution_id` is
   currently mandatory: any nullable origin extension needs an explicit source-integrity
   constraint and updates to inner-join-based logs. Final table/column names remain open.
2. Extend the existing n8n contract compatibly with stable send key, attempt correlation,
   structured acknowledgment and durable duplicate suppression/reconciliation. Keep old
   Workflow callers working. Never enable blind retry of an ambiguous Gmail submission.
   Choose/prove reconciliation before claiming external duplicate prevention is complete.
3. Prefer authenticated Portal Familia links in email rather than binary attachments:
   access can be revalidated and files are not leaked permanently through forwarding.
   Approved follow-up: email-only communications never appear in the portal inbox.
   Their email links open an authenticated, recipient-authorized detail/download route;
   eligibility is persisted separately from inbox visibility. No public bearer file links.
4. Prioritize a small communication-owned binary attachment table in PostgreSQL, matching
   existing admissions storage patterns: atomic metadata/content avoids filesystem orphans
   and public paths. Tradeoff: database/backup growth. Private object storage remains an
   alternative only if limits/volume justify the added infrastructure. This is the
   preparation's minimum-impact technical recommendation, not implemented storage.
5. Reuse form/detail/list for channel selection, upload/removal, family downloads and
   truthful per-channel outcomes/history. Do not redesign other modules.

## Acceptance and test matrix

| # | Required evidence |
|---|---|
| 1 | Administration and authorized teacher publish with a valid attachment |
| 2 | Intended family sees communication and downloads identical bytes |
| 3 | Unrelated user cannot read content, metadata or file; cross-parent IDs fail |
| 4 | Actual configured n8n/Gmail path sends to a controlled test mailbox; record submission separately from receipt |
| 5 | Responsible/address, logical send, attempts and outcomes are durable and correlated |
| 6 | n8n refusal/unavailability does not roll back the published portal communication |
| 7 | Repeated/concurrent publication and retry do not duplicate receipts/publications; logical email deduplication is proven |
| 8 | Test 4xx/5xx, timeout, lost response, crash before/after send, restart, expired claim and uncertain-result reconciliation |
| 9 | Active-role switch, revoked teaching assignment, revoked family link, missing profile and own-history checks remain enforced |
| 10 | Relevant PostgreSQL integration/concurrency/migration tests and frontend/browser regressions pass |

Additional attachment cases: empty/truncated/mismatched files, dangerous/unsupported
formats, excessive count/bytes, traversal/control characters, orphan cleanup, concurrent
upload/publication, rollback and immutable published attachments. Do not call a signature
match proof that a PDF/image is harmless; define content validation/scanning policy.

Run existing communication and Workflows/IA notification regressions, migration
upgrade/downgrade with pre-existing data, and UI state/permission/download tests. Browser
flows require real synthetic Administration, Docente, intended Familia and unrelated
Familia accounts, desktop/mobile, PostgreSQL and no mocked API responses. Restrict real
email tests to controlled recipients. Commands come from layer READMEs/package scripts.

## Definitive preparation — 2026-10-30 follow-up

The user authorized an isolated local Git documentation commit, no push/PR and no
functional changes. Base: integrated `origin/main` including PRs #274/#275. Private
attachments and authenticated email links are the priority. Email-only messages must
not generate visible portal-inbox entries. These supersede the earlier open channel question.

### Minimum transport mechanism

Use one notification infrastructure, not a Communications delivery engine. Proposed
minimum: one durable email-intent table owned by existing notification infrastructure;
reuse `Notificacion` as the individual-attempt log instead of adding another attempt table.
An attachment table belongs to Communications. Exact identifiers remain implementation detail.

| Responsibility | Minimum persisted contract |
|---|---|
| Publication | Freeze channel choice, authorized responsible/student context and attachment set with publication; portal visibility is independent of email authorization and transport status |
| Logical send | One intent per communication/responsible/normalized destination email/channel, enforced by uniqueness; immutable address/content snapshots; stable UUID send key, state, next retry, claim token/deadline and attempt counter |
| Attempt | `Notificacion` keeps snapshots/result; add intent reference, attempt number, correlation UUID, start/end and controlled error/result metadata. Commit before HTTP; every retry creates an attempt, never rewrites history |
| Origin integrity | Workflow attempts retain a real execution FK. Manual attempts reference an intent instead; constraint requires exactly one origin. Existing Workflow projections retain their execution-based semantics; manual history is separately authorized, using the same persistence/transport |
| Dispatch | Integrate intent draining into existing notification/job lifecycle; bounded batches and `FOR UPDATE SKIP LOCKED`, short claim transaction, HTTP outside DB locks, token-checked finalization. Startup and periodic passes recover durable work |
| Recovery | Expired claim with no started external attempt can return to pending; an interrupted started attempt becomes uncertain, never automatically resent. Recovery does not create another publication/receipt |
| Retry | Retry only confirmed safe failures, with bounded exponential backoff; proposed 3 total attempts with 30 s then 120 s delays. Authentication/config/validation errors require correction, not a hot loop. Exhaustion remains visible; an authorized retry uses the same logical-send key |
| Correlation | Add optional stable `envio_id` and per-attempt `intento_id`; preserve legacy payload fields. n8n must echo identifiers and return a provider submission reference or a controlled definite rejection. Validate response shape; unexpected 2xx is not proof of submission |
| Uncertain result | Read timeout/disconnect, ambiguous provider error, malformed success, process crash or expired in-flight claim enters uncertain. Do not conflate this with known-safe failure. Reconcile against correlated n8n/provider evidence; absence of evidence does not prove no send |
| Duplicate prevention | Unique intent prevents application duplicates; n8n claims the stable send key durably before Gmail. Duplicate calls return recorded outcome or in-progress/uncertain, never invoke Gmail again. Provider-acceptance-before-ledger-update remains uncertain; do not promise exactly-once external delivery |
| Truthful states | Pending/processing/accepted by transport/submitted to provider/definite failure/uncertain are distinct from portal published/read. Mailbox delivery requires additional real evidence, never inferred from HTTP 200 |

The n8n send-key ledger should use backend-owned durable state and authenticated
claim/result operations rather than workflow static memory or fake business executions.
A repeated claim returns the previous state; only its holder can record the result.
This is an extension of the same notification intent, not a second outbox. The exact
claim/result API and backward-compatible export must be validated before implementing.
Without a verified durable claim/result contract, automatic uncertain-send retries stay disabled.

Email-only recipients keep an internal authorization context (reuse receipt context with
an explicit portal-visible distinction, without treating email authorization as portal
delivery). Inbox queries filter it out; authenticated detail/download can authorize from
that context. Opening an email link must not record portal delivery or mailbox delivery.
Old publications default to portal-visible; new channel fields must not invalidate old
idempotency hashes. Never expose unrelated audience/address/history information to families.

### Approved file policy (implementation follow-up)

Approved policy bundle: at most **5 files**, **5 MiB each**, **25 MiB aggregate** per
communication; PDF/JPEG/PNG only. Private PostgreSQL storage with separate metadata and
binary tables; assess query, disk and backup impact. Bounded multipart reads,
type/signature plus structural validation, safe generated identifiers and download-only
responses. Signature-only acceptance is insufficient. Quarantine until malware scan is
clean; fail closed if the scanner is unavailable; reject encrypted/uninspectable or
dangerous active-content PDFs with structural inspection, not extension/MIME alone.
Evaluate free ClamAV, no unnecessary paid service. Keep published files with their immutable communication; delete unassociated
temporary uploads after **24 hours**, never delete an associated draft's files solely
because the draft is old. No public URLs and no file bytes in outbound email.

The user explicitly approved this bundle and authorized stage 3. Transport must progress
independently of scanner provisioning; attachments remain disabled until controls are
operational. Authentication/current-link checks and private storage are mandatory.
Do not change Gentle AI configuration, repeat prior analysis or start stage 4.

### Concrete implementation order after authorization

1. Verify actual published n8n contract/authentication, controlled test
   mailbox, scanner availability and isolated PostgreSQL/browser setup. Locate the
   specific Claude reference if different from versioned HTML. Resolve only fresh gaps.
2. Create bounded stage-3 ODD specs and additive migration for channels/visibility,
   private attachments, durable intent and notification origin/attempt fields; prove
   old data/hash compatibility and PostgreSQL upgrade/downgrade.
3. Implement atomic publication + invisible email-only authorization context + intent
   creation; preserve stage-1/2 scope guards and publication/read idempotency.
4. Extend shared notification dispatch and n8n contract together: durable claims,
   attempts, result validation, safe retries, startup recovery and uncertain reconciliation.
   Keep legacy Workflow/IA callers and projections covered by regressions.
5. Implement private upload/quarantine/scan/download and bounded orphan cleanup, with
   communication-scoped authorization and immutable published attachment sets.
6. Extend existing form/detail/list with channel selector, attachments, publication vs
   real transport states and authorized history; email links support email-only detail
   without adding inbox entries. Preserve DESIGN.md and portal shells.
7. Run PostgreSQL migration/concurrency/crash/fault tests, relevant full regressions,
   real four-role browser upload/download flows and controlled real n8n/email submission
   checks. Close ODD/Gentle AI gates and update these documents before declaring completion.
