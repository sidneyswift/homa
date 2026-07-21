import { MAP_FLOW_STEPS, type MapFlowStep } from "@homa/core";

import { emitMapEvent, stepViewRecorded } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";

/**
 * POST /api/map/step  { step }
 * The per-card funnel beacon (funnel work 2026-07-20,
 * docs/homa-planning/plans/2026-07-20-onboarding-funnel-drip.md). The
 * onboarding flow pings this on every phase change so map.step_viewed
 * records which card each family reached. Before this, a family stuck on
 * the account (parent) step was indistinguishable in the data from one
 * that never arrived; now per-card drop-off is measurable.
 *
 * Server-side emission is required: the public events policy stays
 * waitlist-only, so map.* rows can only be written with the server key
 * (same reason /api/map/start emits map.started rather than the browser).
 * The family comes from the resume cookie or auth session, never the body
 * (tenancy law), which is also why it works for the anonymous pre-account
 * session sitting on the parent step.
 *
 * Emitted once per (family, step): the beacon fires again on a resume days
 * later, and the funnel wants a single row per card reached, so the route
 * checks stepViewRecorded first. Best-effort by law: a beacon that fails
 * never blocks the flow.
 */

const ALLOWED_STEPS = new Set<string>(MAP_FLOW_STEPS);

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`step:${clientIp(request)}`, 60)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const step = (body as { step?: unknown }).step;
  if (typeof step !== "string" || !ALLOWED_STEPS.has(step)) {
    return Response.json({ ok: false, reason: "bad-step" }, { status: 400 });
  }

  if (!(await stepViewRecorded(family.id, step as MapFlowStep))) {
    await emitMapEvent("map.step_viewed", {
      family_id: family.id,
      step: step as MapFlowStep,
    });
  }

  return Response.json({ ok: true });
}
