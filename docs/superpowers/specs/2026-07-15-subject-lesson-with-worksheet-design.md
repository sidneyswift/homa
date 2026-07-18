# Subject lesson with worksheet design

> Status: approved in chat by the founder on 2026-07-15. This document
> formalizes the approved product and technical contract before implementation.

## Founder direction

Replace the subject-specific four-week plan offered inside every progress
report subject card with one lesson. The lesson teaches the next skill that
could move that subject forward and includes one practice suggestion plus an
automatically generated printable worksheet.

Keep the separate whole-child four-week month unchanged.

This direction supersedes the subject-card four-week-plan action. It does not
supersede the whole-child month or its 28-day re-check loop. Implementation
must register this ruling in
`docs/homa-planning/build-log.md` and the founder-ruling index in
`docs/homa-planning/journeys/10-reconciliation.md`.

## Goal

Give a parent one immediately understandable next teaching move for a subject,
without asking her to commit to another four-week plan.

The feature succeeds when one tap:

1. chooses the correct next skill from the child's scored progress data;
2. saves one subject lesson;
3. builds a useful teaching sequence and practice suggestion;
4. creates and visually reviews a printable worksheet for the same skill;
5. lets the account owner Keep the worksheet in Binder; and
6. hands the parent back to chat, with optional phone settings when useful.

## Scope boundaries

In scope:

- eligible scored subject cards on permanent progress reports;
- one current lesson per child and subject;
- deterministic target selection;
- generated lesson content;
- automatic worksheet generation through the materials studio;
- saved lesson history;
- owner-only build, retry, and Keep actions;
- Binder visibility after explicit Keep;
- chat and optional phone-settings handoff after Keep;
- existing share behavior for a finished lesson and worksheet;
- billing-door, event, cost, and admin visibility updates.

Out of scope:

- changing or removing the whole-child four-week month;
- changing the month's 28-day re-check email;
- adding a day picker or persisted drag-and-drop scheduling;
- adding subject lessons to a planner or check-off surface;
- adding a lesson done-state;
- automatically finalizing the worksheet without parent approval;
- automatically using a child's photo;
- deleting or rewriting existing subject-specific four-week plans;
- changing curriculum generation, which may continue to use the internal
  four-week-plan builder as source context;
- adding a lesson sequence, unit study, term, or curriculum.

## Parent experience

### Subject card

An eligible subject card uses these actions:

- No current lesson for this report target: **Build the next lesson**
- Current lesson exists: **Open the lesson**

The mirror view keeps the same label but renders it inert with `hers to tap`.
The sample report continues to route a visitor into her own onboarding flow.

The button remains strongest on a growing subject and secondary on other
eligible scored subjects. Exposure-only and not-mapped subjects do not get the
lesson action.

The button never says that one lesson will improve a score. It offers the next
skill selected from the score path.

### Build state

The authenticated first tap creates the lesson request and opens its page. The
page immediately shows:

- the child and subject;
- **Teach this next**, followed by the deterministic target statement; and
- **HOMA is making this lesson**, followed by a calm status line.

While the background session runs, the worksheet status reads:

> Making the practice page...

The page polls only while the row is queued or running. The parent may leave
the page. The durable row, Eve session, materials row, and Blob artifacts carry
the work.

### Ready lesson

The ready page contains only these teaching sections:

1. **Teach this next**
   - The exact deterministic target statement.
2. **The lesson**
   - A short, concrete title.
   - Ordinary household materials, only when needed.
   - Three to five ordered teaching steps.
3. **Practice afterward**
   - One repeatable suggestion that reinforces the same target.
4. **Practice page**
   - The existing material preview card and **Print it** action.

The generated teaching steps and worksheet may use the child's age, interests,
homeschool style, and current subject context. The automatic worksheet uses no
family material, photo, image, or CSS image reference. It must stay aligned to
the deterministic target.

### Keep and handoff

The ready worksheet remains a draft until the authenticated account owner
chooses **Keep in Binder**. Keep finalizes only the worksheet attached to this
lesson. Token viewers and invited family members do not receive the control.

After Keep, the page confirms **Kept in Binder** and offers:

- **Message HOMA about this lesson**, which opens chat; and
- **Open phone settings** only when the family has no linked phone.

Phone setup remains optional. The lesson stays at its permanent report link.
A later report with a different deterministic target makes the saved lesson
historical and offers **Build the next lesson** for the new target.

### Failure and retry

If lesson content exists but the worksheet fails, the page keeps the content
visible and says:

> The lesson is saved. The practice page did not finish. Try the page again.

