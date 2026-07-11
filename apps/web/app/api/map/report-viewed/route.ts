import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { getReportEventIdsByToken } from "../../../../lib/map/store";

/**
 * POST /api/map/report-viewed
 * Fire-and-forget analytics beacon from the report page (server components
 * should not emit on render, prefetches would double-count). The report
 * token is the access grant; ids are resolved server-side before the
 * event is emitted.
 */
const beaconSchema = z.object({
  token: z.string().min(16).max(160),
  entry: z.enum(["instant", "link"]),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`viewed:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  try {
    const parsed = beaconSchema.safeParse(await request.json());
    if (parsed.success) {
      const ids = await getReportEventIdsByToken(parsed.data.token);
      if (!ids) return Response.json({ ok: true });
      await emitMapEvent("map.report_viewed", {
        family_id: ids.familyId,
        child_id: ids.childId,
        entry: parsed.data.entry,
      });
    }
  } catch {
    // Analytics never surface errors to the caller.
  }
  return Response.json({ ok: true });
}
