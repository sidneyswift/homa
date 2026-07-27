import { deleteLessonBlob } from "../../../../../lib/lessons/blobs";
import {
  listLessonMedia,
  listLessonSegments,
  markLessonAudioDeleted,
} from "../../../../../lib/lessons/store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * DELETE /api/lessons/{id}/audio: the other half of keep-their-voice.
 *
 * Homa keeps a recording without being asked when the review found a
 * breakthrough or a sweet moment, so the parent needs a way to undo
 * that which does not cost her anything else. The sibling route deletes
 * the whole lesson, review and transcript included, which is the right
 * tool for "I never wanted this recorded" and the wrong one for "keep
 * the write-up, lose the audio". This deletes only the bytes.
 *
 * Stamping audio_deleted_at is what makes it stick: the TTL sweep skips
 * rows that are already stamped, and markLessonAudioKept refuses to
 * re-exempt a stamped row, so a later re-analysis cannot quietly decide
 * to keep audio the parent has already removed.
 */

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;
  const familyId = context.auth.familyId;

  const [segments, media] = await Promise.all([
    listLessonSegments(lessonId, familyId),
    listLessonMedia(lessonId, familyId),
  ]);
  for (const segment of segments) {
    await deleteLessonBlob(segment.blobUrl, familyId);
  }
  for (const item of media) {
    await deleteLessonBlob(item.blobUrl, familyId);
  }
  // Stamped even when there was nothing to delete: the row's claim is
  // "this lesson holds no audio", and that is true either way.
  await markLessonAudioDeleted(lessonId, familyId);
  return Response.json({ ok: true });
}
