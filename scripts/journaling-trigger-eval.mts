/**
 * The journaling-trigger eval: does Homa actually call
 * manage_child_progress when a mother tells her something about her
 * child?
 *
 * This measures the stage that failed silently in production. Every
 * layer below it is well tested (matcher, ledger, scoring, surfacing),
 * and none of that mattered while the model simply never opened the
 * door: Story's family messaged daily for nine days and produced zero
 * progress operations. PR #79 rewrote the trigger wording with no way
 * to tell whether it helped. This is that instrument.
 *
 * The eval gives the model the REAL production instructions and the
 * REAL tool schema, plus decoy tools it might legitimately prefer
 * (remember, log_hours, create_printable, open_planner) so a "must
 * stay silent" case has somewhere honest to go. It then asserts on the
 * TOOL CALLS, never on the reply text: an agent that answers warmly
 * and records nothing is exactly the failure being measured.
 *
 * The loop is result-fed: every tool returns a result and the model may
 * take further steps after reading it, the way a production turn does.
 * The journal result is built through the production schema, hours
 * reminder included, because the hours law is enforced as a
 * deterministic note ON the journal result rather than as instruction
 * prose (prose left log_hours uncalled on ~90% of duration-bearing
 * recaps, 2026-07-25). A single-completion harness could only ever
 * observe same-step co-calls and would measure that note as zero by
 * construction. Assertions therefore span the calls of ALL steps.
 *
 * Modes:
 *   --check-fixtures   free, deterministic, CI-safe. Validates fixture
 *                      integrity (ids unique, children resolvable,
 *                      both outcomes represented, prod cases present).
 *   (default)          the paid run: one short agent loop per fixture.
 *
 * Usage:
 *   pnpm check:journaling-trigger   (fixtures only, runs in CI)
 *   pnpm eval:journaling-trigger    (real model calls)
 */

import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import {
  generateText,
  stepCountIs,
  tool,
} from "../apps/web/node_modules/ai/dist/index.js";
import { z } from "../apps/web/node_modules/zod/index.js";

import { manageChildProgressToolInputSchema } from "../apps/web/lib/child-progress/tool-contract";
import {
  JOURNAL_HOURS_PROGRESS_NOTE,
  manageChildProgressResultSchema,
  REFUSED_PROGRESS_NOTE,
} from "../apps/web/lib/child-progress/tool-result-contract";
import { HOMA_MODEL } from "../apps/web/agent/model";
import {
  JOURNALING_TRIGGER_FIXTURES,
  TRIGGER_FAMILY,
  type TriggerFixture,
} from "./fixtures/journaling-trigger";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const checkFixturesOnly = process.argv.includes("--check-fixtures");

/**
 * Which channel's real instruction stack to compose. The journal rule
 * has one always-on home (instructions.md), but SMS and email turns
 * ride mode blocks on top of it, and a dedup of those blocks is only
 * gateable by an eval that actually renders them (2026-07-25; the web
 * hardcode measured the mode files as zero by construction).
 */
const channelArg =
  process.argv.find((arg) => arg.startsWith("--channel="))?.slice(10) ?? "web";
if (!["web", "sms", "email"].includes(channelArg)) {
  console.error(`Unknown --channel=${channelArg} (web, sms, email)`);
  process.exit(1);
}

/**
 * Fixture integrity, free and deterministic. This is what CI runs on
 * every PR: it cannot catch a model regression, but it does catch a
 * fixture that names a child who does not exist, a duplicate id, or a
 * corpus that quietly lost its adversarial half.
 */
function checkFixtures(): number {
  const problems: string[] = [];
  const seen = new Set<string>();
  const names = new Set(TRIGGER_FAMILY.map((child) => child.name));

  for (const fixture of JOURNALING_TRIGGER_FIXTURES) {
    if (seen.has(fixture.id)) problems.push(`duplicate id: ${fixture.id}`);
    seen.add(fixture.id);
    if (fixture.message.trim().length === 0) {
      problems.push(`${fixture.id}: empty message`);
    }
    if (fixture.note.trim().length === 0) {
      problems.push(`${fixture.id}: every fixture needs its reason`);
    }
    if (fixture.expect === "silent" && fixture.childNames.length > 0) {
      problems.push(`${fixture.id}: a silent case cannot expect a child`);
    }
    if (fixture.expect === "journals" && fixture.childNames.length === 0) {
      problems.push(`${fixture.id}: a journaling case must name a child`);
    }
    for (const name of fixture.childNames) {
      if (!names.has(name)) {
        problems.push(`${fixture.id}: unknown child "${name}"`);
      }
    }
  }

  const journaling = JOURNALING_TRIGGER_FIXTURES.filter(
    (f) => f.expect === "journals",
  ).length;
  const silent = JOURNALING_TRIGGER_FIXTURES.length - journaling;
  // Both halves matter. A corpus of only positives rewards a model
  // that journals everything, which fills the record with logistics.
  if (journaling < 5) problems.push("too few journaling fixtures");
  if (silent < 5) problems.push("too few silent fixtures");
  if (
    !JOURNALING_TRIGGER_FIXTURES.some((f) => f.childNames.length > 1)
  ) {
    problems.push("no multi-child fan-out fixture");
  }
  if (!JOURNALING_TRIGGER_FIXTURES.some((f) => f.source === "prod_chat")) {
    problems.push("no real production message in the corpus");
  }

  for (const problem of problems) console.error(`FIXTURE  ${problem}`);
  console.log(
    `fixtures: ${JOURNALING_TRIGGER_FIXTURES.length} total, ` +
      `${journaling} journaling, ${silent} silent, ` +
      `${problems.length} problems`,
  );
  return problems.length;
}

