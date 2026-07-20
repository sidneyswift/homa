/**
 * Materials-studio decision scorecard: runs the customer-shaped scenario
 * suite through the decision harness (real model, real skill package,
 * stubbed tools; see apps/web/evals/materials-studio/studio-harness.ts)
 * and writes a dated markdown scorecard with every check and the full
 * decision trace, so a reviewing agent can see exactly where the skill
 * failed and iterate.
 *
 * Two grading layers: deterministic checks (routing, recipe reads, anchor,
 * thrash) as the objective gate, and an LLM judge scoring "delighted first
 * try" with the single most useful skill fix.
 *
 * Usage:
 *   pnpm evals:materials-studio                 # deterministic + judge
 *   pnpm evals:materials-studio -- --scenario activity-pack-space-theme
 *   pnpm evals:materials-studio -- --no-judge   # objective gate only, cheaper
 *
 * Needs the AI Gateway (apps/web/.env.local), like pnpm materials:calibrate.
 * Costs real model tokens (one scenario call plus one judge call each, no
 * images). Out of band by design, never CI. Reports land in
 * docs/homa-planning/materials/evals/.
 */
import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Env may arrive from the shell.
}

const { STUDIO_SCENARIOS } = await import(
  "../apps/web/evals/materials-studio/scenarios"
);
const { runStudioScenario, gradeStudioTrace } = await import(
  "../apps/web/evals/materials-studio/studio-harness"
);
const { judgeStudioTrace } = await import(
  "../apps/web/evals/materials-studio/judge"
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const runJudge = !process.argv.includes("--no-judge");
const onlyScenario = argValue("--scenario");
const scenarios = onlyScenario
  ? STUDIO_SCENARIOS.filter((scenario) => scenario.id === onlyScenario)
  : STUDIO_SCENARIOS;
if (scenarios.length === 0) {
  console.error(
    `No scenario named "${onlyScenario}". Known: ${STUDIO_SCENARIOS.map((s) => s.id).join(", ")}`,
  );
  process.exit(2);
}

const date = new Date().toISOString().slice(0, 10);
const reportDir = path.join(repoRoot, "docs/homa-planning/materials/evals");
mkdirSync(reportDir, { recursive: true });

const lines: string[] = [
  `# Materials-studio decision scorecard, ${date}`,
  "",
  "Decision-harness run: real model, real skill package, stubbed tools.",
  "Grades the decisions (format, recipe reads, anchor, theme, thrash),",
  "not rendered image quality; the admin bench owns that.",
  "",
];

let passCount = 0;
let failCount = 0;
let delightedCount = 0;
let judgedCount = 0;
const skillFixes: string[] = [];

for (const scenario of scenarios) {
  process.stdout.write(`running ${scenario.id}... `);
  try {
    const trace = await runStudioScenario(scenario);
    const checks = gradeStudioTrace(scenario, trace);
    const failed = checks.filter((check) => !check.pass);
    passCount += checks.length - failed.length;
    failCount += failed.length;
    const verdict = runJudge ? await judgeStudioTrace(scenario, trace) : null;
    if (verdict) {
      judgedCount += 1;
      if (verdict.delightedFirstTry) delightedCount += 1;
      if (verdict.skillFix && verdict.skillFix.toLowerCase() !== "none") {
        skillFixes.push(`${scenario.id}: ${verdict.skillFix}`);
      }
    }
    console.log(
      `${failed.length === 0 ? `checks PASS (${checks.length})` : `checks FAIL ${failed.length}/${checks.length}`}` +
        (verdict ? ` · judge ${verdict.score}/5${verdict.delightedFirstTry ? " keeper" : ""}` : ""),
    );

    lines.push(`## ${scenario.id}`, "", `Request: "${scenario.request}"`, "");
    if (verdict) {
      lines.push(
        `Judge: ${verdict.delightedFirstTry ? "KEEPER first try" : "would need a round trip"} · score ${verdict.score}/5 · customization ${verdict.customization}`,
        `- Went wrong: ${verdict.wentWrong}`,
        `- Skill fix: ${verdict.skillFix}`,
        "",
      );
    }
    for (const check of checks) {
      lines.push(`- ${check.pass ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
    }
    lines.push(
      "",
      `Files read: ${trace.filesRead.join(", ") || "none"}`,
      `Anchors: ${trace.anchorsUsed.join(", ") || "none"}`,
      `Builds: ${trace.buildCount}`,
      "",
      "<details><summary>Image prompts</summary>",
      "",
      ...trace.imagePrompts.map((prompt) => `> ${prompt.slice(0, 500)}`),
      "",
      "</details>",
      "",
      "<details><summary>Final reply to parent</summary>",
      "",
      `> ${trace.text.slice(0, 800).replaceAll("\n", "\n> ")}`,
      "",
      "</details>",
      "",
    );
  } catch (error) {
    failCount += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`ERROR: ${message}`);
    lines.push(`## ${scenario.id}`, "", `- ERROR  harness run failed: ${message}`, "");
  }
}

lines.push(
  "---",
  "",
  `Deterministic checks: ${passCount} passed, ${failCount} failed.`,
);
if (judgedCount > 0) {
  lines.push(
    `Judge: ${delightedCount}/${judgedCount} keepers on the first try.`,
    "",
    "## Skill fixes to iterate on",
    "",
    ...(skillFixes.length > 0
      ? skillFixes.map((fix) => `- ${fix}`)
      : ["- none: the judge found nothing to change"]),
  );
}
const reportPath = path.join(reportDir, `${date}-decision-scorecard.md`);
writeFileSync(reportPath, lines.join("\n") + "\n");
console.log(`\nScorecard: ${reportPath}`);
console.log(
  `Deterministic: ${passCount} passed, ${failCount} failed.` +
    (judgedCount > 0 ? ` Judge: ${delightedCount}/${judgedCount} keepers.` : ""),
);
process.exit(failCount > 0 ? 1 : 0);
