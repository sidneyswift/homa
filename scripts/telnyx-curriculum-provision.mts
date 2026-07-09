/**
 * Provisions the "Call Homa" curriculum feature's Telnyx resources
 * (founder decision 2026-07-07, build-log). Idempotent, safe to re-run:
 *
 *   1. A SECOND, outbound-only AI assistant ("Homa curriculum call"),
 *      separate from the general inbound voice line: different job
 *      (structured info-gathering, not a warm companion line), and it
 *      needs its own Insight Group wired up.
 *   2. A Structured Insight that extracts subjects/concerns/interests/
 *      goals from the finished call, plus verbatim family_id/child_id
 *      (referenced as dynamic variables) so the webhook can correlate
 *      the result back to a real call without trusting anything else.
 *   3. An Insight Group wrapping that insight, with a webhook URL
 *      pointing at /api/voice/curriculum/insights, assigned to the new
 *      assistant.
 *
 * Usage: pnpm telnyx:curriculum:provision
 * Env: apps/web/.env.local (TELNYX_API_KEY, TELNYX_WEBHOOK_SECRET).
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  CURRICULUM_ASSISTANT_NAME,
  CURRICULUM_INSIGHT_GROUP_NAME,
  CURRICULUM_INSIGHT_NAME,
  REPO_ROOT,
  findAssistantByName,
  findInsightGroup,
  findInsightTemplate,
  logHoursToolConfig,
  rememberToolConfig,
  requireApiKey,
  sendEmailToolConfig,
  tx,
  type AssistantRow,
  type InsightGroupRow,
  type InsightTemplateRow,
} from "./telnyx-shared.mts";

requireApiKey();

function log(step: string, message: string): void {
  console.log(`[${step}] ${message}`);
}

function requireWebhookSecret(): string {
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("TELNYX_WEBHOOK_SECRET is not set (apps/web/.env.local)");
    process.exit(2);
  }
  return secret;
}

async function loadInstructions(): Promise<string> {
  const instructionsPath = path.join(
    REPO_ROOT,
    "apps/web/agent/curriculum-call-instructions.md",
  );
  return readFile(instructionsPath, "utf8");
}

/**
 * Creates the assistant if missing, then ALWAYS syncs its instructions
 * and tools to the current agent/curriculum-call-instructions.md and
 * the shared send-email tool config on every run, so an edit takes
 * effect the moment this script re-runs instead of silently drifting
 * from what is actually live on Telnyx.
 */
async function ensureAssistant(webhookSecret: string): Promise<AssistantRow> {
  const instructions = await loadInstructions();
  const tools = [
    sendEmailToolConfig(webhookSecret),
    rememberToolConfig(webhookSecret),
    logHoursToolConfig(webhookSecret),
  ];
  const existing = await findAssistantByName(CURRICULUM_ASSISTANT_NAME);
  if (existing) {
    await tx("POST", `/ai/assistants/${existing.id}`, { instructions, tools });
    log("assistant", `already exists (${existing.id}); instructions + tools synced`);
    return existing;
  }
  const created = await tx<AssistantRow>("POST", "/ai/assistants", {
    name: CURRICULUM_ASSISTANT_NAME,
    description:
      "Outbound-only: reviews a child's progress report with the parent " +
      "and digs deeper, feeding a Structured Insight that builds a real " +
      "curriculum. Never assigned to an inbound number.",
    instructions,
    greeting: "<assistant-speaks-first-with-model-generated-message>",
    model: "Qwen/Qwen3-235B-A22B",
    voice_settings: {
      voice: "Telnyx.Ultra.00a77add-48d5-4ef6-8157-71e5437b282d",
    },
    telephony_settings: { noise_suppression: "krisp" },
    enabled_features: ["telephony"],
    tools,
  });
  log("assistant", `created ${created.id}`);
  return created;
}

