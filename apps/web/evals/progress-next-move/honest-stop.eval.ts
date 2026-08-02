import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  progressNextMoveBehaviorCredentialBlocker,
  progressNextMoveBehaviorFindings,
  runProgressNextMoveBehaviorEval,
} from "./behavior-harness";

export default defineEval({
  description:
    "The real model stops honestly when the bounded Progress context has no allowed target.",
  tags: ["model-backed", "progress-next-move"],
  timeoutMs: 120_000,
  async test(t) {
    const blocker = progressNextMoveBehaviorCredentialBlocker();
    if (blocker) t.skip(blocker);
    const result = await runProgressNextMoveBehaviorEval("honest_stop");
    const findings = progressNextMoveBehaviorFindings(result);
    t.log(`calls: ${result.calls.map((call) => call.name).join(" -> ")}`);
    t.log(`inputs: ${JSON.stringify(result.calls.map((call) => call.input))}`);
    for (const finding of findings) t.log(finding);
    t.check(findings, equals([]));
  },
});
