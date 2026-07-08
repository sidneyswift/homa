import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";

/**
 * POST /api/map/report-viewed
 * Fire-and-forget analytics beacon from the report page (server components
 * should not emit on render, prefetches would double-count). Carries only
 * pseudonymous ids that the report page itself provided.
 */
const beaconSchema = z.object({
  familyId: z.uuid(),
  childId: z.uuid(),
  entry: z.enum(["instant", "link"]),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`viewed:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  try {
    const parsed = beaconSchema.safeParse(await request.json());
    if (parsed.success) {
      await emitMapEvent("map.report_viewed", {
        family_id: parsed.data.familyId,
        child_id: parsed.data.childId,
        entry: parsed.data.entry,
      });
    }
  } catch {
    // Analytics never surface errors to the caller.
  }
  return Response.json({ ok: true });
}
