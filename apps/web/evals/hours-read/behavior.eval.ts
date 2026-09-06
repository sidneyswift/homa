import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import { credentialBlocker, runHoursBehaviorEval } from "./behavior-harness";
import { HOURS_READ_CASES } from "./fixtures";

/** Real model/tool interpretation, with an in-memory authenticated reader.
 * No t.send: this uses the same isolated direct-model seam as the existing
 * Progress/subject-lesson behavior evals, not the full hosted Eve tool fleet. */
export default HOURS_READ_CASES.map((testCase) => defineEval({
  description: `Hours read: ${testCase.id}.`,
  tags: ["model-backed", "hours-read"],
  timeoutMs: 165_000,
  async test(t) {
    const blocker = credentialBlocker();
    if (blocker) t.skip(blocker);
    const result = await runHoursBehaviorEval(testCase, t.signal);
    t.log(JSON.stringify(result));
    t.check(result.deterministicFindings, equals([]));
    t.check(result.semanticFindings, equals([]));
  },
}));
