import {
  createLessonRecording,
} from "../../../lib/lessons/store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../lib/lessons/route-auth";
import { lessonBlobPrefix } from "../../../lib/lessons/blobs";

/**
 * POST /api/lessons: opens one lesson (plan 2026-07-13-lesson-listen.md
 * §4.4 step 1). The child is re-scoped to the caller's family inside
 * the store; consent (LL-0) gates the door; the rolling daily cap
 * answers with honest copy instead of a mystery failure.
 */

export async function POST(request: Request): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  if (!context.consented) {
    return Response.json({ ok: false, reason: "no-consent" }, { status: 403 });
  }

  let body: { childId?: unknown; source?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const childId = typeof body.childId === "string" ? body.childId : "";
  const source = body.source === "upload" ? "upload" : "recorder";
  if (!childId) {
    return Response.json({ ok: false, reason: "no-child" }, { status: 400 });
  }

  const result = await createLessonRecording({
    familyId: context.auth.familyId,
    childId,
    createdBy: context.auth.userId,
    source,
  });
  if (result.status === "unknown_child") {
    return Response.json({ ok: false, reason: "unknown-child" }, { status: 404 });
  }
  if (result.status === "daily_cap") {
    return Response.json({ ok: false, reason: "daily-cap" }, { status: 429 });
  }
  return Response.json({
    ok: true,
    lessonId: result.lesson.id,
    uploadPrefix: lessonBlobPrefix(context.auth.familyId, result.lesson.id),
  });
}
