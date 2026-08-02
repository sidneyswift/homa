import { emitMapEvent } from "../../../../../lib/map/events";
import { captionSmsImage } from "../../../../../lib/voice/caption-image";
import { isFamilyLessonUrl, readLessonBlob } from "../../../../../lib/lessons/blobs";
import {
  getLessonForFamily,
  registerLessonMedia,
  saveLessonMediaCaption,
} from "../../../../../lib/lessons/store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * POST /api/lessons/{id}/media: attaches one worksheet photo (plan
 * 2026-07-13-lesson-listen.md §4.9), mid-recording (stamped with the
 * segment playing when she tapped), at the finish screen, or after the
 * review exists. The caption runs inline (captionSmsImage's 20s
 * fail-soft budget) so the finish synthesis can pair moments with
 * their artifacts; a missing caption never blocks the photo.
 */

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;

  let body: {
    blobUrl?: unknown;
    contentType?: unknown;
    capturedDuringSeq?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const blobUrl = typeof body.blobUrl === "string" ? body.blobUrl : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const capturedDuringSeq = Number.isInteger(Number(body.capturedDuringSeq))
    ? Number(body.capturedDuringSeq)
    : null;
  if (!blobUrl || !contentType.startsWith("image/")) {
    return Response.json({ ok: false, reason: "bad-media" }, { status: 400 });
  }
  if (!isFamilyLessonUrl(blobUrl, context.auth.familyId, lessonId)) {
    return Response.json({ ok: false, reason: "bad-url" }, { status: 400 });
  }

  const result = await registerLessonMedia({
    lessonId,
    familyId: context.auth.familyId,
    blobUrl,
    contentType,
    capturedDuringSeq,
  });
  if (result.status === "unknown_lesson") {
    return Response.json({ ok: false, reason: "unknown-lesson" }, { status: 404 });
  }
  if (result.status === "cap") {
    return Response.json({ ok: false, reason: "media-cap" }, { status: 429 });
  }

  const bytes = await readLessonBlob(blobUrl, context.auth.familyId);
  const caption = bytes
    ? await captionSmsImage({
        image: new Uint8Array(bytes),
        mediaType: contentType,
        familyId: context.auth.familyId,
        channel: "web",
        attribution: {
          resourceKind: "lesson_media",
          resourceId: result.mediaId,
        },
      })
    : null;
  if (caption !== null) {
    await saveLessonMediaCaption({
      mediaId: result.mediaId,
      familyId: context.auth.familyId,
      caption,
    });
  }

  const lesson = await getLessonForFamily(lessonId, context.auth.familyId);
  if (lesson !== null) {
    await emitMapEvent("lesson.media_attached", {
      family_id: context.auth.familyId,
      child_id: lesson.childId,
      when: result.afterReady
        ? "after_ready"
        : capturedDuringSeq === null
          ? "finish"
          : "during",
    });
  }
  return Response.json({ ok: true, mediaId: result.mediaId });
}