If neither part finishes, the page keeps the request and target visible and
says:

> That did not finish. Your lesson request is saved. Try again.

Retries are explicit. A retry reuses any already-saved content or attached
material and builds only what is missing.

## Target selection

Target selection is deterministic code, not model judgment.

Extract the existing first-unconfirmed-skill logic from
`buildFourWeekPlan()` in `packages/core/src/map/plans.ts` into one shared pure
selector. Both the legacy internal plan builder and the new lesson builder may
call that selector.

For one subject, the selector:

1. loads the subject's reviewed map items in age order;
2. finds the strongest confirmed starting line;
3. finds the first unconfirmed item above that line;
4. respects a named `not_yet` frontier when nothing lower is confirmed; and
5. returns the target item id and reviewed statement.

When every bank item is confirmed, the selector returns a reviewed
subject-depth target instead of inventing a higher benchmark.

The lesson snapshots:

- target item id when one exists;
- target statement;
- strongest confirmed starting line when one exists;
- report generation timestamp;
- map bank version; and
- a stable source fingerprint derived from the target plus only the single
  effective floor-determining confirmation, or the lowest relevant `not_yet`
  when no confirmation exists.

The model receives these values as facts. It may explain and teach the target.
It may not replace the target, invent a score, or promise a score increase.

## Durable data model

Add an additive `public.subject_lessons` table. Do not overload
`public.child_plans`, whose uniqueness, progress map, retest fields, and JSON
shape represent four-week plans.

Each lesson row stores:

- `id`;
- `child_id`;
- `subject_id`;
- `target_item_id`, nullable only for a reviewed depth target;
- `target_statement`;
- `starting_line`;
- `source_report_generated_at`;
- `source_fingerprint`;
- `bank_version`;
- `content` JSON containing title, materials, ordered steps, and practice;
- `build_status`: `queued`, `running`, `ready`, or `failed`;
- `build_phase`: `starting`, `writing_lesson`, `making_worksheet`, or
  `reviewing_worksheet`;
- `attempt_count`;
- `idempotency_key`;
- `runtime_session_id`;
- `material_id`, referencing `public.materials`;
- `error_code`;
- `superseded_at`;
- `created_at`; and
- `updated_at`.

Build status describes whether Homa finished the lesson package. Worksheet
approval remains the existing material `draft` to `final` transition.

A partial unique index permits only one non-superseded lesson per child and
subject. A unique idempotency key for child, subject, and source fingerprint
makes repeated taps reopen the same build. A later report whose relevant facts
produce the same fingerprint keeps the current lesson instead of rebuilding it.

When a new report changes the target, one transaction supersedes the previous
current lesson and inserts or reuses the row for the new target. Historical
rows remain readable.

`subject_lessons` is server-readable only. Permanent-token and authenticated
owner routes return bounded projections from mapDb. Authenticated Data API
material reads hide lesson-linked drafts and superseded rows, while final
lesson worksheets remain visible in Binder. No client or model chooses a
family.

## Build initiation and access

Building a worksheet is a billable side effect and must never happen from an
unauthenticated GET request.

Use an owner-aware subject lesson action that follows the existing month-button
pattern:

1. The client supplies child and subject identifiers.
2. The server derives the family from the authenticated session.
3. The server re-scopes the child to that family.
4. The server verifies the subject and current report target.
5. The server applies the `lesson` billing-door decision.
6. The server claims or reuses the idempotent lesson row.
7. The server starts one background Eve session.
8. The server returns the canonical lesson URL.

A finished lesson page may be read through the permanent report token, matching
the current shareable plan behavior. A token-only viewer cannot start, retry,
Keep, or otherwise mutate a lesson.

## Background Eve build

Use a dedicated dispatch-style Eve channel and task-mode session. Eve already
provides the repository's durable workflow runtime. Do not introduce a second
Vercel Workflow abstraction, use an Eve subagent to pretend a turn is
backgrounded, or rely on `after()` for image generation and rendering.

The lesson row is the run record. Do not reuse scheduled
`homa_task_runs`, because a lesson build has product-specific state and is not
a recurring delivery task.

The starter:

1. atomically claims a queued or explicitly retryable row;
2. records `running`, attempt count, and claim time;
3. starts a task-mode Eve session with trusted `familyId`, `childId`,
   `lessonId`, and channel kind;
4. stores the runtime session id; and
5. returns after the separate session starts.

The channel, not the starter, owns terminal status. It marks the lesson ready
or failed from session events and reaps stale running rows through a bounded
recovery path.

