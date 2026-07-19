# curriculum-studio routing evals

Behavioral fixtures for the agent-jobs / curriculum-studio capability
(agent-jobs primitive + `start_agent_job`, live in prod behind
`HOMA_AGENT_JOBS_ENABLED`). They run via eve's built-in `eve eval` discovery
(`apps/web/evals/evals.config.ts`), the same deterministic tool-assertion
pattern as `evals/materials-studio` and `evals/research-brief`.

Design source: the build-order stage "curriculum-studio skill v0 +
five-fixture eval" in
`docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html`.

| # | File | What it pins |
|---|------|--------------|
| 1 | `full-program-start-routing.eval.ts` | Positive / anti-refusal: a whole-program ask loads `curriculum-studio` and calls `start_agent_job`, and does not fall back to `create_task`. This is the exact bug the feature fixed (Homa used to refuse and call no tool). |
| 2 | `one-page-adjacent-negative.eval.ts` | Over-trigger guard: a single worksheet stays a `materials-studio` one-off and never starts a job. |
| 3 | `recurring-reminder-negative.eval.ts` | Boundary guard: a recurring reminder fires `create_task`, not `start_agent_job`. |
| 4 | `premature-start-guard.eval.ts` | Two-turn confirm-first: turn one drafts the shape with no start, turn two starts exactly one job with a sane `total_stages`. |
| 5 | `build-session-reliability.eval.ts` | Deferred and skipped. See below. |

Fixture (5) from the plan, a plan-parses assertion against the skill's
`JOB_CONTRACTS` schema, is folded into the two positive fixtures (1 and 4) as
a **soft** assertion rather than a separate file. It checks that the `plan`
the model hands `start_agent_job` validates against `curriculum-studio`'s
`planSchema` (the same shape `startJob` enforces server-side). It is soft
because the plan shape is model-produced: a miss is a signal that the skill
should spell out the plan fields (`pacing`, `weeks`,
`scopeAndSequence[{block, focus}]`), which are currently not documented to the
model, not a reason to fail the routing suite.

## Why fixture 5 (build session) is deferred

The build session runs on the `agent-job` channel with runner-stamped
job-worker auth attributes, and `report_agent_job_stage` refuses any session
that lacks them (`refuseNonJobWorkerSession`, `lib/jobs/guard.ts`). The eve
eval driver (`t.send` / `SendTurnPayload`) can attach only ephemeral
`clientContext` to a turn; it cannot set a session's channel or auth
attributes, so it cannot produce a faithful job-worker session. That is the
plan's own gate for this fixture ("assert it if the harness can seed a
job-worker session, otherwise document why").

The available follow-up is a model-backed harness that calls the real model
with stubbed tools (the `evals/subject-lesson-builder/workflow-harness.ts`
pattern): seed `buildStageBrief`, stub `load_skill` / `create_printable` /
`report_agent_job_stage`, and grade the recorded call order. It is
model-and-credential dependent and bypasses the channel guard by construction,
so it is left out of this routing-focused pass.
