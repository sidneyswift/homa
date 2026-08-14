import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";

import {
  judgeSubjectLessonTargetFidelity,
  runSubjectLessonWorkflowEval,
  SUBJECT_LESSON_QUALITY_MATRIX,
  subjectLessonQualityMatrixFindings,
  subjectLessonWorkflowCredentialBlocker,
} from "./workflow-harness";

export default defineEval({
  description:
    "The real Homa model builds five age- and subject-varied lesson worksheets, and a separate model reviewer verifies target fidelity with source-bound evidence.",
  tags: ["model-backed", "subject-lesson", "quality-matrix"],
  timeoutMs: 600_000,
  async test(t) {
    const blocker = subjectLessonWorkflowCredentialBlocker();
    if (blocker) t.skip(blocker);

    const findings: string[] = [];
    for (const qualityCase of SUBJECT_LESSON_QUALITY_MATRIX) {
      const result = await runSubjectLessonWorkflowEval("success", qualityCase);
      const review = await judgeSubjectLessonTargetFidelity(result);
      const caseFindings = subjectLessonQualityMatrixFindings(result, review);
      t.log(`${qualityCase.id}: ${JSON.stringify(review)}`);
      for (const finding of caseFindings) {
        t.log(`${qualityCase.id}: ${finding}`);
      }
      findings.push(
        ...caseFindings.map((finding) => `${qualityCase.id}: ${finding}`)
      );
    }
    t.check(findings, equals([]));
  },
});
