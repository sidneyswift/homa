import { after } from "next/server";
import { z } from "zod";

import { resolveApiFamily } from "../../../../../../lib/api-auth";
import {
  processQueuedFamilyAsset,
  queueFamilyAssetProcessingRetry,
} from "../../../../../../lib/library/family-asset-processing";
import { getFamilyAsset } from "../../../../../../lib/library/family-asset-store";

const assetIdSchema = z.string().uuid();

export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { id } = await params;
  if (!assetIdSchema.safeParse(id).success) {
    return Response.json({ ok: false, reason: "bad-id" }, { status: 400 });
  }

  const queued = await queueFamilyAssetProcessingRetry({
    familyId: auth.familyId,
    assetId: id,
  });
  if (!queued.ok) {
    return Response.json(
      { ok: false, reason: queued.reason },
      { status: queued.reason === "not-found" ? 404 : 409 },
    );
  }
  const asset = await getFamilyAsset(auth.familyId, id);
  if (!asset) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  after(async () => {
    try {
      await processQueuedFamilyAsset({ familyId: auth.familyId, assetId: id });
    } catch (error) {
      console.error(
        "family Library processing retry failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  });

  return Response.json({ ok: true, asset });
}
