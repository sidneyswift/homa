import { cookies } from "next/headers";

import { mapClaimSchema, WAITLIST_SOURCES } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireLead } from "../../../../lib/map/session";
import { claimLead, mirrorToWaitlist } from "../../../../lib/map/store";
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

  const lead = await requireLead();
  if (!lead) {
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
    const { leadId, returning, resumeToken } = await claimLead({
      leadId: lead.id,
      email: input.email,
      firstName: lead.first_name ?? undefined,
      lastName: lead.last_name ?? undefined,
      usState: input.usState ?? lead.us_state ?? undefined,
    });
    await mirrorToWaitlist({
      email: input.email,
      firstName: lead.first_name ?? undefined,
      usState: input.usState ?? lead.us_state ?? undefined,
      source: lead.source,
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

    const source = WAITLIST_SOURCES.includes(lead.source as (typeof WAITLIST_SOURCES)[number])
      ? (lead.source as (typeof WAITLIST_SOURCES)[number])
      : "other";
    await emitMapEvent("map.claimed", {
      lead_id: leadId,
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
