import { BANNED_WORDS, EM_DASH } from "@homa/core";

import { getFamilyEmail, sendAgentComposedEmail } from "../../../../../lib/map/email";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import {
  readVoiceChildId,
  readVoiceFamilyId,
} from "../../../../../lib/voice/tool-context";
import { hasVoiceWebhookSecret } from "../../../../../lib/voice/webhook-auth";

/**
 * POST /api/voice/tools/send-email: a live webhook tool BOTH voice
 * assistants can trigger mid-call (build-log 2026-07-08: "what tools
 * can she trigger, can she send an email"). Configured on each
 * assistant with family_id/child_id templated straight into the tool's
 * URL from that call's own dynamic variables (the general line's
 * /api/voice/context webhook and the curriculum line's outbound-call
 * variables both set them), so the recipient is never something the
 * model supplies, only the caller's own family email on file.
 *
 * Auth: the same keyed-URL posture as /api/voice/context. The response
 * shape is a tool RESULT the assistant reads back, not a fire-and-forget
 * event: on any rejection it explains why in plain language so the
 * model can relay it or self-correct (a brand-law violation, for
 * instance, is phrased as an instruction to rephrase and retry).
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_FAMILY_PER_DAY = 5;

/** The success result the assistant reads back. It states the boundary
 * instead of a bare ok: on 2026-07-19 a call followed this tool with "I've
 * sent the filled worksheet with visuals" and "I've added the syllable
 * activity to Amalia's binder", and this tool can do neither. Mirrors the
 * limits in agent/general-call-instructions.md; change both together. */
const SENT_NOTE =
  "Sent as a plain text email containing only the words you wrote. There is no attachment, no worksheet file, and nothing was added to her binder. Confirm you sent it in one short sentence, and do not claim you made a printable or saved anything to the binder on this call.";

interface ToolCallBody {
  subject?: string;
  body?: string;
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!hasVoiceWebhookSecret(request, url)) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const context = readVoiceFamilyId(
    url,
    "This caller is not linked to a Homa family yet, so there is no address to send to.",
  );
  if (!context.ok) return Response.json({ success: false, error: context.error });
  const familyId = context.familyId;
  const childId = readVoiceChildId(url);

  let body: ToolCallBody;
  try {
    body = (await request.json()) as ToolCallBody;
  } catch {
    return Response.json({ success: false, error: "Missing subject and body." });
  }
  const subject = body.subject?.trim();
  const text = body.body?.trim();
  if (!subject || !text) {
    return Response.json({ success: false, error: "Missing subject and body." });
  }

  if (rateLimited(`agent-email:${familyId}`, MAX_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({
      success: false,
      error: "Already sent enough emails to this family today. Tell them you'll follow up another way.",
    });
  }

  const combined = `${subject} ${text}`;
  if (EM_DASH.test(combined) || BANNED_WORDS.test(combined)) {
    return Response.json({
      success: false,
      error:
        "That used an em dash or a word like 'behind'/diagnosis language. Rephrase without it and call this tool again.",
    });
  }

  const email = await getFamilyEmail(familyId);
  if (!email) {
    return Response.json({
      success: false,
      error: "No email is on file for this family. Tell them you can't send it yet.",
    });
  }

  const sent = await sendAgentComposedEmail(
    email,
    subject,
    text.split("\n").filter((line) => line.trim().length > 0),
  );
  if (!sent) {
    return Response.json({ success: false, error: "The send failed. Tell them you'll try again shortly." });
  }

  await emitMapEvent("voice.email_sent", { family_id: familyId, child_id: childId ?? undefined });
  return Response.json({ success: true, note: SENT_NOTE });
}
