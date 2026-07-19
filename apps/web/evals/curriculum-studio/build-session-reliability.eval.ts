import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  buildSessionCredentialBlocker,
  buildSessionFindings,
  runBuildSessionEval,
} from "./build-session-harness";

/**
 * Fixture 5 of the curriculum-studio five-fixture eval
 * (docs/homa-planning/plans/2026-07-18-curriculum-studio-tweakable-plan.html,
 * build-order stage "curriculum-studio skill v0 + five-fixture eval").
 *
 * Build-session reliability. A background stage session, woken with
 * buildStageBrief (lib/jobs/session.ts), must build the stage's material with
 * create_printable and then finish it with report_agent_job_stage, in that
 * order, naming a material it actually built, and never messaging the parent.
 * report_agent_job_stage is the only way a stage finishes, so a session that
 * builds but never reports leaves the job wedged (handleUnreportedStage
 * retries then parks it), which is the failure this pins.
 *
 * Model-backed, so it skips without AI Gateway credentials, matching
 * evals/subject-lesson-builder/workflow-success.eval.ts. See
 * build-session-harness.ts for why this uses a direct model harness rather
 * than the eve eval driver.
 */
export default defineEval({
  description:
    "The real Homa model builds a stage's material and finishes the stage by reporting it, through local tool stubs.",
  tags: ["model-backed", "curriculum-studio"],
  timeoutMs: 120_000,
  async test(t) {
    const blocker = buildSessionCredentialBlocker();
    if (blocker) t.skip(blocker);

    const result = await runBuildSessionEval();
    const findings = buildSessionFindings(result);
    t.log(`calls: ${result.calls.map((call) => call.name).join(" -> ")}`);
    t.log(`terminal: ${result.text}`);
    for (const finding of findings) t.log(finding);
    t.check(findings, equals([]));
  },
});
