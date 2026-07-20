import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

/**
 * POST /api/shelf/upload: token route for the Shelf's client-side Blob
 * uploads (cover photos and table-of-contents photos). Follows the same
 * pattern as /api/chat/upload: session resolves the family, token is
 * scoped to that family's shelf/ prefix.
 */

const MAX_BYTES = 25 * 1024 * 1024;

const SHELF_CONTENT_TYPES = ["image/*"];

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const shelfPrefix = `families/${auth.familyId}/shelf/`;

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
        if (!pathname.startsWith(shelfPrefix)) {
          throw new Error("pathname must stay inside this family's shelf/ space");
        }
        return {
          allowedContentTypes: SHELF_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "shelf upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
