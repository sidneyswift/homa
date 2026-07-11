/**
 * Live model eval for the weekday morning research brief contract.
 *
 * The deterministic validator proves the shape rules. This eval adds the
 * real producer skill and model, so prompt drift is caught before delivery.
 *
 * Usage: pnpm eval:research-brief
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateText } from "../apps/web/node_modules/ai/dist/index.js";

import { HOMA_MODEL } from "../apps/web/agent/model";
import { validateResearchBriefFormat } from "../apps/web/lib/tasks/research-brief-format";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Deployed and CI-like environments can supply gateway credentials directly.
}

const skill = readFileSync(
  path.join(repoRoot, "apps/web/agent/skills/research-brief/SKILL.md"),
  "utf8",
);

const fixturePrompt = `Compose one weekday morning research brief.

No top-up web search was performed during this run, so use the honest overnight tense.

Parent: Sidney
Child: Story, age 6
Family style: Montessori-inspired, hands-on, short lessons
Current work: Story is reading Bob Books and can sound out CVC words. Sidney wants blending to feel smoother without changing books.
Interest: drawing animals

Fresh knowledge-bank finding:
Topic: connected phonation for early phonics
Finding: Keeping the voice on between sounds can make blending easier because the child hears a continuous word rather than disconnected sound pieces. Stretchable sounds can be held, while stop sounds should be added quickly as the word grows.
Evidence: a current evidence review of beginning reading instruction and a phonics teaching guide.

Use only this supplied finding. Do not browse. Your response will be delivered exactly as written.`;

const result = await generateText({
  model: HOMA_MODEL,
  system: skill,
  prompt: fixturePrompt,
  maxRetries: 1,
  providerOptions: {
    gateway: {
      disallowPromptTraining: true,
      tags: ["research_brief_format_eval"],
    },
  },
});

const brief = result.text;
const validation = validateResearchBriefFormat(brief, {
  expectedTense: "overnight",
});
const learnedBlock = /^What I learned: (.+)$/mu.exec(brief)?.[1] ?? "";
const learnedFirstSentence =
  Array.from(
    new Intl.Segmenter("en", { granularity: "sentence" }).segment(
      learnedBlock,
    ),
  )[0]?.segment ?? "";
const sourceType =
  /\b(?:review|study|meta-analysis|research|guide|scope and sequence|paper|report|curriculum)\b/iu;
const negatedSourceType =
  /\b(?:no|neither|not|without)\b.{0,40}\b(?:review|study|meta-analysis|research|guide|scope and sequence|paper|report|curriculum)\b/iu;
const namesSourceType =
  sourceType.test(learnedFirstSentence) &&
  !negatedSourceType.test(learnedFirstSentence);
const errors = validation.ok ? [] : [...validation.errors];
if (!namesSourceType) errors.push("What I learned must name a source type");

console.log(brief);
if (errors.length > 0) {
  console.error("\nFormat errors:", errors);
  process.exit(1);
}

console.log("\nPASS  Morning research brief matches the approved format");
