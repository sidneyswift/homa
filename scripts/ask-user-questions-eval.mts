/**
 * Routing eval for the choice card (agent/tools/ask_user_questions.ts).
 *
 * `--check-fixtures` never calls a model: it validates fixture hygiene and
 * is what CI runs. The default command runs one production-shaped call per
 * fixture with the REAL instructions and the REAL tool surface, and checks
 * only whether Homa reached for the card.
 *
 * Fidelity note, because it decides whether a result means anything: the
 * model is given every tool Homa actually has, with their real
 * descriptions, read from the eve build summary. Offering the choice card
 * alone would make a call look correct that only happened because nothing
 * else was on the table, which is the exact over-call this eval exists to
 * catch. Alternative tools carry a permissive schema and a stub result:
 * routing is decided on descriptions, and nothing here touches a database.
 *
 * Tool results are per-fixture and realistic: get_children returns that
 * family's actual roster, and a scenario's lookups return that scenario's
 * facts. An earlier version answered every lookup with "no result", which
 * biased the whole eval toward the card, because an agent that learns
 * nothing falls back on asking. Fixtures now teach Homa what production
 * would have taught her, so a positive and a negative are equally fair.
 */

import { readFileSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

import { generateText, tool, stepCountIs } from "../apps/web/node_modules/ai/dist/index.js";
import { z } from "../apps/web/node_modules/zod/index.js";

import { HOMA_MODEL } from "../apps/web/agent/model";
import askUserQuestionsDynamic from "../apps/web/agent/tools/ask_user_questions";
import {
  ASK_USER_QUESTIONS_FAILURE_MODES,
  ASK_USER_QUESTIONS_FIXTURES,
  DEFAULT_TOOL_RESULT,
  type AskUserQuestionsFixture,
} from "./fixtures/ask-user-questions";

const TOOL_NAME = "ask_user_questions";
const FIXTURE_CHECK_ARGUMENT = "--check-fixtures";
// Deliberately low: under the reluctant doctrine (founder ruling
// 2026-07-21) genuine card moments are rare, and inventing a third
// positive to hit a quota would encode a preference the product rejects.
const MIN_POSITIVES = 2;
const MIN_NEGATIVES = 6;
/** Enough turns to look something up and then decide. */
const MAX_STEPS = 6;
/** Runs per fixture. One sample from a sampled model is a coin flip, and
 * tuning a production prompt against n=1 chases noise. */
const DEFAULT_REPEATS = 3;

const instructionsUrl = new URL(
  "../apps/web/agent/instructions.md",
  import.meta.url,
);
const summaryUrl = new URL(
  "../apps/web/.eve/agent-summary.json",
  import.meta.url,
);

interface SummaryTool {
  name: string;
  description: string;
}

type DynamicSentinel = {
  events: Record<string, (event: unknown, ctx: unknown) => unknown>;
};

/** The real tool, resolved for a web turn (the only turn it exists on). */
function resolveChoiceTool(): { description: string; inputSchema: unknown } {
  // Under .mts the default export arrives nested behind ESM interop,
  // while a plain .ts import hands back the sentinel directly. Accept
  // both rather than pin the eval to one loader's shape.
  const imported = askUserQuestionsDynamic as unknown as
    | DynamicSentinel
    | { default?: DynamicSentinel };
  const sentinel =
    "events" in imported && imported.events !== undefined
      ? imported
      : (imported as { default?: DynamicSentinel }).default;
  if (!sentinel?.events?.["turn.started"]) {
    throw new Error(
      "ask_user_questions no longer exports a turn.started resolver: the channel gate changed shape",
    );
  }
  const resolved = sentinel.events["turn.started"](null, {
    channel: { kind: "channel:http", metadata: {} },
    session: { auth: { current: { attributes: { channel: "web" } } } },
  });
  if (!resolved) {
    throw new Error(
      "ask_user_questions did not resolve for a web turn: the channel gate changed",
    );
  }
  return resolved as { description: string; inputSchema: unknown };
}

function fixtureErrors(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  const positives = ASK_USER_QUESTIONS_FIXTURES.filter((f) => f.expect === "ask");
  const negatives = ASK_USER_QUESTIONS_FIXTURES.filter(
    (f) => f.expect === "no_ask",
  );

  for (const fixture of ASK_USER_QUESTIONS_FIXTURES) {
    if (seen.has(fixture.id)) errors.push(`duplicate fixture id: ${fixture.id}`);
    seen.add(fixture.id);
    if (fixture.message.trim().length === 0) {
      errors.push(`${fixture.id}: empty message`);
    }
    if (fixture.why.trim().length === 0) {
      errors.push(`${fixture.id}: every fixture states why, so a failure is readable`);
    }
    if (fixture.expect === "no_ask" && fixture.failureMode === undefined) {
      errors.push(
        `${fixture.id}: a negative names the over-call it defends against`,
      );
    }
    if (fixture.expect === "ask" && fixture.failureMode !== undefined) {
      errors.push(`${fixture.id}: failureMode belongs to negatives only`);
    }
  }

  if (positives.length < MIN_POSITIVES) {
    errors.push(`need at least ${MIN_POSITIVES} positives, found ${positives.length}`);
  }
  if (negatives.length < MIN_NEGATIVES) {
    errors.push(`need at least ${MIN_NEGATIVES} negatives, found ${negatives.length}`);
  }
  // Every documented over-call keeps a live defender. Deleting the last
  // fixture for a mode silently retires that protection.
  const covered = new Set(negatives.map((f) => f.failureMode));
  for (const mode of ASK_USER_QUESTIONS_FAILURE_MODES) {
    if (!covered.has(mode)) errors.push(`no negative fixture covers ${mode}`);
  }
  return errors;
}

function loadSummaryTools(): SummaryTool[] {
  const summary = JSON.parse(readFileSync(summaryUrl, "utf8")) as {
    tools: SummaryTool[];
  };
  return summary.tools.filter((entry) => entry.name !== TOOL_NAME);
}

/**
 * The alternative tools for ONE fixture, answering with that scenario's
 * facts. Homa is required to gather context before offering options, so
 * the turn has to be able to continue past a lookup; answering every
 * lookup with nothing would starve her into asking and quietly rig the
 * eval toward the card.
 */
function alternativeTools(
  summaryTools: readonly SummaryTool[],
  fixture: AskUserQuestionsFixture,
): Record<string, ReturnType<typeof tool>> {
  const tools: Record<string, ReturnType<typeof tool>> = {};
  const roster = {
    ok: true,
    children: fixture.children.map((child) => ({
      id: child.id,
      name: child.name,
      age: child.age,
    })),
  };
  for (const entry of summaryTools) {
    const scripted = fixture.toolResults?.[entry.name];
    const result =
      entry.name === "get_children"
        ? roster
        : scripted ?? DEFAULT_TOOL_RESULT;
    tools[entry.name] = tool({
      description: entry.description,
      inputSchema: z.object({}).loose(),
      execute: async () => result,
    });
  }
  return tools;
}

async function runLiveEval(): Promise<number> {
  try {
    loadEnvFile(
      process.env.HOMA_EVAL_ENV_FILE
        ?? fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)),
    );
  } catch {
    // Env may already be present in the shell.
  }
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    console.error(
      "No model credentials. Set AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN, or run with --check-fixtures.",
    );
    return 1;
  }

  const repeats = Math.max(
    1,
    Number(process.env.HOMA_ASK_EVAL_REPEATS ?? DEFAULT_REPEATS),
  );
  let instructions: string;
  let summaryTools: SummaryTool[];
  const choiceTool = resolveChoiceTool();
  try {
    instructions = readFileSync(instructionsUrl, "utf8");
    summaryTools = loadSummaryTools();
  } catch (error) {
    console.error(
      `Could not load the real tool surface (${(error as Error).message}).`,
    );
    console.error("Run: cd apps/web && pnpm exec eve build");
    return 1;
  }

  const choiceEntry = tool({
    description: choiceTool.description,
    inputSchema: choiceTool.inputSchema as never,
  });

  const results: {
    fixture: AskUserQuestionsFixture;
    askCount: number;
    pass: boolean;
    flaky: boolean;
  }[] = [];

  console.log(`${repeats} run(s) per fixture on ${HOMA_MODEL}\n`);

  for (const fixture of ASK_USER_QUESTIONS_FIXTURES) {
    let askCount = 0;
    const otherTools = new Set<string>();
    const tools = {
      ...alternativeTools(summaryTools, fixture),
      [TOOL_NAME]: choiceEntry,
    };
    for (let run = 0; run < repeats; run += 1) {
      const result = await generateText({
        model: HOMA_MODEL,
        tools,
        // The whole trajectory, not the opening move. ask_user_questions
        // has no execute, so a call to it ends the run on its own.
        stopWhen: stepCountIs(MAX_STEPS),
        system: `${instructions}\n\n## This family\n\n${fixture.familyBlurb}`,
        prompt: fixture.message,
      });
      if (result.toolCalls.some((call) => call.toolName === TOOL_NAME)) {
        askCount += 1;
      }
      for (const call of result.toolCalls) {
        if (call.toolName !== TOOL_NAME) otherTools.add(call.toolName);
      }
    }
    // Majority, not unanimity: this is a sampled model, and one stray run
    // is not a regression. Split runs are reported as flaky instead of
    // being silently rounded into a verdict.
    const asksMostly = askCount * 2 > repeats;
    const pass = asksMostly === (fixture.expect === "ask");
    const flaky = askCount > 0 && askCount < repeats;
    results.push({ fixture, askCount, pass, flaky });
    console.log(
      `${pass ? "pass" : "FAIL"}${flaky ? " (flaky)" : "        "} ${fixture.id}  expected=${
        fixture.expect
      } asked=${askCount}/${repeats}${
        otherTools.size > 0 ? ` other=[${[...otherTools].join(", ")}]` : ""
      }`,
    );
    if (!pass) console.log(`      why: ${fixture.why}`);
  }

  const failed = results.filter((r) => !r.pass);
  const overCalls = failed.filter((r) => r.askCount * 2 > repeats);
  const flakes = results.filter((r) => r.flaky);
  console.log(
    `\n${results.length - failed.length}/${results.length} passed on ${HOMA_MODEL}`,
  );
  if (flakes.length > 0) {
    // Named loudly: a split fixture means the behavior is unstable, which
    // is a finding in itself and makes any single-run score untrustworthy.
    console.log(
      `${flakes.length} flaky (split runs, behavior is not stable): ${flakes
        .map((r) => `${r.fixture.id} ${r.askCount}/${repeats}`)
        .join(", ")}`,
    );
  }
  if (overCalls.length > 0) {
    // Called separately: an over-call spends a parent's turn making her do
    // work Homa should have done, which is worse than a miss.
    console.log(
      `${overCalls.length} over-call(s): ${overCalls
        .map((r) => r.fixture.failureMode ?? r.fixture.id)
        .join(", ")}`,
    );
  }
  return failed.length === 0 ? 0 : 1;
}

const errors = fixtureErrors();
if (errors.length > 0) {
  for (const error of errors) console.error(`fixture error: ${error}`);
  process.exitCode = 1;
} else if (process.argv.includes(FIXTURE_CHECK_ARGUMENT)) {
  const positives = ASK_USER_QUESTIONS_FIXTURES.filter((f) => f.expect === "ask");
  console.log(
    `ask-user-questions fixtures ok: ${positives.length} positive, ${
      ASK_USER_QUESTIONS_FIXTURES.length - positives.length
    } adversarial-negative, all ${ASK_USER_QUESTIONS_FAILURE_MODES.length} over-call modes covered`,
  );
  process.exitCode = 0;
} else {
  process.exitCode = await runLiveEval();
}
