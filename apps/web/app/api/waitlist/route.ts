import { emitEvent, waitlistSubmissionSchema } from "@homa/core";

import { clientIp, rateLimited } from "../../../lib/map/ratelimit";

/**
 * POST /api/waitlist
 * Validates a submission and writes it to public.waitlist over the Supabase
 * Data API using the publishable key. RLS makes that key write-only for this
 * table (insert pending rows, never read), so no secret is required here.
 *
 * Duplicate emails return ok: the caller retries on flaky wifi and a repeat
 * submission means "you are already on the list", not an error.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

interface WaitlistRequestBody {
  email?: unknown;
  firstName?: unknown;
  usState?: unknown;
  kidCount?: unknown;
  kidAgeBands?: unknown;
  source?: unknown;
  utm?: unknown;
  /** Honeypot: humans never see this field; bots fill it. */
  website?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("waitlist: missing Supabase env vars");
    return Response.json({ ok: false }, { status: 500 });
  }

  // Public, unauthenticated endpoint: throttle by IP so it cannot be
  // hammered into Supabase and the events table, matching the map routes'
  // damper (the honeypot below only stops naive bots) (2026-07-11 review,
  // CR-19).
  if (rateLimited(`waitlist:${clientIp(request)}`, 20)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: WaitlistRequestBody;
  try {
    body = (await request.json()) as WaitlistRequestBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (typeof body.website === "string" && body.website.length > 0) {
    // Bot filled the honeypot: pretend success, store nothing.
    return Response.json({ ok: true, duplicate: false });
  }

  const parsed = waitlistSubmissionSchema.safeParse({
    email: body.email,
    firstName: typeof body.firstName === "string" && body.firstName.trim() ? body.firstName : undefined,
    usState: body.usState,
    kidCount: body.kidCount ?? undefined,
    kidAgeBands: body.kidAgeBands,
    source: body.source,
    utm: body.utm,
  });
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const submission = parsed.data;

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      email: submission.email,
      first_name: submission.firstName ?? null,
      source: submission.source,
      utm: submission.utm,
      us_state: submission.usState ?? null,
      kid_count: submission.kidCount ?? null,
      kid_age_bands: submission.kidAgeBands,
    }),
  });

  if (insert.status === 201) {
    await emitEvent(
      { supabaseUrl: SUPABASE_URL, supabaseKey: SUPABASE_KEY },
      "waitlist.joined",
      {
        source: submission.source,
        channel_variant: submission.source === "conference" ? "conference" : "default",
        us_state: submission.usState,
        kid_age_bands: submission.kidAgeBands,
      },
    );
    return Response.json({ ok: true, duplicate: false });
  }

  if (insert.status === 409) {
    return Response.json({ ok: true, duplicate: true });
  }

  // No email in server logs, ever: status code only.
  console.error(`waitlist: insert failed with HTTP ${insert.status}`);
  return Response.json({ ok: false }, { status: 502 });
}
