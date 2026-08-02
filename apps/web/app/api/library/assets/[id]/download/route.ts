import { z } from "zod";

import { resolveApiFamily } from "../../../../../../lib/api-auth";
import { isFamilyLibraryUrl } from "../../../../../../lib/library/family-assets";
import { mapDb } from "../../../../../../lib/map/db";
import { emitMapEvent } from "../../../../../../lib/map/events";

const assetIdSchema = z.string().uuid();

export async function GET(
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

  const sql = mapDb();
  const rows = await sql<{ download_url: string }[]>`
    select download_url
    from public.family_assets
    where id = ${id}
      and family_id = ${auth.familyId}
      and deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  if (!isFamilyLibraryUrl(row.download_url, auth.familyId)) {
    console.error("family Library download URL was outside its family prefix");
    return Response.json({ ok: false, reason: "bad-download" }, { status: 500 });
  }
  const surface = new URL(request.url).searchParams.get("surface") === "shelf"
    ? "shelf"
    : "detail";
  await emitMapEvent("library.original_downloaded", {
    family_id: auth.familyId,
    asset_id: id,
    surface,
  });
  return Response.redirect(row.download_url, 302);
}