if (checkFixturesOnly) {
  process.exit(checkFixtures() === 0 ? 0 : 1);
}

try {
  loadEnvFile(
    process.env.HOMA_EVAL_ENV_FILE ??
      path.join(repoRoot, "apps/web/.env.local"),
  );
} catch {
  // CI or a shell may supply Gateway credentials directly.
}

const instructions = readFileSync(
  path.join(repoRoot, "apps/web/agent/instructions.md"),
  "utf8",
);

async function channelBlock(): Promise<string> {
  if (channelArg === "sms") {
    const { composeSmsModeMarkdown } = await import(
      "../apps/web/agent/instructions/sms-mode"
    );
    // The linked-family branch: a real family texting Homa.
    return composeSmsModeMarkdown({ familyId: "eval-family" });
  }
  if (channelArg === "email") {
    const { EMAIL_MODE_MARKDOWN } = await import(
      "../apps/web/agent/instructions/email-mode"
    );
    return EMAIL_MODE_MARKDOWN;
  }
  return "The current channel is web chat.";
}
const modeBlock = await channelBlock();

/** The family block Homa reads every turn, in its real shape. */
const familyContext = [
  "<family_context>",
  JSON.stringify(
    {
      family: { name: "The Swift family", parentName: "Alessa" },
      children: TRIGGER_FAMILY.map((child) => ({
        childId: child.id,
        name: child.name,
        age: child.ageLabel,
      })),
    },
    null,
    2,
  ),
  "</family_context>",
].join("\n");

function childNameFor(childId: string | undefined): string | undefined {
  return TRIGGER_FAMILY.find((child) => child.id === childId)?.name;
}

const JOURNAL_UNDO_TOKEN = "44444444-4444-4444-8444-444444444444";

/**
 * What record_journal_evidence hands back on a capture, built through
 * the production schema so this harness cannot drift from the
 * contract. The hours reminder rides every capture unconditionally;
 * whether the model then calls log_hours is exactly the judgment under
 * measurement.
 */
function journalToolResult(input: {
  action?: string;
  childId?: string;
}): unknown {
  const childName =
    input.action === "record_journal_evidence"
      ? childNameFor(input.childId)
      : undefined;
  if (!childName) {
    return manageChildProgressResultSchema.parse({
      kind: "refused",
      note: REFUSED_PROGRESS_NOTE,
    });
  }
  return manageChildProgressResultSchema.parse({
    kind: "progress_update",
    label: "Progress updated",
    childName,
    affectedTopics: ["Practices the skill the parent described"],
    undoAvailable: true,
    undoToken: JOURNAL_UNDO_TOKEN,
    note: JOURNAL_HOURS_PROGRESS_NOTE,
  });
}

/**
 * The real progress tool plus decoys. Without alternatives the model
 * has one lever and pulls it for everything, which would make the
 * silent cases meaningless. Every tool executes: a call that returned
 * nothing would end the loop and hide every follow-through behavior.
 */
const tools = {
  manage_child_progress: tool({
    description:
      "Manage one family's durable child progress evidence and check-ins.",
    inputSchema: manageChildProgressToolInputSchema,
    execute: async (input) =>
      journalToolResult(input as { action?: string; childId?: string }),
  }),
  remember: tool({
    description: "Save one durable fact about the family.",
    inputSchema: z.object({ fact: z.string() }),
    execute: async () => ({ saved: true }),
  }),
  // This decoy carries the production tool's real description
  // (agent/tools/log_hours.ts): a thinner one measurably changed the
  // behavior under test, stalling the model on "which child?" when the
  // real tool says hours may be family-wide and logged on mention.
  log_hours: tool({
    description:
      "Log a block of school time to the family's hours record the moment the parent mentions one ('we did 45 minutes of math'). These rows are the family's compliance evidence, so log every real mention exactly once. School time only: movies, errands, and waiting rooms never count. When the duration is vague ('most of the morning'), ask one short 'about how long?' first.",
    inputSchema: z.object({
      childId: z
        .string()
        .optional()
        .describe(
          "The child it was for. Omit for family-wide time like co-op.",
        ),
      subject: z.string(),
      minutes: z.number(),
    }),
    execute: async (input) => ({
      logged: true,
      done: true,
      subject: input.subject,
      minutes: input.minutes,
      note: "On the record. Mention it in one short natural aside; the running week total is there if it fits naturally.",
    }),
  }),
  create_printable: tool({
    description: "Build a worksheet or printable page for a child.",
    inputSchema: z.object({ childId: z.string(), skill: z.string() }),
    execute: async () => ({ queued: true }),
  }),
  open_planner: tool({
    description: "Open the family's planner board.",
    inputSchema: z.object({ childId: z.string().optional() }),
    execute: async () => ({ opened: true }),
  }),
};

