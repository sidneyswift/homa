import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  runSubjectLessonWorkflowEval,
  subjectLessonWorkflowCredentialBlocker,
  subjectLessonWorkflowFindings,
} from "./workflow-harness";

export default defineEval({
  description:
    "The real Homa model stops honestly when the stubbed subject lesson content save fails.",
  tags: ["model-backed", "subject-lesson"],
  timeoutMs: 120_000,
  async test(t) {
    const blocker = subjectLessonWorkflowCredentialBlocker();
    if (blocker) t.skip(blocker);

    const result = await runSubjectLessonWorkflowEval("save_failure");
    const findings = subjectLessonWorkflowFindings(result);
    t.log(`calls: ${result.calls.map((call) => call.name).join(" -> ")}`);
    t.log(`inputs: ${JSON.stringify(result.calls.map((call) => call.input))}`);
    t.log(`terminal: ${result.text}`);
    for (const finding of findings) t.log(finding);
    t.check(findings, equals([]));
  },
});
