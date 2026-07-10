/**
 * Generates the two committed narrative fixtures through the REAL
 * pipeline (facts builder, report-writer prompt, gate) for the founder
 * read-aloud:
 *   1. Maya: the sample page's exact answer set (the public sample renders
 *      this fixture; it must be founder-reviewed content).
 *   2. The struggling kid: map-check golden kid 4, every base answer
 *      not_yet at 50 months. The hardest honest case; red-team fixture.
 *
 * Writes apps/web/app/onboarding/sample/narrative.fixture.ts and
 * scripts/fixtures/red-team-narrative.json, and prints both narratives to
 * stdout for the read-aloud. Run locally with gateway credentials
 * (AI_GATEWAY_API_KEY or a live VERCEL_OIDC_TOKEN in apps/web/.env.local):
 *   pnpm tsx scripts/map-narrative-fixtures.mts
 */

import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Fine when the vars arrive via the environment.
}

const { planQuestions, scoreMap, validateNarrative } = await import(
  "../packages/core/src/index"
);
type MapAnswer = import("../packages/core/src/index").MapAnswer;
type MapAnswerInput = import("../packages/core/src/index").MapAnswerInput;
const { buildReportFacts, allowedNumbersFrom, genderedPronounsAllowedFrom } = await import(
  "../apps/web/lib/map/narrative-facts"
);
const { generateReportNarrative } = await import("../apps/web/lib/map/narrative-generate");
const { REPORT_PROMPT_VERSION } = await import("../apps/web/agent/report-writer-version");
// Maya's answers: the same pinned list the sample page renders, so the
// narrative fixture and the sample numbers can never diverge.
const { SAMPLE_AGE_MONTHS, SAMPLE_ANSWERS, SAMPLE_PRIOR_ANSWERS } = await import(
  "../apps/web/app/onboarding/sample/sample-answers"
);

function mayaBirthMonth(): string {
  const now = new Date();
  const born = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - SAMPLE_AGE_MONTHS, 1));
  return `${born.getUTCFullYear()}-${String(born.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function generateFixture(label: string, input: Parameters<typeof buildReportFacts>[0], siblingNames: string[]) {
  const facts = buildReportFacts(input);
  const gateContext = {
    allowedNumbers: allowedNumbersFrom(facts),
    siblingNames,
    childName: input.childName,
    genderedPronounsAllowed: genderedPronounsAllowedFrom(facts),
    expectedSubjects: facts.subjects.map((subject) => subject.subjectId),
    expectedDrawers: facts.subjects
      .filter((subject) => subject.position !== "not_mapped")
      .map((subject) => subject.subjectId),
  };

  console.log(`\nGenerating ${label}...`);
  const generated = await generateReportNarrative(facts);
  const verdicts = validateNarrative(generated.value, gateContext);

  console.log(`\n===== ${label} (v${REPORT_PROMPT_VERSION}, ${generated.durationMs}ms, ${generated.tokensIn} in / ${generated.tokensOut} out) =====`);
  console.log(`\n--- note ---\n${generated.value.note}`);
  console.log(`\n--- subject lines ---`);
  for (const [id, line] of Object.entries(generated.value.subjects)) {
    console.log(`  ${id}: ${line}`);
  }
  console.log(`\n--- drawers ---`);
  for (const [id, text] of Object.entries(generated.value.drawers)) {
    console.log(`  ${id}: ${text}`);
  }
  if (verdicts.rejectedPieces.length > 0) {
    console.log(`\nGATE REJECTIONS (${label}):`, verdicts.rejected);
  } else {
    console.log(`\nGate: clean pass.`);
  }
  return { narrative: generated.value, gateContext, verdicts };
}

// ---------- 1. Maya (the sample page) ----------
const AGE = SAMPLE_AGE_MONTHS;
const mayaAnswers: MapAnswerInput[] = SAMPLE_ANSWERS;
const mayaScores = scoreMap(AGE, mayaAnswers);
const mayaPriorScores = scoreMap(AGE, SAMPLE_PRIOR_ANSWERS);
const monthAgo = new Date();
monthAgo.setDate(monthAgo.getDate() - 28);

const maya = await generateFixture(
  "Maya, 4y 2m, the sample kid",
  {
    childName: "Maya",
    birthMonth: mayaBirthMonth(),
    parentFirstName: "Sarah",
    interests: ["dinosaurs", "drawing"],
    helpWith: [],
    whatsWorkingByDomain: {},
    scores: mayaScores,
    answers: mayaAnswers,
    history: [{ scores: mayaPriorScores, generated_at: monthAgo.toISOString() }],
  },
  [],
);

// ---------- 2. The struggling kid (map-check golden kid 4) ----------
const strugglingAnswers: MapAnswerInput[] = planQuestions(AGE).map((plan) => ({
  itemId: plan.base.id,
  answer: "not_yet" as MapAnswer,
}));
const strugglingScores = scoreMap(AGE, strugglingAnswers);

const struggling = await generateFixture(
  "The struggling kid, 4y 2m, every base answer not_yet",
  {
    childName: "Riley",
    birthMonth: mayaBirthMonth(),
    parentFirstName: "Jordan",
    interests: ["trucks"],
    helpWith: ["reading"],
    whatsWorkingByDomain: {},
    scores: strugglingScores,
    answers: strugglingAnswers,
    history: [],
  },
  ["Casey"],
);

// ---------- Write fixtures ----------

const fixtureTs = `// GENERATED by scripts/map-narrative-fixtures.mts (prompt v${REPORT_PROMPT_VERSION}).
// Do not hand-edit: regenerate, then the founder re-reads (STOP 1 gate).
// The public sample page renders this narrative through the exact same
// ReportView path a live ready narrative uses; it never calls the model.

import type { ReportNarrative } from "@homa/core";

export const SAMPLE_NARRATIVE_PROMPT_VERSION = ${JSON.stringify(REPORT_PROMPT_VERSION)};

export const SAMPLE_NARRATIVE: ReportNarrative = ${JSON.stringify(maya.narrative, null, 2)};

/** The gate context this fixture was validated against (check:map re-runs it). */
export const SAMPLE_NARRATIVE_GATE_CONTEXT = ${JSON.stringify(maya.gateContext, null, 2)};
`;
writeFileSync(
  path.join(repoRoot, "apps/web/app/onboarding/sample/narrative.fixture.ts"),
  fixtureTs,
);

mkdirSync(path.join(repoRoot, "scripts/fixtures"), { recursive: true });
writeFileSync(
  path.join(repoRoot, "scripts/fixtures/red-team-narrative.json"),
  JSON.stringify(
    {
      promptVersion: REPORT_PROMPT_VERSION,
      narrative: struggling.narrative,
      gateContext: struggling.gateContext,
    },
    null,
    2,
  ),
);

console.log("\nWrote apps/web/app/onboarding/sample/narrative.fixture.ts");
console.log("Wrote scripts/fixtures/red-team-narrative.json");

if (maya.verdicts.rejectedPieces.length > 0 || struggling.verdicts.rejectedPieces.length > 0) {
  console.error("\nFIXTURE GATE REJECTIONS EXIST: iterate the prompt before committing.");
  process.exit(1);
}
