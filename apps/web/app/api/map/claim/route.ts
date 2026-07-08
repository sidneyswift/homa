import { cookies } from "next/headers";

import { mapClaimSchema } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { attachAuthUser, mirrorToWaitlist } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/map/claim
 * S1's create-account submit (founder call 2026-07-08, overturning
 * 2026-07-06's "password is the last question" ruling): email and
 * password, right up front. Her name deliberately is NOT collected here
 * (founder follow-up, same day): the create-your-family step right after
 * this asks for it, and asking twice reads as a bug. This is the one
 * moment the anonymous lead becomes a real Supabase Auth account for the
 * password path; Google sign-ups skip this route entirely and link at
 * /api/map/state instead. If the email already belongs to a different,
 * older family, attachAuthUser folds this sitting's kids into that family
 * rather than losing either side. If it already belongs to a real account
 * (any device, any sitting), signUp fails honestly and the client offers
 * sign-in instead of a doomed "try again".
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`claim:${clientIp(request)}`, 10)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  if (family.has_account) {
    // Already an account (double submit, or a Google link that raced this
    // request): nothing to do, but not an error either.
    return Response.json({ ok: true, returning: false });
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
    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (signUpError || !signUpData.user) {
      // A returning parent whose email already has an account can never
      // succeed by retrying here; the client needs to know so it can
      // offer sign-in instead of a generic try-again.
      const alreadyRegistered =
        signUpError?.code === "user_already_exists" ||
        /already (been )?registered/i.test(signUpError?.message ?? "");
      return Response.json(
        {
          ok: false,
          reason: alreadyRegistered ? "exists" : "auth-failed",
          message: signUpError?.message,
        },
        { status: 400 },
      );
    }

    // Open signup accounts are auto-confirmed at creation (migration #8),
    // but sign in explicitly anyway so the session cookie is set
    // deterministically even if that project setting ever changes.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (signInError) {
      return Response.json({ ok: false, reason: "auth-failed" }, { status: 400 });
    }

    // No name here by design; FamilyStep saves it right after this.
    const { familyId, returning, resumeToken } = await attachAuthUser({
      familyId: family.id,
      authUserId: signUpData.user.id,
      email: input.email,
      usState: input.usState,
    });
    await mirrorToWaitlist({
      email: input.email,
      usState: input.usState,
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

    await emitMapEvent("map.account_created", { family_id: familyId, method: "password", returning });

    return Response.json({ ok: true, returning });
  } catch (error) {
    // No email in server logs, ever.
    console.error("map/claim failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
