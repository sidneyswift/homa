import { defineEval } from "eve/evals";

/**
 * Fixture 5 (build-session reliability) of the curriculum-studio five-fixture
 * eval, intentionally deferred and skipped.
 *
 * What it would assert: a background build session woken with
 * buildStageBrief (lib/jobs/session.ts) on the 'agent-job' channel builds the
 * stage with create_printable and then finishes it with
 * report_agent_job_stage, acting with tools only and never messaging the
 * parent.
 *
 * Why it is skipped, not written against this harness: the eve eval driver
 * (t.send / SendTurnPayload) can attach only ephemeral clientContext to a
 * turn. It cannot stamp a session's auth attributes, so it cannot put a
 * session on the 'agent-job' channel or give it the runner's job-worker
 * context. report_agent_job_stage guards exactly on those attributes
 * (refuseNonJobWorkerSession in lib/jobs/guard.ts) and would refuse any
 * session this harness can produce, so a faithful build-session run is not
 * expressible here. That matches the plan's own gate for this fixture:
 * assert it if the harness can seed a job-worker session with a specific
 * message, otherwise document why and ship the routing fixtures.
 *
 * The available alternative, if build-session coverage is wanted later, is a
 * model-backed harness that calls the real model directly with stubbed tools
 * (the pattern in evals/subject-lesson-builder/workflow-harness.ts): seed
 * buildStageBrief as the prompt, stub load_skill, create_printable, and
 * report_agent_job_stage, and grade the recorded call order. That bypasses
 * the channel guard by construction rather than exercising it, and it is
 * model-and-credential dependent, so it is left as a follow-up rather than
 * bundled into this routing-focused pass.
 */
export default defineEval({
  description:
    "Build-session stage reliability is deferred: the eval harness cannot seed a job-worker 'agent-job' session (see file comment).",
  async test(t) {
    t.skip(
      "The eve eval harness cannot stamp 'agent-job' channel job-worker auth attributes, which report_agent_job_stage requires. See the file comment for the model-backed alternative.",
    );
  },
});
