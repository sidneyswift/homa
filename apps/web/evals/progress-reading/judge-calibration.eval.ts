import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { readCanonicalChildMap } from "../../lib/map/canonical-explore";
import { PROGRESS_READING_CASES } from "./fixtures";
import { judgeProgressReading } from "./judge";

// Fixed, root-reviewed meanings calibrate the model judge independently of
// whichever wording the candidate model happens to produce in a later run.
const oldCorrect = "The calculation is from today. About 10 months ahead uses the catching answer from September 6, 2025, which Homa matched from what you shared. Today's galloping answer is already saved as Easily. Catching earns more skill-age credit, so that older answer still supports the number.";
const negativeCorrect = "There is no positive months-ahead number here. You directly shared today that she catches a big ball most of the time, marked Easily. The 58-month reference credited for that skill is earlier than her current age of 72 months. Skipping is saved as Not yet. This describes those saved skills, not a grade on her development.";
const capCorrect = "It is a display limit: At least 12 months ahead. You directly shared today that she catches a big ball most of the time, marked Easily. This one saved answer supports the reading. Its credited skill age is 58 months and her age is 36 months; the arithmetic difference is 22, while the capped display says at least 12. That arithmetic does not establish her exact developmental level, and the cap does not establish that harder questions ran out.";
const calibrations = [
  { id: "direct-report-paraphrase-valid", source: "positive-sparse", candidate: "About 10 months ahead comes from one saved answer: you shared today that Maya catches a big ball most of the time, marked Easily. That skill receives credit at 58 months compared with her age of 48 months. It does not mean she has mastered every movement skill or rank her against other children.", pass: true },
  { id: "old-evidence-current-calculation-valid", source: "old-inferred-winner", candidate: oldCorrect, pass: true },
  { id: "invented-source-wording-invalid", source: "old-inferred-winner", candidate: oldCorrect + " You never said the word catching or Easily yourself.", pass: false },
  { id: "invented-uncapped-cause-invalid", source: "old-inferred-winner", candidate: oldCorrect + " The display cap reduced the answer to 10.", pass: false },
  { id: "saved-not-yet-valid", source: "negative-frontier", candidate: negativeCorrect, pass: true },
  { id: "erases-saved-not-yet-invalid", source: "negative-frontier", candidate: negativeCorrect.replace("Skipping is saved as Not yet.", "Everything except catching is unanswered, including skipping."), pass: false },
  { id: "arithmetic-not-child-verdict-valid", source: "cap-with-harder-items", candidate: capCorrect, pass: true },
] as const;

export default calibrations.map(calibration => defineEval({
  description: `Progress explanation judge calibration: ${calibration.id}.`,
  tags: ["model-backed", "progress-reading", "judge-calibration"], timeoutMs: 150_000,
  async test(t) {
    if (!process.env.VERCEL_OIDC_TOKEN) { t.skip("Vercel OIDC unavailable."); return; }
    const testCase = PROGRESS_READING_CASES.find(value => value.id === calibration.source)!;
    if (!testCase.view || !testCase.comparison) throw new Error("Calibration needs a real canonical fixture");
    const toolResult = await readCanonicalChildMap({ familyId: "synthetic-eval-family", childId: testCase.view.childId,
      query: { query: "subject_map", subjectId: testCase.comparison.subjectId } }, { getView: async () => testCase.view });
    const judged = await judgeProgressReading({ parentRequest: testCase.prompt, receipt: testCase.comparison,
      toolResult, rubric: testCase.rubric, candidate: calibration.candidate, signal: t.signal, log: value => t.log(value) });
    t.log(JSON.stringify({ id: calibration.id, expected: calibration.pass, candidate: calibration.candidate, judge: judged.object, usage: judged.usage }));
    const { findings, quote, ...dimensions } = judged.object;
    t.check(calibration.candidate.includes(quote), equals(true));
    t.check(Object.values(dimensions).every(Boolean) && findings.length === 0, equals(calibration.pass));
  },
}));
