import { cookies } from "next/headers";

import { mapClaimSchema, WAITLIST_SOURCES } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { claimFamily, mirrorToWaitlist } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";

/**
 * POST /api/map/claim
 * Signup: the one moment email is asked for, framed as creating the
 * account that generates the report. Runs right before scoring, or, for a
 * family whose only kids are outside the scored age range, before the hub
 * (so "I'll email you when it's ready" stays an honest promise). If the
 * email already belongs to a different, older lead, claimLead folds this
 * sitting's kids into that account rather than losing either side.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`claim:${clientIp(request)}`, 10)) {
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

  const parsed = mapClaimSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    // Email is the S1 ask (founder call 2026-07-06, third revision); the
    // name arrives later at account signup. If this lead somehow already
    // has a name (legacy order, Google profile), carry it forward into the
    // claim and the waitlist mirror rather than dropping it.
    const { familyId, returning, resumeToken } = await claimFamily({
      familyId: family.id,
      email: input.email,
      firstName: family.first_name ?? undefined,
      lastName: family.last_name ?? undefined,
      usState: input.usState ?? family.us_state ?? undefined,
    });
    await mirrorToWaitlist({
      email: input.email,
      firstName: family.first_name ?? undefined,
      usState: input.usState ?? family.us_state ?? undefined,
      source: family.source,
      utm: {},
    });

    const cookieStore = await cookies();
    cookieStore.set(MAP_RESUME_COOKIE, resumeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });

    const source = WAITLIST_SOURCES.includes(family.source as (typeof WAITLIST_SOURCES)[number])
      ? (family.source as (typeof WAITLIST_SOURCES)[number])
      : "other";
    await emitMapEvent("map.claimed", {
      family_id: familyId,
      source,
      has_state: Boolean(input.usState),
      returning,
    });

    return Response.json({ ok: true, returning });
  } catch (error) {
    // No email in server logs, ever.
    console.error("map/claim failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
