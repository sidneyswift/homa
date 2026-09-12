/**
 * Byte ratchet on Homa's always-on agent context.
 *
 * The 2026-07-24 context-engineering audit found the always-on prompt
 * had grown by accretion (a 25-row router table, a mirrored materials
 * workflow, three restatements of the journal rule), and the 07-25
 * compression bought roughly 2k tokens back on every turn. Nothing then
 * stopped the creep from returning. This check does: each always-on
 * component gets its own byte budget, seeded from its measured size
 * plus about 3% slack, and CI fails when a component grows past it.
 *
 * Per-component budgets on purpose: one total would let the onboarding
 * preload (deliberately large) hide creep in the small blocks.
 *
 * When this fails you have two honest moves. Raise the budget constant
 * in the same PR with a reason in the commit message, or shrink the
 * file. Shrinking instructions.md or a mode block is a behavior change
 * and is separately gated by the live eval suite (journaling-trigger,
 * progress-check-in, and the eve routing evals, per the PR #143
 * precedent). Laws are never deletion candidates: both tool-honesty
 * rules, the Voice (binding) block, tenancy, and the no-diagnoses rule
 * stay whatever the byte count says.
 *
 * Measurement is pure: no defineDynamic handler runs, no database, no
 * telemetry. Mode modules export pure builders; the family block
 * renders the eval fixture rows through the real renderFamilyContext.
 *
 * Usage: tsx scripts/agent-context-budget-check.mts
 * Unit tests: scripts/agent-context-budget-check.test.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderOnboardingStageGuidance } from "../apps/web/lib/onboarding/stage-guidance";

import { EMAIL_MODE_MARKDOWN } from "../apps/web/agent/instructions/email-mode";
import { IOS_MODE_MARKDOWN } from "../apps/web/agent/instructions/ios-mode";
import { RESEARCH_MODE_MARKDOWN } from "../apps/web/agent/instructions/research-mode";
import {
  composeSmsModeMarkdown,
  type SmsModeAttributes,
} from "../apps/web/agent/instructions/sms-mode";
import { composeOnboardingModeMarkdown } from "../apps/web/lib/onboarding/onboarding-mode";
import { renderFamilyContext } from "../apps/web/lib/family-context";
import { evalFamilyFixtureRows } from "../apps/web/lib/family-context-eval-fixture";
import { WEB_MODE_MARKDOWN } from "../apps/web/agent/instructions/web-mode";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/**
 * Budgets in bytes: measured on 2026-07-25 (post-compression) plus
 * about 3% slack. Raising one requires a reason in the same PR.
 *
 * instructions.md 22_400 -> 25_600 on 2026-07-29, founder ruling
 * `copy-voice-memorable` (gh#413): the Voice section carries the register,
 * five never-cross floors, and five anti-slop rules, each with the worked
 * example that makes it executable at the moment of writing. It went from
 * 1,466 to 3,704 bytes after a trim pass; the rest of the file is unchanged.
 * The examples are the part that works (an ignored rule stated abstractly
 * produced two em dashes and four "behind" leaks in testing), so they are not
 * deletion candidates. Anything above 25,600 should shrink prose or split,
 * not ratchet again.
 */
// #1167: root budgets fall after workflow extraction. The automatic stage
// block has its own budget, including the failure fallback, so moving text
// cannot hide it from measurement.
export const CONTEXT_BUDGETS: Record<string, number> = {
  "instructions.md": 22_500,
  "family-context (eval fixture render)": 3_000,
  "sms-mode (largest branch)": 4_600,
  "email-mode": 450,
  "web-mode": 400,
  "ios-mode": 700,
  "research-mode": 3_700,
  // Raised from 28,000 on 2026-07-30 (PR #469). Nine measured walks in
  // one session added real, load-bearing content the ratchet is meant to
  // let through: the age-template planner's honesty rules, growingEdges
  // reveal guidance, and three separate verbatim-example production bugs
  // each fixed with its own dated citation. A compression pass first cut
  // ~2,970 bytes of genuine duplication (see git history same date); the
  // remainder is one fact or one scar per sentence, not padding. Next
  // pass that touches this file should look for split-worthy sections
  // before raising this further.
  "onboarding-mode (preloaded skill body)": 14_500,
  "onboarding-stage (all-stage fallback)": 21_000,
};

/**
 * The SMS block branches on session attributes; the budget covers the
 * largest branch so prose cannot hide in a corner of the state space.
 */
const SMS_BRANCH_FIXTURES: Array<SmsModeAttributes | undefined> = [
  undefined,
  { familyId: "f" },
  { familyId: "f", canInviteFamilyMembers: "true" },
  { smsSignupCandidate: "true" },
  { familySmsInviteState: "pending", familySmsInviteDecision: "accept" },
  { familySmsInviteState: "expired" },
  { familySmsInviteLookupFailed: "true" },
  { familySmsInviterConfirmationDecision: "confirm" },
  { familySmsInviterConfirmationLookupFailed: "true" },
];

