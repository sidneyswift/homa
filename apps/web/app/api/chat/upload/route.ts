import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { assertFamilyArtifactAccess } from "../../../../lib/account-deletion-artifact-fence";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

/**
 * POST /api/chat/upload: the chat attach flow's front door (step 1 of 2,
 * the /api/video/upload pattern). The composer asks here for a scoped
 * Blob client-upload token, uploads the file straight to the
 * homa-artifacts store, then trades the blob URLs for model parts and
 * binder records at /api/chat/attachments (step 2).
 *
 * Tenancy: the session (cookie or bearer) resolves the family, and the
 * token is only granted for that family's own chat/ prefix, so no
 * client can mint a token into another family's space. Uploads keep the
 * house blob posture: public store, random-suffix URLs, nobody can
 * enumerate.
 *
 * Types mirror what the SMS lanes already digest (approved chat
 * redesign: "everything SMS takes"): photos, PDFs, voice notes, video
 * clips, Word/Excel, and text-format files.
 */

/** Videos ride the Twelve Labs direct-upload cap like /api/video/upload;
 *  everything else stays a fraction of that. */
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

const CHAT_UPLOAD_CONTENT_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/*",
];

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const chatPrefix = `families/${auth.familyId}/chat/`;

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
        await assertFamilyArtifactAccess(auth.familyId);
        if (!pathname.startsWith(chatPrefix)) {
          throw new Error("pathname must stay inside this family's chat/ space");
        }
        // The client names the media type so the size cap can follow it;
        // the token's allowedContentTypes stays the real wall either way.
        const isVideo =
          typeof clientPayload === "string" && clientPayload.startsWith("video/");
        return {
          allowedContentTypes: CHAT_UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: isVideo ? VIDEO_MAX_BYTES : DEFAULT_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "chat upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
