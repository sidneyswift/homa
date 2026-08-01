import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { MAX_LIBRARY_UPLOAD_BYTES } from "../../../../lib/library/family-assets";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

const LIBRARY_UPLOAD_CONTENT_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "text/*",
  "application/pdf",
  "application/epub+zip",
  "application/zip",
  "application/vnd.amazon.ebook",
  "application/x-mobipocket-ebook",
  "application/msword",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.apple.keynote",
  "application/vnd.apple.numbers",
  "application/vnd.apple.pages",
];

interface LibraryUploadPayload {
  fileSize?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const libraryPrefix = `families/${auth.familyId}/library/`;
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith(libraryPrefix)) {
          throw new Error("pathname must stay inside this family's Library space");
        }
        let payload: LibraryUploadPayload = {};
        try {
          payload = clientPayload
            ? (JSON.parse(clientPayload) as LibraryUploadPayload)
            : {};
        } catch {
          throw new Error("client payload must be valid JSON");
        }
        if (
          typeof payload.fileSize !== "number" ||
          !Number.isSafeInteger(payload.fileSize) ||
          payload.fileSize < 1 ||
          payload.fileSize > MAX_LIBRARY_UPLOAD_BYTES
        ) {
          throw new Error("file size is outside the Library upload limit");
        }
        return {
          allowedContentTypes: LIBRARY_UPLOAD_CONTENT_TYPES,
          maximumSizeInBytes: MAX_LIBRARY_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "library upload token failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
