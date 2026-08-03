import { z } from "zod";

import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamilyWithActorFromRequest } from "../../../../lib/map/session";
import { readMakingStatus } from "../../../../lib/onboarding/making-status";

/**
 * GET /api/onboarding/making-status?jobId=...
 * The first-making promise card's own read, so waiting on the page
 * costs no model turn (same shape as the checklist card's re-read of
 * /api/map/state). The family comes from the browser cookie or native
 * bearer session, never the query; a job id from another family simply
 * does not exist here.
 */

const jobIdSchema = z.uuid();

export async function GET(request: Request): Promise<Response> {
  if (rateLimited(`onboarding-making-status:${clientIp(request)}`, 60)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let actor;
  try {
    actor = await requireFamilyWithActorFromRequest(request);
  } catch {
    return Response.json({ ok: false, reason: "auth-error" }, { status: 401 });
  }
  if (!actor) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const jobId = new URL(request.url).searchParams.get("jobId");
  const parsed = jobIdSchema.safeParse(jobId);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  const status = await readMakingStatus(actor.family.id, parsed.data);
  if (!status) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  return Response.json({ ok: true, ...status });
}
