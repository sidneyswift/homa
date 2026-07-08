import { normalizeUsPhoneE164 } from "@homa/core";

import { findFamilyIdByPhone } from "../../../../lib/family-phone";
import {
  loadFamilyContextPinned,
  renderFamilyContext,
} from "../../../../lib/family-context";

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
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
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
    const familyId = await findFamilyIdByPhone(caller);
    if (!familyId) return Response.json(EMPTY_RESPONSE);

    const rows = await loadFamilyContextPinned(familyId);
    return Response.json({
      dynamic_variables: {
        caller_known: "true",
        parent_name: rows.family?.parent_display_name ?? "",
        family_context: renderFamilyContext(rows),
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
