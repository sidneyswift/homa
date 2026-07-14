import {
  getLessonForFamily,
  listLessonSegments,
} from "../../../../../lib/lessons/store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * GET /api/lessons/{id}/status: the review page's poll (plan
 * 2026-07-13-lesson-listen.md §4.6, the narrative-status pattern:
 * poll only while something is pending, stop on a terminal state).
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;

  const lesson = await getLessonForFamily(lessonId, context.auth.familyId);
  if (lesson === null) {
    return Response.json({ ok: false, reason: "unknown-lesson" }, { status: 404 });
  }
  const segments = await listLessonSegments(
    lessonId,
    context.auth.familyId,
  );
  return Response.json({
    ok: true,
    status: lesson.status,
    segmentCount: segments.length,
    transcribedCount: segments.filter(
      (segment) => segment.transcript !== null,
    ).length,
    error: lesson.status === "failed",
  });
}
