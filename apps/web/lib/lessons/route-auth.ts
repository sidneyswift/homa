import { familyWallCheckout } from "../billing/wall";
import type { WallCheckout } from "../billing/wall-types";
import { resolveApiFamily, type ApiFamilyAuth } from "../api-auth";
import { lessonListenEnabled } from "./flag";

/**
 * Shared front door for every /api/lessons route: the feature flag,
 * the caller's family (cookie or bearer, never the body), the wall for
 * net-new signups (below), and the lesson-audio consent stamp (LL-0's
 * server gate: no consent, no lesson bytes anywhere).
 */

/**
 * Founder ruling 2026-07-27: recording a lesson had no wall check at
 * any layer, unlike every other door (plan, subject-lesson worksheets,
 * call, chat). Gated here like the rest, but for NET-NEW signups only:
 * a family that already existed when this shipped keeps the free
 * access it always had, never retroactively walled. Families created
 * on or after this instant get the same familyWallCheckout() check
 * every other door already uses.
 */
export const LESSON_RECORD_WALL_SINCE_MS = Date.parse("2026-07-27T20:46:00Z");

async function lessonRecordCheckout(
  familyId: string,
  createdAt: string | null | undefined,
): Promise<WallCheckout | null> {
  const createdAtMs = createdAt ? Date.parse(createdAt) : null;
  if (createdAtMs === null || createdAtMs < LESSON_RECORD_WALL_SINCE_MS) return null;
  return familyWallCheckout(familyId);
}

export type LessonRouteContext =
  | { status: "ok"; auth: ApiFamilyAuth; consented: boolean }
  | { status: "disabled" }
  | { status: "no_session" }
  | { status: "walled"; checkout: WallCheckout };

export async function resolveLessonRoute(
  request: Request,
): Promise<LessonRouteContext> {
  if (!lessonListenEnabled()) return { status: "disabled" };
  const auth = await resolveApiFamily(request);
  if (!auth) return { status: "no_session" };
  const { data } = await auth.supabase
    .from("families")
    .select("lesson_audio_consent_at, created_at")
    .eq("id", auth.familyId)
    .limit(1)
    .maybeSingle();

  const checkout = await lessonRecordCheckout(auth.familyId, data?.created_at);
  if (checkout) return { status: "walled", checkout };

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
  if (context.status === "walled") {
    return Response.json({ ok: false, reason: "walled" }, { status: 402 });
  }
  return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
}
