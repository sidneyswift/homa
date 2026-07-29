import { emitMapEvent } from "../../../../lib/map/events";
import { syncOneCallTranscript } from "../../../../lib/voice/transcript-sync";
import { hasVoiceWebhookSecret } from "../../../../lib/voice/webhook-auth";

/**
 * POST /api/voice/insights: the GENERAL phone line's call-ended webhook,
 * fired by its Telnyx Insight Group the moment a call finishes
 * (scripts/telnyx-provision.mts).
 *
 * Why this route exists. The curriculum line has had a call-ended webhook
 * in production since it shipped; the general line, the one real parents
 * actually call, was simply never given one. So a call's content reached
 * web chat only when the hourly cron happened to run, which is the whole of
 * #171: a parent finished a call, opened chat, and Homa had never heard of
 * it. This closes that to seconds without changing where transcripts live
 * or how they are owned.
 *
 * Auth, and what is deliberately NOT trusted. The keyed URL is the same
 * posture as /api/voice/context: a long random secret in the query string,
 * stored only in the Insight Group's webhook config on Telnyx. Beyond that,
 * this route believes exactly one thing from the payload, the conversation
 * id, and nothing about whose call it was. Ownership is re-derived
 * server-side from the caller's number via family_phones, inside
 * syncOneCallTranscript, the same path the cron has always used. That
 * matters here more than on the curriculum line, which can correlate
 * against a call row this server placed; the general line has no such row,
 * so an echoed family_id would be the only claim, and BUILD.md law #1 says
 * an id from outside is never the basis for a write.
 *
 * Fail soft, always 200. Telnyx retries non-2xx, and a retry cannot help
 * any failure here: the cron is already the backstop, and this route is an
 * accelerator. A 500 would buy nothing and cost a retry storm.
 */

interface InsightWebhookBody {
  event_type?: string;
  /** Telnyx nests the conversation id in a few shapes across payload
   * versions, so read all of them rather than pinning one. */
  conversation_id?: string;
  data?: { conversation_id?: string; id?: string };
  payload?: { conversation_id?: string; id?: string };
}

export function readConversationId(body: InsightWebhookBody): string | null {
  const candidates = [
    body.conversation_id,
    body.data?.conversation_id,
    body.data?.id,
    body.payload?.conversation_id,
    body.payload?.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return null;
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!hasVoiceWebhookSecret(request, url)) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: InsightWebhookBody;
  try {
    body = (await request.json()) as InsightWebhookBody;
  } catch {
    return new Response("bad json", { status: 400 });
  }
  if (body.event_type !== "conversation.insights.completed") {
    return new Response("ignored", { status: 200 });
  }

  const conversationId = readConversationId(body);
  if (!conversationId) {
    console.error("voice insights webhook: no conversation id in payload");
    return new Response("ok", { status: 200 });
  }

  try {
    const result = await syncOneCallTranscript(conversationId);
    if (!result.skipped) {
      await emitMapEvent("voice.call_ended_synced", {
        linked_family: result.linkedFamily,
        message_count: result.messageCount,
      });
    }
  } catch (error) {
    // The hourly cron will still pick this call up, so a failure here costs
    // latency and nothing else. Log it and take the 200.
    console.error(
      `voice insights webhook: sync of ${conversationId} failed:`,
      error instanceof Error ? error.message : "unknown",
    );
  }

  return new Response("ok", { status: 200 });
}
