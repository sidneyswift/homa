import { resolveApiFamily, type ApiFamilyAuth } from "../api-auth";
import { lessonListenEnabled } from "./flag";

/**
 * Shared front door for every /api/lessons route: the feature flag,
 * the caller's family (cookie or bearer, never the body), and the
 * lesson-audio consent stamp (LL-0's server gate: no consent, no
 * lesson bytes anywhere).
 */

export type LessonRouteContext =
  | { status: "ok"; auth: ApiFamilyAuth; consented: boolean }
  | { status: "disabled" }
  | { status: "no_session" };

export async function resolveLessonRoute(
  request: Request,
): Promise<LessonRouteContext> {
  if (!lessonListenEnabled()) return { status: "disabled" };
  const auth = await resolveApiFamily(request);
  if (!auth) return { status: "no_session" };
  const { data } = await auth.supabase
    .from("families")
    .select("lesson_audio_consent_at")
    .eq("id", auth.familyId)
    .limit(1)
    .maybeSingle();
  return {
    status: "ok",
    auth,
    consented: Boolean(data?.lesson_audio_consent_at),
  };
}

export function lessonRouteRefusal(
  context: Exclude<LessonRouteContext, { status: "ok" }>,
): Response {
  if (context.status === "disabled") {
    return Response.json({ ok: false, reason: "disabled" }, { status: 404 });
  }
  return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
}