A running row with a runtime session id never starts a second session. This
prevents a repeated tap or delivery retry from charging for duplicate work.

## Fleet skill and deterministic effects

Add a repo-authored `subject-lesson-builder` fleet skill. Its routing
description names the internal task intent. Its body owns the complete
procedure, quality bar, tool sequence, revision loop, and stop conditions.

The procedure:

1. read the trusted child, subject, target, and family context;
2. write one lesson with three to five teaching steps;
3. write one practice suggestion for the same target;
4. call a narrow lesson-content save effect;
5. load the existing `materials-studio` skill;
6. design an HTML-only worksheet with no image or reference path;
7. call `create_printable` with complete child, subject, skill, theme, and
   generation metadata;
8. inspect the visual-review result;
9. revise when the review reports a concrete problem; and
10. stop only when content is saved and one worksheet material is attached,
    or record an honest terminal failure.

Add only the smallest missing exact effects:

- save generated content to the lesson named in trusted session attributes;
- attach a returned material after re-scoping both lesson and material to the
  pinned family; and
- update lesson build phase and terminal status.

The model never supplies `familyId`. A model-supplied record id is re-scoped to
the session's lesson and family before every write.

The worksheet stays a draft. The background session must not call
`mark_material_final`, because only the parent's approval finalizes a family
material.

Automatic lesson worksheets use HTML only. They do not call image generation,
pass `pageImageUrl`, include image-bearing markup or data URLs, use CSS
`url(...)`, use navigation-capable markup such as meta refresh, base, iframe,
object, or embed, or use child photos and material previews. Chromium also
blocks every image request and every non-initial document or navigation
request for this channel; safe web-font resources remain available.

## Worksheet pipeline

Reuse the existing HTML materials pipeline end to end:

- `validatePrintableHtml` and the existing printable shell;
- `renderPrintableHtml`;
- `reviewArtifact`;
- `uploadMaterialArtifacts`;
- the existing `materials` row, metadata, lineage, and Binder;
- `MaterialCard` for preview and print; and
- existing `materials.*` events and model-usage recording.

The lesson stores only `material_id`. PDF and preview bytes remain in Blob.
The server stamps `materials.subject_lesson_id`; generation JSON is not trusted
as provenance. A durable effect receipt claims each initial worksheet or
review revision before render, review, or Blob upload.

Before that claim, the tool requires the exact trusted child id and name,
canonical `subjectId`, target statement as `skill`, and worksheet kind. The
display name is never normalized into storage (`art` remains `art`, while
`Art & creative` remains display copy only). Revision
preflight also requires the same family, lesson, child, subject, target,
eligible draft status, and current unbranched chain.

## Retention boundary

This slice is one direct path:

> report -> lesson + worksheet -> Keep -> Binder -> chat -> optional phone settings

The separate whole-child month remains unchanged. Subject lessons add no
planner item, check-off field, route, control, or event.

## Existing flow updates

Update every per-subject entry and payoff:

- permanent report subject card;
- founder report mirror;
- sample report;
- onboarding scoring status lines;
- wall-door copy and included-value copy;
- report and progress-card tests;
- admin family screen labels; and
- analytics naming.

Keep these paths unchanged:

- the report's whole-child month button;
- `MONTH_PLAN_SUBJECT`;
- month plan rendering;
- month progress check-offs;
- month retest cron and email;
- legacy subject-plan rendering; and
- internal four-week plan context used by curriculum generation.

## Billing, events, and usage

Add a distinct `lesson` action door. Its included-value copy promises the
lesson the parent tapped and its printable practice page. The `plan` door
continues to mean the whole-child four-week month.

Register the billable lesson action in the action-cost registry before the
feature flag can enable.

Add these typed events:

- `map.subject_lesson_requested`;
- `map.subject_lesson_started`;
- `map.subject_lesson_ready`;
- `map.subject_lesson_failed`;
- `map.subject_lesson_retried`; and
- `map.subject_lesson_kept`.

Worksheet creation continues to emit `materials.created` and review metadata.
Direct model usage continues through `model_usage` with authenticated family
attribution.

## Idempotency and recovery

The database claim happens before the Eve session starts.

Safe repeat behavior:

- repeated build taps return the current row and URL;
- a queued row may be claimed once;
- a running row with a session id is observed, never restarted;
- a ready row is returned unchanged;
- an explicit retry increments the attempt and builds only missing effects.

The first complete content save is write-once. Later attempts may reuse the
exact content but cannot replace it.

