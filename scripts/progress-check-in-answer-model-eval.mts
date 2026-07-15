/**
 * Model-level regression eval for SMS progress answer judgment.
 *
 * Deterministic code supplies the active check-in identity. This eval proves
 * Eve keeps the semantic half of the contract: map a bounded answer, clarify
 * a generic yes, and pause for a topic change.
 */

import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { generateText } from "../apps/web/node_modules/ai/dist/index.js";

import { LINKED_SMS_PROGRESS_GUIDANCE } from "../apps/web/lib/child-progress/instruction-guidance";
import { HOMA_MODEL } from "../apps/web/agent/model";

const repoRoot = path.dirname(
  path.dirname(fileURLToPath(import.meta.url)),
);
try {
  loadEnvFile(
    process.env.HOMA_EVAL_ENV_FILE ??
      path.join(repoRoot, "apps/web/.env.local"),
  );
} catch {
  // CI may supply Gateway credentials directly.
}

const instructions = readFileSync(
  path.join(repoRoot, "apps/web/agent/instructions.md"),
  "utf8",
);
const statement =
  "Maya tells you how many things are in a small group of 1 to 3 without counting them";
const labels = [
  "easily",
  "getting_there",
  "not_yet",
  "not_sure",
  "skip",
  "clarify",
  "topic_change",
] as const;
type JudgmentLabel = (typeof labels)[number];

const cases: ReadonlyArray<{
  message: string;
  expected: JudgmentLabel;
}> = [
  {
    message: "Yes up to 2",
    expected: "getting_there",
  },
  {
    message: "Yes",
    expected: "clarify",
  },
  {
    message: "Can we switch to a science activity instead?",
    expected: "topic_change",
  },
];

let failures = 0;
for (const testCase of cases) {
  const result = await generateText({
    model: HOMA_MODEL,
    system: [
      instructions,
      "The current channel is SMS.",
      LINKED_SMS_PROGRESS_GUIDANCE,
      [
        "For this evaluation only, return exactly one label and no other text:",
        labels.join(" | "),
        "Use clarify when the message does not establish a progress answer.",
        "Use topic_change when the parent asks to move away from the check-in.",
      ].join("\n"),
    ].join("\n\n"),
    prompt: [
      `Delivered check-in statement: ${JSON.stringify(statement)}`,
      `Current parent message: ${JSON.stringify(testCase.message)}`,
    ].join("\n"),
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        tags: ["progress_check_in_answer_eval"],
      },
    },
  });
  const actual = result.text
    .trim()
    .toLowerCase()
    .replace(/^[`"']+|[`"'.]+$/gu, "") as JudgmentLabel;
  const passed = actual === testCase.expected;
  if (!passed) failures += 1;
  console.log(
    `${passed ? "PASS" : "FAIL"}  expected=${testCase.expected} actual=${actual}`,
  );
}

process.exit(failures === 0 ? 0 : 1);
