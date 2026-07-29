import { normalizeUsPhoneE164 } from "@homa/core";

import { familyWallCheckout } from "../../../../lib/billing/wall";
import { addFamilyPhone, getFamilyPhones } from "../../../../lib/family-phone";
import { familyHasChannel } from "../../../../lib/billing/channel-access";
import { emitMapEvent } from "../../../../lib/map/events";
import { rateLimited } from "../../../../lib/map/ratelimit";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { generalLineIds } from "../../../../lib/voice/general-line";

/**
 * POST /api/voice/call-me: "have Homa call me" for the GENERAL line.
 *
 * The curriculum line has had an outbound button since the report page
 * shipped (/api/voice/curriculum/start), aimed at one child's report. This
 * is the same move aimed at ordinary conversation, so a parent can start a
 * call with Homa from inside the app instead of only receiving one or
 * dialing the number herself.
 *
 * Why this instead of browser audio (issue #283). In-app voice was scoped
 * as WebRTC, a second credential path, and a canary AI SDK dependency, to
 * answer a demand question nobody has data on. The affordance already
 * exists and is production-hardened; aiming it at the general assistant is
 * an argument, not a build. If the taps come, browser audio is worth
 * building. Issue #253 is the precedent for shipping a surface with no
 * discovery loop and measuring zero.
 *
 * familyId is never taken from the request. It comes from the caller's own
 * membership row under their session, and the number dialed is one this
 * family has already linked, so this endpoint cannot be used to make Homa
 * phone an arbitrary number.
 *
 * The entitlement gate is STRONGER here than on the inbound path, and
 * deliberately so. /api/voice/context can only withhold family context from
 * a non-entitled caller, because a dynamic-variables webhook cannot decline
 * a call that is already ringing (see its own comment, and gh#298). Placing
 * a call is a decision, so this route simply does not place it.
 */

interface CallMeBody {
  /** Optional: links or re-links this adult's number in the same step, the
   * same way the report page's button does, so there is no separate save. */
  phone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Matches the curriculum line's ceiling. A call is an interruption, and
 * three in a day is already generous for one family. */
const MAX_CALLS_PER_FAMILY_PER_DAY = 3;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  // The caller's own family, under their own RLS. Never from the body.
  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return Response.json({ ok: false, reason: "no-family" }, { status: 404 });
  }
  const familyId = membership.family_id as string;

  let body: CallMeBody = {};
  try {
    body = (await request.json()) as CallMeBody;
  } catch {
    // A body is optional here; an unparseable one just means no phone.
  }

  // The wall: a call is a door, always an action, so there is no
  // existing-content exemption. The button shows the offer on this 403.
  if ((await familyWallCheckout(familyId)) !== null) {
    return Response.json({ ok: false, reason: "walled" }, { status: 403 });
  }

  // Calling is part of Homa Plus (gh#298, tier ruling 2026-07-28).
  if (!(await familyHasChannel(familyId))) {
    await emitMapEvent("sms.channel_gated", { channel: "voice" }, { familyId });
    return Response.json({ ok: false, reason: "not-included" }, { status: 403 });
  }

  if (rateLimited(`general-call:${familyId}`, MAX_CALLS_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let providedPhone: string | null = null;
  if (body.phone) {
    const normalized = normalizeUsPhoneE164(body.phone);
    if (!normalized) {
      return Response.json({ ok: false, reason: "bad-phone" }, { status: 400 });
    }
    const result = await addFamilyPhone({
      familyId,
      phoneE164: normalized,
      addedBy: user.id,
      source: "home",
    });
    if (!result.ok) {
      return Response.json({ ok: false, reason: "phone-taken" }, { status: 409 });
    }
    providedPhone = normalized;
  }

  // Her own linked number first (multi-parent v0: each adult carries one),
  // so a second parent's tap rings the second parent.
  const linked = await getFamilyPhones(familyId);
  const callTarget =
    providedPhone ??
    linked.find((row) => row.member_user_id === user.id)?.phone_e164 ??
    linked[0]?.phone_e164 ??
    null;
  if (!callTarget) {
    return Response.json({ ok: false, reason: "no-phone" }, { status: 400 });
  }

  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  if (!apiKey || !fromNumber) {
    console.error("call-me: Telnyx env not configured");
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  // Looked up by name rather than configured, so there is no pair of env
  // vars to keep in step with the assistant and nothing to rot if it is
  // ever recreated (the lesson of #276: a step someone has to remember is a
  // step that gets missed).
  const line = await generalLineIds(apiKey);
  if (!line) {
    console.error("call-me: general line is not provisioned yet");
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  try {
    const response = await fetch(
      `https://api.telnyx.com/v2/texml/ai_calls/${line.texmlAppId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: fromNumber,
          To: callTarget,
          AIAssistantId: line.assistantId,
          // The general assistant resolves its own family context at call
          // start through /api/voice/context, keyed on the number being
          // called. family_id is passed anyway as a floor: if that webhook
          // does not fire on an outbound leg, the four voice tools still
          // have the one value they cannot work without, and Homa is
          // context-poor rather than talking to a stranger.
          AIAssistantDynamicVariables: { family_id: familyId },
        }),
      },
    );
    if (!response.ok) {
      const text = await response.text();
      console.error(`call-me: Telnyx ${response.status} ${text.slice(0, 300)}`);
      await emitMapEvent("voice.call_requested", {
        family_id: familyId,
        line: "general",
        outcome: "telnyx-error",
      });
      return Response.json({ ok: false, reason: "telnyx-error" }, { status: 502 });
    }
  } catch (error) {
    console.error(
      "call-me: Telnyx request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    await emitMapEvent("voice.call_requested", {
      family_id: familyId,
      line: "general",
      outcome: "telnyx-error",
    });
    return Response.json({ ok: false, reason: "telnyx-error" }, { status: 502 });
  }

  await emitMapEvent("voice.call_requested", {
    family_id: familyId,
    line: "general",
    outcome: "placed",
  });
  return Response.json({ ok: true });
}
