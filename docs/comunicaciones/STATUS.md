# Communications — verified status and stage-3 handoff

Updated 2026-10-30. **Stages 1 and 2 are integrated; stage 3 is now authorized and
implemented locally with verification still in progress, not declared complete.**
Current worktree: `../esseri-data-core-worktrees/comunicaciones-etapa-3`, branch
`feat/comunicaciones-etapa-3`, based on `c6c2615`. No push/PR or stage 4 is authorized.
Read [PLAN.md](PLAN.md) for approved scope. No managed prompt or model config changed.

## Current implementation checkpoint

- Added channel selection, invisible email-only inbox behavior with authenticated detail,
  atomic recipient/intention creation and authorized manual transport history/retries.
- Reused notification infrastructure: durable `EnvioNotificacion`, existing `Notificacion`
  attempts with exactly-one-origin constraint, real Workflow legacy projections preserved,
  existing job lifecycle, correlated n8n claim/result export. No fake Workflow executions.
- Added private attachment metadata/blob tables, bounded formats/quotas, structural Pillow/
  pypdf inspection, fail-closed ClamAV quarantine, scoped downloads and draft-only mutation.
- Migration `7b60ea457979` generated and manually reviewed; applied on disposable PostgreSQL.
  Round-trip upgrade/downgrade/upgrade succeeded on empty isolated data; downgrade refuses
  data loss if stage-3-specific rows/visibility policies exist. No shared DB migrated.
- Focused PostgreSQL+transport/client/log+real ClamAV: **100 passed**. True parallel worker
  and duplicate n8n claims are covered using independent PostgreSQL sessions.
- Real ClamAV clean PNG + inert EICAR proof: **2 passed**; scanner is healthy. ARM host uses
  explicit amd64 emulation because official image manifest lacks arm64. No paid service.
- Full frontend: **620 passed**, lint/build passed (existing large-chunk warning).
  Full backend first run exceeded120s; rerun completed: **1328 passed, 10 skipped**
  (SQLite run, isolated PostgreSQL/scanner opt-in checks run separately above).
- Native `gentle-ai-verify` and `gentle-ai-worker` (Go Flash max) are verifying/specifying
  the real browser fixture. Initial generic delegations are recorded honestly in ODD L3.
- **Live email blocker:** local n8n read-only CLI export returned no workflows. Gmail
  submission cannot be verified until workflow import/publication, real credentials and
  a controlled recipient are available. Do not equate mocks/HTTP acknowledgment to delivery.
- All functional stage-3 work is currently uncommitted. Documentation-only commit4e93b7b
  remains in `docs/comunicaciones-etapa-3-preparacion`; the stage-3 checkout carries its
  evolved documents. Delivery slicing/native review disposition are not yet closed.

### Final verification additions

- Native ODD verifier: S1–S5 met, no code blockers; independent temporary-schema
  PostgreSQL probes11passed and migration checks preserved pre-existing portal/Workflow rows.
  Its four durable atomicity/current-link/blob-free-read probes were persisted and rerun:
  **4 passed**. The real-send part of S6 remains unverified, not waived.
- Native browser worker: **6 real tests passed**, desktop Chromium and Pixel7, repeated
  successfully after idempotent reseeding. Real logins for Administration, teacher,
  intended family and unrelated family; actual upload→ClamAV clean→publish→browser file
  download with matching bytes, access denials, and email-only hidden inbox/direct-link
  access with `leida_at=null`. No API/transport response mocking and no mailbox-delivery claim.
- Durable browser harness: `backend/tests/comunicaciones/seed_e2e.py`,
  `frontend/e2e/comunicaciones-etapa-3.spec.ts`,
  `frontend/playwright.comunicaciones.config.ts`; commands in frontend README. Seed refuses
  wrong host/port/database, missing explicit test password or production mode. Browser data
  is separate from test transactions and shared application data.
- Parent resolved email-state-label advisory and added full authorized attempt history and
  safe definite-failure retry UI. Observed2RED→GREEN; module20passed, lint/buildpassed.
  Native targeted recheck2passed, advisory resolved, no new blocker.
