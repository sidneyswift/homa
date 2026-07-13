"use server";

import { revalidatePath } from "next/cache";

import {
  buildAgentPrompt,
  parseAgentPromptSource,
} from "../../lib/admin/agent-prompt";
import {
  acknowledgeAlert,
  parseAlertSource,
  unacknowledgeAlert,
  type AlertSource,
} from "../../lib/admin/alert-acks";
import { getFounderSession } from "../../lib/admin/gate";

/**
 * /admin server actions. Same founder gate as the pages, but through
 * getFounderSession(): a server action must fail with a plain result,
 * not a thrown 404 render. The ack is stamped with the founder's email
 * so a two-founder future still knows who checked what.
 */

export interface AlertAckState {
  error: string | null;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function parseAckInput(
  source: string,
  sourceId: string,
): Promise<{ founderEmail: string; source: AlertSource } | { error: string }> {
  const founder = await getFounderSession();
  if (!founder) return { error: "Only the founder can do this." };
  const parsedSource = parseAlertSource(source);
  if (!parsedSource || !UUID_PATTERN.test(sourceId)) {
    return { error: "That alert could not be identified. Reload and try again." };
  }
  return { founderEmail: founder.email, source: parsedSource };
}

export async function acknowledgeAlertAction(
  source: string,
  sourceId: string,
): Promise<AlertAckState> {
  const parsed = await parseAckInput(source, sourceId);
  if ("error" in parsed) return { error: parsed.error };

  const ok = await acknowledgeAlert(parsed.source, sourceId, parsed.founderEmail);
  if (!ok) return { error: "That alert's record is gone. Reload the page." };
  revalidatePath("/admin");
  return { error: null };
}

export async function unacknowledgeAlertAction(
  source: string,
  sourceId: string,
): Promise<AlertAckState> {
  const parsed = await parseAckInput(source, sourceId);
  if ("error" in parsed) return { error: parsed.error };

  await unacknowledgeAlert(parsed.source, sourceId);
  revalidatePath("/admin");
  return { error: null };
}

export interface AgentPromptState {
  prompt: string | null;
  error: string | null;
}

const CRON_JOB_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Builds the copy-paste diagnostic packet for one failure row (founder
 * ask 2026-07-13: "a [Prompt for agent] button that copies as much info
 * about the error as would help any agent diagnose it"). Read-only. */
export async function buildAgentPromptAction(
  source: string,
  sourceId: string,
): Promise<AgentPromptState> {
  const founder = await getFounderSession();
  if (!founder) return { prompt: null, error: "Only the founder can do this." };

  const parsedSource = parseAgentPromptSource(source);
  const idOk =
    parsedSource === "cron" ? CRON_JOB_PATTERN.test(sourceId) : UUID_PATTERN.test(sourceId);
  if (!parsedSource || !idOk) {
    return { prompt: null, error: "That record could not be identified. Reload and try again." };
  }

  const prompt = await buildAgentPrompt(parsedSource, sourceId);
  if (prompt === null) return { prompt: null, error: "That record's row is gone. Reload the page." };
  return { prompt, error: null };
}
