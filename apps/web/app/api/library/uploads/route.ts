import { del } from "@vercel/blob";
import { z } from "zod";

import { resolveApiFamily } from "../../../../lib/api-auth";
import {
  type FamilyAssetUploadRow,
  toFamilyAssetUploadView,
} from "../../../../lib/library/family-asset-upload-store";
import {
  familyAssetUploadPartByteSize,
  familyAssetUploadPartCount,
  familyAssetUploadPath,
  isFamilyAssetUploadFingerprint,
} from "../../../../lib/library/family-asset-uploads";
import {
  isLibraryUploadMediaTypeAllowed,
  libraryUploadMediaType,
  MAX_LIBRARY_UPLOAD_BYTES,
} from "../../../../lib/library/family-assets";
import { mapDb } from "../../../../lib/map/db";
import { blobConfigured } from "../../../../lib/materials/artifact-store";

const uuidSchema = z.string().uuid();

const reserveUploadSchema = z
  .object({
    clientRequestId: uuidSchema,
    originalName: z.string().trim().min(1).max(240),
    mediaType: z.string().trim().min(1).max(160),
    byteSize: z.number().int().min(1).max(MAX_LIBRARY_UPLOAD_BYTES),
    lastModified: z.number().int().nonnegative(),
    fingerprintSha256: z.string().length(64),
  })
  .strict();

const updateUploadSchema = z.discriminatedUnion("operation", [
  z
    .object({
      operation: z.literal("start"),
      id: uuidSchema,
      blobUploadId: z.string().min(1).max(500),
      blobKey: z.string().min(1).max(1000),
    })
    .strict(),
  z
    .object({
      operation: z.literal("part"),
      id: uuidSchema,
      partNumber: z.number().int().min(1).max(10_000),
      etag: z.string().min(1).max(300),
      byteSize: z.number().int().min(1).max(MAX_LIBRARY_UPLOAD_BYTES),
      sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    })
    .strict(),
  z
    .object({
      operation: z.literal("attention"),
      id: uuidSchema,
      errorCode: z.enum(["network_interrupted", "multipart_expired", "completion_failed"]),
    })
    .strict(),
  z.object({ operation: z.literal("completing"), id: uuidSchema }).strict(),
  z.object({ operation: z.literal("restart"), id: uuidSchema }).strict(),
]);

const UPLOAD_ROW_SELECT = `
  id, family_id, initiated_by_user_id, original_name, pathname, media_type,
  byte_size, last_modified, fingerprint_sha256, blob_upload_id, blob_key,
  completed_parts, status, status_note, error_code, created_at::text, updated_at::text
`;

const ATTENTION_NOTES = {
  network_interrupted: "The connection stopped before the file finished uploading.",
  multipart_expired: "That upload can no longer continue. Restart the upload to try again.",
  completion_failed: "The upload finished, but Homa did not add the file to your Library.",
} as const;

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function loadUpload(
  id: string,
  familyId: string,
): Promise<FamilyAssetUploadRow | null> {
  const sql = mapDb();
  const rows = await sql<FamilyAssetUploadRow[]>`
    select id, family_id, initiated_by_user_id, original_name, pathname,
           media_type, byte_size, last_modified, fingerprint_sha256,
           blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
           created_at::text, updated_at::text
    from public.family_asset_uploads
    where id = ${id} and family_id = ${familyId}
  `;
  return rows[0] ?? null;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const sql = mapDb();
  const rows = await sql<FamilyAssetUploadRow[]>`
    select id, family_id, initiated_by_user_id, original_name, pathname,
           media_type, byte_size, last_modified, fingerprint_sha256,
           blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
           created_at::text, updated_at::text
    from public.family_asset_uploads
    where family_id = ${auth.familyId}
      and status not in ('ready', 'abandoned')
    order by updated_at desc
    limit 50
  `;
  return Response.json({ ok: true, uploads: rows.map(toFamilyAssetUploadView) });
}

