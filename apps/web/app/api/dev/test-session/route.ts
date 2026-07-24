import { randomUUID } from "node:crypto";

import { emitMapEvent } from "../../../../lib/map/events";
import { setMapResumeCookie } from "../../../../lib/map/resume-cookie";
import { attachAuthUser, startAnonymousFamily } from "../../../../lib/map/store";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/dev/test-session: provision a throwaway family and sign in.
 *
 * The whole onboarding flow starts behind an account, so nothing past
 * the first screen can be walked end to end without one. This is the
 * fixture that makes that walk possible: it creates a family, attaches a
 * real Supabase Auth user to it, and leaves the browser holding both the
 * auth cookies and the map resume cookie, exactly as /api/map/claim does
 * for a real parent. It reuses those same primitives rather than
 * reimplementing them, so a session it mints is indistinguishable from a
 * real one and the walk tests the real thing.
 *
 * Four gates, and all four have to hold:
 *
 * 1. Never in production. NODE_ENV is the first check and it 404s, so
 *    this route does not exist on the deployed site.
 * 2. Never without HOMA_DEV_TEST_SESSIONS. A local build with a
 *    production-shaped env still cannot reach it by accident.
 * 3. The email is GENERATED here and never read from the request. It
 *    always carries the reserved +homatest alias, which is what marks
 *    the family sandbox at the account moment (founder ask 2026-07-14),
 *    so a session from this route can only ever produce a family that is
 *    fenced out of funnels, physical mail, and the founder's alerts.
 * 4. The password is random per call and is returned once, to the
 *    caller who just asked for it, so a walk can sign back in on a
 *    second device. It is never stored anywhere by this route.
 *
 * You usually only need this ONCE. To walk the flow again as the same
 * account, use /dev/reset, which deletes the family and gives this
 * login a fresh one; that is the loop worth bookmarking. Use this route
 * when you want a genuinely separate account (two families side by
 * side, a second device signing in).
 *
 * Deleting what it makes: `tsx scripts/delete-test-families.mts`
 * (dry run by default, --apply to retire), or the family file in the
 * founder console.
 */

function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

/** The reserved alias is not optional: it is the sandbox marker. */
function generateTestEmail(): string {
  const base = (process.env.HOMA_DEV_TEST_EMAIL_BASE ?? "homa.dev").trim();
  const [local, domain] = base.includes("@")
    ? base.split("@")
    : [base, "example.invalid"];
  return `${local}+homatest${Date.now().toString(36)}@${domain}`.toLowerCase();
}

interface ProvisionedSession {
  familyId: string;
  email: string;
  password: string;
  userId: string;
}

/**
 * Does the work and lets the CALLER build the response.
 *
 * That split is the whole point: cookies().set() queues onto the
 * response Next is about to send, so a handler that builds its own
 * Response and copies headers off another one silently drops them. The
 * first version of this route did exactly that and handed back a browser
 * with an auth cookie and no map resume cookie.
 */
async function provisionTestSession(): Promise<
  { ok: true; session: ProvisionedSession } | { ok: false; message: string }
> {
  const email = generateTestEmail();
  const password = `homa-test-${randomUUID()}`;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError || !signUpData.user) {
      return { ok: false, message: signUpError?.message ?? "no user from signup" };
    }
    // Sign in explicitly, exactly as the real claim route does, so the
    // session cookies are set deterministically rather than depending on
    // the project's auto-confirm setting staying as it is.
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) return { ok: false, message: signInError.message };

    const { familyId: anonymousId, resumeToken: anonymousToken } =
      await startAnonymousFamily({ source: "organic", utm: {} });
    await setMapResumeCookie(anonymousToken);

    const { familyId, resumeToken } = await attachAuthUser({
      familyId: anonymousId,
      authUserId: signUpData.user.id,
      email,
    });
    await setMapResumeCookie(resumeToken);
    await emitMapEvent("map.account_created", {
      family_id: familyId,
      method: "password",
      returning: false,
    });

    return {
      ok: true,
      session: { familyId, email, password, userId: signUpData.user.id },
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "unknown" };
  }
}

export async function POST(): Promise<Response> {
  if (!devTestSessionsEnabled()) return new Response("Not found", { status: 404 });
  const result = await provisionTestSession();
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 502 });
  }
  return Response.json({ ok: true, ...result.session, next: "/onboarding" });
}

/**
 * GET /api/dev/test-session: the same thing, then straight into the
 * flow. One address to paste into a browser to become a brand new
 * parent, which is what makes the walk a walk rather than a setup
 * exercise. The credentials are not returned on this path; use POST when
 * a second device needs to sign in as the same family.
 */
export async function GET(): Promise<Response> {
  if (!devTestSessionsEnabled()) return new Response("Not found", { status: 404 });
  const result = await provisionTestSession();
  if (!result.ok) {
    return Response.json({ ok: false, message: result.message }, { status: 502 });
  }
  // Redirect built here, so the cookies queued above ride this response.
  return new Response(null, {
    status: 303,
    headers: {
      location: "/onboarding",
      "x-homa-test-family": result.session.familyId,
    },
  });
}
