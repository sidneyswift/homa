import { cookies } from "next/headers";

import { mapSignupSchema, normalizeUsPhoneE164 } from "@homa/core";

import { emitMapEvent } from "../../../../lib/map/events";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireFamily } from "../../../../lib/map/session";
import { attachAuthUser } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/map/signup
 * Password: the last question, right before the report (founder call
 * 2026-07-06, second revision: "have them create a password as the LAST
 * question before they get results"). Her email is already known (S1);
 * this is the moment the anonymous lead becomes a real Supabase Auth
 * account. Google sign-ups never reach this route: /api/map/state links
 * their account the moment they return from the OAuth redirect.
 *
 * One world: the family row has existed since the first tap, so this is
 * purely an identity upgrade (one membership insert inside
 * attachAuthUser). Nothing migrates; the workspace was always here.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`signup:${clientIp(request)}`, 10)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  if (!family.email) {
    return Response.json({ ok: false, reason: "no-email" }, { status: 400 });
  }
  if (family.has_account) {
    // Already an account (double submit, or a Google link that raced this
    // request): nothing to do, but not an error either.
    return Response.json({ ok: true });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const parsed = mapSignupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const input = parsed.data;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: family.email,
      password: input.password,
      options: {
        data: { given_name: input.firstName, family_name: input.lastName ?? "" },
      },
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
      email: family.email,
      password: input.password,
    });
    if (signInError) {
      return Response.json({ ok: false, reason: "auth-failed" }, { status: 400 });
    }

    // Optional field: an unparseable number is skipped, never a failure.
    const phoneE164 = input.phone ? normalizeUsPhoneE164(input.phone) : null;

    const { familyId, returning, resumeToken } = await attachAuthUser({
      familyId: family.id,
      authUserId: signUpData.user.id,
      email: family.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phoneE164: phoneE164 ?? undefined,
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

    return Response.json({ ok: true });
  } catch (error) {
    console.error("map/signup failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
