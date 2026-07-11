import { z } from "zod";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { childBelongsToFamily } from "../../../../lib/map/store";

/**
 * POST /api/map/walk-fork
 * Analytics beacon for the onboarding depth fork
 * (plans/2026-07-11-onboarding-depth-fork.md): after a subject's core
 * questions the mom chose "go deeper" or "move on". choice feeds the
 * per-subject take-rate the founder asked to watch from day one; the
 * walk's answers flow through /api/map/walk.
 */
const schema = z.object({
  childId: z.uuid(),
  subject: z.string().min(1).max(60),
  choice: z.enum(["deeper", "move_on"]),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`walk-fork:${clientIp(request)}`, 30)) {
    return Response.json({ ok: true });
  }
  const family = await requireFamily();
  if (!family) return Response.json({ ok: false }, { status: 401 });

  try {
    const parsed = schema.safeParse(await request.json());
    if (parsed.success) {
      const childId = parsed.data.childId;
      if (!(await childBelongsToFamily(childId, family.id))) {
        return Response.json({ ok: true });
      }
      await emitMapEvent("map.depth_fork_decided", {
        family_id: family.id,
        child_id: childId,
        subject: parsed.data.subject,
        choice: parsed.data.choice,
      });
    }
  } catch {
    // Analytics never surface errors.
  }
  return Response.json({ ok: true });
}