async function ensureInsight(): Promise<InsightTemplateRow> {
  const existing = await findInsightTemplate(CURRICULUM_INSIGHT_NAME);
  if (existing) {
    log("insight", `already exists (${existing.id})`);
    return existing;
  }
  const created = await tx<{ data: InsightTemplateRow }>(
    "POST",
    "/ai/conversations/insights",
    {
      name: CURRICULUM_INSIGHT_NAME,
      instructions: [
        "From this call between Homa and a homeschooling parent, extract:",
        "- subjects_discussed: which school subjects came up",
        "- concerns: anything the parent worried about",
        "- interests_confirmed: the child's interests the parent confirmed or added",
        "- goals: what the parent said she wants for the child",
        "- parent_requests: anything specific she asked Homa to include",
        "- call_summary: 2-3 sentences summarizing the call",
        "",
        "Also include these two fields verbatim, exactly as given, do not paraphrase them:",
        "- family_id: {{family_id}}",
        "- child_id: {{child_id}}",
      ].join("\n"),
      json_schema: {
        type: "object",
        properties: {
          family_id: { type: "string" },
          child_id: { type: "string" },
          subjects_discussed: { type: "array", items: { type: "string" } },
          concerns: { type: "array", items: { type: "string" } },
          interests_confirmed: { type: "array", items: { type: "string" } },
          goals: { type: "array", items: { type: "string" } },
          parent_requests: { type: "array", items: { type: "string" } },
          call_summary: { type: "string" },
        },
        required: [
          "family_id",
          "child_id",
          "subjects_discussed",
          "concerns",
          "interests_confirmed",
          "goals",
          "parent_requests",
          "call_summary",
        ],
        additionalProperties: false,
      },
    },
  ).then((payload) => ("data" in payload ? payload.data : (payload as InsightTemplateRow)));
  log("insight", `created ${created.id}`);
  return created;
}

async function ensureGroup(
  insight: InsightTemplateRow,
  webhookSecret: string,
): Promise<InsightGroupRow> {
  const webhookUrl = `https://thankshoma.com/api/voice/curriculum/insights?key=${webhookSecret}`;
  const existing = await findInsightGroup(CURRICULUM_INSIGHT_GROUP_NAME);
  if (existing) {
    log("group", `already exists (${existing.id})`);
    const alreadyAssigned = (existing.insights ?? []).some((item) => item.id === insight.id);
    if (!alreadyAssigned) {
      await tx(
        "POST",
        `/ai/conversations/insight-groups/${existing.id}/insights/${insight.id}/assign`,
      );
      log("group", "insight assigned");
    }
    return existing;
  }
  const created = await tx<{ data: InsightGroupRow }>(
    "POST",
    "/ai/conversations/insight-groups",
    { name: CURRICULUM_INSIGHT_GROUP_NAME, webhook: webhookUrl },
  ).then((payload) => ("data" in payload ? payload.data : (payload as InsightGroupRow)));
  log("group", `created ${created.id} → ${webhookUrl.replace(/key=.*/, "key=***")}`);
  await tx(
    "POST",
    `/ai/conversations/insight-groups/${created.id}/insights/${insight.id}/assign`,
  );
  log("group", "insight assigned");
  return created;
}

async function assignGroupToAssistant(
  assistant: AssistantRow,
  group: InsightGroupRow,
): Promise<void> {
  await tx("POST", `/ai/assistants/${assistant.id}`, {
    insight_settings: { insight_group_id: group.id },
  });
  log("assistant", `insight group assigned (${group.id})`);
}

async function main(): Promise<void> {
  const webhookSecret = requireWebhookSecret();
  const assistant = await ensureAssistant(webhookSecret);
  const insight = await ensureInsight();
  const group = await ensureGroup(insight, webhookSecret);
  await assignGroupToAssistant(assistant, group);

  console.log("\n=== Summary ===");
  console.log(`Assistant:     ${assistant.id}`);
  console.log(`Insight:       ${insight.id}`);
  console.log(`Insight group: ${group.id}`);
  console.log(
    "\nEnv to set (apps/web/.env.local AND Vercel production):" +
      `\n  TELNYX_CURRICULUM_ASSISTANT_ID=${assistant.id}`,
  );
}

await main();
