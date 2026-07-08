import { validateCurriculum, type Curriculum } from "@homa/core";

import {
  fallbackCurriculum,
  generateCurriculum,
  type CallFacts,
} from "../../../../../lib/map/curriculum-generate";
import {
  buildReportFactsForChild,
  getPendingCallForChild,
  markCallCompleted,
  markCallFailed,
  upsertCurriculum,
} from "../../../../../lib/map/curriculum-store";
import { emitMapEvent } from "../../../../../lib/map/events";

/**
 * POST /api/voice/curriculum/insights: Telnyx's Insight Group webhook,
 * fired once a curriculum-review call ends and the Structured Insight
 * (scripts/telnyx-curriculum-provision.mts) finishes analyzing it.
 *
 * Auth: a long random key in the URL query string (same posture as
 * /api/voice/context; the keyed URL lives only in the Insight Group's
 * webhook config on Telnyx). The insight's OWN family_id/child_id fields
 * are never trusted alone: they must match a real 'initiated' call row
 * this server placed (getPendingCallForChild), so an attacker would need
 * BOTH the webhook secret and the Telnyx account to forge a write, at
 * which point the account is already compromised.
 */

interface InsightWebhookBody {
  event_type?: string;
  insights?: Array<{
    insight_name?: string;
    result?: Record<string, unknown>;
  }>;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (!secret || key !== secret) {
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

  const insight = (body.insights ?? [])[0]?.result;
  const childId = typeof insight?.child_id === "string" ? insight.child_id : null;
  const familyId = typeof insight?.family_id === "string" ? insight.family_id : null;
  if (!insight || !childId || !familyId) {
    console.error("curriculum insights webhook: missing child_id/family_id");
    return new Response("ok", { status: 200 });
  }

  // Correlate against a real call this server placed; an echoed id alone
  // is never enough to trigger a write (see header).
  const pendingCall = await getPendingCallForChild(childId);
  if (!pendingCall || pendingCall.familyId !== familyId) {
    console.error(`curriculum insights webhook: no matching call for child ${childId}`);
    return new Response("ok", { status: 200 });
  }

  const callFacts: CallFacts = {
    subjectsDiscussed: asStringArray(insight.subjects_discussed),
    concerns: asStringArray(insight.concerns),
    interestsConfirmed: asStringArray(insight.interests_confirmed),
    goals: asStringArray(insight.goals),
    parentRequests: asStringArray(insight.parent_requests),
    callSummary: typeof insight.call_summary === "string" ? insight.call_summary : "",
  };
  await markCallCompleted(pendingCall.id, insight);

  const reportFacts = await buildReportFactsForChild(childId);
  if (!reportFacts) {
    await markCallFailed(pendingCall.id, "report facts unavailable");
    return new Response("ok", { status: 200 });
  }

  let curriculum: Curriculum;
  let fallback = false;
  let durationMs = 0;
  let tokensIn = 0;
  let tokensOut = 0;

  try {
    const generated = await generateCurriculum(reportFacts, callFacts);
    durationMs = generated.durationMs;
    tokensIn = generated.tokensIn;
    tokensOut = generated.tokensOut;

    let verdict = validateCurriculum(generated.value);
    if (!verdict.ok) {
      console.error(`curriculum gate rejected: ${verdict.violations.join(", ")}, retrying`);
      const retry = await generateCurriculum(reportFacts, callFacts);
      durationMs += retry.durationMs;
      tokensIn += retry.tokensIn;
      tokensOut += retry.tokensOut;
      verdict = validateCurriculum(retry.value);
      curriculum = verdict.ok ? retry.value : fallbackCurriculum(reportFacts, callFacts);
      fallback = !verdict.ok;
    } else {
      curriculum = generated.value;
    }
  } catch (error) {
    console.error(
      "curriculum generation failed:",
      error instanceof Error ? error.message : "unknown",
    );
    curriculum = fallbackCurriculum(reportFacts, callFacts);
    fallback = true;
  }

  await upsertCurriculum(childId, pendingCall.id, curriculum, fallback ? "fallback" : "generated");
  await emitMapEvent("voice.curriculum_generated", {
    family_id: familyId,
    child_id: childId,
    duration_ms: durationMs,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    fallback,
  });

  return new Response("ok", { status: 200 });
}
