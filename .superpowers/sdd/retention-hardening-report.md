# Retention hardening report

Date: 2026-07-16

Worktree:
`/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons`

Status: DONE

## Result

All final-review findings are implemented in the isolated worktree.
Environment-only verification remains intentionally unavailable without
credentials or an applied migration. No migration, environment value, commit,
push, or deployment was performed.

## Remaining final-review closure

The second final-review pass added these protections:

1. Generic pinned creation rejects lesson-linked revision sources for SMS,
   email, and dispatch. Generic pinned finalization rejects any chain that
   contains lesson provenance. Direct Keep supplies the exact trusted lesson
   id and accepts only a chain wholly owned by that lesson.
2. Subject lesson HTML rejects image-bearing markup, data-image URLs, and all
   CSS `url(...)` forms, including background shorthand. Chromium request
   interception blocks every image resource while retaining allowlisted font
   stylesheets and font files.
3. Flag-off compatibility recognizes PGRST204 and PostgreSQL 42703 missing
   `materials.subject_lesson_id` responses in either message order. Realistic
   fallback fixtures prove legacy approval still completes.
4. `subject_lessons` has no authenticated SELECT policy or grant. Authenticated
   Data API reads hide lesson-linked drafts and superseded rows, while final
   lesson worksheets remain readable for Binder.
5. Paid worksheet work requires the exact trusted child id, child name,
   canonical subject id, target statement as `skill`, and worksheet kind.
   Stored and ready material checks bind child, subject, and target back to
   the lesson.
6. Revision receipt preflight validates family, lesson, child, subject,
   target, worksheet kind, failed-review draft status, and an unbranched
   current chain before the receipt claim.
7. Fingerprints retain one effective floor-determining confirmation with
   deterministic tie handling. Lower confirmations and irrelevant answers no
   longer change identity while the starting line and target remain fixed.

## Final three closure

The last review pass added:

1. Canonical subject binding from trusted `subjectId` through tool validation,
   material storage, attachment, and ready reads. All map subjects pass,
   including `art` with display name `Art & creative`; the display name is
   rejected as stored subject metadata.
2. Navigation-safe HTML and Chromium rendering. Subject lessons reject meta
   refresh, base, iframe, frame, object, embed, image markup, data images, and
   CSS URLs. Request interception allows the initial `about:blank` document
   but aborts later document, navigation, and image requests.
3. Pinned material privacy across SMS, email, dispatch, and subject lessons.
   Direct ID, card, `draft`, and `any` reads hide nonfinal lesson-linked rows.
   Ordinary drafts and final lesson worksheets retain their intended
   visibility. Subject lesson `find_materials` is final-only.

## Final rollout blocker closure

Pinned card, direct-ID, and filtered material reads now choose their query
shape from a bounded schema-capability check:

- Before the migration, flag-off reads execute the exact legacy SQL without
  naming `subject_lesson_id`, preserving SMS, email, and dispatch behavior.
- After the migration, protected reads hide every nonfinal lesson-linked row.
- After rollback, a false flag still uses protected reads when the column is
  present.
- A flag-off PGRST204 or PostgreSQL 42703 race retries once with the legacy
  query. A flag-on missing-column result fails closed with null or an empty
  list.
- Missing-column details and family data never enter tool results.

## Delivered hardening

### A. Migration compatibility

- Caller-JWT material approval first calls the atomic
  `finalize_family_material` RPC.
- Only an exact flag-off plus missing-RPC result enters the temporary legacy
  caller path.
- Flag-on material approval fails closed when the RPC is absent.
- Pinned approval checks whether the provenance column exists while the flag is
  off, so pre-migration material approval keeps its legacy query shape.
- Lesson Keep remains flag-gated and fails closed without its schema.

### B. Lesson channel restrictions

- The `subject_lesson` channel is rejected by `mark_material_final`.
- Subject lesson `create_printable` accepts only an exact-child worksheet with
  exact trusted names and target, HTML, no `pageImageUrl`, and no image-bearing
  markup, data-image URL, or CSS `url(...)`.
- `generate_image`, web-photo search, and photo import refuse the subject
  lesson channel before provider or Blob work. Saved-material lookup is
  final-only and cannot expose a lesson draft.
- Only `materials.created` accepts `channel: "subject_lesson"` in the event
  registry. Image, photo, and finalization events reject it.
- The fleet skill now advertises and follows the HTML-only path.
- Chromium independently blocks image resource requests for subject lessons.
- Chromium also blocks non-initial document and navigation requests.

### C. Provenance and owner boundary

- The unapplied migration adds nullable
  `materials.subject_lesson_id -> subject_lessons.id`.
- Authenticated Data API inserts require `subject_lesson_id is null`.
- Subject lesson rows are server-readable only. Authenticated material reads
  expose final lesson worksheets but not lesson-linked drafts or superseded
  rows.
- Trusted pinned creation stamps the lesson id, validates the exact child and
  attempt, stores the canonical subject id, and permits revisions only inside
  the same lesson provenance.
- Attachment, recovery, ready reads, and direct Keep use the shared strict
  material predicate. Model-authored generation JSON is no longer provenance.
- Direct authenticated status, approval-time, and provenance updates are
  rejected. The caller-JWT RPC is the status-write boundary.
- Ordinary materials remain approvable by a family member through the RPC.
  A lesson-linked target or revision chain requires the authenticated account
  owner.
- Generic pinned finalization refuses lesson-linked materials. The owner-only
  direct Keep route remains the server-authenticated path.
- Generic pinned revisions cannot enter a lesson chain. Direct Keep accepts
  only the exact attached lesson chain.
