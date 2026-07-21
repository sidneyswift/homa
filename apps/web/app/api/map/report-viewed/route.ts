import { z } from "zod";

import { emitMapEventOnce } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { getReportEventIdsByToken } from "../../../../lib/map/store";

/**
 * POST /api/map/report-viewed
 * Fire-and-forget analytics beacon from the report page (server components
 * should not emit on render, prefetches would double-count). The report
 * token is the access grant; ids are resolved server-side before the
 * event is emitted. Emission dedupes a short same-child window: two
 * beacons moments apart (a doubled page context, a fast reload) are one
 * view, not two.
 */
const beaconSchema = z.object({
  token: z.string().min(16).max(160),
  entry: z.enum(["instant", "link", "chat"]),
});

/** Two views of one report inside this window are one visit (live
 * 2026-07-18: the beacon landed in same-child pairs, once 6
 * microseconds apart). Well past any double-fire; far under a real
 * return visit. */
const VIEWED_DEDUPE_SECONDS = 10;

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`viewed:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  try {
    const parsed = beaconSchema.safeParse(await request.json());
    if (parsed.success) {
      const ids = await getReportEventIdsByToken(parsed.data.token);
      if (!ids) return Response.json({ ok: true });
      await emitMapEventOnce(
        "map.report_viewed",
        { family_id: ids.familyId, child_id: ids.childId, entry: parsed.data.entry },
        { childId: ids.childId, windowSeconds: VIEWED_DEDUPE_SECONDS },
      );
    }
  } catch {
    // Analytics never surface errors to the caller.
  }
  return Response.json({ ok: true });
}
