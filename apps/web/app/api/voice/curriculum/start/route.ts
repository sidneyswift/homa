import { normalizeUsPhoneE164 } from "@homa/core";

import { familyWallCheckout } from "../../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";
import {
  buildCallFocusSummary,
  buildReportFactsForChild,
} from "../../../../../lib/map/curriculum-store";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { addFamilyPhone, getFamilyPhones } from "../../../../../lib/family-phone";

/**
 * POST /api/voice/curriculum/start: the report page's "Call me" button.
 * Signed-in only. Verifies the child belongs to the caller's family
 * under RLS BEFORE anything else, then (a) links the given phone number
 * if provided/changed, reusing the same family_phones system texting
 * uses, (b) builds this child's report facts, (c) places the outbound
 * call via Telnyx with those facts baked in as dynamic variables, and
 * (d) records the attempt. familyId/childId are re-derived from the
 * RLS-scoped ownership check, never trusted from the request body.
 */

interface StartBody {
  childId?: string;
  /** Optional: links or re-links the family's texting/calling number in
   * the same step, so the report page never needs a separate save flow. */
  phone?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CALLS_PER_FAMILY_PER_DAY = 3;

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const childId = body.childId;
  if (!childId) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  // Ownership check under the caller's own RLS: a childId that isn't
  // theirs simply returns nothing here.
  const { data: child, error: childError } = await supabase
    .from("children")
    .select("id, name, family_id")
    .eq("id", childId)
    .maybeSingle();
  if (childError || !child) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  const familyId = child.family_id as string;

  // The wall (plans/2026-07-11-the-wall.md): a curriculum call is a
  // door, always an action, so there is no existing-content exemption
  // here. CallHomaPs shows the offer on this 403.
  if ((await familyWallCheckout(familyId)) !== null) {
    return Response.json({ ok: false, reason: "walled" }, { status: 403 });
  }

  if (rateLimited(`curriculum-call:${familyId}`, MAX_CALLS_PER_FAMILY_PER_DAY, DAY_MS)) {
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

  // Call the number she just gave; otherwise her own linked number
  // (multi-parent v0: each adult carries one), else the family's first.
  const linked = await getFamilyPhones(familyId);
  const callTarget =
    providedPhone ??
    linked.find((row) => row.member_user_id === user.id)?.phone_e164 ??
    linked[0]?.phone_e164 ??
    null;
  if (!callTarget) {
    return Response.json({ ok: false, reason: "no-phone" }, { status: 400 });
  }

  const facts = await buildReportFactsForChild(familyId, childId);
  if (!facts) {
    return Response.json({ ok: false, reason: "no-report" }, { status: 400 });
  }

  const apiKey = process.env.TELNYX_API_KEY;
  const fromNumber = process.env.TELNYX_FROM_NUMBER;
  const texmlAppId = process.env.TELNYX_CURRICULUM_TEXML_APP_ID;
  const assistantId = process.env.TELNYX_CURRICULUM_ASSISTANT_ID;
  if (!apiKey || !fromNumber || !texmlAppId || !assistantId) {
    console.error("curriculum call: Telnyx env not configured");
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const reportSummary = [
    `${facts.childName} is ${facts.childAge}.`,
    facts.interests.length > 0 ? `Interested in ${facts.interests.join(", ")}.` : "",
    facts.subjects
      .filter((subject) => subject.position !== "not_mapped")
      .map((subject) => `${subject.subjectName}: ${subject.badge}.`)
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  // The targeting brief: which 1-2 subjects need the call's questions,
  // and exactly what is confirmed vs. still a guess in each (founder
  // note: don't waste questions, go straight for missing context).
  const focusSubjects = buildCallFocusSummary(facts);

  let callControlId: string | null = null;
  try {
    const response = await fetch(
      `https://api.telnyx.com/v2/texml/ai_calls/${texmlAppId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: fromNumber,
          To: callTarget,
          AIAssistantId: assistantId,
          AIAssistantDynamicVariables: {
            family_id: familyId,
            child_id: childId,
            parent_name: facts.parentFirstName ?? "there",
            child_name: facts.childName,
            report_summary: reportSummary,
            focus_subjects: focusSubjects,
          },
        }),
      },
    );
    const text = await response.text();
    if (!response.ok) {
      console.error(`curriculum call: Telnyx ${response.status} ${text.slice(0, 300)}`);
      await emitMapEvent("voice.call_failed", {
        family_id: familyId,
        child_id: childId,
        reason: "telnyx-error",
      });
      return Response.json({ ok: false, reason: "telnyx-error" }, { status: 502 });
    }
    const data = JSON.parse(text) as { call_sid?: string };
    callControlId = data.call_sid ?? null;
  } catch (error) {
    console.error(
      "curriculum call: request failed:",
      error instanceof Error ? error.message : "unknown",
    );
    await emitMapEvent("voice.call_failed", {
      family_id: familyId,
      child_id: childId,
      reason: "telnyx-error",
    });
    return Response.json({ ok: false, reason: "telnyx-error" }, { status: 502 });
  }

  const { error: insertError } = await supabase.from("child_curriculum_calls").insert({
    child_id: childId,
    family_id: familyId,
    phone_e164: callTarget,
    call_control_id: callControlId,
    status: "initiated",
  });
  if (insertError) {
    console.error("curriculum call: failed to record call:", insertError.message);
  }

  await emitMapEvent("voice.call_started", { family_id: familyId, child_id: childId });
  return Response.json({ ok: true });
}
