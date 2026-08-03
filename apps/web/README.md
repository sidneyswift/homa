# web

The one deployable: Homa's marketing site, onboarding flow, authenticated
product, API routes, and eve agent in one Next.js App Router application.

Start at the repo root: `AGENTS.md` for commands and laws, `BUILD.md` for
the build phases. This README covers only what is specific to this package.

## Run it

```bash
pnpm install            # from the repo root
cp apps/web/.env.example apps/web/.env.local   # then fill in values
pnpm --filter web dev   # http://localhost:3000
```

## Layout

- `app/` includes `/`, `/onboarding`, `/blog`, `/privacy`, `/terms`,
  `/signin`, and `/join`. Internal onboarding code retains the earlier map
  name in `/api/map/*` and `lib/map/`.
- Authenticated routes live under `/app`: `/app` is chat, `/app/progress`
  resolves the focused or first child, and `/app/[childId]/progress` renders
  the feature-flagged live subject, domain, and topic hierarchy. Legacy
  in-app report routes remain the flag-off rollback path. Planner, tasks,
  child, and settings surfaces have their own routes. Settings includes
  saved memories and adult membership controls.
- The web chat parses completed `manage_child_progress` output through
  `app/app/progress-message-parts.ts`. Its update, question, conflict, and
  workflow cards send visible choices through the existing chat queue without
  clearing a composer draft. Only the latest actionable live tool part is
  enabled, using stable message-and-part identity. Accepted sends consume that
  action; a wall rejection or removed queue entry releases it for retry.
  Archived, stale, and consumed cards remain readable with disabled controls.
  SMS and email keep their plain-text progress replies.
- `lib/child-progress/tool-result-contract.ts` is the one bounded,
  client-safe result schema shared by the Eve tool and web parser. It carries
  strict offset-bearing dates and conflict evidence sources without importing
  server crypto into the client path.
- `lib/child-progress/legacy-adapters.ts` owns the flag-off versus flag-on
  writer seam and transport-derived idempotency. Its colocated test proves
  every disabled writer makes zero ChildProgress calls.
- `lib/child-progress/selection-answer.ts` gives compatibility answer rows a
  stable selection identity shared by transactions and Postgres projection
  reads.
- `app/onboarding/map-answer-attempt.ts` owns the ref-backed save and undo
  intent-key policy. Failure retains a key, a changed answer or action replaces
  it, and success clears the matching intent.
- `app/onboarding/receipt-correction-intent.ts` snapshots versioned report
  edits and clears only versions accepted by the server. Receipt controls stay
  disabled while that snapshot is in flight.
- `lib/child-progress/legacy-tool-disabled.test.ts` protects the disabled
  `record_observation` sentinel.
- `lib/child-progress/sms-onboarding-resume.test.ts` protects compatibility
  answer resume for the unlinked SMS checklist.
- `lib/sms-inbound-auth.ts` stamps provider-message and inbound-receipt
  identity before an SMS number is linked to a family. Its test covers linked,
  unlinked, and reclaimed-receipt behavior.
- `lib/family-fold.ts` is the shared account-attachment and SMS-stub fold
  transaction. ChildProgress composite foreign keys move child-scoped state
  with the child.
- `lib/map/walk-answer-event.ts` preserves the existing `map.walk_answered`
  properties for all five answer values. Its colocated test protects parity.
- `lib/map/walk-prompt-store.ts` creates and consumes server-only durable graph
  walk prompts in the same ChildProgress repository transaction as the answer
  write and next prompt. Exact retries replay; stale sittings and newer item
  observations retire safely before mutation. Expired, stale, and stopped
  prompts release their active slot so restart returns one fresh prompt.
- `lib/map/family-actor-auth.ts` distinguishes authenticated, confirmed
  anonymous, and failed browser actor lookups so failures never become
  unattributed writes.
- `agent/` contains the eve instructions, tools, channel adapters, schedules,
  and hooks. A source prompt does not prove that an external provider has
  been re-provisioned with its current bytes.
- `lib/map/` owns onboarding and report data. Progress answer, walk, delete,
  and report-correction writers enter `lib/child-progress/legacy-adapters.ts`.
  With the live flag off, the adapter calls only the existing `child_answers`
  implementation. With it on, evidence and atomic corrections use
  ChildProgress while `child_answers` remains the compatibility projection.
  There is no reverse database bridge.
  `lib/agent-db.ts` uses caller JWT plus RLS for web chat and authenticated
  family-pinned access for server-originated channels; M1-02 owns the remaining
  transaction-local role hardening.
