import { del, head, type HeadBlobResult } from "@vercel/blob";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  FAMILY_ASSET_PROCESSING_QUEUED_NOTE,
  familyAssetFileKind,
  isFamilyLibraryUrl,
  titleFromLibraryFileName,
  type FamilyAssetView,
} from "./family-assets";
import {
  familyAssetUploadPartByteSize,
  type FamilyAssetUploadPart,
  type FamilyAssetUploadStatus,
  type FamilyAssetUploadView,
} from "./family-asset-uploads";

export interface FamilyAssetUploadRow {
  id: string;
  family_id: string;
  initiated_by_user_id: string | null;
  original_name: string;
  pathname: string;
  media_type: string;
  byte_size: number | string;
  last_modified: number | string;
  fingerprint_sha256: string;
  blob_upload_id: string | null;
  blob_key: string | null;
  completed_parts: unknown;
  status: FamilyAssetUploadStatus;
  status_note: string | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface FamilyAssetRow {
  id: string;
  title: string;
  original_name: string;
  url: string;
  download_url: string;
  media_type: string;
  byte_size: number | string;
  file_kind: FamilyAssetView["fileKind"];
  resource_kind: FamilyAssetView["resourceKind"];
  authors: string[];
  publisher: string | null;
  language: string | null;
  status: FamilyAssetView["status"];
  processing_error_code: string | null;
  processing_note: string | null;
  source_upload_id: string | null;
  source_attachment_id: string | null;
  parent_asset_id: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export const FAMILY_ASSET_ROW_SELECT = `
  id, title, original_name, url, download_url, media_type, byte_size,
  file_kind, resource_kind, authors, publisher, language, status,
  processing_error_code, processing_note, source_upload_id,
  source_attachment_id, parent_asset_id, processed_at::text,
  created_at::text, updated_at::text
`;

export type FinalizeFamilyAssetUploadResult =
  | { ok: true; asset: FamilyAssetView; familyId: string }
  | {
      ok: false;
      reason: "not-found" | "abandoned" | "blob-not-found" | "blob-mismatch";
    };

export interface FamilyAssetBlobDependencies {
  head(url: string): Promise<HeadBlobResult>;
  delete(url: string): Promise<void>;
}

const DEFAULT_BLOB_DEPENDENCIES: FamilyAssetBlobDependencies = {
  head,
  async delete(url) {
    await del(url);
  },
};

function isUploadPart(value: unknown): value is FamilyAssetUploadPart {
  if (!value || typeof value !== "object") return false;
  const part = value as Record<string, unknown>;
  return (
    typeof part.etag === "string" &&
    part.etag.length >= 1 &&
    part.etag.length <= 300 &&
    typeof part.partNumber === "number" &&
    Number.isSafeInteger(part.partNumber) &&
    typeof part.byteSize === "number" &&
    Number.isSafeInteger(part.byteSize) &&
    typeof part.sha256 === "string" &&
    /^[0-9a-f]{64}$/u.test(part.sha256)
  );
}

export function parseFamilyAssetUploadParts(
  value: unknown,
  byteSize: number,
): FamilyAssetUploadPart[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const byPartNumber = new Map<number, FamilyAssetUploadPart>();
  for (const candidate of Object.values(value as Record<string, unknown>)) {
    if (
      isUploadPart(candidate) &&
      familyAssetUploadPartByteSize(byteSize, candidate.partNumber) ===
        candidate.byteSize
    ) {
      byPartNumber.set(candidate.partNumber, candidate);
    }
  }
  return [...byPartNumber.values()].sort(
    (first, second) => first.partNumber - second.partNumber,
  );
}

export function toFamilyAssetUploadView(
  row: FamilyAssetUploadRow,
): FamilyAssetUploadView {
  const byteSize = Number(row.byte_size);
  return {
    id: row.id,
    originalName: row.original_name,
    pathname: row.pathname,
    mediaType: row.media_type,
    byteSize,
    lastModified: Number(row.last_modified),
    fingerprintSha256: row.fingerprint_sha256,
    blobUploadId: row.blob_upload_id,
    blobKey: row.blob_key,
    completedParts: parseFamilyAssetUploadParts(row.completed_parts, byteSize),
    status: row.status,
    statusNote: row.status_note,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toFamilyAssetView(
  row: FamilyAssetRow,
  associations: Pick<FamilyAssetView, "children" | "subjects"> = {
    children: [],
    subjects: [],
  },
): FamilyAssetView {
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
    authors: row.authors,
    publisher: row.publisher,
    language: row.language,
    status: row.status,
    processingErrorCode: row.processing_error_code,
    processingNote: row.processing_note,
    sourceUploadId: row.source_upload_id,
    sourceAttachmentId: row.source_attachment_id,
    parentAssetId: row.parent_asset_id,
    children: associations.children,
    subjects: associations.subjects,
    processedAt: row.processed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function markUploadNeedsAttention(
  upload: FamilyAssetUploadRow,
  errorCode: string,
  note: string,
): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.family_asset_uploads
    set status = 'needs_attention',
        error_code = ${errorCode},
        status_note = ${note},
        updated_at = now()
    where id = ${upload.id}
      and family_id = ${upload.family_id}
      and status not in ('ready', 'abandoned')
      and error_code is distinct from 'blob_delete_failed'
  `;
}

function blobMatchesUpload(
  blob: HeadBlobResult,
  upload: FamilyAssetUploadRow,
): boolean {
  return (
    isFamilyLibraryUrl(blob.url, upload.family_id) &&
    blob.pathname === upload.pathname &&
    blob.size === Number(upload.byte_size) &&
    blob.contentType.toLowerCase().split(";", 1)[0] ===
      upload.media_type.toLowerCase().split(";", 1)[0]
  );
}

async function loadUpload(
  reservationId: string,
  expectedFamilyId?: string,
): Promise<FamilyAssetUploadRow | null> {
  const sql = mapDb();
  const rows = expectedFamilyId
    ? await sql<FamilyAssetUploadRow[]>`
        select id, family_id, initiated_by_user_id, original_name, pathname,
               media_type, byte_size, last_modified, fingerprint_sha256,
               blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
               created_at::text, updated_at::text
        from public.family_asset_uploads
        where id = ${reservationId} and family_id = ${expectedFamilyId}
      `
    : await sql<FamilyAssetUploadRow[]>`
        select id, family_id, initiated_by_user_id, original_name, pathname,
               media_type, byte_size, last_modified, fingerprint_sha256,
               blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
               created_at::text, updated_at::text
        from public.family_asset_uploads
        where id = ${reservationId}
      `;
  return rows[0] ?? null;
}

/**
 * Finalizes a completed Blob into exactly one Family Library record. Browser
 * completion and the signed Vercel callback may race, so the upload row is
 * locked and source_upload_id is unique inside the family.
 */
export async function finalizeFamilyAssetUpload(
  input: {
    reservationId: string;
    blobUrl: string;
    expectedFamilyId?: string;
  },
  dependencies: FamilyAssetBlobDependencies = DEFAULT_BLOB_DEPENDENCIES,
): Promise<FinalizeFamilyAssetUploadResult> {
  const upload = await loadUpload(input.reservationId, input.expectedFamilyId);
  if (!upload) return { ok: false, reason: "not-found" };

  if (upload.status === "abandoned" || upload.error_code === "blob_delete_failed") {
    try {
      await dependencies.delete(input.blobUrl);
    } catch {
      console.error("abandoned family Library blob cleanup failed");
    }
    return { ok: false, reason: "abandoned" };
  }

  let blob: HeadBlobResult;
  try {
    blob = await dependencies.head(input.blobUrl);
  } catch {
    await markUploadNeedsAttention(
      upload,
      "blob_not_found",
      "Homa could not finish adding the uploaded file to your Library.",
    );
    return { ok: false, reason: "blob-not-found" };
  }

  if (!blobMatchesUpload(blob, upload)) {
    await markUploadNeedsAttention(
      upload,
      "blob_metadata_mismatch",
      "Homa could not add the uploaded file because its details did not match.",
    );
    return { ok: false, reason: "blob-mismatch" };
  }

  const sql = mapDb();
  const finalized = await sql.begin(async (transaction) => {
    const lockedRows = await transaction<FamilyAssetUploadRow[]>`
      select id, family_id, initiated_by_user_id, original_name, pathname,
             media_type, byte_size, last_modified, fingerprint_sha256,
             blob_upload_id, blob_key, completed_parts, status, status_note, error_code,
             created_at::text, updated_at::text
      from public.family_asset_uploads
      where id = ${upload.id} and family_id = ${upload.family_id}
      for update
    `;
    const locked = lockedRows[0];
    if (
      !locked ||
      locked.status === "abandoned" ||
      locked.error_code === "blob_delete_failed"
    ) {
      return null;
    }

    const rows = await transaction<FamilyAssetRow[]>`
      insert into public.family_assets (
        family_id, uploaded_by_user_id, source_upload_id, title, original_name,
        url, download_url, media_type, byte_size, file_kind, status,
        processing_note, processed_at
      )
      values (
        ${locked.family_id},
        ${locked.initiated_by_user_id},
        ${locked.id},
        ${titleFromLibraryFileName(locked.original_name)},
        ${locked.original_name},
        ${blob.url},
        ${blob.downloadUrl},
        ${blob.contentType},
        ${blob.size},
        ${familyAssetFileKind(blob.contentType)},
        'processing',
        ${FAMILY_ASSET_PROCESSING_QUEUED_NOTE},
        null
      )
      on conflict (family_id, source_upload_id) do update
      set source_upload_id = excluded.source_upload_id
      returning ${transaction.unsafe(FAMILY_ASSET_ROW_SELECT)}
    `;
    const row = rows[0];
    if (!row) return null;

    await transaction`
      update public.family_asset_uploads
      set status = 'ready',
          status_note = null,
          error_code = null,
          completed_at = now(),
          updated_at = now()
      where id = ${locked.id} and family_id = ${locked.family_id}
    `;
    return {
      asset: toFamilyAssetView(row),
      completedNow: locked.status !== "ready",
      familyId: locked.family_id,
    };
  });

  if (finalized) {
    if (finalized.completedNow) {
      await emitMapEvent("library.upload_completed", {
        family_id: finalized.familyId,
        asset_id: finalized.asset.id,
        bytes: finalized.asset.byteSize,
      });
    }
    return {
      ok: true,
      asset: finalized.asset,
      familyId: finalized.familyId,
    };
  }
  try {
    await dependencies.delete(blob.url);
  } catch {
    console.error("abandoned family Library blob cleanup failed after finalization race");
  }
  return { ok: false, reason: "abandoned" };
}
