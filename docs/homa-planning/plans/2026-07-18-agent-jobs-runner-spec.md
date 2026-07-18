# Agent-jobs runner: the remaining piece after stage 2

Stage 2 shipped the durable, tenant-safe **job primitive and its tool
surface**: the schema (`agent_jobs` + 3 sibling tables), the
`JOB_CONTRACTS` registry, the four lifecycle tools, the deterministic
state machine (`apps/web/lib/jobs/store.ts`), the `job.*` events, and the
`HOMA_AGENT_JOBS_ENABLED` flag. All of it is locally verified (typecheck,
lint, `check:jobs`, `check:events`, `check:isolation`, `check:fleet-skills`,
`eve build`).

What stage 2 deliberately did **not** build, because it can only be truly
verified against a deployment, is the **runner**: the loop that actually
executes each stage by having the model draft and render it. This file is
its exact blueprint so the next session builds it without re-deriving.

## What the runner is

A Postgres claim-lease loop, the same idiom as
`claimDueFamilyTasks` in `apps/web/lib/tasks/store.ts:189` (atomic
`update ... where ... for update skip locked`). It is NOT a second Vercel
Workflow runtime (the council killed that: eve owns the
`.well-known/workflow/` namespace; see the plan's §A4).

It runs on the existing hourly cron (`apps/web/agent/schedules/dispatch.ts`)
or a dedicated tighter schedule, and each tick:

1. **Claims** the next runnable stage of a runnable job, atomically, so
   concurrent cron instances never double-run a stage. Runnable job =
   `status in ('queued','running')` and `cancel_requested_at is null`.
   The claim predicate uses `agent_job_stages_runnable_idx`.
2. **Checks cancellation first.** If `cancel_requested_at is not null`,
   finalize the cancel (`status='cancelled'`, `cancelled_at=now()`), emit
   `job.cancelled`, and stop, do not run the stage. This is how the
   cooperative cancel in `cancelJob` completes.
3. **Expands the stage** from `agent_jobs.plan` at the current
   `plan_revision` if the stage row does not exist yet (lazy expansion),
   validating the derived `stagePayload` against the skill's contract.
   A `superseded` stage from a `revise_plan` is re-expanded from the new
   plan revision.
4. **Executes the stage** by starting an eve session that loads the job's
   skill and drafts + renders that one stage (for curriculum-studio: one
   week's packet via `create_printable`, reusing materials-studio craft).
   The stage's `payload` is the session's brief.
5. **Captures the result** into `agent_job_stages` (status
   `ready_for_review` if this is a review-gated stage, else `approved`)
   and writes any rendered material into `agent_job_stage_artifacts`
   (kind `material`, composite-FK scoped). Records metering
   (`sandbox_cpu_seconds`, `page_fetch_count`, `model_tokens`).
6. **Advances or gates.** Increments `current_stage`. If this was the
   first volume (gate-first-volume, plan §A2), set job `status='awaiting_input'`
   and stop until the parent approves via `respond_to_agent_job`. Otherwise
   continue. When the last stage is done, set `status='completed'`,
   `completed_at`, deliver the completion message, and link a
   `homa_task_runs` row (`kind='agent_job'`) into `completion_task_run_id`
   so it shows in `/app/tasks` history.
7. **Emits** `job.stage_completed` per stage and `job.completed` /
   `job.failed` at the end. These three are currently in
   `STAGED_EVENTS` (scripts/events-check.mts); the runner un-stages them by
   emitting them via `emitMapEvent`.

## Material capture: the design decision (verified against the code 2026-07-18)

Two facts settled this, both checked in-repo:

- eve exposes **no `tool.completed` event** to a channel. The channel event
  surface is message.appended/received/completed/metadata,
  turn.started/completed/failed, step.started/completed/failed, and
  session.started/completed/waiting/failed. A channel cannot passively grab
  a specific tool's (create_printable's) result.
- The `materials` row (`insertMaterialRowPinned`) carries no session_id and
  no job link, so the runner cannot reliably find "the material this session
  just made" by querying after the fact.

**Decision: a job-worker report tool, not a create_printable change.** The
build session finishes a stage by calling a new `report_agent_job_stage`
tool (job-worker-only, refused outside an agent-job session by the existing
`refuseJobSpawnedSession` idiom, inverted) with the material id(s) it
produced. That tool links the `agent_job_stage_artifacts` rows and calls the
runner's stage transition (`recordStageBuilt`, keyed by jobId + stageNumber +
the session's resolved familyId). Rationale: it keeps the critical,
high-traffic create_printable path untouched, and makes stage completion an
explicit, auditable act rather than an inference. The trade: it depends on
the build session actually calling the report tool, which is exactly the
model behavior a behavioral eval and a live preview run must confirm before
the flag flips. If a turn ends with the stage still `in_progress` (the model
never reported), the channel's turn.completed handler calls `failStage`.

## The one genuinely new thing to build: a non-delivering session path

The council's blocking finding (plan §A4): the existing
`apps/web/agent/channels/dispatch.ts` `message.completed` handler SMS/emails
the parent the session's reply and closes a `homa_task_runs` row on **every**
turn end. Reused as-is, a per-stage session would text the parent Homa's raw
drafting reply after every single week.

So the runner needs its **own** session mechanism that does NOT auto-deliver
per stage:

- A dedicated channel (e.g. `apps/web/agent/channels/agent-job.ts`) whose
  completion handler writes the stage result into `agent_job_stages` /
  `agent_job_stage_artifacts` and emits `job.stage_completed`, and does
  **not** compose or send a parent message.
- Milestone delivery (finished volume, final completion) is a **separate,
  explicit** step that runs the existing milestone/continuity path
  (consulting `lib/conversation-continuity` so a job finishing while the
  parent is mid-conversation surfaces an open loop instead of double-texting).
- The channel must stamp a session attribute `channel: 'agent-job'` so
  `refuseJobSpawnedSession` (`apps/web/lib/jobs/guard.ts`) already blocks the
  runner's own sessions from starting or steering jobs (jobs cannot breed
  jobs). This guard is built and shipped; the channel just needs to set the
  attribute.

## Isolation / tenancy notes for the runner

- The runner writes through the server connection (`mapDb`), always
  re-scoping `family_id` from the job row it claimed, never model input,
  exactly like `lib/jobs/store.ts` already does.
- The runner resolves the family's rows into the session brief and writes
  result blobs into family artifacts; the session itself (and any future
  isolated worker) never receives family DB credentials. Root Homa treats
  session/worker output as untrusted (the F11 lesson).

## Rollout (unchanged from the plan)

Flag-gated, ChildProgress-style: keep `HOMA_AGENT_JOBS_ENABLED` off, deploy
the code, wait READY, apply the additive migration
(`20260718140000_agent_jobs.sql`), then enable the flag and probe a real
authenticated start / status / respond / cancel. The tools already refuse
cleanly while the flag is off, so the curriculum-studio SKILL.md and the
tools can ship before the flag flips without leading the model into a dead
call.
