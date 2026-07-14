import { isFamilyLessonUrl } from "../../../../../lib/lessons/blobs";
import {
  registerLessonSegment,
} from "../../../../../lib/lessons/store";
import { processLessonSegment } from "../../../../../lib/lessons/worker";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../../lib/lessons/route-auth";

/**
 * POST /api/lessons/{id}/segments: registers one uploaded segment and
 * runs both ears inline before responding (plan
 * 2026-07-13-lesson-listen.md §4.4 step 2). The recorder fires and
 * forgets this request, so the inline transcription and tone pass cost
 * the parent nothing; the cron sweep retries anything that dies here.
 * Idempotent on (lesson, seq): flaky connections re-register freely.
 */

/** Transcription runs seconds; the tone pass carries a 45s internal
 *  timeout; the fallback file's Telnyx file_url call can run longer. */
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
): Promise<Response> {
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  const { lessonId } = await params;

  let body: {
    seq?: unknown;
    blobUrl?: unknown;
    contentType?: unknown;
    durationSeconds?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const seq = Number(body.seq);
  const blobUrl = typeof body.blobUrl === "string" ? body.blobUrl : "";
  const contentType =
    typeof body.contentType === "string" ? body.contentType : "";
  const durationSeconds = Number.isFinite(Number(body.durationSeconds))
    ? Math.max(0, Math.round(Number(body.durationSeconds)))
    : null;
  if (!Number.isInteger(seq) || seq < 1 || !blobUrl || !contentType) {
    return Response.json({ ok: false, reason: "bad-segment" }, { status: 400 });
  }
  // The URL wall: rows never point outside this family's own lesson
  // space, so a forged body cannot make Homa transcribe foreign bytes.
  if (!isFamilyLessonUrl(blobUrl, context.auth.familyId, lessonId)) {
    return Response.json({ ok: false, reason: "bad-url" }, { status: 400 });
  }

  const result = await registerLessonSegment({
    lessonId,
    familyId: context.auth.familyId,
    seq,
    blobUrl,
    contentType,
    durationSeconds,
  });
  if (result.status === "not_open") {
    return Response.json({ ok: false, reason: "not-open" }, { status: 409 });
  }

  await processLessonSegment(result.segmentId, context.auth.familyId);
  return Response.json({ ok: true, segmentId: result.segmentId });
}
