import { deleteLessonBlob, isFamilyLessonUrl } from "../../../../lib/lessons/blobs";
import {
  deleteLessonRecording,
  listLessonMedia,
  listLessonSegments,
} from "../../../../lib/lessons/store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../lib/lessons/route-auth";

/**
 * DELETE /api/lessons/{id}: the consent screen's delete promise, kept
 * for real (plan 2026-07-13-lesson-listen.md §4.1): the recording, the
 * transcript, the tone notes, the photos, and the review all go. Blobs
 * delete first (best-effort, family-prefix walled), then the row, and
 * the cascades take everything else. Progress evidence stays: score
 * changes belong to the corrections flow the parent already has.
 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;

  let unregisteredBlobUrl: string | null = null;
  try {
    const body = (await request.json()) as { blobUrl?: unknown };
    if (
      typeof body.blobUrl === "string"
      && isFamilyLessonUrl(body.blobUrl, context.auth.familyId, lessonId)
    ) {
      unregisteredBlobUrl = body.blobUrl;
    }
  } catch {
    // A normal delete has no body.
  }

  const [segments, media] = await Promise.all([
    listLessonSegments(lessonId, context.auth.familyId),
    listLessonMedia(lessonId, context.auth.familyId),
  ]);
  for (const segment of segments) {
    await deleteLessonBlob(segment.blobUrl, context.auth.familyId);
  }
  for (const item of media) {
    await deleteLessonBlob(item.blobUrl, context.auth.familyId);
  }
  if (unregisteredBlobUrl) {
    await deleteLessonBlob(unregisteredBlobUrl, context.auth.familyId);
  }
  const deleted = await deleteLessonRecording(
    lessonId,
    context.auth.familyId,
  );
  if (!deleted) {
    return Response.json({ ok: false, reason: "unknown-lesson" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
