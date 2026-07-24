import { setMapResumeCookie } from "../../../../lib/map/resume-cookie";
import { requireFamily } from "../../../../lib/map/session";
import { resetOnboardingFamily } from "../../../../lib/onboarding/dev-reset";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/dev/reset-onboarding: put this account back to before.
 *
 * The companion to /api/dev/test-session. That one gets you an account;
 * this one lets you keep it. Same login, same bookmark, brand new
 * family, as many times as you like.
 *
 * Three gates, same as the harness: never in production, never without
 * HOMA_DEV_TEST_SESSIONS, and never for a family that is not sandbox
 * (checked again inside resetOnboardingFamily, which is where the
 * deleting happens).
 *
 * The family is resolved from the caller's own session. There is no
 * family id in the request, so there is nothing to point at the wrong
 * household.
 */

function devTestSessionsEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  const value = (process.env.HOMA_DEV_TEST_SESSIONS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

export async function POST(): Promise<Response> {
  if (!devTestSessionsEnabled()) return new Response("Not found", { status: 404 });

  const family = await requireFamily();
  if (!family) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    // Without the auth user there is nobody to re-attach, and a delete
    // would strand the account with no family at all.
    return Response.json({ ok: false, reason: "no-auth-user" }, { status: 401 });
  }

  try {
    const result = await resetOnboardingFamily({
      familyId: family.id,
      authUserId: user.id,
      email: user.email,
    });
    // The old resume cookie points at a family that no longer exists.
    await setMapResumeCookie(result.resumeToken);
    return Response.json({
      ok: true,
      previousFamilyId: result.previousFamilyId,
      familyId: result.familyId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const refused = message.includes("not a test family");
    console.error("dev/reset-onboarding failed:", message);
    return Response.json(
      { ok: false, reason: refused ? "not-sandbox" : "failed", message },
      { status: refused ? 403 : 502 },
    );
  }
}
