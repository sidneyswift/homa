import {
  issueSignedToken,
  parseStoreIdFromDelegationToken,
  presignUrl,
} from "@vercel/blob";
import {
  handleUploadPresigned,
  type HandleUploadPresignedBody,
} from "@vercel/blob/client";

import {
  lessonBlobConfigured,
  lessonBlobToken,
} from "../../../../lib/lessons/blobs";
import {
  lessonRouteRefusal,
  resolveLessonRoute,
} from "../../../../lib/lessons/route-auth";
import { getLessonForFamily } from "../../../../lib/lessons/store";

/**
 * POST /api/lessons/upload: the lesson lane's front door (the
 * /api/video/upload pattern, plan 2026-07-13-lesson-listen.md §4.3).
 * The recorder asks here for a scoped Blob client-upload token, then
 * uploads each ~3-minute segment (or the fallback file, or a worksheet
 * photo) straight to the private lesson store and registers the URL on
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
  if (!lessonBlobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
  const context = await resolveLessonRoute(request);
  if (context.status !== "ok") return lessonRouteRefusal(context);
  if (!context.consented) {
    return Response.json({ ok: false, reason: "no-consent" }, { status: 403 });
  }
  const lessonsPrefix = `families/${context.auth.familyId}/lessons/`;

  let body: HandleUploadPresignedBody;
  try {
    body = (await request.json()) as HandleUploadPresignedBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (body.type !== "blob.generate-presigned-url") {
    return Response.json({ ok: false, reason: "unsupported-event" }, { status: 400 });
  }

  try {
    let nativeUpload:
      | { url: string; storeId: string }
      | undefined;
    const result = await handleUploadPresigned({
      request,
      body,
      // Completion webhooks are intentionally disabled. Segment registration is
      // an authenticated Homa API call after Blob confirms the direct upload.
      webhookPublicKey: "lesson-upload-callbacks-disabled",
      getSignedToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith(lessonsPrefix)) {
          throw new Error(
            "pathname must stay inside this family's lessons/ space",
          );
        }
        const lessonId = pathname.slice(lessonsPrefix.length).split("/")[0] ?? "";
        const lesson = await getLessonForFamily(lessonId, context.auth.familyId);
        if (!lesson || lesson.status !== "recording") {
          throw new Error("lesson upload must target an open lesson in this family");
        }
        const isImage =
          typeof clientPayload === "string" &&
          clientPayload.startsWith("image/");
        const maximumSizeInBytes = isImage ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
        const allowedContentTypes = ["audio/*", "video/*", "image/*"];
        const validUntil = Date.now() + 15 * 60 * 1000;
        const token = lessonBlobToken();
        if (!token) throw new Error("private lesson store is not configured");
        const signedToken = await issueSignedToken({
          token,
          pathname,
          operations: ["put"],
          allowedContentTypes,
          maximumSizeInBytes,
          validUntil,
        });
        const urlOptions = {
          allowedContentTypes,
          maximumSizeInBytes,
          validUntil,
          addRandomSuffix: true,
          cacheControlMaxAge: 60,
        };
        const { presignedUrl } = await presignUrl(signedToken, {
          operation: "put",
          pathname,
          access: "private",
          ...urlOptions,
        });
        nativeUpload = {
          url: presignedUrl,
          storeId: parseStoreIdFromDelegationToken(
            signedToken.delegationToken,
          ),
        };
        return {
          token: signedToken,
          urlOptions,
        };
      },
    });
    return Response.json({ ...result, nativeUpload });
  } catch (error) {
    console.error(
      "lesson upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
