import { z } from "zod";

import { emitMapEventOnce } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { getReportEventIdsByToken } from "../../../../lib/map/store";

/** A report card appeared in chat. This is not a report-page view. */
const beaconSchema = z.object({
  token: z.string().min(16).max(160),
});

const RENDERED_DEDUPE_SECONDS = 10;

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`report-rendered:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  try {
    const parsed = beaconSchema.safeParse(await request.json());
    if (parsed.success) {
      const ids = await getReportEventIdsByToken(parsed.data.token);
      if (!ids) return Response.json({ ok: true });
      await emitMapEventOnce(
        "map.report_rendered",
        { family_id: ids.familyId, child_id: ids.childId, entry: "chat" },
        { childId: ids.childId, windowSeconds: RENDERED_DEDUPE_SECONDS },
      );
    }
  } catch {
    // Analytics never surface errors to the parent.
  }
  return Response.json({ ok: true });
}
