import { cookies } from "next/headers";

import { mapStartSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { startAnonymousFamily } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";

/**
 * POST /api/map/start
 * S1: opens an anonymous session, silently, before she's typed anything.
 * The family row exists from this first tap (one world); kids and the
 * checklist auto-save under this cookie-only family, and email is
 * asked for once, at signup, right before the report is scored (see
 * /api/map/claim). Idempotent: a caller who already holds a valid resume
 * cookie gets a no-op success rather than a second row.
 */

interface StartBody {
  source?: unknown;
  utm?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`start:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const existing = await requireFamily();
  if (existing) {
    return Response.json({ ok: true, returning: true });
  }

  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    body = {};
  }

  const parsed = mapStartSchema.safeParse({ source: body.source, utm: body.utm });
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const { familyId, resumeToken } = await startAnonymousFamily({
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
      family_id: familyId,
      source: input.source,
      has_state: false,
      returning: false,
    });

    return Response.json({ ok: true, returning: false });
  } catch (error) {
    console.error("map/start failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
