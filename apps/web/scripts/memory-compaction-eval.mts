import { loadEnvFile } from "node:process";

import { CASES, CHILD_NAMES, type CompactionCase } from "../evals/memory-compaction/fixtures";
import {
  proposeCompaction,
  validateMerge,
  validateSplit,
} from "../lib/learning/compact-memories";

/**
 * Measures the compaction JUDGMENT layer against real production language
 * (AGENTS.md "Models judge, code verifies", third corollary: deterministic
 * tests below the judgment prove nothing about whether judgment is any
 * good).
 *
 * validateMerge and validateSplit have 26 unit tests and would pass them
 * happily while the model proposed nothing useful, or proposed merging two
 * sisters. This scores what the model actually says about the sentences
 * families really wrote.
 *
 *   pnpm --filter web exec tsx scripts/memory-compaction-eval.mts
 *   pnpm --filter web exec tsx scripts/memory-compaction-eval.mts --runs 3
 *
 * Costs real tokens per case per run. Needs VERCEL_OIDC_TOKEN in
 * apps/web/.env.local (refresh with `vercel env pull`, they are short
 * lived). Needs no database.
 *
 * RATCHET, measured 2026-07-21 over four runs: 10 or 11 of 11, and
 * **0 unsafe proposals every time**. Hold both. The safety number is the
 * one that must never move: an unsafe proposal means the model reached to
 * merge across children or across kinds and only the validator stopped it.
 *
 * The floating case is Amalia's two letter rows (86 + 220 chars). Merging
 * them under the 300 cap is achievable, production did it at 213, but it
 * is tight enough that the model sometimes takes the prompt's own advice
 * to merge fewer entries rather than write one long one. A declined merge
 * costs 86 characters and is retried the next night.
 *
 * Deliberately NOT fixed by adding a "retire the subsumed row" operation.
 * Row 0 of that pair lists the letter g and row 1 does not, so retirement
 * would drop a real delta while looking tidy. Merging has to carry the
 * residue forward or not happen.
 */

try {
  loadEnvFile(".env.local");
} catch {
  // CI or preconfigured shells provide the env directly.
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
const runs = Number(argValue("--runs") ?? 1);

const nameToId = new Map(
  [...CHILD_NAMES.entries()].map(([id, name]) => [name.toLowerCase(), id]),
);

interface Result {
  name: string;
  pass: boolean;
  detail: string;
  unsafe: string[];
}

async function runCase(testCase: CompactionCase): Promise<Result> {
  const unsafe: string[] = [];
  let proposal;
  try {
    proposal = await proposeCompaction(testCase.rows, CHILD_NAMES, "eval-no-family");
  } catch (error) {
    return {
      name: testCase.name,
      pass: false,
      detail: `model call failed: ${error instanceof Error ? error.message : "unknown"}`,
      unsafe,
    };
  }

  const { merges, splits } = proposal.object;

  // Anything the validators refuse is a proposal the model should not have
  // made. Tracked separately from pass/fail: the gate held, but the
  // judgment layer reached for something it was not entitled to.
  for (const merge of merges) {
    const verdict = validateMerge(merge, testCase.rows);
    if (!verdict.ok && ["cross-child", "cross-kind"].includes(verdict.reason)) {
      unsafe.push(`merge rejected as ${verdict.reason}`);
    }
  }
  for (const split of splits) {
    const verdict = validateSplit(split, testCase.rows, nameToId);
    if (!verdict.ok && ["unknown-child", "duplicate-child"].includes(verdict.reason)) {
      unsafe.push(`split rejected as ${verdict.reason}`);
    }
  }

  if (testCase.expectNothing) {
    const applied =
      merges.filter((m) => validateMerge(m, testCase.rows).ok).length +
      splits.filter((s) => validateSplit(s, testCase.rows, nameToId).ok).length;
    return {
      name: testCase.name,
      pass: applied === 0,
      detail: applied === 0 ? "proposed nothing, correct" : `proposed ${applied} change(s)`,
      unsafe,
    };
  }

  if (testCase.expectMerge) {
    // Subset, not equality: every required index must land in ONE group.
    // See the note on expectMerge in the fixtures.
    const want = testCase.expectMerge;
    const hit = merges.some((m) => {
      if (!validateMerge(m, testCase.rows).ok) return false;
      const got = new Set(m.replaces);
      return want.every((index) => got.has(index));
    });
    return {
      name: testCase.name,
      pass: hit,
      detail: hit
        ? `merged [${want.join(",")}] into one group as required`
        : `expected [${want.join(",")}] in one group, got ${JSON.stringify(merges.map((m) => m.replaces))}`,
      unsafe,
    };
  }

  if (testCase.expectSplit) {
    const wanted = [...testCase.expectSplit.children].sort();
    const hit = splits.some((s) => {
      if (s.entry !== testCase.expectSplit!.entry) return false;
      if (!validateSplit(s, testCase.rows, nameToId).ok) return false;
      const got = s.parts.map((p) => p.childName.trim()).sort();
      return got.length === wanted.length && got.every((n, i) => n === wanted[i]);
    });
    return {
      name: testCase.name,
      pass: hit,
      detail: hit
        ? `split onto ${wanted.join(" + ")} as expected`
        : `expected split onto ${wanted.join(" + ")}, got ${JSON.stringify(splits)}`,
      unsafe,
    };
  }

  return { name: testCase.name, pass: false, detail: "fixture declares no expectation", unsafe };
}

let totalPass = 0;
let totalCases = 0;
let totalUnsafe = 0;

for (let run = 1; run <= runs; run += 1) {
  if (runs > 1) console.log(`\n########## RUN ${run} of ${runs} ##########`);
  // Sequential on purpose: the gateway rate-limits, and a run is small.
  for (const testCase of CASES) {
    const result = await runCase(testCase);
    totalCases += 1;
    if (result.pass) totalPass += 1;
    totalUnsafe += result.unsafe.length;
    console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.name}`);
    if (!result.pass) console.log(`        ${result.detail}`);
    for (const u of result.unsafe) console.log(`        UNSAFE: ${u}`);
  }
}

const pct = ((totalPass / totalCases) * 100).toFixed(0);
console.log(`\n${"=".repeat(60)}`);
console.log(`${totalPass}/${totalCases} (${pct}%)   unsafe proposals: ${totalUnsafe}`);
console.log(`${"=".repeat(60)}`);

if (totalUnsafe > 0) {
  console.error("\nAn unsafe proposal is a judgment failure even though the gate held.");
}
process.exit(totalPass === totalCases && totalUnsafe === 0 ? 0 : 1);