interface TriggerOutcome {
  fixture: TriggerFixture;
  passed: boolean;
  detail: string;
}

async function runFixture(fixture: TriggerFixture): Promise<TriggerOutcome> {
  const result = await generateText({
    model: HOMA_MODEL,
    system: [instructions, modeBlock, familyContext].join("\n\n"),
    prompt: fixture.message,
    tools,
    // Enough steps for fan-out plus the follow-through the journal
    // result's note asks for, then the closing reply.
    stopWhen: stepCountIs(5),
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        tags: ["journaling_trigger_eval"],
      },
    },
  });

  // A follow-through call prompted by a tool result lands in a later
  // step, so every assertion reads the whole loop, not the final step.
  const toolCalls = result.steps.flatMap((step) => step.toolCalls ?? []);
  const journalCalls = toolCalls.filter(
    (call: { toolName: string; input?: { action?: string } }) =>
      call.toolName === "manage_child_progress" &&
      call.input?.action === "record_journal_evidence",
  );
  const journaledNames = journalCalls
    .map((call: { input?: { childId?: string } }) =>
      childNameFor(call.input?.childId),
    )
    .filter((name): name is string => name !== undefined);
  const otherTools = toolCalls
    .map((call: { toolName: string }) => call.toolName)
    .filter((name: string) => name !== "manage_child_progress");

  if (fixture.expect === "silent") {
    const passed = journalCalls.length === 0;
    return {
      fixture,
      passed,
      detail: passed
        ? otherTools.length > 0
          ? `stayed out of the record (used ${otherTools.join(", ")})`
          : "stayed out of the record"
        : `journaled ${journaledNames.join(", ") || "an unknown child"}`,
    };
  }

  const missing = fixture.childNames.filter(
    (name) => !journaledNames.includes(name),
  );
  const missingCompanion =
    fixture.alsoCallsTool !== undefined
    && !otherTools.includes(fixture.alsoCallsTool);
  const passed = missing.length === 0 && !missingCompanion;
  return {
    fixture,
    passed,
    detail: passed
      ? `journaled ${journaledNames.join(", ")}${fixture.alsoCallsTool ? ` + ${fixture.alsoCallsTool}` : ""}`
      : journalCalls.length === 0
        ? `no journal call (used ${otherTools.join(", ") || "no tools"})`
        : missing.length > 0
          ? `journaled ${journaledNames.join(", ")}, missing ${missing.join(", ")}`
          : `journaled ${journaledNames.join(", ")} but never called ${fixture.alsoCallsTool}`,
  };
}

const outcomes: TriggerOutcome[] = [];
for (const fixture of JOURNALING_TRIGGER_FIXTURES) {
  try {
    outcomes.push(await runFixture(fixture));
  } catch (error) {
    outcomes.push({
      fixture,
      passed: false,
      detail: `threw: ${error instanceof Error ? error.message : "unknown"}`,
    });
  }
}

for (const outcome of outcomes) {
  console.log(
    `${outcome.passed ? "PASS" : "FAIL"}  ` +
      `${outcome.fixture.expect.padEnd(8)} ${outcome.fixture.id.padEnd(22)} ` +
      `${outcome.detail}`,
  );
}

const journaling = outcomes.filter((o) => o.fixture.expect === "journals");
const silent = outcomes.filter((o) => o.fixture.expect === "silent");
const capture = journaling.filter((o) => o.passed).length;
const restraint = silent.filter((o) => o.passed).length;

console.log(`\nchannel   ${channelArg}`);
console.log(
  `capture   ${capture}/${journaling.length}` +
    ` (${Math.round((capture / journaling.length) * 100)}%)` +
    `  the mother told Homa something and it reached the record`,
);
console.log(
  `restraint ${restraint}/${silent.length}` +
    ` (${Math.round((restraint / silent.length) * 100)}%)` +
    `  Homa left the record alone when nothing was reported`,
);

process.exit(outcomes.every((outcome) => outcome.passed) ? 0 : 1);
