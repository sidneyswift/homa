import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { composeSmsModeMarkdown } from "../../agent/instructions/sms-mode";
import { HOMA_MODEL, HOMA_REASONING } from "../../agent/model";
import headsUp from "../../agent/tools/send_heads_up";
import { manageChildProgressToolInputSchema } from "../../lib/child-progress/tool-contract";
import { isEvalIsolationActive } from "../../lib/eval-isolation";

// Synthetic counterparts of #1206, plus nearby negatives and preserved slow work.
export const SMS_REPLY_CASES = [
  { id: "reading-narration", message: "Alex was home early this afternoon so Maya did her Greek myths reading with him, and did a really good job narrating the last 6 weeks of readings!", headsUp: false, required: ["manage_child_progress", "record_planner_activity"] },
  { id: "picture-book", message: "During Leo's picture book this morning, he noticed that the little bear was eating berries just like the child in the story. Please save that observation and log our reading.", headsUp: false, required: ["manage_child_progress", "record_planner_activity"] },
  { id: "multi-child", message: "Please log 20 minutes of reading for Maya and 15 minutes of drawing for Leo today. Maya retold the beginning, middle and end by herself. Remember that Leo concentrates best at the kitchen table.", headsUp: false, required: ["manage_child_progress", "record_planner_activity", "remember"] },
  { id: "research", message: "Please research three current complete third-grade math curricula, check their current prices and what comes in each, compare the teaching approaches, and recommend one for Maya.", headsUp: true, required: ["web_search"] },
  { id: "material", message: "Make a one-page printable with ten large empty circles for Leo to count and color. Use a simple black-and-white HTML layout. No illustrations or answer key needed.", headsUp: true, required: ["create_printable"] },
] as const;

const agentRoot = new URL("../../agent/", import.meta.url);
const childIds = ["00000000-0000-4000-8000-000000000011", "00000000-0000-4000-8000-000000000012"];

/** Real model, channel instructions and heads-up tool schema; all effects are inert.
 * This measures the decision that caused #1206, not database or carrier delivery.
 */
export async function runSmsReplyCase(id: string, signal: AbortSignal) {
  assert.ok(isEvalIsolationActive(process.env), "SMS eval requires scrubbed production credentials");
  const fixture = SMS_REPLY_CASES.find(row => row.id === id);
  assert.ok(fixture, `Unknown SMS case: ${id}`);
  const calls: string[] = [];
  let progressTexts = 0;
  const receipt = (name: string, result: unknown) => async () => { calls.push(name); return result; };
  const skillNames = ["progress-capture", "planner", "materials-studio", "curriculum-studio"];
  const skillBodies = await Promise.all(skillNames.map(async name => ({name, body: await readFile(new URL(`skills/${name}/SKILL.md`, agentRoot), "utf8")})));
  const system = [
    await readFile(new URL("instructions.md", agentRoot), "utf8"),
    composeSmsModeMarkdown({familyId: "synthetic-family"}),
    `Current local date: 2026-09-30. Parent: Jamie. Partner: Alex. Maya, age 8, id ${childIds[0]}. Leo, age 5, id ${childIds[1]}. Leo's current progress snapshot: independently counts sets of up to five objects and recognizes numerals 1 to 5. His saved interest is ocean animals. This is a linked SMS family.`,
    "Available skills:\n" + skillBodies.map(({name, body}) => `${name}: ${body.match(/^description: (.+)$/m)?.[1]}`).join("\n"),
  ].join("\n\n");
  const result = await generateText({
    model: HOMA_MODEL, system, prompt: fixture.message, maxRetries: 0,
    abortSignal: signal, stopWhen: stepCountIs(9), maxOutputTokens: 5_000,
    providerOptions: {openai: {reasoningEffort: HOMA_REASONING}, gateway: {disallowPromptTraining: true, tags: ["sms_reply_regression"]}},
    tools: {
      send_heads_up: tool({description: headsUp.description, inputSchema: headsUp.inputSchema as z.ZodType<{message: string}>, execute: async () => {
        calls.push("send_heads_up"); progressTexts++;
        return {sent: true, note: "Progress text sent. Do the work, then send the completed reply. Never send a second progress message."};
      }}),
      load_skill: tool({description: "Load the full procedure for an advertised skill.", inputSchema: z.object({skill: z.enum(skillNames as [string, ...string[]])}), execute: async ({skill}) => {
        calls.push("load_skill"); return skillBodies.find(row => row.name === skill)?.body;
      }}),
      read_file: tool({description: "Read a skill's reference file.", inputSchema: z.object({path: z.string()}), execute: async ({path}) => {
        calls.push("read_file");
        const relative = path.replace(/^\/workspace\/skills\//, "");
        if (!skillNames.some(name => relative.startsWith(`${name}/`)) || relative.includes("..")) return {error: "Not an allowed skill reference"};
        try { return await readFile(new URL(`skills/${relative}`, agentRoot), "utf8"); } catch { return {error: "No such reference"}; }
      }}),
      manage_child_progress: tool({description: "Record a parent's reported ability using action record_journal_evidence. The server reads and validates the current parent message.", inputSchema: manageChildProgressToolInputSchema, execute: receipt("manage_child_progress", {kind: "progress_update", label: "Progress updated", note: "The reported observation is saved. Record a separate dated activity in Planner if the parent reported one."})}),
      record_planner_activity: tool({description: "Record dated completed or planned learning for the named children. Supplied minutes also record Hours in the same operation.", inputSchema: z.object({title: z.string(), childIds: z.array(z.string()).optional(), activityDate: z.string(), status: z.enum(["planned", "completed"]), durationMinutes: z.number().optional(), subject: z.string().optional(), sourceQuote: z.string().optional(), sourceActivityOrdinal: z.number().optional(), note: z.string().optional()}), execute: receipt("record_planner_activity", {done: true, recorded: true, created: true, note: "Activity and any supplied time recorded. Do not log those hours again."})}),
      remember: tool({description: "Save a stable family fact or per-child teaching preference.", inputSchema: z.object({content: z.string(), childId: z.string().optional(), kind: z.string().optional()}), execute: receipt("remember", {done: true, saved: true})}),
      web_search: tool({description: "Research current information on the web.", inputSchema: z.object({query: z.string()}), execute: receipt("web_search", {error: "Synthetic research provider unavailable. Explain this honestly; do not invent current prices."})}),
      create_printable: tool({description: "Create a printable PDF from authored HTML after loading materials-studio.", inputSchema: z.object({title: z.string(), html: z.string().optional()}), execute: receipt("create_printable", {error: "Synthetic renderer unavailable. Explain this honestly; no file was created."})}),
    },
  });
  const terminal = result.steps.at(-1);
  return {id, calls, progressTexts, reply: result.text, finishReason: terminal?.finishReason, expectedHeadsUp: fixture.headsUp, required: fixture.required};
}

export function assertSmsReplyCase(run: Awaited<ReturnType<typeof runSmsReplyCase>>) {
  assert.equal(run.finishReason, "stop", `${run.id}: turn must finish, not stop at the step limit`);
  assert.ok(run.reply.trim(), `${run.id}: completed reply is required`);
  assert.equal(run.progressTexts, run.expectedHeadsUp ? 1 : 0, `${run.id}: unexpected extra SMS`);
  for (const name of run.required) assert.ok(run.calls.includes(name), `${run.id}: still must do ${name}`);
}
