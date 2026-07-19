# curriculum-studio evals

Behavioral fixtures for the agent-jobs / curriculum-studio capability
(agent-jobs primitive + `start_agent_job`, live in prod behind
`HOMA_AGENT_JOBS_ENABLED`). They run via eve's built-in `eve eval` discovery
(`apps/web/evals/evals.config.ts`), the same tool-assertion pattern as
`evals/materials-studio` and `evals/research-brief`.

Design source: the build-order stage "curriculum-studio skill v0 +
five-fixture eval" in
`docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html`.

| # | File | What it pins |
|---|------|--------------|
| 1 | `full-program-start-routing.eval.ts` | Positive / anti-refusal: a whole-program ask loads `curriculum-studio` and calls `start_agent_job`, and does not fall back to `create_task`. The exact bug the feature fixed (Homa used to refuse and call no tool). |
| 2 | `one-page-adjacent-negative.eval.ts` | Over-trigger guard: a single worksheet stays a `materials-studio` one-off and never starts a job. |
| 3 | `recurring-reminder-negative.eval.ts` | Boundary guard: a recurring reminder fires `create_task`, not `start_agent_job`. |
| 4 | `premature-start-guard.eval.ts` | Two-turn confirm-first: turn one drafts the shape with no start, turn two starts exactly one job with a sane `total_stages`. |
| 5 | `build-session-reliability.eval.ts` | Model-backed: a build session woken with `buildStageBrief` builds the stage with `create_printable` then finishes it with `report_agent_job_stage`, in order, naming a material it built. |

Routing fixtures (1-4) drive the live agent through `t.send`. Fixture 5 is
model-backed and skips without AI Gateway credentials, matching
`evals/subject-lesson-builder/workflow-success.eval.ts`. `eve eval` is not
part of CI, so this is an on-demand suite that does not gate CI.

## Plan-parses gate (fixture 5 of the plan design)

The plan's plan-parses assertion is folded into the two positive fixtures (1
and 4) as a hard gate rather than a separate file. It checks that the `plan`
the model hands `start_agent_job` validates against `curriculum-studio`'s
`planSchema` through the exact `parseJobPlan` that `startJob` runs
server-side. An unparseable plan is not a style nit: it is a job that would
fail to start in production, so the gate has no false positives. The plan
shape (`pacing`, `weeks`, `scopeAndSequence[{block, focus}]`, optional
`curriculumKey`) is documented to the model in the skill's "Start the job"
section so it can produce a valid plan.

## Fixture 5: why a model-backed harness, not the eve driver

The build session runs on the `agent-job` channel with runner-stamped
job-worker auth attributes, and `report_agent_job_stage` refuses any session
that lacks them (`refuseNonJobWorkerSession`, `lib/jobs/guard.ts`). The eve
eval driver (`t.send` / `SendTurnPayload`) can attach only ephemeral
`clientContext` to a turn; it cannot set a session's channel or auth
attributes, so it cannot produce a faithful job-worker session. So fixture 5
stands in the worker's place directly with a `generateText` harness
(`build-session-harness.ts`): it seeds the real `buildStageBrief`, stubs
`load_skill` / `create_printable` / `report_agent_job_stage`, and grades the
recorded call order. This is the `subject-lesson-builder/workflow-harness.ts`
pattern; it exercises the model's build behavior, not the channel guard.
