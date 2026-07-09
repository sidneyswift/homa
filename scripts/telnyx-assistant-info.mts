/**
 * Read-only ops query: print each Telnyx AI assistant with its wired
 * tools and whether a dynamic-variables webhook is set. Used to confirm,
 * e.g., that the general voice assistant actually has the send_email tool
 * attached (root-causing "Homa said it would email but didn't").
 *
 * Usage: pnpm exec tsx scripts/telnyx-assistant-info.mts
 */

import { tx, listOf } from "./telnyx-shared.mts";

interface AssistantTool {
  type?: string;
  webhook?: { name?: string; url?: string };
}

interface AssistantDetail {
  id: string;
  name: string;
  model?: string;
  tools?: AssistantTool[];
  dynamic_variables_webhook_url?: string;
  insight_settings?: { insight_group_id?: string | null };
}

interface InsightGroupDetail {
  id: string;
  name: string;
  webhook?: string;
  insights?: Array<{ id: string; name: string }>;
}

/** Hide the ?key=<secret> query param before printing a webhook URL. */
function redactKey(url: string | undefined): string {
  if (!url) return "(none)";
  return url.replace(/key=[^&]+/u, "key=***");
}

function toolLabel(tool: AssistantTool): string {
  if (tool.webhook?.name) return `${tool.type ?? "tool"}:${tool.webhook.name}`;
  return tool.type ?? "unknown";
}

async function main(): Promise<void> {
  const list = listOf<{ id: string; name: string }>(await tx("GET", "/ai/assistants"));
  console.log(`\n${list.length} assistant(s):\n`);

  for (const summary of list) {
    // The list payload omits tools; fetch each assistant for the detail.
    const detail = await tx<{ data?: AssistantDetail } & AssistantDetail>(
      "GET",
      `/ai/assistants/${summary.id}`,
    );
    const assistant = detail.data ?? detail;
    const tools = assistant.tools ?? [];
    const toolNames = tools.length > 0 ? tools.map(toolLabel).join(", ") : "(none)";

    console.log(`• ${assistant.name}`);
    console.log(`    id:    ${assistant.id}`);
    console.log(`    model: ${assistant.model ?? "?"}`);
    console.log(`    tools: ${toolNames}`);
    console.log(
      `    dyn-vars webhook: ${assistant.dynamic_variables_webhook_url ? "yes" : "no"}`,
    );
    console.log(
      `    insight group: ${assistant.insight_settings?.insight_group_id ?? "(none)"}`,
    );
    console.log("");
  }

  const groups = listOf<InsightGroupDetail>(
    await tx("GET", "/ai/conversations/insight-groups"),
  );
  console.log(`${groups.length} insight group(s):\n`);
  for (const group of groups) {
    console.log(`• ${group.name}`);
    console.log(`    id:       ${group.id}`);
    console.log(`    webhook:  ${redactKey(group.webhook)}`);
    console.log(
      `    insights: ${(group.insights ?? []).map((insight) => insight.name).join(", ") || "(none)"}`,
    );
    console.log("");
  }
}

await main();
