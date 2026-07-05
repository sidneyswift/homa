import { MAP_KID_CAP, mapChildSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireLead } from "../../../../lib/map/session";
import { addChild, countChildren } from "../../../../lib/map/store";

/**
 * POST /api/map/children
 * Step S2: add one child to the caller's lead (resolved from the resume
 * cookie, never from the body). Returns whether the child's age band is
 * scored yet so the client can show the sage card honestly.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`children:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const lead = await requireLead();
  if (!lead) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = mapChildSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }

  try {
    if ((await countChildren(lead.id)) >= MAP_KID_CAP) {
      return Response.json({ ok: false, reason: "kid-cap" }, { status: 400 });
    }

    const { childId, ageMonths, inRange } = await addChild(lead.id, {
      name: parsed.data.name,
      birthMonth: parsed.data.birthMonth,
      interests: parsed.data.interests,
      helpWith: parsed.data.helpWith,
    });

    await emitMapEvent("map.child_added", {
      lead_id: lead.id,
      child_id: childId,
      age_months: ageMonths,
      in_range: inRange,
    });

    return Response.json({ ok: true, childId, ageMonths, inRange });
  } catch (error) {
    console.error("map/children failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
