import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import { createPrintableInputSchema } from "../../agent/tools/create_printable";
import startJob from "../../agent/tools/start_agent_job";
import { conversationJobQuoteMatches } from "../../lib/conversation-jobs";

const jobInputSchema = (() => {
  const schema = startJob.inputSchema;
  if (!(schema instanceof z.ZodObject)) throw new Error("The job eval needs its real object schema");
  return schema;
})();

export async function runConversationBackgroundCase(kind: "ready" | "missing-level" | "existing-material") {
  const root = process.cwd().endsWith("/apps/web") ? process.cwd() : resolve(process.cwd(), "apps/web");
  const [instructions, skill, procedure] = await Promise.all([
    readFile(resolve(root, "agent/instructions.md"), "utf8"),
    readFile(resolve(root, "agent/skills/materials-studio/SKILL.md"), "utf8"),
    readFile(resolve(root, "agent/skills/materials-studio/references/conversation-background.md"), "utf8"),
  ]);
  const calls: { name: string; input: unknown }[] = [];
  const prompts = {
    ready: "Make Maya one dinosaur counting worksheet. She reliably counts up to five objects, and is working on six through ten. Keep it pencil-only, with large blanks.",
    "missing-level": "Make Maya a reading worksheet. I have not told you what she can read yet.",
    "existing-material": "Do not make anything new. Reopen the dinosaur worksheet we already made so I can look at it.",
  };
  const result = await generateText({ model: HOMA_MODEL, stopWhen: stepCountIs(7), abortSignal: AbortSignal.timeout(90_000),
    system: `${instructions}\nCurrent server context: Background material delivery to this conversation is available.\nMaya's ID is aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa. No reading-level evidence is available.\nLoaded materials-studio:\n${skill}\nLoaded reference conversation-background.md:\n${procedure}`,
    prompt: prompts[kind],
    tools: {
      load_skill: tool({ description: "Read a fleet skill", inputSchema: z.object({ skill: z.string() }), execute: async input => {
        calls.push({ name: "load_skill", input }); return { text: skill };
      } }),
      read_file: tool({ description: "Read a skill reference", inputSchema: z.object({ path: z.string() }), execute: async input => {
        calls.push({ name: "read_file", input });
        const relative = input.path.replace(/^\/workspace\/skills\/materials-studio\//u, "");
        if (!relative.startsWith("references/") || relative.includes("..")) return { error: "Unknown reference" };
        return { text: await readFile(resolve(root, "agent/skills/materials-studio", relative), "utf8") };
      } }),
      start_agent_job: tool({ description: startJob.description, inputSchema: jobInputSchema, execute: async input => {
        if (!conversationJobQuoteMatches(input.plan, prompts[kind])) return { started: false, note: "Use an exact quote from the saved message, or omit herWords. No build was started." };
        calls.push({ name: "start_agent_job", input }); return { started: true, jobId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", alreadyRunning: false,
          note: "The material is durably queued and will appear in this conversation. Finish this reply; the parent can keep talking while it is made." };
      } }),
      create_printable: tool({ description: "Build a material in this foreground turn", inputSchema: createPrintableInputSchema, execute: async input => {
        calls.push({ name: "create_printable", input }); return { created: true, materialId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", status: "draft" };
      } }),
      find_materials: tool({ description: "Find existing saved materials by title", inputSchema: z.object({ title: z.string() }), execute: async input => {
        calls.push({ name: "find_materials", input }); return { materials: kind !== "existing-material" ? [] : [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "Dinosaur worksheet" }] };
      } }),
      show_material: tool({ description: "Reopen an existing material", inputSchema: z.object({ materialId: z.string() }), execute: async input => {
        calls.push({ name: "show_material", input }); return { shown: true };
      } }),
    },
  });
  const starts = calls.filter(call => call.name === "start_agent_job");
  const findings: string[] = [];
  if (calls.some(call => call.name === "create_printable")) findings.push("This scenario should not create a second build or bypass calibration.");
  if (kind === "ready") {
    if (starts.length !== 1) findings.push("An eligible build must start exactly one job.");
    const input = starts[0]?.input as { skill?: string; totalStages?: number; plan?: { request?: string } } | undefined;
    if (input?.skill !== "materials-studio" || input.totalStages !== 1) findings.push("The standalone build must use its one-stage contract.");
    const brief = input?.plan?.request ?? "";
    if (!/five|5/iu.test(brief) || !/ten|10/iu.test(brief) || !/pencil/iu.test(brief)) findings.push("The job brief lost the parent's level or constraint.");
  } else if (starts.length) findings.push("Missing calibration or reopening work must not start a new job.");
  if (kind === "existing-material" && !calls.some(call => call.name === "show_material")) findings.push("The existing material was not reopened.");
  return { kind, calls, text: result.text, findings };
}
