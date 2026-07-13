"use server";

import { revalidatePath } from "next/cache";

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
