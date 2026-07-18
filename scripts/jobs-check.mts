/**
 * Job-contract registry check (agent-jobs plan §A1). Two jobs, one exit
 * code, mirroring check:events for the event registry:
 *   1. Every JOB_CONTRACTS entry parses its OWN example (plan +
 *      stagePayload) and produces a non-empty describeStage line, so a
 *      contract can never carry a schema that does not accept the shape it
 *      claims to.
 *   2. Every entry resolves to a real fleet-skill package
 *      (apps/web/agent/skills/<skill>/SKILL.md), so a job skill and its
 *      procedure never drift apart.
 *
 * Usage: pnpm check:jobs   (tsx scripts/jobs-check.mts)
 */

import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { JOB_CONTRACTS } from "../apps/web/lib/jobs/contracts.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "apps/web/agent/skills");

const failures: string[] = [];
function report(label: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  (${detail})`}`);
  if (!ok) failures.push(label);
}

const skills = Object.keys(JOB_CONTRACTS);
report("registry has at least one job contract", skills.length > 0, "JOB_CONTRACTS is empty");

for (const skill of skills.sort()) {
  const contract = JOB_CONTRACTS[skill];

  const planResult = contract.planSchema.safeParse(contract.example.plan);
  report(
    `${skill}: example plan parses`,
    planResult.success,
    planResult.success ? "" : planResult.error.issues[0]?.message ?? "invalid",
  );

  const stageResult = contract.stagePayloadSchema.safeParse(contract.example.stagePayload);
  report(
    `${skill}: example stagePayload parses`,
    stageResult.success,
    stageResult.success ? "" : stageResult.error.issues[0]?.message ?? "invalid",
  );

  let described = "";
  try {
    described = contract.describeStage(contract.example.stagePayload);
  } catch (error) {
    described = "";
    report(
      `${skill}: describeStage runs`,
      false,
      error instanceof Error ? error.message : "threw",
    );
  }
  report(
    `${skill}: describeStage returns a non-empty line`,
    typeof described === "string" && described.trim().length > 0,
    `got ${JSON.stringify(described)}`,
  );

  report(
    `${skill}: respondSchema is present`,
    typeof contract.respondSchema?.safeParse === "function",
    "respondSchema is not a zod schema",
  );

  let hasPackage = false;
  try {
    hasPackage = statSync(path.join(skillsRoot, skill, "SKILL.md")).isFile();
  } catch {
    hasPackage = false;
  }
  report(
    `${skill}: resolves to a fleet-skill package`,
    hasPackage,
    `no apps/web/agent/skills/${skill}/SKILL.md`,
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.length} job-contract check(s) FAILED`);
  process.exit(1);
}
console.log(`\nAll job-contract checks passed (${skills.length} contract(s)).`);