export async function POST(request: Request): Promise<Response> {
  if (!blobConfigured()) {
    return Response.json({ ok: false, reason: "not-configured" }, { status: 503 });
  }
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const parsed = reserveUploadSchema.safeParse(await readJson(request));
  if (!parsed.success || !isFamilyAssetUploadFingerprint(parsed.data?.fingerprintSha256 ?? "")) {
    return Response.json({ ok: false, reason: "bad-upload" }, { status: 400 });
  }

  const input = parsed.data;
  const mediaType = libraryUploadMediaType(input.originalName, input.mediaType);
  if (!mediaType || !isLibraryUploadMediaTypeAllowed(mediaType)) {
    return Response.json({ ok: false, reason: "unsupported-file" }, { status: 400 });
  }
  const pathname = familyAssetUploadPath(
    auth.familyId,
    input.clientRequestId,
    input.originalName,
  );
  const sql = mapDb();
  const rows = await sql<FamilyAssetUploadRow[]>`
    insert into public.family_asset_uploads as existing (
      family_id, initiated_by_user_id, client_request_id, original_name,
      pathname, media_type, byte_size, last_modified, fingerprint_sha256
    )
    values (
      ${auth.familyId}, ${auth.userId}, ${input.clientRequestId},
      ${input.originalName}, ${pathname}, ${mediaType}, ${input.byteSize},
      ${input.lastModified}, ${input.fingerprintSha256}
    )
    on conflict (family_id, client_request_id) do update
    set client_request_id = excluded.client_request_id
    where existing.original_name = excluded.original_name
      and existing.pathname = excluded.pathname
      and existing.media_type = excluded.media_type
      and existing.byte_size = excluded.byte_size
      and existing.last_modified = excluded.last_modified
      and existing.fingerprint_sha256 = excluded.fingerprint_sha256
      and existing.status <> 'abandoned'
    returning id, family_id, initiated_by_user_id, original_name, pathname,
              media_type, byte_size, last_modified, fingerprint_sha256,
              blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
              created_at::text, updated_at::text
  `;
  const row = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "request-conflict" }, { status: 409 });
  }
  return Response.json({ ok: true, upload: toFamilyAssetUploadView(row) });
}