- `app/api/map/subject-lesson/keep/route.ts` and
  `lib/subject-lessons/keep-route-policy.ts` own the owner-only direct Keep
  boundary. The lesson page's `lesson-keep-button.tsx` shows the Binder and
  daily-loop handoff only after an explicit kept response. `lib/family-phone.ts`
  supplies the server-only boolean used for the optional Parents settings link.
- The state pack (plans/2026-07-28-state-pack.md): `app/app/binder/` hosts
  the one-button card, `POST app/api/compliance/pack/route.ts` composes and
  renders "Your {State} pack" fresh from `state_requirements` payload via
  `lib/compliance/pack.ts` (pure derivation, all 51 jurisdictions covered by
  `lib/compliance/pack.test.ts`) and `lib/compliance/pack-store.ts` (each
  generation a new finalized materials row, subject `state-pack`, prior pack
  superseded but its bytes kept as a receipt). Downloads ride the existing
  `/api/materials/[id]/pdf` route, which emits the compliance download event
  for state packs. `scripts/state-pack-render-smoke.mts` is the local
  Chromium proof.
- `lib/materials/library.ts` shares one first-transition receipt contract
  between agent approval and subject lesson Keep. Caller-JWT approval uses the
  atomic `finalize_family_material` RPC from the subject lesson migration;
  family-pinned approval uses the matching server transaction. The direct
  lesson finalizer accepts attached `draft` or `final` rows only, while explicit
  agent approval retains previously-final revision recovery.
  `lib/materials/finalization.test.ts` protects replay-safe cleanup and event
  receipts, while the Binder contract remains final-material only.
- `lib/subject-lessons/content-save.ts`,
  `lib/subject-lessons/material-validity.ts`, and
  `lib/subject-lessons/worksheet-effect.ts` own write-once lesson content,
  the shared ready-material rule, and replay-safe worksheet effect decisions.
  The subject lesson migration stores server-authenticated material provenance
  and durable effect receipts before any render, review, or Blob upload.
  `lib/materials/render-policy.test.ts` protects the subject lesson Chromium
  no-image request policy, including CSS backgrounds and data-image URLs.
  `lib/materials/pinned-privacy.test.ts` protects final-only lesson visibility
  across pinned find, show, and card reads while preserving the exact
  pre-migration legacy query shape.
- `components/marketing/` landing sections, migrating to the Quiet authority
  contract under gh#683 (legacy values remain frozen until each row passes its
  own evidence gate).
- `vercel.json` registers the hourly `/api/map/cron` request. Registration does
  not prove successful production execution.

## Webchat prompt suggestions

Webchat prompt suggestions are paused pending a more valuable redesign.
`ChatClient` renders neither the fixed starter chips nor the generated rail,
and it does not request suggestion sets after replies. SMS, email, dispatch,
and mobile remain unchanged.

The isolated implementation is retained for redesign work. Its editable
prompt lives at `agent/prompt-suggestions.md`, and suggestion sets remain
local browser data rather than durable family data.

Run `pnpm check:prompt-suggestions` for the credential-free fixture, contract,
policy, storage, rail, and client checks that CI uses. Run
`pnpm eval:prompt-suggestions` manually for the paid 20-case synthetic
producer-plus-judge eval. The paid eval is intentionally absent from CI. Set
`HOMA_SUGGESTIONS_MODEL` to override the live producer model and
`HOMA_SUGGESTIONS_JUDGE_MODEL` to override only the eval judge.
Run `pnpm eval:prompt-suggestions:judge-gold` to skip producers and calibrate
that judge against the fake corpus's human-authored gold suggestions.

## Guards

Use `pnpm check:child-progress` for core events, default ChildProgress modules,
walk events, and reconciliation. Use `pnpm check:progress-ui` for focused route,
message-part, and card behavior, and `pnpm child-progress:e2e` for the
disposable local PostgreSQL proof. Use the remaining root command list in
`AGENTS.md`. Agent-module changes also require
`pnpm --filter web exec eve build`. Do not infer that CI passed from the
workflow definition; inspect the actual run.

## ChildProgress rollout

The repository implementation and local migration do not establish production
state. Keep `HOMA_LIVE_PROGRESS_ENABLED` false for the code deployment, wait
for Vercel READY, and probe legacy onboarding, reports, and unlinked SMS. Then
apply the additive migration, run the dry-run and real progress reconciliation,
enable the flag, and probe authenticated Progress, permanent token reports,
corrections, and linked-family SMS. Rollback disables the flag first and keeps
the additive tables and evidence.

## Public summary ownership

`public/llms-full.txt` is the canonical long public product summary.
`public/llms.txt` is a condensed derivative and must not introduce a product
claim that is absent from the long summary. Public claims require the same
policy, repository, and production evidence recorded in the reconciliation
ledger.
