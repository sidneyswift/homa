import { z } from "zod";

import { WALL_DOORS } from "@homa/core";

import { familyWallCheckout } from "../../../../lib/billing/wall";
import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { childBelongsToFamily } from "../../../../lib/map/store";

/**
 * POST /api/billing/beacon: the wall's analytics door
 * (plans/2026-07-11-the-wall.md). The browser reports taps and wall
 * moments; this route resolves the family from auth context (never the
 * body), re-scopes the optional child id, computes `walled` server-side,
 * and emits the registry events. door_tap fires with the wall flag OFF
 * too, on purpose: baseline tap-through data from the free era is what
 * the paywall decision will be graded against.
 */

const beaconSchema = z.object({
  kind: z.enum(["door_tap", "wall_viewed", "wall_dismissed", "checkout_started"]),
  door: z.enum(WALL_DOORS),
  childId: z.uuid().optional(),
  plan: z.enum(["monthly", "annual"]).optional(),
});

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`wall-beacon:${clientIp(request)}`, 60)) {
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
  const parsed = beaconSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const beacon = parsed.data;

  // Re-scope the client-supplied child id (tenancy law). When a child
  // id arrives and is NOT the caller's, the whole beacon drops: that is
  // a shared-link viewer who has her own Homa session tapping someone
  // else's report, and attributing her tap to her family would poison
  // the funnel data.
  let childId: string | undefined;
  if (beacon.childId) {
    if (!(await childBelongsToFamily(beacon.childId, family.id))) {
      return Response.json({ ok: true });
    }
    childId = beacon.childId;
  }

  switch (beacon.kind) {
    case "door_tap": {
      const walled = (await familyWallCheckout(family.id)) !== null;
      await emitMapEvent("report.action_tapped", {
        family_id: family.id,
        ...(childId ? { child_id: childId } : {}),
        door: beacon.door,
        walled,
      });
      break;
    }
    case "wall_viewed":
      await emitMapEvent("wall.viewed", { family_id: family.id, door: beacon.door });
      break;
    case "wall_dismissed":
      await emitMapEvent("wall.dismissed", { family_id: family.id, door: beacon.door });
      break;
    case "checkout_started": {
      if (!beacon.plan) {
        return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
      }
      await emitMapEvent("wall.checkout_started", {
        family_id: family.id,
        door: beacon.door,
        plan: beacon.plan,
      });
      break;
    }
    default: {
      const exhaustive: never = beacon.kind;
      throw new Error(`Unhandled wall beacon kind: ${exhaustive}`);
    }
  }

  return Response.json({ ok: true });
}
