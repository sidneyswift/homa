import { emitMapEvent } from "../../../../../lib/map/events";
import {
  finishLessonRecording,
  listLessonSegments,
} from "../../../../../lib/lessons/store";
import { runLessonAnalysis } from "../../../../../lib/lessons/worker";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * POST /api/lessons/{id}/finish: the parent tapped done (plan
 * 2026-07-13-lesson-listen.md §4.4 step 3). Flips the lesson to
 * uploaded, emits lesson.recorded, and runs the analysis inline:
 * straggler segments, the synthesis pass, the clause fan-out, and the
 * review write. The client polls /status rather than awaiting this
 * response; if this function dies the cron sweep finishes the job.
 */

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;

  let body: { durationSeconds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const durationSeconds = Number.isFinite(Number(body.durationSeconds))
    ? Math.max(0, Math.round(Number(body.durationSeconds)))
    : null;

  const lesson = await finishLessonRecording({
    lessonId,
    familyId: context.auth.familyId,
    durationSeconds,
  });
  if (lesson === null) {
    return Response.json({ ok: false, reason: "not-open" }, { status: 409 });
  }

  const segments = await listLessonSegments(
    lessonId,
    context.auth.familyId,
  );
  await emitMapEvent("lesson.recorded", {
    family_id: context.auth.familyId,
    child_id: lesson.childId,
    source: lesson.source,
    segment_count: segments.length,
    duration_seconds: lesson.durationSeconds,
  });

  const outcome = await runLessonAnalysis(
    lessonId,
    context.auth.familyId,
  );
  return Response.json({ ok: true, analysis: outcome.status });
}
