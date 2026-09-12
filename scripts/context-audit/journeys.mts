import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WEB_MODE_MARKDOWN } from "../../apps/web/agent/instructions/web-mode";
import { renderFamilyContext } from "../../apps/web/lib/family-context";
import { evalFamilyFixtureRows } from "../../apps/web/lib/family-context-eval-fixture";
import { composeOnboardingModeMarkdown } from "../../apps/web/lib/onboarding/onboarding-mode";
import { renderOnboardingStageGuidance } from "../../apps/web/lib/onboarding/stage-guidance";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");
const skillRoot = "apps/web/agent/skills";
const skill = (name: string) => `${skillRoot}/${name}/SKILL.md`;
const ref = (name: string, file: string) => `${skillRoot}/${name}/references/${file}.md`;
const skillNames = readdirSync(path.join(root, skillRoot)).sort();

/** Fixed synthetic examples compare authored context, not production-family
 * data. Provider input usage in behavioral evals is the measurement that also
 * includes tool schemas, history and repeated steps. Never call this a token
 * count, an entire runtime prompt, or measured latency savings. */
export function contextJourneyReport() {
  const descriptions = skillNames.map((name) => {
    const description = read(skill(name)).match(/^description: (.+)$/m)?.[1];
    if (!description) throw new Error(`Missing description: ${name}`);
    return `${name}: ${description}`;
  }).join("\n");
  const common = [read("apps/web/agent/instructions.md"), WEB_MODE_MARKDOWN,
    renderFamilyContext(evalFamilyFixtureRows()), descriptions];
  const journeys = [
    { name: "ordinary-web", files: [] },
    { name: "reopen-material", files: [skill("materials-studio"), ref("materials-studio", "reopen-work")] },
    { name: "print-material", files: [skill("materials-studio"), ref("materials-studio", "review-and-delivery")] },
    { name: "revise-packet-page", files: [skill("materials-studio"), ref("materials-studio", "review-and-delivery"), ref("materials-studio", "html-and-packets")] },
    { name: "log-school-time", files: [skill("planner"), ref("planner", "capture-work"), ref("planner", "hours-identity")] },
    { name: "explain-progress", files: [skill("progress-reading")] },
  ].map(({ name, files }) => ({ name, files,
    authoredContextBytes: Buffer.byteLength([...common, ...files.map(read)].join("\n\n")),
    onDemandBytes: files.reduce((sum, file) => sum + Buffer.byteLength(read(file)), 0),
  }));
  const onboarding = composeOnboardingModeMarkdown({ channel: "web", onboardingActive: "true" }, read(skill("onboarding")))!;
  for (const [name, input] of [
    ["onboarding-family-setup", { record: null, children: [] }],
    ["onboarding-state-unavailable", null],
  ] as const) {
    const stages = renderOnboardingStageGuidance(input);
    journeys.push({ name, files: [skill("onboarding")],
      authoredContextBytes: Buffer.byteLength([...common, onboarding, stages].join("\n\n")),
      onDemandBytes: 0 });
  }
  return {
    scope: "Authored documents plus a synthetic family snapshot. Excludes tool schemas, other dynamic blocks, history and provider overhead. Bytes, not tokens or latency.",
    skillCount: skillNames.length,
    descriptionBytes: Buffer.byteLength(descriptions),
    journeys,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(contextJourneyReport(), null, 2));
}
