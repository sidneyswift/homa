import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";

/**
 * POST /api/map/deep-dive-start
 * Analytics beacon for a subject deep dive, carrying the mode the parent
 * chose (answer from memory vs sit together with the kid). The answers
 * themselves flow through the normal /api/map/answer route.
 */
const schema = z.object({
  childId: z.uuid(),
  domain: z.string().min(1).max(60),
  mode: z.enum(["parent", "together"]),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`dds:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  const family = await requireFamily();
  if (!family) return Response.json({ ok: false }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (parsed.success) {
      await emitMapEvent("map.deep_dive_started", {
        family_id: family.id,
        child_id: parsed.data.childId,
        domain: parsed.data.domain,
        mode: parsed.data.mode,
      });
    }
  } catch {
    // Analytics never surface errors.
  }
  return Response.json({ ok: true });
}
