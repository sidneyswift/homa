import { normalizeUsPhoneE164 } from "@homa/core";

import { rateLimited } from "../../../../../lib/map/ratelimit";
import { updatePhoneLead } from "../../../../../lib/phone-leads";
import { sendHomaSms } from "../../../../../lib/voice/telnyx-api";
import { isUuid } from "../../../../../lib/voice/tool-context";
import { hasVoiceWebhookSecret } from "../../../../../lib/voice/webhook-auth";

/**
 * POST /api/voice/tools/send-signup-link: the voice assistant's way in
 * for unknown callers (lead-funnel-plan LF-5). "Want me to text you the
 * link?" becomes a real text to the caller's OWN number, templated into
 * the URL from the call's dynamic variables ({{telnyx_end_user_target}}),
 * the same posture as every voice tool: the model never chooses the
 * destination.
 *
 * Linked callers are refused (they have a workspace; there is nothing to
 * sign up for), and a per-number daily cap keeps a confused model from
 * texting anyone twice.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_NUMBER_PER_DAY = 2;

/** Verbatim user-facing copy: the first text a stranger gets from Homa.
 * Mirrors the onboarding offer in sms-mode.ts; change both together.
 * The free-report and no-card promises left 2026-07-26 with the signup
 * paywall: the trial is the offer now, and this text must stay true
 * whichever way HOMA_SIGNUP_PAYWALL_ENABLED is set. */
const SIGNUP_LINK_TEXT =
  "Homa here, as promised: your free trial starts at thankshoma.com/onboarding. Five minutes of questions, then your child's progress report. A card starts your 7 free days, and nothing is charged during them. If you enter this same phone number when it asks, your texts to me link up automatically.";

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!hasVoiceWebhookSecret(request, url)) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  if (isUuid(url.searchParams.get("family_id"))) {
    return Response.json({
      success: false,
      error:
        "This caller already has a Homa family, so there is nothing to sign up for. Their texts link up at thankshoma.com/app/settings.",
    });
  }

  const caller = normalizeUsPhoneE164(url.searchParams.get("caller") ?? "");
  if (!caller) {
    return Response.json({
      success: false,
      error: "No usable number for this caller. Say the link out loud instead: thankshoma dot com slash onboarding.",
    });
  }
  if (rateLimited(`voice-signup-link:${caller}`, MAX_PER_NUMBER_PER_DAY, DAY_MS)) {
    return Response.json({
      success: false,
      error: "The link was already texted to this number today. Tell the caller to check their messages.",
    });
  }

  const sent = await sendHomaSms(caller, SIGNUP_LINK_TEXT);
  if (!sent) {
    return Response.json({
      success: false,
      error: "The text could not be sent. Say the link out loud instead: thankshoma dot com slash onboarding.",
    });
  }

  await updatePhoneLead({ phoneE164: caller, invited: true, channel: "voice" }).catch(
    (error: unknown) => {
      console.error(
        "signup-link lead update failed:",
        error instanceof Error ? error.message : "unknown",
      );
    },
  );

  return Response.json({
    success: true,
    note: "Sent. Tell the caller the text is on its way in one short sentence.",
  });
}
