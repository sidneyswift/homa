import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { assertFamilyArtifactAccess } from "../../../../lib/account-deletion-artifact-fence";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

/**
 * POST /api/video/upload: the video gateway's front door (step 1 of 2).
 * Vercel functions cap request bodies near 4.5MB and phone videos run
 * 20 to 200MB, so video bytes never pass through our API: the client
 * asks here for a scoped Blob client-upload token, uploads straight to
 * the homa-artifacts store, then trades the blob URL for text at
 * /api/video/describe (step 2).
 *
 * Client contract (web now, mobile when its attach UI lands): call
 * upload() from @vercel/blob/client with handleUploadUrl pointing here,
 * pathname "families/{familyId}/videos/{name}", and the Supabase JWT as
 * an Authorization header when there is no cookie session.
 *
 * Tenancy: the session (cookie or bearer) resolves the family, and the
 * token is only granted for that family's own videos/ prefix, so no
 * client can mint a token into another family's space. Uploads keep the
 * house blob posture: public store, random-suffix URLs, nobody can
 * enumerate.
 */

/** Twelve Labs takes URL uploads to 2GB, but a parent clip should never
 *  need that; 200MB matches their direct-upload cap and keeps a stuck
 *  camera roll from filling the store. */
const VIDEO_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const videoPrefix = `families/${auth.familyId}/videos/`;

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
      onBeforeGenerateToken: async (pathname) => {
        await assertFamilyArtifactAccess(auth.familyId);
        if (!pathname.startsWith(videoPrefix)) {
          throw new Error("pathname must stay inside this family's videos/ space");
        }
        return {
          allowedContentTypes: ["video/*"],
          maximumSizeInBytes: VIDEO_UPLOAD_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "video upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
