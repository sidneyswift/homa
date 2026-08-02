import { after } from "next/server";
import { z } from "zod";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { finalizeFamilyAssetUpload } from "../../../../lib/library/family-asset-upload-store";
import { processQueuedFamilyAsset } from "../../../../lib/library/family-asset-processing";
import {
  deleteFamilyAsset,
  getFamilyAsset,
  updateFamilyAsset,
} from "../../../../lib/library/family-asset-store";
import {
  isFamilyLibraryUrl,
} from "../../../../lib/library/family-assets";
import { familyAssetUpdateSchema } from "../../../../lib/library/family-asset-shelf";

interface CreateFamilyAssetBody {
  reservationId?: unknown;
  url?: unknown;
}

const assetIdSchema = z.string().uuid();

export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !assetIdSchema.safeParse(id).success) {
    return Response.json({ ok: false, reason: "bad-id" }, { status: 400 });
  }
  const asset = await getFamilyAsset(auth.familyId, id);
  return asset
    ? Response.json({ ok: true, asset })
    : Response.json({ ok: false, reason: "not-found" }, { status: 404 });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  let body: CreateFamilyAssetBody;
  try {
    body = (await request.json()) as CreateFamilyAssetBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const reservationId =
    typeof body.reservationId === "string" ? body.reservationId : "";
  const url = typeof body.url === "string" ? body.url : "";
  if (
    !/^[0-9a-f-]{36}$/iu.test(reservationId) ||
    !isFamilyLibraryUrl(url, auth.familyId)
  ) {
    return Response.json({ ok: false, reason: "bad-asset" }, { status: 400 });
  }

  try {
    const result = await finalizeFamilyAssetUpload({
      reservationId,
      blobUrl: url,
      expectedFamilyId: auth.familyId,
    });
    if (!result.ok) {
      const status =
        result.reason === "blob-not-found"
          ? 503
          : result.reason === "not-found"
            ? 404
            : 409;
      return Response.json({ ok: false, reason: result.reason }, { status });
    }
    after(async () => {
      try {
        await processQueuedFamilyAsset({
          familyId: result.familyId,
          assetId: result.asset.id,
        });
      } catch (error) {
        console.error(
          "family Library metadata processing failed after finalization:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    });
    return Response.json({ ok: true, asset: result.asset });
  } catch (error) {
    console.error(
      "library asset finalization failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "finalize-failed" }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  const parsed = familyAssetUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "bad-update" }, { status: 400 });
  }

  const result = await updateFamilyAsset({
    familyId: auth.familyId,
    edit: parsed.data,
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, reason: result.reason },
      { status: result.reason === "not-found" ? 404 : 400 },
    );
  }
  return Response.json({ ok: true, asset: result.asset });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/iu.test(id)) {
    return Response.json({ ok: false, reason: "bad-id" }, { status: 400 });
  }

  const result = await deleteFamilyAsset({
    familyId: auth.familyId,
    assetId: id,
  });
  if (!result.ok) {
    return Response.json(
      { ok: false, reason: result.reason },
      { status: result.reason === "not-found" ? 404 : 503 },
    );
  }
  return Response.json({ ok: true });
}
