import { mapPlanProgressSchema } from "@homa/core";

import { emitMapEvent } from "../../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../../lib/map/session";
import { savePlanProgress } from "../../../../../lib/map/store";

/**
 * POST /api/map/plan/progress
 * Syncs the four-week plan's check-offs to the plan row, so the month has
 * a memory the report can render at retest ("your work is showing up in
 * the numbers", now with receipts). Session-gated: a shared-link viewer's
 * checks stay in their own localStorage and never write here.
 */

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`plan-progress:${clientIp(request)}`, 60)) {
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
  const parsed = mapPlanProgressSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const { childId, domainId, checks } = parsed.data;

  try {
    const result = await savePlanProgress(family.id, childId, domainId, checks);
    if (!result) {
      return Response.json({ ok: false, reason: "unknown-plan" }, { status: 400 });
    }
    await emitMapEvent("map.plan_progress", {
      family_id: family.id,
      child_id: childId,
      domain: domainId,
      done_count: result.done,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error(
      "map/plan/progress failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
