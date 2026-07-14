import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { blobConfigured } from "../../../../lib/materials/artifact-store";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../lib/lessons/route-auth";

/**
 * POST /api/lessons/upload: the lesson lane's front door (the
 * /api/video/upload pattern, plan 2026-07-13-lesson-listen.md §4.3).
 * The recorder asks here for a scoped Blob client-upload token, then
 * uploads each ~3-minute segment (or the fallback file, or a worksheet
 * photo) straight to the homa-artifacts store and registers the URL on
 * the matching /api/lessons route.
 *
 * Tenancy: the session resolves the family, the token only mints for
 * families/{familyId}/lessons/, and LL-0's consent stamp gates the
 * whole door: no consent, no lesson bytes anywhere.
 */

/** Telnyx STT's file ceiling (their REST docs, verified 2026-07-13);
 *  the fallback single file is the only thing near it. A 3-minute
 *  recorder segment runs about 1MB on opus and a few MB on iOS AAC. */
const AUDIO_MAX_BYTES = 100 * 1024 * 1024;
/** Worksheet photos downscale client-side first (child-photo-prepare
 *  pattern); this is the belt, matching chat's non-video cap. */
const IMAGE_MAX_BYTES = 25 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  if (!context.consented) {
    return Response.json({ ok: false, reason: "no-consent" }, { status: 403 });
  }
  const lessonsPrefix = `families/${context.auth.familyId}/lessons/`;

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith(lessonsPrefix)) {
          throw new Error(
            "pathname must stay inside this family's lessons/ space",
          );
        }
        const isImage =
          typeof clientPayload === "string" &&
          clientPayload.startsWith("image/");
        return {
          allowedContentTypes: ["audio/*", "video/*", "image/*"],
          maximumSizeInBytes: isImage ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "lesson upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
