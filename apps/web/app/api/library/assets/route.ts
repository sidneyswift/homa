import { del } from "@vercel/blob";

import { resolveApiFamily } from "../../../../lib/api-auth";
import { finalizeFamilyAssetUpload } from "../../../../lib/library/family-asset-upload-store";
import {
  isFamilyLibraryUrl,
} from "../../../../lib/library/family-assets";
import { mapDb } from "../../../../lib/map/db";

interface CreateFamilyAssetBody {
  reservationId?: unknown;
  url?: unknown;
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
    return Response.json({ ok: true, asset: result.asset });
  } catch (error) {
    console.error(
      "library asset finalization failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "finalize-failed" }, { status: 500 });
  }
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

  const sql = mapDb();
  const rows = await sql<{ url: string }[]>`
    update public.family_assets
    set status = 'processing',
        processing_note = 'Removing original file',
        processing_error_code = null,
        updated_at = now()
    where id = ${id}
      and family_id = ${auth.familyId}
      and deleted_at is null
    returning url
  `;
  const row = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }

  try {
    await del(row.url);
  } catch (error) {
    await sql`
      update public.family_assets
      set status = 'needs_attention',
          processing_error_code = 'blob_delete_failed',
          processing_note = 'The original file could not be removed yet.',
          updated_at = now()
      where id = ${id} and family_id = ${auth.familyId}
    `;
    console.error(
      "library asset delete failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "delete-failed" }, { status: 503 });
  }

  await sql`
    update public.family_assets
    set deleted_at = now(),
        processing_note = null,
        processing_error_code = null,
        updated_at = now()
    where id = ${id} and family_id = ${auth.familyId}
  `;
  return Response.json({ ok: true });
}
