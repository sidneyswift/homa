import { cookies } from "next/headers";

import { mapStartSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { mirrorToWaitlist, upsertLead } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";

/**
 * POST /api/map/start
 * Step S1: secure the lead before any work is asked. Creates (or refreshes)
 * the lead, mirrors it into the waitlist table so the invite list stays one
 * list, and sets the httpOnly resume cookie the rest of the flow rides on.
 * Duplicate emails are success, never an error.
 */

interface StartBody {
  email?: unknown;
  firstName?: unknown;
  usState?: unknown;
  source?: unknown;
  utm?: unknown;
  /** Honeypot: humans never see this field; bots fill it. */
  website?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`start:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    // Bot filled the honeypot: pretend success, store nothing.
    return Response.json({ ok: true, returning: false });
  }

  const parsed = mapStartSchema.safeParse({
    email: body.email,
    firstName: typeof body.firstName === "string" && body.firstName.trim() ? body.firstName : undefined,
    usState: typeof body.usState === "string" && body.usState ? body.usState : undefined,
    source: body.source,
    utm: body.utm,
  });
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { leadId, returning, resumeToken } = await upsertLead({
      email: input.email,
      firstName: input.firstName,
      usState: input.usState,
      source: input.source,
      utm: input.utm,
    });
    await mirrorToWaitlist({
      email: input.email,
      firstName: input.firstName,
      usState: input.usState,
      source: input.source,
      utm: input.utm,
    });

    const cookieStore = await cookies();
    cookieStore.set(MAP_RESUME_COOKIE, resumeToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90,
    });

    await emitMapEvent("map.started", {
      lead_id: leadId,
      source: input.source,
      has_state: Boolean(input.usState),
      returning,
    });

    return Response.json({ ok: true, returning });
  } catch (error) {
    // No email in server logs, ever.
    console.error("map/start failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
