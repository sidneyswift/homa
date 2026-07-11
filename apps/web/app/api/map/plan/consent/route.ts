import { mapPlanConsentSchema } from "@homa/core";

import { emitMapEvent } from "../../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../../lib/map/session";
import { getOrBuildPlan, getReportTokenForChild } from "../../../../../lib/map/store";

/**
 * POST /api/map/plan/consent
 * The report's one-tap month. The tap IS the explicit ask the email
 * doctrine requires (email.ts: "Every send here is something the parent
 * explicitly asked for"), so building the plan and arming its 28-day
 * retest email here breaks no law that silent auto-arming would have.
 * The plan itself is the same deterministic build the plan page does.
 */

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`plan-consent:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapPlanConsentSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { childId, subjectId } = parsed.data;

  try {
    const token = await getReportTokenForChild(family.id, childId);
    if (!token) {
      return Response.json({ ok: false, reason: "unknown-child" }, { status: 400 });
    }

    const built = await getOrBuildPlan(token, subjectId);
    if (!built) {
      return Response.json({ ok: false, reason: "unknown-plan" }, { status: 400 });
    }

    await emitMapEvent("map.plan_consented", {
      family_id: family.id,
      child_id: childId,
      subject: subjectId,
    });
    if (built.wasNew) {
      await emitMapEvent("map.plan_built", {
        family_id: family.id,
        child_id: childId,
        subject: subjectId,
      });
    }

    return Response.json({ ok: true, url: `/onboarding/r/${token}/plan/${subjectId}` });
  } catch (error) {
    console.error(
      "map/plan/consent failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
