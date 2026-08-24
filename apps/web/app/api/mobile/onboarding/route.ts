import { getFamilyByAuthUser, startAnonymousFamily, attachAuthUser } from "../../../../lib/map/store";
import { mapDb } from "../../../../lib/map/db";
import { writeOnboardingRecord } from "../../../../lib/onboarding/store";
import { clientIp, rateLimited } from "../../../../lib/map/ratelimit";
import { requireAuthUserFromBearer } from "../../../../lib/map/session";

/**
 * POST /api/mobile/onboarding
 * The native onboarding bootstrap, called once right after the door
 * (mobile onboarding v1, plans/2026-08-18-mobile-onboarding-v1-plan.md).
 * A mobile-born account arrives signed in but family-less; this creates
 * its family server-side (an anonymous row immediately attached to the
 * auth user, reusing the web account moment's recovery and sandbox
 * logic) and tells the app which onboarding world it is in:
 *
 *  - "native":  a mobile-born family (source "mobile"); the app runs the
 *               native flow and resumes from the returned step.
 *  - "web":     a family that exists from web onboarding (founder ruling
 *               D6, 2026-08-18): the app skips the native flow entirely
 *               and Homa's chat continues their sitting.
 *
 * The family id never arrives in the request; it is derived from the
 * verified bearer token, and the response carries only the caller's own
 * family. Step and answer persistence does NOT live here: the app reads
 * and writes mobile_onboarding_state directly under RLS.
 */
export async function POST(request: Request): Promise<Response> {
  if (rateLimited(`mobile-onboarding:${clientIp(request)}`, 30)) {
    return Response.json({ ok: false }, { status: 429 });
  }

  const caller = await requireAuthUserFromBearer(request);
  if (!caller) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  try {
    let family = await getFamilyByAuthUser(caller.userId);

    if (!family) {
      if (!caller.email) {
        // Every supported door (Apple, Google, email code) yields an
        // email; a tokenless identity cannot own a family.
        return Response.json(
          { ok: false, reason: "no-email" },
          { status: 400 },
        );
      }
      const opened = await startAnonymousFamily({
        source: "mobile",
        utm: {},
      });
      await attachAuthUser({
        familyId: opened.familyId,
        authUserId: caller.userId,
        email: caller.email,
      });
      // Re-read through the same door every later request uses, so the
      // response reflects exactly what the membership row now grants
      // (attachAuthUser may have recovered an existing family instead).
      family = await getFamilyByAuthUser(caller.userId);
      if (!family) {
        return Response.json({ ok: false }, { status: 502 });
      }
    }

    if (family.source !== "mobile") {
      return Response.json({
        ok: true,
        world: "web",
      });
    }

    const sql = mapDb();
    const rows = await sql<
      { step: string; answers: unknown; completed_at: string | null }[]
    >`
      select step, answers, completed_at
      from public.mobile_onboarding_state
      where family_id = ${family.id}
    `;
    const state = rows[0] ?? null;

    // While the native walk is live, the family carries an ACTIVE
    // onboarding record. The record outranks profile_completed_at in
    // onboardingActiveForRow, and that matters here: the walk's "about
    // you" screen saves through /api/onboarding/basics, which stamps
    // profile_completed_at, and without this record that stamp would
    // flip the family to onboarding-done mid-walk and drop the
    // phone-only paywall exemption (gh#305) out from under her.
    // Idempotent merge; one small UPDATE per app open during the walk.
    if (!state?.completed_at) {
      await writeOnboardingRecord(family.id, {});
    }

    return Response.json({
      ok: true,
      world: "native",
      state: state
        ? {
            step: state.step,
            answers: state.answers,
            completed: state.completed_at !== null,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "mobile/onboarding bootstrap failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false }, { status: 502 });
  }
}