/** Modules under agent/instructions/ that are deliberately not budgeted,
 * with the reason on the record. */
const EXEMPT_MODULES: Record<string, string> = {
  "family-context.ts":
    "measured through the family-context fixture render above; the module wires DB loading around renderFamilyContext",
  "onboarding-mode.ts":
    "measured through composeOnboardingModeMarkdown above; the module wires the raw-skill import around it",
};

const MEASURED_MODULES = new Set([
  "sms-mode.ts",
  "email-mode.ts",
  "web-mode.ts",
  "ios-mode.ts",
  "research-mode.ts",
]);

export interface MeasuredComponent {
  name: string;
  bytes: number;
}

export function measureComponents(): MeasuredComponent[] {
  const rawSkill = readFileSync(
    path.join(repoRoot, "apps/web/agent/skills/onboarding/SKILL.md"),
    "utf8",
  );
  const familyBlock = renderFamilyContext(evalFamilyFixtureRows());
  const smsLargest = Math.max(
    ...SMS_BRANCH_FIXTURES.map(
      (attributes) => composeSmsModeMarkdown(attributes).length,
    ),
  );
  const onboarding = composeOnboardingModeMarkdown(
    { channel: "web", onboardingActive: "true" },
    rawSkill,
  );
  return [
    { name: "onboarding-stage (all-stage fallback)", bytes: Buffer.byteLength(renderOnboardingStageGuidance(null), "utf8") },
    {
      name: "instructions.md",
      bytes: readFileSync(
        path.join(repoRoot, "apps/web/agent/instructions.md"),
        "utf8",
      ).length,
    },
    { name: "family-context (eval fixture render)", bytes: familyBlock.length },
    { name: "sms-mode (largest branch)", bytes: smsLargest },
    { name: "email-mode", bytes: EMAIL_MODE_MARKDOWN.length },
    { name: "web-mode", bytes: WEB_MODE_MARKDOWN.length },
    { name: "ios-mode", bytes: IOS_MODE_MARKDOWN.length },
    { name: "research-mode", bytes: RESEARCH_MODE_MARKDOWN.length },
    {
      name: "onboarding-mode (preloaded skill body)",
      bytes: onboarding?.length ?? 0,
    },
  ];
}

export function checkBudgets(
  components: MeasuredComponent[],
  budgets: Record<string, number>,
): string[] {
  const problems: string[] = [];

  for (const component of components) {
    const budget = budgets[component.name];
    if (budget === undefined) {
      problems.push(`no budget declared for component: ${component.name}`);
      continue;
    }
    if (component.bytes > budget) {
      problems.push(
        `${component.name} is ${component.bytes} bytes, over its ${budget}-byte budget. `
          + "Shrink it (behavior changes are gated by the live eval suite) or raise the budget in this PR with a reason. "
          + "Laws are never deletion candidates.",
      );
    }
  }

  const familyBlock = components.find((component) =>
    component.name.startsWith("family-context"),
  );
  // A broken fixture render collapses to the ~200-byte unavailable
  // fallback and would otherwise pass every budget forever.
  if (familyBlock !== undefined && familyBlock.bytes < 1_000) {
    problems.push(
      `family-context fixture render is only ${familyBlock.bytes} bytes; the fixture path looks broken (fallback-sized output)`,
    );
  }

  return problems;
}

export function checkModuleParity(moduleFiles: string[]): string[] {
  const problems: string[] = [];
  for (const file of moduleFiles) {
    if (!file.endsWith(".ts")) continue;
    if (MEASURED_MODULES.has(file)) continue;
    if (file in EXEMPT_MODULES) continue;
    problems.push(
      `agent/instructions/${file} is neither measured nor exempt; a new mode module cannot ship uncounted. `
        + "Add it to the budget table or the exempt list with a written reason.",
    );
  }
  return problems;
}

function isMain(): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined
    && path.resolve(entry) === fileURLToPath(import.meta.url)
  );
}

if (isMain()) {
  const components = measureComponents();
  for (const component of components) {
    const budget = CONTEXT_BUDGETS[component.name];
    console.log(
      `${String(component.bytes).padStart(7)} / ${String(budget ?? "?").padStart(7)}  ${component.name}`,
    );
  }
  const problems = [
    ...checkBudgets(components, CONTEXT_BUDGETS),
    ...checkModuleParity(
      readdirSync(path.join(repoRoot, "apps/web/agent/instructions")),
    ),
  ];
  for (const problem of problems) console.error(`FAIL  ${problem}`);
  if (problems.length > 0) process.exit(1);
  console.log("PASS  every always-on context component is inside its budget");
}
