/**
 * Materials-studio decision scorecard: runs the customer-shaped scenario
 * suite through the decision harness (real model, real skill package,
 * stubbed tools; see apps/web/evals/materials-studio/studio-harness.ts)
 * and writes a dated markdown scorecard with every check and the full
 * decision trace, so a reviewing agent can see exactly where the skill
 * failed and iterate.
 *
 * Usage:
 *   pnpm evals:materials-studio                 # full suite
 *   pnpm evals:materials-studio -- --scenario activity-pack-space-theme
 *
 * Costs real model tokens (one to three calls per scenario, no images).
 * Out of band by design, never CI. Reports land in
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

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

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

for (const scenario of scenarios) {
  process.stdout.write(`running ${scenario.id}... `);
  try {
    const trace = await runStudioScenario(scenario);
    const checks = gradeStudioTrace(scenario, trace);
    const failed = checks.filter((check) => !check.pass);
    passCount += checks.length - failed.length;
    failCount += failed.length;
    console.log(
      failed.length === 0
        ? `PASS (${checks.length} checks)`
        : `FAIL ${failed.length}/${checks.length}: ${failed.map((c) => c.name).join("; ")}`,
    );

    lines.push(`## ${scenario.id}`, "", `Request: "${scenario.request}"`, "");
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

lines.push("---", "", `Totals: ${passCount} checks passed, ${failCount} failed.`);
const reportPath = path.join(reportDir, `${date}-decision-scorecard.md`);
writeFileSync(reportPath, lines.join("\n") + "\n");
console.log(`\nScorecard: ${reportPath}`);
console.log(`Totals: ${passCount} passed, ${failCount} failed.`);
process.exit(failCount > 0 ? 1 : 0);