- Generic pinned material reads apply the same nonfinal lesson privacy rule.
- The isolation guard now includes forged provenance, direct status update,
  non-owner lesson finalization, and ordinary member RPC probes.

### D. Replay-safe worksheet effect

- `subject_lesson_effect_receipts` claims each logical worksheet effect by
  lesson id, attempt, and `initial` or revision source id.
- The claim lands before render, visual review, upload, and material insertion.
- A completed replay returns its attached material. An in-flight or uncertain
  replay is refused without another billable effect.
- An explicit parent Retry gets a new attempt key.
- Review revisions use the prior material id as a distinct create key.
- Revision eligibility is checked before the receipt claim or paid work.
- Subject lesson reference lookup is final-only.
- Material creation records the created row on the in-flight receipt.
  Attachment and recovery stamp completion only after the exact material is
  attached in the same transaction.
- The first complete lesson content save is write-once. Exact later content is
  a successful replay; changed content is rejected.

### E. Stable target fingerprint

- Determinant answers now include only the single confirmation that sets the
  effective floor.
- When none are present, only the lowest relevant `not_yet` is included.
- Later `skip`, `not_sure`, and irrelevant higher `not_yet` changes keep the
  same target fingerprint.
- The shared lesson and four-week-plan selector still returns the same first
  target.

### F. Ready material validity

Ready transitions, token reads, owner reads, report summaries, recovery, and
Keep now require all of the following:

- `material.subject_lesson_id = lesson.id`;
- exact lesson child;
- exact lesson subject and target metadata;
- `kind = worksheet`;
- `status in (draft, final)`;
- nonempty PDF and preview URLs; and
- visual review passed or was unavailable.

Superseded, deleted, mismatched, malformed, or failed-review materials make the
ready projection unavailable, so no broken Print link is returned.

### G. Retention-only shape

- Removed subject lesson done-state fields and store functions.
- Removed the subject lesson planner projection.
- Removed `subject_lessons.completed_at` and its planner index from the
  unapplied migration.
- Removed planner, done-state, and deep-dive redirect requirements from
  the design spec.
- The retained path is report -> lesson + worksheet -> Keep -> Binder -> chat
  -> optional phone settings.
- No subject lesson planner or Complete route, control, mutation, or event is
  present.

## Test-first evidence

### Initial RED

The first hardening run was executed after the new assertions and before
production changes:

```text
tests 79
pass 59
fail 20
```

The failures covered missing RPC fallback, missing deterministic channel
guards, missing trusted child provenance, unstable determinant answers,
missing effect and validity modules, overwriteable content, forgeable
generation metadata, and retained planner and done-state shape.

Two follow-up RED cases were also observed before their implementations:

```text
material event channel restriction: 13 tests, 12 passed, 1 failed
saved-material reference restriction: 12 tests, 11 passed, 1 failed
```

The second final-review assertions produced:

```text
tests 56
pass 41
fail 15
```

Those failures covered protected revision chains, missing-column response
variants, render interception, exact paid-work binding, direct-read privacy,
revision preflight ordering, and single-determinant selection.

The final three assertions produced:

```text
tests 47
pass 38
fail 9
```

Those failures covered Art canonical subject metadata, meta-refresh and
navigation requests, and pinned direct, card, draft, and any-read privacy.

The rollout compatibility assertions produced:

```text
tests 18
pass 16
fail 2
```

The failures proved the legacy, protected, rollback, missing-column retry, and
flag-on fail-closed read modes were not yet present.

### GREEN

```text
focused hardening suite:             103 passed
remaining-findings focused suite:     57 passed in 19 suites
final-three focused suite:             47 passed in 17 suites
pinned rollout compatibility suite:    18 passed in 2 suites
final subject lesson/material suite: 230 passed in 61 suites
deterministic channel subset:         25 passed
```

The replay tests prove one create, one refused uncertain replay, completed
receipt reuse, distinct Retry and revision keys, and write-once content.

## Verification

Passed:

- `pnpm check:map`
- `pnpm check:events`
- `pnpm check:fleet-skills`
- `pnpm check:skills-targeting`
- `pnpm check:fleet-skills-dormant`
- `pnpm check:taxonomy`
- `pnpm check:progress-ui`, 128 tests
- `pnpm check:child-progress`, 289 tests
- `pnpm check:continuity`, 101 tests
- core typecheck
- web typecheck
- full `pnpm typecheck`
- `pnpm lint`, zero errors
- full `pnpm build`, including the complete Next route build
- `VERCEL=1 pnpm --filter web exec eve build`
- `VERCEL=1 pnpm check:eve-stream-duration`, 3 checks
- `git diff --check`
- `node --check scripts/isolation-check.mjs`

Lint retains one existing warning in `apps/web/lib/chat-history.ts` for the
unused `ChatHistoryMessage` type.

The Next build retains the known nested-worktree root-inference warning.
The Eve build retains plugin timing warnings and the expected local prewarm
warning because `VERCEL_DEPLOYMENT_ID` is absent.

## Environment-only exclusions

1. `pnpm check:isolation` stopped before any remote action because
   `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are absent. The static isolation
   contracts and script syntax passed, but the authenticated Data API and SQL
   probes could not run.
2. The model-backed workflow eval could not run because both
   `AI_GATEWAY_API_KEY` and `VERCEL_OIDC_TOKEN` are unset. Its deterministic
   workflow findings tests passed.
3. The migration remains unapplied as required. No real PostgreSQL receipt,
   owner-RPC, attachment, recovery, or ready-projection journey was executed.
4. No environment value was added or changed. No commit, push, deployment, or
   production probe was performed.
