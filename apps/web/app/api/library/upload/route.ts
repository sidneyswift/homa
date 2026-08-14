import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { after } from "next/server";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { assertFamilyArtifactAccess } from "../../../../lib/account-deletion-artifact-fence";
import { familyAccountCheckout } from "../../../../lib/billing/wall";
import { finalizeFamilyAssetUpload } from "../../../../lib/library/family-asset-upload-store";
import { processQueuedFamilyAsset } from "../../../../lib/library/family-asset-processing";
import { mapDb } from "../../../../lib/map/db";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

interface UploadTokenPayload {
  reservationId?: unknown;
}

interface UploadTokenRow {
  id: string;
  pathname: string;
  media_type: string;
  byte_size: number | string;
  status: string;
  error_code: string | null;
}

export const maxDuration = 300;

function parseTokenPayload(value: string | null | undefined): UploadTokenPayload {
  if (!value) return {};
  try {
    return JSON.parse(value) as UploadTokenPayload;
  } catch {
    return {};
  }
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const auth =
    body.type === "blob.generate-client-token"
      ? await resolveApiFamily(request)
      : null;
  if (body.type === "blob.generate-client-token" && !auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  if (
    body.type === "blob.generate-client-token" &&
    auth &&
    (await familyAccountCheckout(auth.familyId)) !== null
  ) {
    return Response.json({ ok: false, reason: "membership-required" }, { status: 402 });
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload, multipart) => {
        if (!auth || !multipart) throw new Error("multipart session required");
        await assertFamilyArtifactAccess(auth.familyId);
        const payload = parseTokenPayload(clientPayload);
        if (!isUuid(payload.reservationId)) {
          throw new Error("valid reservation required");
        }
        const sql = mapDb();
        const rows = await sql<UploadTokenRow[]>`
          select id, pathname, media_type, byte_size, status, error_code
          from public.family_asset_uploads
          where id = ${payload.reservationId}
            and family_id = ${auth.familyId}
        `;
        const upload = rows[0];
        if (
          !upload ||
          upload.pathname !== pathname ||
          upload.status === "ready" ||
          upload.status === "abandoned" ||
          upload.error_code === "blob_delete_failed"
        ) {
          throw new Error("reservation is not uploadable");
        }
        return {
          allowedContentTypes: [upload.media_type],
          maximumSizeInBytes: Number(upload.byte_size),
          validUntil: Date.now() + 6 * 60 * 60 * 1000,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ reservationId: upload.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const payload = parseTokenPayload(tokenPayload);
        if (!isUuid(payload.reservationId)) {
          throw new Error("upload callback has no valid reservation");
        }
        const finalized = await finalizeFamilyAssetUpload({
          reservationId: payload.reservationId,
          blobUrl: blob.url,
        });
        if (!finalized.ok && finalized.reason === "blob-not-found") {
          throw new Error("completed Blob was not readable yet");
        }
        if (finalized.ok) {
          after(async () => {
            try {
              await processQueuedFamilyAsset({
                familyId: finalized.familyId,
                assetId: finalized.asset.id,
              });
            } catch (error) {
              console.error(
                "family Library metadata processing failed after Blob callback:",
                error instanceof Error ? error.message : "unknown",
              );
            }
          });
        }
      },
    });
    return Response.json(result);
  } catch (error) {
    console.error(
      "library upload handling failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "rejected" }, { status: 400 });
  }
}
