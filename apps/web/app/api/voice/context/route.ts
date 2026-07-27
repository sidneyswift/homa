import { normalizeUsPhoneE164 } from "@homa/core";

import { loadRecentContinuityForMember } from "../../../../lib/conversation-continuity/ledger";
import { findFamilyIdentityByPhone } from "../../../../lib/family-phone";
import {
  loadFamilyContextPinned,
  renderFamilyContext,
} from "../../../../lib/family-context";
import { recordLeadContact } from "../../../../lib/phone-leads";
import { effectiveTimeZone, zonedDateString } from "../../../../lib/time-zone";
import { loadRecentActivityDigest } from "../../../../lib/voice/recent-activity";
import { hasVoiceWebhookSecret } from "../../../../lib/voice/webhook-auth";

/**
 * POST /api/voice/context: the Telnyx voice assistant's dynamic-variables
 * webhook, called once when a phone conversation starts. Resolves the
 * caller's number through family_phones (the same lookup as the SMS
 * channel) and returns the family context as dynamic variables the
 * assistant's instructions template in. Unknown callers get the empty
 * shape and Homa stays a warm general companion.
 *
 * Auth: a long random key in the webhook URL's query string, checked
 * against TELNYX_WEBHOOK_SECRET (the URL, key included, lives only in the
 * assistant's Telnyx-side config; same possession-is-auth posture as the
 * report link tokens). Wrong or missing key returns 401 with no
 * variables. Response must beat Telnyx's webhook timeout (configured to
 * 5s; the pinned reads take ~50ms).
 */

interface DynamicVariablesWebhookBody {
  data?: {
    event_type?: string;
    payload?: {
      telnyx_end_user_target?: string;
      telnyx_agent_target?: string;
      telnyx_conversation_channel?: string;
    };
  };
}

const EMPTY_RESPONSE = {
  dynamic_variables: {
    caller_known: "false",
    parent_name: "",
    family_context: "",
    // Blank on purpose: the shared send-email tool's URL templates these
    // in, and an unlinked caller must resolve to "no account" server-side,
    // never to an empty string that could be misread as a valid id.
    family_id: "",
    child_id: "",
  },
};

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!hasVoiceWebhookSecret(request, url)) {
    return Response.json(EMPTY_RESPONSE, { status: 401 });
  }

  let body: DynamicVariablesWebhookBody;
  try {
    body = (await request.json()) as DynamicVariablesWebhookBody;
  } catch {
    return Response.json(EMPTY_RESPONSE, { status: 400 });
  }

  const rawCaller = body.data?.payload?.telnyx_end_user_target ?? "";
  const caller = normalizeUsPhoneE164(rawCaller);
  if (!caller) return Response.json(EMPTY_RESPONSE);

  try {
    const identity = await findFamilyIdentityByPhone(caller);
    if (!identity) {
      // A stranger calling IS a lead (lead-funnel-plan LF-2). Never
      // blocks the call; the webhook has a 5s budget.
      recordLeadContact(caller, "voice").catch((error: unknown) => {
        console.error(
          "phone lead capture (voice) failed:",
          error instanceof Error ? error.message : "unknown",
        );
      });
      return Response.json(EMPTY_RESPONSE);
    }
    const familyId = identity.familyId;

    const rows = await loadFamilyContextPinned(familyId);
    let continuityContext = "";
    try {
      continuityContext = await loadRecentContinuityForMember({
        familyId,
        memberUserId: identity.memberUserId,
      });
    } catch (error) {
      // Continuity is an enrichment. A ledger outage must never turn a
      // known caller into the stranger experience or hide family context.
      console.error(
        "voice context: continuity load failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    // Bounded "recent activity" digest (issue #176, CG-03, item 5): the
    // call INGESTS what happened on other channels in the last 72
    // hours; it never implies live mid-call awareness of anything else.
    // An outage here is also an enrichment miss, never a blocker.
    let recentActivity = "";
    try {
      const today = zonedDateString(new Date(), effectiveTimeZone(rows.family?.time_zone));
      recentActivity = await loadRecentActivityDigest(familyId, today);
    } catch (error) {
      console.error(
        "voice context: recent-activity digest failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    return Response.json({
      dynamic_variables: {
        caller_known: "true",
        // The calling number's own adult when attributed (multi-parent
        // v0), else the family-level display name.
        parent_name:
          identity.memberDisplayName ?? rows.family?.parent_display_name ?? "",
        family_context: [
          renderFamilyContext(rows, {
            speakingWith: identity.memberDisplayName,
          }),
          continuityContext,
          recentActivity,
        ]
          .filter((block) => block.length > 0)
          .join("\n\n"),
        family_id: familyId,
        // Ambiguous with multiple kids on the general line; the email
        // tool treats a blank child_id as "family-level", which is
        // correct here (unlike the curriculum line, which always knows
        // exactly one child).
        child_id: rows.children.length === 1 ? rows.children[0].id : "",
      },
    });
  } catch (error) {
    // Fail open to the unknown-caller experience; never block the call.
    console.error(
      "voice context webhook failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json(EMPTY_RESPONSE);
  }
}