export async function PATCH(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const parsed = updateUploadSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ ok: false, reason: "bad-update" }, { status: 400 });
  }
  const input = parsed.data;
  const upload = await loadUpload(input.id, auth.familyId);
  if (!upload) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  if (
    upload.status === "ready" ||
    upload.status === "abandoned" ||
    upload.error_code === "blob_delete_failed"
  ) {
    return Response.json({ ok: false, reason: "already-finished" }, { status: 409 });
  }

  const sql = mapDb();
  let rows: FamilyAssetUploadRow[] = [];
  if (input.operation === "start") {
    if (input.blobKey !== upload.pathname) {
      return Response.json({ ok: false, reason: "bad-blob-key" }, { status: 400 });
    }
    rows = await sql<FamilyAssetUploadRow[]>`
      update public.family_asset_uploads
      set blob_upload_id = ${input.blobUploadId},
          blob_key = ${input.blobKey},
          status = 'uploading',
          status_note = null,
          error_code = null,
          updated_at = now()
      where id = ${input.id}
        and family_id = ${auth.familyId}
        and status not in ('ready', 'abandoned')
        and (
          (blob_upload_id is null and blob_key is null)
          or (blob_upload_id = ${input.blobUploadId} and blob_key = ${input.blobKey})
        )
      returning ${sql.unsafe(UPLOAD_ROW_SELECT)}
    `;
  } else if (input.operation === "part") {
    const expectedBytes = familyAssetUploadPartByteSize(
      Number(upload.byte_size),
      input.partNumber,
    );
    if (
      expectedBytes !== input.byteSize ||
      upload.blob_upload_id === null ||
      upload.blob_key === null
    ) {
      return Response.json({ ok: false, reason: "bad-part" }, { status: 400 });
    }
    rows = await sql<FamilyAssetUploadRow[]>`
      update public.family_asset_uploads
      set completed_parts = completed_parts || jsonb_build_object(
            ${String(input.partNumber)},
            jsonb_build_object(
              'etag', ${input.etag},
              'partNumber', ${input.partNumber},
              'byteSize', ${input.byteSize},
              'sha256', ${input.sha256}
            )
          ),
          status = 'uploading',
          status_note = null,
          error_code = null,
          updated_at = now()
      where id = ${input.id}
        and family_id = ${auth.familyId}
        and blob_upload_id = ${upload.blob_upload_id}
        and blob_key = ${upload.blob_key}
        and status not in ('ready', 'abandoned')
      returning ${sql.unsafe(UPLOAD_ROW_SELECT)}
    `;
  } else if (input.operation === "attention") {
    rows = await sql<FamilyAssetUploadRow[]>`
      update public.family_asset_uploads
      set status = 'needs_attention',
          error_code = ${input.errorCode},
          status_note = ${ATTENTION_NOTES[input.errorCode]},
          updated_at = now()
      where id = ${input.id}
        and family_id = ${auth.familyId}
        and status not in ('ready', 'abandoned')
      returning ${sql.unsafe(UPLOAD_ROW_SELECT)}
    `;
  } else if (input.operation === "completing") {
    const completedPartCount = toFamilyAssetUploadView(upload).completedParts.length;
    if (completedPartCount !== familyAssetUploadPartCount(Number(upload.byte_size))) {
      return Response.json({ ok: false, reason: "parts-missing" }, { status: 409 });
    }
    rows = await sql<FamilyAssetUploadRow[]>`
      update public.family_asset_uploads
      set status = 'completing',
          status_note = 'The upload was interrupted while Homa was adding the file to your Library.',
          error_code = null,
          updated_at = now()
      where id = ${input.id}
        and family_id = ${auth.familyId}
        and status not in ('ready', 'abandoned')
      returning ${sql.unsafe(UPLOAD_ROW_SELECT)}
    `;
  } else {
    try {
      await del(upload.pathname);
    } catch {
      console.error("family Library upload restart could not clear its Blob path");
      return Response.json(
        { ok: false, reason: "blob-cleanup-failed" },
        { status: 503 },
      );
    }
    rows = await sql<FamilyAssetUploadRow[]>`
      update public.family_asset_uploads
      set blob_upload_id = null,
          blob_key = null,
          completed_parts = '{}'::jsonb,
          status = 'pending',
          status_note = null,
          error_code = null,
          updated_at = now()
      where id = ${input.id}
        and family_id = ${auth.familyId}
        and status not in ('ready', 'abandoned')
      returning ${sql.unsafe(UPLOAD_ROW_SELECT)}
    `;
  }

  const row = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "update-conflict" }, { status: 409 });
  }
  return Response.json({ ok: true, upload: toFamilyAssetUploadView(row) });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !uuidSchema.safeParse(id).success) {
    return Response.json({ ok: false, reason: "bad-id" }, { status: 400 });
  }
  const sql = mapDb();
  const rows = await sql<{ id: string; pathname: string }[]>`
    update public.family_asset_uploads
    set status = 'abandoned',
        status_note = null,
        error_code = null,
        abandoned_at = now(),
        updated_at = now()
    where id = ${id}
      and family_id = ${auth.familyId}
      and status not in ('ready', 'abandoned')
    returning id, pathname
  `;
  const row = rows[0];
  if (!row) {
    return Response.json({ ok: false, reason: "not-found" }, { status: 404 });
  }
  try {
    await del(row.pathname);
  } catch {
    await sql`
      update public.family_asset_uploads
      set status = 'needs_attention',
          status_note = 'Homa did not remove this unfinished upload. Try again.',
          error_code = 'blob_delete_failed',
          abandoned_at = null,
          updated_at = now()
      where id = ${id} and family_id = ${auth.familyId}
    `;
    console.error("abandoned family Library upload cleanup could not confirm deletion");
    return Response.json(
      { ok: false, reason: "blob-cleanup-failed" },
      { status: 503 },
    );
  }
  return Response.json({ ok: true });
}