- Browser services run only for this isolated proof at backend8019/frontend5179 with
  background jobs disabled; no emails were sent. Synthetic account passwords are not stored
  in these documents or Engram. n8n provisioning remains the concrete external blocker.

Reproduction from the stage-3 worktree, after starting the isolated stack and applying
the reviewed migration (never substitute the shared application's database):

```sh
# backend/; use its activated venv or the existing shared interpreter, no .env secrets needed
DATABASE_URL=sqlite:///:memory: JWT_SECRET=stage3-test-only \
COMUNICACIONES_TEST_DATABASE_URL='postgresql+psycopg://communications:communications-test-only@127.0.0.1:54389/communications_stage3_tests' \
COMUNICACIONES_CLAMAV_TEST_HOST=127.0.0.1 \
python -m pytest -q tests/comunicaciones tests/workflows/test_envios_manuales.py \
  tests/workflows/test_n8n_client.py tests/workflows/test_log_notificaciones.py
# Full backend uses SQLite; opt-in environment-specific checks above are separate.
DATABASE_URL=sqlite:///:memory: JWT_SECRET=stage3-test-only python -m pytest -q
python -m ruff check src/ tests/
python -m ruff format --check src/ tests/
# frontend/
npm test
npm run lint
npm run build
```

### Real Gmail send evidence (2026-10-30)

Un envío real controlado se ejecutó contra `infra-n8n-1` y el Gmail configurado, usando la
base aislada `esseri_stage3_local` (nunca `esseri_data_core`). Resultado:

| Paso | Evidencia |
|---|---|
| Publicación → intención | 1 comunicación, 1 intención durable |
| Claim `/reclamar` | 200, `proveedor_iniciado=true` |
| Ejecución n8n | id 7, `status=success`, ~1,4 s |
| Gmail | aceptado; `referencia_proveedor=1a18eb9f98b5682e` (message id) |
| Callback `/resultado` | 200, estado `presentado` |
| Estado/historial | `presentado`, 1 intento, sin error |
| Duplicados | 1 intención, 1 intento, 1 comunicación, 1 presentado |
| Portal (canal email) | inbox `total=0` (oculto), detalle directo 200, `leida_at=null` |

Antes de este envío hubo dos fallos de configuración de n8n, corregidos sin tocar código:
(1) la credencial Header Auth tenía el token sin `Bearer `; (2) el primer intento real falló
con `Unable to sign without access token` porque el OAuth de Gmail no tenía token válido.
El sistema registró `incierto` en ambos casos, nunca entrega falsa.

Un primer envío con estado `presentado` rebotó porque la dirección de prueba tenía un `t`
de más: Gmail aceptó el mensaje pero el destino no existía. Corregida la dirección, el
reenvío limpio quedó `presentado` con `referencia_proveedor=1a18eb9f98b5682e`. Esto confirma
la distinción aceptado ≠ entregado; el rebote es un evento posterior que el sistema no ve.

**Higiene pendiente:** durante el diagnóstico se volcó de más la ejecución de n8n y quedaron
visibles en el transcript el email de prueba y el `N8N_WEBHOOK_TOKEN`. Rotar ese token (en
`backend/.env` y en la credencial Header Auth de n8n) antes de compartir el historial.

The following recovery sections describe the earlier documentation-only checkpoint;
the implementation checkpoint above supersedes their “not started/unauthorized” statements.

## Checkout warning — read before resuming

Authoritative Git documentation now lives in branch
`docs/comunicaciones-etapa-3-preparacion`, worktree
`/Users/hilario/Proyectos/esseri-data-core-worktrees/comunicaciones-etapa-3-preparacion`,
created directly from `origin/main` at `c6c2615`. The original local copies remain at
`/Users/hilario/Proyectos/esseri-data-core/docs/comunicaciones/` and are older snapshots;
do not overwrite this branch with those copies. The original root checkout is **not**
the implementation baseline: branch
`feat/historial-asistencia-integral`, HEAD `9056977`, behind its tracked remote by 135
commits, with substantial pre-existing tracked/untracked work (including DESIGN.md,
academic/enrollment services and teacher portal UI). Do not reset, stash, switch branches,
merge or overwrite it as part of recovery.

| Reference | Verified state |
|---|---|
| Local `origin/main` | `c6c2615d8b334362209a0d368fad9de100a570ef`, PR #275 merge; no fetch performed this session |
| Stage 1 | PR #274 merge `8114e6d`; implementation `00f6a78`; retained worktree `../esseri-data-core-worktrees/comunicaciones-etapa-1` at `b34bd51` |
| Stage 2 | `feat/comunicaciones-etapa-2` at `5734b62`; remote tracking branch marked gone after merge |
| Verified source tree | Stage-2 HEAD and local origin/main both tree `f33f2f77e6d1475eec2a757ec46ec6ff51070af5`; `git diff --stat 5734b62 origin/main` empty |
| Source inspected/tested | `../esseri-data-core-worktrees/comunicaciones-etapa-2`; only pre-existing untracked `.atl/` reported there |
| Other worktrees | `main` is occupied by `portal-docente-academico`; `main-visual` remains detached at `8114e6d` (stage 1 only). Other family/admissions/history worktrees must be preserved |

The follow-up authorizes committing only these two documents in the isolated branch.
Use `git log docs/comunicaciones-etapa-3-preparacion -- docs/comunicaciones` to recover
the documentation commit without a self-referential SHA. No push or PR is authorized;
therefore a fresh remote clone still cannot recover this branch. Carry this branch's
docs into stage 3, not the older root snapshots or the dirty root's functional code.

## Evidence: implemented versus historically tested

| Stage | Code evidence | Verification provenance |
|---|---|---|
| 1 | Two persisted tables; author drafts; locked publication/receipts; current family-link access and atomic first read; administrative and family UI/API | ODD stage 1 records 14 PostgreSQL tests including concurrent authenticated requests; earlier backend full suite 1,271; real browser desktop/mobile 2 passed. Historical, not rerun today |
| 2 | Teacher type/context, typed routes/grants, assigned course/student/cycle guards; shared form/preview/history; draft isolation and cycle fix; sysadmin grants | ODD stage 2 records final backend 1,286 passed/1 skipped, PostgreSQL communications 29 passed, frontend 611 passed, four real browser flows and targeted role/cycle/mobile checks. Historical, not a current full-suite result |
| 3–6 | No stage-3 channel/attachment/outbox integration in the inspected communication models/service; later editorial/automation scope remains pending | Not complete; existing Workflows/IA email features do not constitute these stage deliveries |

### Checks actually run in this recovery

Executed from the stage-2 worktree (same tracked tree as local origin/main):

```sh
# backend/; shared interpreter only, source imports resolve from this worktree
DATABASE_URL=sqlite:///:memory: JWT_SECRET=documentation-preflight-test-only-secret \
  /Users/hilario/Proyectos/esseri-data-core/backend/venv/bin/python -m pytest -q \
  tests/comunicaciones tests/workflows/test_n8n_client.py \
  tests/workflows/test_notificaciones.py tests/workflows/test_log_notificaciones.py
# frontend/
npm test -- src/modules/comunicaciones/pages/__tests__/comunicaciones.test.tsx
```

- Backend: **89 passed, 1 skipped**, 1 existing Starlette/httpx deprecation warning.
  PostgreSQL-only concurrency test skipped; this is SQLite evidence, not PostgreSQL proof.
- Frontend: **9 passed**, one test file. No full frontend suite/build/lint rerun for this
  documentation-only change. Original worktree `venv`/`.venv` executables were absent;
  root interpreter worked with disposable test settings (no secret copied from `.env`).
- Git merge ancestry/tree equality and source/ODD checks corroborate historical completion;
  stage status is not inferred solely from old agent claims.
- Docker currently exposes shared postgres/backend/frontend/n8n on 5432/8000/5173/5678.
  Earlier isolated stage-1/stage-2 PostgreSQL containers were not listed. No shared/demo
  database was mutated; no migration or real email was executed. Browser E2E and PostgreSQL
  results above remain historical. Service availability does not prove credentials/workflow readiness.

## Relevant files on the integrated baseline

These paths may be absent/outdated in the dirty root. Read them from the stage-2 worktree
or with `git show origin/main:<path>` until using an isolated integrated checkout.

| Area | Paths |
|---|---|
| Architecture and UI | `ARCHITECTURE.md` §Communications domain; `DESIGN.md` §shells/accessibility; `docs/esseri-vistas.html` is the versioned visual reference, but a separate Claude stage-3 mockup was not identified |
| Previous ODD evidence | `odd/tasks/comunicaciones-etapa-1.md`, `odd/tasks/comunicaciones-etapa-2.md`; retain these, do not duplicate their full logs |
| Communication backend | `backend/src/comunicaciones/{models,schemas,service,router}.py` |
| Communication tests | `backend/tests/comunicaciones/{conftest,test_publicacion,test_docente,test_concurrencia,test_sysadmin_migration}.py` |
| Frontend | `frontend/src/modules/comunicaciones/pages/`, `services/`, `types.ts`, `routes.tsx`; `pages/__tests__/comunicaciones.test.tsx`; `frontend/e2e/comunicaciones.spec.ts` |
| Existing notification seam | `backend/src/workflows/{models,notificaciones_service,n8n_client,email_html,despacho_job,despacho_service}.py`; `backend/src/ia_sugerencias/service.py` also calls the existing email seam |
| Notification regressions | `backend/tests/workflows/test_n8n_client.py`, `test_notificaciones.py`, `test_log_notificaciones.py`, `test_email_html.py`, `test_generar_comunicacion.py`; `backend/tests/ia_sugerencias/test_comunicaciones.py` |
| Attachment precedents | `backend/src/inscripciones/admisiones_service.py` validates PDF/JPEG/PNG signatures and 5 MiB, stores binary content and scopes download to parent; `frontend/src/components/ui/dropzone.tsx`; no Communication dependency on academic justification models |
| Transport contract | `infra/n8n/README.md`, `infra/n8n/enviar-email.json`, `backend/.env.example` (names only; do not persist secrets) |
| Run commands | `backend/README.md` communication/PostgreSQL tests; `frontend/package.json`; `frontend/README.md`; `infra/README.md` |

Relevant migration chain: `131253d235ee` (communication/receipt tables and grants) →
`d42435882574` (course type and teacher grants) → `98d809a30507` (sysadmin grants).
Stage-2 changes include `a3c192e`, `ce3e7e2`, `ab6a1ed`, `66158a9`, `c321563`,
`0fdfdfa` and documentation `5734b62`. No stage-3 revision exists from this task.

## Stage-3 dependency and risk register

| Dependency | Observed gap / action before enabling delivery |
|---|---|
| Manual notification origin | `Notificacion.workflow_execution_id` is NOT NULL; existing logs/UI expect rule/execution joins. Extend origin/integrity and projections compatibly; never fabricate executions |
| Durable transport | `_enviar_todos` flushes then calls HTTP in the caller transaction and labels any 2xx `enviado`; not a committed outbox or crash-safe manual dispatch seam. Add durable intentions/attempts within existing infrastructure |
| Current n8n contract | POST JSON `destinatario`, `asunto`, `cuerpo`, optional `cuerpo_html`; optional Bearer token; 10 s timeout. Export is Webhook → Gmail → 200 `{enviado:true}`, Gmail error → 500 `{enviado:false}`. Client ignores body and treats HTTP errors/timeouts as failures |
| Duplicate/uncertain outcomes | No stable send key, attempt correlation, durable dedupe or reconciliation in exported flow/client. Design/prove these; a timeout or crash after provider submission must not trigger blind retry |
| Live n8n/Gmail | Export has `active:false` and credential placeholders; this does not describe the running instance. Confirm published workflow, matching Header Auth, controlled mailbox and valid Gmail OAuth without exposing credentials; actual sending is pending |
| Channel meaning | Resolved by user: email-only must not appear in inbox. Preserve hidden recipient authorization for authenticated detail/download links; separate portal visibility from email eligibility |
| Upload policy | Pending approval: proposed bundle in PLAN (5 files × 5 MiB, 25 MiB total; fail-closed quarantine/scan; reject uninspectable/active PDFs; 24 h temporary-orphan cleanup). Scanner availability is not verified |
| Attachment storage | Proposed private DB binary table minimizes impact/orphans; confirm limits and volume before choosing. Filesystem/object store needs private keys, rollback compensation and a cleanup job; no new storage is provisioned |
| PostgreSQL/browser environment | Reestablish a dedicated disposable migrated database and real synthetic roles/accounts; do not use shared Docker database. Rerun migration, concurrency and actual browser flows before delivery |
| Claude reference | Locate/confirm intended stage-3 mockup; do not treat existing HTML as proof of a separate approved mockup |

Expected additive migration responsibilities (not generated): persisted channels/default
compatibility for old publications, attachment ownership/content metadata, durable send
uniqueness/claim/retry/correlation state, per-attempt history and notification-origin
constraints/indexes. Choose the smallest justified schema; preserve existing request-key
hash compatibility and historical notification data. Follow migration skill/manual review
and test upgrade/downgrade on PostgreSQL before applying outside isolation.

The webhook semantics were also checked against current n8n documentation via Context7:
`https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.respondtowebhook/`.
An HTTP result represents workflow/transport processing, not recipient mailbox delivery.

## Next authorized action and recovery verification

Recovery is complete; definitive preparation is recorded in PLAN's follow-up section.
**Implementation remains gated on an explicit request and the pending file policy**.
On “Implementá la Etapa 3 de Comunicaciones”, read PLAN + this status, create an isolated
branch from freshly verified integrated main, carry these docs, resolve the policy gaps
above before the affected code, and create a bounded stage-3 ODD task. Do not redo the
stage-1/2 architecture analysis. Stage 4 approvals and stage 5 automation stay out of scope.

Engram index: project `esseri-data-core`, topic `comunicaciones/context-recovery`
(#397); preflight topic `comunicaciones/stage3-preflight` (#396). Recovery search
returned #397 and both document paths were checked as readable with reciprocal links
(initial PLAN: 145 lines, before this follow-up). Full observation retrieval of #397 also succeeded. This validates the available
mechanism, not a literal test with a second model or a promise of cross-machine access.

## Key Learnings:

1. The dirty default checkout is older than both Communications stages; integrated source
   must be selected explicitly before testing or implementing.
2. Existing notification transport is reusable infrastructure, but its mandatory execution
   FK and ambiguous-result handling require a compatible extension for manual messages.
3. Historical PostgreSQL/browser success and today's focused SQLite/UI results are distinct
   evidence; neither proves stage-3 email or secure attachment acceptance.

## Follow-up documentation delivery

- Scope: one documentation work unit, PLAN + STATUS only, based on integrated main.
  Runtime harness: N/A, no executable behavior changed. Previous focused tests remain
  applicable evidence; no redundant test rerun is needed for policy prose.
- Minimum design is now specified in PLAN: shared durable notification intent,
  `Notificacion` attempt history with exactly-one-origin integrity, existing job lifecycle,
  stable send/per-attempt correlation, backend-owned n8n claim/result ledger and safe
  uncertain handling. No fictitious Workflow executions or parallel notification engine.
- Existing exported contract and client were already inspected in recovery; no new
  functional bytes differ from that baseline. Live authentication/credential/provider
  behavior remains unverified; no send, workflow activation or shared DB mutation is
  authorized or performed by documentation preparation.
- Verification for the commit: changed paths must be exactly the two docs;
  `git diff --cached --check` must pass; repository-relative links must resolve.
  Rollback boundary: remove/revert only these two new documents on this docs branch.
  Root dirty checkout and all other worktrees remain unchanged.
