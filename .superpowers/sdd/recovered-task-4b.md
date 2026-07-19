# Recovered Task 4B: Eve subject lesson lane and fleet skill

## Result

Status: `DONE_WITH_CONCERNS`

The final reviewed Task 4B implementation is restored only in the isolated
worktree:

```text
/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/subject-lessons
```

No shared-checkout file was changed. No commit, push, deployment, migration
application, or environment-value change was performed.

## Recovered implementation

### Dedicated Eve channel

Created `apps/web/agent/channels/subject-lesson.ts` with:

- CRON_SECRET-protected health and start routes;
- strict UUID and explicit retry request validation;
- one task-mode Eve session per atomically claimed attempt;
- continuation token
  `subject-lesson:{lessonId}:attempt:{attempt}`;
- matching-attempt runtime session persistence;
- no parent delivery or conversation persistence;
- real started, ready, and failed event emitters; and
- channel-owned terminal status.

Every terminal `message.completed` outcome is handled:

```text
tool-calls      nonterminal, ignored
stop            recover attachment, then request ready
content-filter  fail with message_content_filter
error           fail with message_error
length          fail with message_length
other           fail with message_other
```

`turn.failed` and `session.failed` use the same bounded idempotent failure
finalizer.

### Replay-safe terminal transitions

`finishSubjectLessonRun` now returns the terminal row plus:

```text
transitioned: boolean
```

Only the call that atomically changes the matching attempt from running to
ready or failed returns true. Replays return the existing terminal row with
false. The channel emits ready or failed analytics only for true transition
receipts, so replay cannot duplicate terminal events.

### Store to dispatch adapter

Added `claimSubjectLessonSessionInput` to bridge Task 2 storage to Task 4A's
trusted dispatch interface. It:

- loads child and subject display facts through a family-scoped join;
- calls the existing atomic claim exactly once;
- preserves the matching attempt;
- reports whether complete lesson content already exists; and
- carries an existing material id for retry reuse.

### Filesystem-first fleet skill

Created:

```text
apps/web/agent/skills/subject-lesson-builder/SKILL.md
```

The skill requires:

- one saved lesson with three to five target-faithful steps;
- one target-faithful practice suggestion;
- immediate honest stop after a failed content save;
- `materials-studio` loading only after content succeeds;
- bounded family-material discovery before path selection;
- HTML, image-direct, or hybrid path choice;
- no automatic child photo or likeness reference;
- target-verbatim `create_printable.skill` metadata;
- target-verbatim generated-image prompts when image generation is used;
- visual-review-aware revision through `revisesId`;
- attachment only for passing or unavailable review;
- no `mark_material_final`; and
- no score promise using improve, raise, increase, boost, or guarantee.

The generic `find_materials` and `generate_image` affordances still accurately
say that previews and consented child photos are valid for ordinary
parent-requested materials. The subject lesson skill explicitly overrides
those affordances for this automatic internal lane.

### Routing and model-backed evals

Created positive and adjacent-negative routing fixtures plus:

```text
subject-lesson-builder/workflow-success
subject-lesson-builder/workflow-failure
```

The workflow harness uses Homa's production model with local tool stubs, so it
does not require the subject lesson table, Blob storage, image generation, or
material writes.

The deterministic grader inspects:

- every teaching step;
- the practice suggestion;
- printable request summaries;
- visible worksheet HTML after styles and headings are removed;
- every generated-image prompt;
- tool order and review revision;
- attached material identity;
- child-photo and likeness-reference use;
- finalization attempts;
- terminal honesty; and
- score promises.

Negative fixtures prove that a target phrase in a title cannot rescue an
unrelated exercise, score promises fail, and decorative unrelated image
prompts fail.

### Event staging

Removed only:

- `map.subject_lesson_started`
- `map.subject_lesson_ready`
- `map.subject_lesson_failed`

Still staged for Task 5:

- `map.subject_lesson_requested`
- `map.subject_lesson_retried`
- `map.subject_lesson_completed`

## Files created

- `apps/web/agent/channels/subject-lesson.ts`
- `apps/web/agent/skills/subject-lesson-builder/SKILL.md`
- `apps/web/evals/subject-lesson-builder/internal-build-routing.eval.ts`
- `apps/web/evals/subject-lesson-builder/adjacent-negative-routing.eval.ts`
- `apps/web/evals/subject-lesson-builder/workflow-harness.ts`
- `apps/web/evals/subject-lesson-builder/workflow-success.eval.ts`
- `apps/web/evals/subject-lesson-builder/workflow-failure.eval.ts`
- `apps/web/lib/subject-lessons/channel-run.ts`
- `apps/web/lib/subject-lessons/channel-run.test.ts`
- `apps/web/lib/subject-lessons/channel-contract.test.ts`
- `apps/web/lib/subject-lessons/skill-contract.test.ts`
- `apps/web/lib/subject-lessons/workflow-eval.test.ts`
- `.superpowers/sdd/recovered-task-4b.md`

## Files modified

- `apps/web/lib/subject-lessons/store.ts`
- `apps/web/lib/subject-lessons/store-contract.test.ts`
- `apps/web/evals/evals.config.ts`
- `scripts/events-check.mts`

## Verification

### Focused suite

```text
pnpm exec tsx --test \
  apps/web/lib/subject-lessons/dispatch-input.test.ts \
  apps/web/lib/family-context-security.test.ts \
  apps/web/lib/subject-lessons/channel-run.test.ts \
  apps/web/lib/subject-lessons/channel-contract.test.ts \
  apps/web/lib/subject-lessons/store-contract.test.ts \
  apps/web/lib/subject-lessons/skill-contract.test.ts \
  apps/web/lib/subject-lessons/workflow-eval.test.ts \
  packages/core/src/events.test.ts

tests 67
pass 67
fail 0
```

### Required gates

```text
pnpm check:fleet-skills
PASS

pnpm check:events
PASS

pnpm --filter web typecheck
PASS

pnpm --filter web lint
PASS with 0 errors and 1 pre-existing warning in
apps/web/lib/chat-history.ts

VERCEL=1 pnpm --filter web exec eve build
PASS

pnpm exec eve eval --list
PASS, all routing and workflow evals discovered

git diff --check
PASS
```

No em dash was found in the recovered Task 4B source, tests, skill, or eval
files.

## Concrete environment limits

### Real-model workflow run

The requested success and failure command ran, but both cases skipped because
the isolated worktree process has neither supported AI Gateway credential:

```text
AI_GATEWAY_API_KEY unset
VERCEL_OIDC_TOKEN unset

Results: 2 skipped
```

The evals are discoverable and their deterministic harness tests pass. No
environment value was added or changed.

### Additional stream-duration guard

The requested Eve build passed under `VERCEL=1`. The additional repository
stream-duration guard then failed because the installed Eve module in this
recovered worktree does not write `maxDuration: "max"` into the built
`eve/__server.func` configuration, even though the repository patch file still
contains that hunk.

This is outside Task 4B and was not modified. It must be reconciled with the
worktree's installed dependency state before any later push or deployment.
