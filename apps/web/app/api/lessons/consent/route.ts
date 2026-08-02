import { setLessonAudioConsent } from "../../../../lib/family-profile";
import { emitMapEvent } from "../../../../lib/map/events";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../lib/lessons/route-auth";

/** Records the adult's explicit native consent before any lesson audio starts. */
export async function POST(request: Request): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  if (!context.consented) {
    await setLessonAudioConsent(context.auth.familyId, context.auth.userId);
    await emitMapEvent("family.lesson_audio_consented", {
      family_id: context.auth.familyId,
    });
  }
  return Response.json({ ok: true, consented: true });
}