Each worksheet creation claims a durable receipt keyed by lesson id, attempt,
and `initial` or the revision source material id. A replay returns an attached
completed receipt or refuses uncertain in-flight work. An explicit parent Retry
opens a new attempt key.

The receipt records a created material before attachment and becomes completed
only after that exact material is attached. Recovery uses the server-stamped
lesson id, exact child, worksheet kind, valid status, nonempty URLs, and passing
or unavailable review.

Generic pinned material creation cannot revise a lesson-linked material.
Generic pinned finalization refuses any revision chain containing lesson
provenance. The direct owner Keep path passes the exact trusted lesson id and
accepts only a chain whose every row belongs to that lesson.

Pinned material find, show, and card reads hide every nonfinal lesson-linked
row. Ordinary drafts remain available to their existing generic workflows, and
final lesson worksheets remain reusable and visible in Binder. Subject lesson
lookup is final-only.

## Security and privacy

- Family identity comes from authenticated context or trusted Eve session
  attributes, never the client or model.
- Every child, lesson, and material id is re-scoped to that family.
- The permanent report token permits read-only access to a ready lesson.
- Token-only viewers cannot create model usage, Keep, or retry.
- Worksheet HTML passes the existing script, brand, copy, and footer gates.
- Automatic lesson worksheets have no image or reference path.
- No family details enter event properties, error codes, or logs.
- The background session's internal prompt and tool chatter do not enter the
  parent's conversation history or family recall.

## Rollout

Use `HOMA_SUBJECT_LESSONS_ENABLED` as the dedicated dark feature flag for the
subject lesson action. When false, code must not query `subject_lessons`, so a
dark deploy is safe before the production migration exists.

The safe order:

1. verify the migration, RLS, disabled code paths, and all required gates
   locally;
2. deploy code with the feature flag off;
3. wait for the Vercel deployment to become READY and probe the unchanged
   report, whole-child month, and legacy plan paths;
4. apply the additive production migration;
5. enable the flag in a preview environment and complete the authenticated
   generated-worksheet journey;
6. enable the flag in production;
7. probe the authenticated lesson, worksheet, Keep, Binder, chat handoff,
   optional phone settings, retry, shared-read, and sessionless-denial paths;
   and
8. keep the flag off if any production probe fails.

Rollback turns the feature flag off first. Existing lesson and material rows
remain durable. The whole-child month and legacy subject-plan reads continue
unchanged.

## Verification

### Pure and storage tests

- first-unconfirmed target selection across all scored subjects and ages;
- named `not_yet` frontier with no lower confirmation;
- all-items-confirmed depth fallback;
- stable source fingerprint;
- one current lesson per child and subject;
- repeated build idempotency;
- score-target change supersedes the previous current lesson;
- write-once content across attempts;
- durable initial and revision effect receipts;
- explicit retry reuses existing content and material;
- material recovery by server-stamped lesson provenance; and
- RLS and cross-family lesson, child, and material rejection.

### Agent and material tests

- positive skill routing for an internal subject lesson build;
- adversarial-negative routing for ordinary chat and unrelated materials;
- behavioral evaluation for target fidelity, three-to-five-step lesson shape,
  one practice suggestion, and no score promise;
- worksheet metadata names child, subject, skill, lesson, and source;
- visual-review failure causes a bounded revision;
- terminal ready requires saved content and an attached worksheet;
- no automatic finalization;
- HTML-only worksheet input; and
- no image, child-photo, or reference path.

### UI and integration tests

- subject-card build and open labels;
- mirror remains inert;
- sample report remains an onboarding door;
- sessionless and wrong-family build denial;
- queued, running, partial failure, failed, and ready lesson states;
- material preview and **Print it**;
- owner-only **Keep in Binder**;
- token viewers remain read-only;
- final and draft links disappear when the attached material is invalid;
- post-Keep chat handoff and optional phone settings; and
- the draft is visible on the lesson page, while Binder visibility follows
  existing parent approval.

### Required gates

- `pnpm typecheck`
- `pnpm lint`
- `pnpm check:isolation`
- `pnpm check:map`
- `pnpm check:events`
- `pnpm check:skills-targeting`
- `pnpm check:progress-ui`
- `pnpm build`
- `pnpm --filter web exec eve build`

Run the parent-facing words through `homa-copy-reviewer` and then
`homa-copy-editor`. Run the rendered subject card, lesson states, worksheet
card, Keep state, and handoff through `homa-uxui-reviewer`.

Run the affected authenticated browser journey with a real generated
worksheet. A route returning HTTP 200 is not sufficient evidence.
