import { del, head } from "@vercel/blob";

import { resolveApiFamily } from "../../../../lib/api-auth";
import {
  familyAssetFileKind,
  isFamilyLibraryUrl,
  MAX_LIBRARY_UPLOAD_BYTES,
  titleFromLibraryFileName,
  type FamilyAssetView,
} from "../../../../lib/library/family-assets";
import { mapDb } from "../../../../lib/map/db";

interface CreateFamilyAssetBody {
  url?: unknown;
  originalName?: unknown;
}

interface FamilyAssetRow {
  id: string;
  title: string;
  original_name: string;
  url: string;
  download_url: string;
  media_type: string;
  byte_size: number | string;
  file_kind: FamilyAssetView["fileKind"];
  resource_kind: FamilyAssetView["resourceKind"];
  status: FamilyAssetView["status"];
  processing_note: string | null;
  created_at: string;
}

function toView(row: FamilyAssetRow): FamilyAssetView {
  return {
    id: row.id,
    title: row.title,
    originalName: row.original_name,
    url: row.url,
    downloadUrl: row.download_url,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    fileKind: row.file_kind,
    resourceKind: row.resource_kind,
    status: row.status,
    processingNote: row.processing_note,
    createdAt: row.created_at,
  };
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

  const url = typeof body.url === "string" ? body.url : "";
  const originalName =
    typeof body.originalName === "string" ? body.originalName.trim().slice(0, 240) : "";
  if (!originalName || !isFamilyLibraryUrl(url, auth.familyId)) {
    return Response.json({ ok: false, reason: "bad-asset" }, { status: 400 });
  }

  let blob;
  try {
    blob = await head(url);
  } catch {
    return Response.json({ ok: false, reason: "blob-not-found" }, { status: 400 });
  }
  if (
    !isFamilyLibraryUrl(blob.url, auth.familyId) ||
    blob.size < 1 ||
    blob.size > MAX_LIBRARY_UPLOAD_BYTES
  ) {
    return Response.json({ ok: false, reason: "bad-blob" }, { status: 400 });
  }

  const sql = mapDb();
  try {
    const rows = await sql<FamilyAssetRow[]>`
      insert into public.family_assets (
        family_id, uploaded_by_user_id, title, original_name, url,
        download_url, media_type, byte_size, file_kind, status, processed_at
      )
      values (
        ${auth.familyId},
        ${auth.userId},
        ${titleFromLibraryFileName(originalName)},
        ${originalName},
        ${blob.url},
        ${blob.downloadUrl},
        ${blob.contentType},
        ${blob.size},
        ${familyAssetFileKind(blob.contentType)},
        'ready',
        now()
      )
      on conflict (family_id, url) do update
      set updated_at = now()
      where public.family_assets.deleted_at is null
      returning id, title, original_name, url, download_url, media_type,
                byte_size, file_kind, resource_kind, status,
                processing_note, created_at::text
    `;
    const row = rows[0];
    if (!row) {
      return Response.json({ ok: false, reason: "already-removed" }, { status: 409 });
    }
    return Response.json({ ok: true, asset: toView(row) });
  } catch (error) {
    try {
      await del(blob.url);
    } catch {
      console.error("library asset cleanup failed after record write failure");
    }
    console.error(
      "library asset record failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({ ok: false, reason: "record-failed" }, { status: 500 });
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
