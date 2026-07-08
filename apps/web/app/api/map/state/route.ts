import { cookies } from "next/headers";

import { emitMapEvent } from "../../../../lib/map/events";
import { requireFamily } from "../../../../lib/map/session";
import { attachAuthUser, getFamilyByResumeToken, getFamilyState, hasFamilyContext } from "../../../../lib/map/store";
import { MAP_RESUME_COOKIE } from "../../../../lib/map/tokens";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * GET /api/map/state
 * Resume: the full saved snapshot for the caller's lead (children, answers,
 * report tokens), so the client can restore the flow exactly where it
 * stopped, on any device holding the cookie. Question plans are computed
 * client-side from the same bank (pure data, same package). Returns
 * ok:false (not 401) for cookieless visitors: a fresh start is a normal
 * state, not an error.
 *
 * Also the landing spot for a Google sign-up: the OAuth callback redirects
 * back here with a Supabase Auth session cookie already set (separate from
 * the map resume cookie), and the client's next call to this route is
 * always /api/map/state (the mount effect calls it first). If the lead has
 * no account yet, resolve the auth session server-side and link it, so the
 * client never needs a dedicated "did Google work" round trip.
 */
export async function GET(): Promise<Response> {
  let family = await requireFamily();
  if (!family) return Response.json({ ok: false });

  try {
    if (!family.has_account) {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
        const givenName = typeof meta.given_name === "string" ? meta.given_name.trim() : "";
        const fullName = typeof meta.full_name === "string" ? meta.full_name.trim() : "";
        const firstName = givenName || (fullName ? fullName.split(" ")[0] : undefined);
        const lastName =
          typeof meta.family_name === "string" && meta.family_name.trim()
            ? meta.family_name.trim()
            : fullName.split(" ").slice(1).join(" ") || undefined;

        const { familyId, returning, resumeToken } = await attachAuthUser({
          familyId: family.id,
          authUserId: user.id,
          email: user.email,
          firstName,
          lastName,
        });

        const cookieStore = await cookies();
        cookieStore.set(MAP_RESUME_COOKIE, resumeToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 90,
        });

        const relinked = await getFamilyByResumeToken(resumeToken);
        if (relinked) family = relinked;
        await emitMapEvent("map.account_created", { family_id: familyId, method: "google", returning });
      }
    }

    const state = await getFamilyState(family);
    const familyContextDone = await hasFamilyContext(family.id);
    return Response.json({
      ok: true,
      firstName: state.family.first_name,
      hasAccount: state.family.has_account,
      familyContextDone,
      // The caller's own email (cookie-authenticated), for the
      // "send this link to my other device" button.
      email: state.family.email,
      children: state.children.map((child) => ({
        id: child.id,
        name: child.name,
        birthDate: child.birth_month,
        interests: child.interests,
        helpWith: child.help_with,
        ageMonths: child.age_months,
        inRange: child.in_range,
        answered: child.answered,
        reportToken: child.report_token,
        answers: state.answers[child.id] ?? [],
      })),
    });
  } catch (error) {
    console.error("map/state failed:", error instanceof Error ? error.message : "unknown");
    return Response.json({ ok: false }, { status: 502 });
  }
}
