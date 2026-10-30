# Communications — stage 3

Objective: durable real email through existing notification infrastructure and private,
quarantined attachments. Branch: `feat/comunicaciones-etapa-3`; base: `c6c2615`.
Delivery: ask-on-risk; local work units only, no push/PR authorized. No stage 4.
Risk: migration, authorization, transport uncertainty, untrusted binary content.

## Specs

- S1: Persist portal/email/both selection. Email-only never appears in the family inbox;
  authenticated detail/attachment links retain responsible/current-link authorization.
- S2: Atomic publication/recipient/intention persistence; transport after commit through
  existing notification infrastructure. No invented Workflow execution. Durable attempts,
  correlation, safe retry, restart recovery and uncertain outcomes; never call acceptance delivery.
- S3: Five PDF/JPEG/PNG files, 5 MiB each, 25 MiB total. Private PostgreSQL storage,
  separate metadata/binary. Mandatory quarantine, structural inspection and clean malware
  result before publication/download. Scanner failure is blocked, not safe.
- S4: Evaluate free ClamAV; reject encrypted/uninspectable/active dangerous files. Preserve
  draft associations; delete temporary orphans after 24 hours. Email links, no binary attachments.
- S5: Email progresses independently of antivirus provisioning. Reuse forms and DESIGN;
  preserve ARCHITECTURE, other worktrees and Gentle AI/model configuration.
- S6: PostgreSQL permissions/concurrency/migration, transport failure/retry, malicious file,
  authorized/unauthorized download, relevant regressions and actual browser proof.

## Tasks

- T1 [S1,S2,S5,S6]: implemented; PostgreSQL/fault/retry regressions passed; real provider proof blocked.
- T2 [S3,S4,S5,S6]: implemented; private metadata/blob, real scanner, permission/denial and file tests passed.
- T3 [S1–S6]: migration/UI implemented; PG/native ODD/browser evidence passed; native review
  disposition and actual n8n/Gmail sending still pending. No commit/push/PR performed.

## Log

- L1: User approved file policy and incremental stage-3 implementation, explicitly decoupled
  email from antivirus readiness. Isolated worktree created from local origin/main c6c2615;
  documentation copied from commit 4e93b7b. No other checkout changed.
- L2: Two independent backend delegations failed before work due provider free-usage quota.
  Parent continues inline without changing model configuration. No CodeGraph index in new
  worktree; MCP directed targeted filesystem fallback, no index initialized.
- L3: User corrected provider to OpenCode Go DeepSeek V4.1 Flash. Initial generic writer
  roles resumed with that provider. User then required exact native Gentle AI profiles:
  verified configured hidden `gentle-ai-worker`/`gentle-ai-verify` Go Flash max through
  OpenCode API and switched subsequent worker/verification handoffs to those native IDs.
  No global agent/model/prompt configuration changed. Earlier generic roles are not
  misrepresented as native-profile executions.
- L4: Dedicated PostgreSQL16 test stack at54389 migrated through7b60ea457979, separate browser
  database migrated. Generated migration manually reviewed: CHECK extensions, named FK,
  preserve old portal defaults and refuse data-losing downgrade. Empty-schema round trip passed.
- L5: ClamAV1.4 manifest is amd64-only; explicit emulation in isolated profile on ARM.
  Real scanner healthy; clean PNG and inert EICAR signature tests2passed. Local n8n export
  found no workflows; live Gmail submission cannot be claimed without provisioning.
- L6: Parent integration fixed fixture/settings gate mismatch. Combined isolated PostgreSQL,
  communication/concurrency/transport/client/log and real antivirus tests100passed.
  Fullfrontend620passed; lint and build passed with existing chunk-size warning.
- L7: Independent generic transport review found unsafe negative callback/retry after a
  provider claim. Parent reproduced2RED regressions then made durable claim authoritative:
  errors remain uncertain, not requeueable. n8n generic Gmail error branch now uncertain too.
  Native verifier and native browser worker running; fullbackend initial120s timeout retried
  with600s bound. No stage3 completion, native-review receipt, code commit or remote publication claimed.
- L8: Full backend rerun completed:1328passed10skipped (250s). Skipped opt-in PostgreSQL/
  antivirus tests separately covered by focused real-infrastructure100passed run; existing
  Starlette deprecation warning only. Fullfrontend620passed, lint/buildpassed. Native
  verifier/browser work continues; OpenCode API wait client's timeout is not child cancellation,
  attached native subagent continuation now forwards completion notifications.
- L9: Native verifier independently confirmed S1–S5,11scratchPGprobes and a legacy-data
  migration round trip; own4durable probes persisted by parent and rerun4passed. S6 real
  sending remains blocked; no code blockers. Label advisory fixed by parent with2RED→GREEN,
  module20passed; native targeted recheck2passed. No full backend rerun for test-only additions.
- L11: First real-send attempt failed at Gmail OAuth (`Unable to sign without access token`),
  recorded `incierto`, no email sent; chain/claim/callbacks/portal verified. Fixed by
  re-authorizing Gmail OAuth2. Second clean send: n8n execution id7 `success`, Gmail accepted
  (`referencia_proveedor` present), callback `/resultado` 200, final `presentado`, 1 intent/1
  attempt/1 communication (no duplicates), Portal email-only hidden with direct detail 200 and
  `leida_at=null`.
- L12: The `presentado` send bounced because the test recipient had a leading `t` (Gmail
  accepted, destination did not exist). Corrected the worktree `.env` recipient and resent:
  n8n execution id8 `success`, `referencia_proveedor=1a18eb9f98b5682e`, callbacks 200, final
  `presentado`, uniqueness 1/1/1/1, Portal email-only hidden/direct detail 200/`leida_at=null`.
  Security: a diagnostic dump exposed the test recipient and webhook token in the transcript;
  token rotation is pending.
