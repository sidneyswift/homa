/**
 * Measures the judgment step against the same real parent phrasings the
 * lexical matcher was measured on (AGENTS.md "Models judge, code
 * verifies": measure the judgment layer against real language, and
 * ratchet the number).
 *
 * Runs every corpus case through the production path, extraction plus
 * the deterministic gate, and reports the two numbers that matter:
 *
 *   recall     should-score cases that produced accepted claims
 *   precision  must-never-record cases that produced none
 *
 * The lexical matcher scores recall 4/14 (29%) with precision 6/6 on
 * this corpus. Anything below that is not an improvement, whatever it
 * feels like.
 *
 * Needs Gateway credentials (VERCEL_OIDC_TOKEN from `vercel env pull`,
 * or AI_GATEWAY_API_KEY). Usage:
 *   HOMA_EVAL_ENV_FILE=/path/to/prod.env pnpm eval:claim-extraction
 */

import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { ageInMonths } from "../packages/core/src/index";
import { JOURNAL_RECALL_CORPUS } from "../apps/web/lib/child-progress/journal-recall-corpus";
import { extractProgressClaims } from "../apps/web/lib/child-progress/claim-extraction";
import {
  validateProposedClaims,
  type ClaimChild,
} from "../apps/web/lib/child-progress/claim-validation";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(
    process.env.HOMA_EVAL_ENV_FILE ??
      path.join(repoRoot, "apps/web/.env.local"),
  );
} catch {
  // Credentials may already be in the environment.
}

/**
 * The corpus names children by first name only, so the roster gives
 * each one a stable id and a plausible age. Ages are chosen so every
 * case's true skill sits inside the gate's plausibility window: the
 * point here is to measure judgment, not to re-test the age rule that
 * claim-validation.test.ts already pins.
 */
const ROSTER: Record<string, { childId: string; birthDate: string }> = {
  Maya: { childId: "child-maya", birthDate: "2019-03-14" },
  Story: { childId: "child-story", birthDate: "2021-01-20" },
  Emma: { childId: "child-emma", birthDate: "2019-08-02" },
  Jordan: { childId: "child-jordan", birthDate: "2020-05-11" },
};
const FAMILY_ID = "00000000-0000-4000-8000-000000000000";
const now = new Date();

function rosterFor(childName: string): ClaimChild[] {
  const entry = ROSTER[childName];
  if (!entry) throw new Error(`corpus names an unrostered child: ${childName}`);
  return [
    {
      childId: entry.childId,
      name: childName,
      ageMonths: ageInMonths(entry.birthDate, now),
    },
  ];
}

interface Outcome {
  quote: string;
  want: string;
  source: string;
  scored: boolean;
  detail: string;
}

const outcomes: Outcome[] = [];
for (const testCase of JOURNAL_RECALL_CORPUS) {
  const children = rosterFor(testCase.childName);
  let scored = false;
  let detail = "";
  try {
    const proposed = await extractProgressClaims({
      familyId: FAMILY_ID,
      message: testCase.quote,
      children,
      surface: "journal",
    });
    const { accepted, rejected } = validateProposedClaims({
      message: testCase.quote,
      children,
      claims: proposed,
    });
    scored = accepted.length > 0;
    detail = scored
      ? accepted
          .map((claim) => `${claim.itemId}=${claim.answer}`)
          .join(", ")
      : rejected.length > 0
        ? `all rejected (${rejected.map((r) => r.reason).join(", ")})`
        : "no claims proposed";
  } catch (error) {
    detail = `threw: ${error instanceof Error ? error.message : "unknown"}`;
  }
  outcomes.push({
    quote: testCase.quote,
    want: testCase.want,
    source: testCase.source,
    scored,
    detail,
  });
}

for (const outcome of outcomes) {
  const ok =
    outcome.want === "scores" ? outcome.scored : !outcome.scored;
  console.log(
    `${ok ? "PASS" : "FAIL"}  want=${outcome.want.padEnd(8)} ` +
      `${outcome.quote.slice(0, 52).padEnd(54)} ${outcome.detail}`,
  );
}

const shouldScore = outcomes.filter((o) => o.want === "scores");
const shouldNotRecord = outcomes.filter((o) => o.want === "ignores");
const recalled = shouldScore.filter((o) => o.scored).length;
const respected = shouldNotRecord.filter((o) => !o.scored).length;

console.log(
  `\nrecall    ${recalled}/${shouldScore.length}` +
    ` (${Math.round((recalled / shouldScore.length) * 100)}%)` +
    `   lexical matcher baseline: 4/14 (29%)`,
);
console.log(
  `precision ${respected}/${shouldNotRecord.length}` +
    ` (${Math.round((respected / shouldNotRecord.length) * 100)}%)` +
    `   lexical matcher baseline: 6/6 (100%)`,
);

// The bar is the matcher it replaces: never fewer real reports captured,
// never more junk recorded.
const passed =
  recalled >= 4 && respected === shouldNotRecord.length;
process.exit(passed ? 0 : 1);
