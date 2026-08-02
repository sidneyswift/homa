import { mapDb } from "../map/db";
import {
  extractFamilyAssetSourceDocument,
  type ClaimedFamilyAsset,
  type FamilyAssetProcessingFailureReason,
  type FamilyAssetSourceDocument,
  type FamilyAssetSourceSegment,
} from "./family-asset-processing";

export const FAMILY_CURRICULUM_READ_MAX_SEGMENTS = 8;
export const FAMILY_CURRICULUM_READ_MAX_CHARS = 32_000;

export interface ReadyFamilyCurriculum extends ClaimedFamilyAsset {
  updatedAt: string;
  uploadedByUserId: string | null;
  downloadUrl: string;
  byteSize: number;
  fileKind: string;
  authors: string[];
  publisher: string | null;
  atlasId: string | null;
  contentSha256: string | null;
}

export type ReadyFamilyCurriculumResult =
  | { ok: true; asset: ReadyFamilyCurriculum }
  | {
      ok: false;
      reason: "not-found" | "not-ready" | "not-curriculum" | "curriculum-unit";
    };

export type FamilyCurriculumSourceReadResult =
  | {
      ok: true;
      asset: ReadyFamilyCurriculum;
      document: Extract<FamilyAssetSourceDocument, { ok: true }>;
      page: FamilyCurriculumReadPage;
    }
  | {
      ok: false;
      reason:
        | Exclude<ReadyFamilyCurriculumResult, { ok: true }>["reason"]
        | FamilyAssetProcessingFailureReason;
    };

export async function getReadyFamilyCurriculum(
  familyId: string,
  assetId: string,
): Promise<ReadyFamilyCurriculumResult> {
  const sql = mapDb();
  const rows = await sql<
    Array<{
      id: string;
      family_id: string;
      uploaded_by_user_id: string | null;
      parent_asset_id: string | null;
      atlas_id: string | null;
      title: string;
      original_name: string;
      url: string;
      download_url: string;
      media_type: string;
      byte_size: number | string;
      file_kind: string;
      resource_kind: string | null;
      authors: string[];
      publisher: string | null;
      language: string | null;
      status: string;
      content_sha256: string | null;
      updated_at: string;
    }>
  >`
    select id, family_id, uploaded_by_user_id, parent_asset_id, atlas_id,
           title, original_name, url, download_url, media_type, byte_size,
           file_kind, resource_kind, authors, publisher, language, status,
           content_sha256, updated_at::text as updated_at
    from public.family_assets
    where id = ${assetId}
      and family_id = ${familyId}
      and deleted_at is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, reason: "not-found" };
  if (row.parent_asset_id) return { ok: false, reason: "curriculum-unit" };
  if (row.resource_kind !== "curriculum") {
    return { ok: false, reason: "not-curriculum" };
  }
  if (row.status !== "ready") return { ok: false, reason: "not-ready" };
  return {
    ok: true,
    asset: {
      id: row.id,
      familyId: row.family_id,
      uploadedByUserId: row.uploaded_by_user_id,
      title: row.title,
      originalName: row.original_name,
      url: row.url,
      downloadUrl: row.download_url,
      mediaType: row.media_type,
      byteSize: Number(row.byte_size),
      fileKind: row.file_kind,
      resourceKind: "curriculum",
      authors: Array.isArray(row.authors) ? row.authors : [],
      publisher: row.publisher,
      language: row.language,
      atlasId: row.atlas_id,
      contentSha256: row.content_sha256,
      updatedAt: row.updated_at,
    },
  };
}

/** True only for active unit rows in this family. Foreign and missing ids do
 *  not influence billing; the normal asset validator rejects them later. */
export async function familyAssetIdsIncludeCurriculumUnits(
  familyId: string,
  assetIds: readonly string[],
): Promise<boolean> {
  const uniqueIds = [...new Set(assetIds)];
  if (uniqueIds.length === 0) return false;
  const sql = mapDb();
  const rows = await sql<{ one: number }[]>`
    select 1 as one
    from public.family_assets
    where family_id = ${familyId}
      and id in ${sql(uniqueIds)}
      and parent_asset_id is not null
      and deleted_at is null
    limit 1
  `;
  return rows.length > 0;
}

export interface FamilyCurriculumReadPage {
  segments: FamilyAssetSourceSegment[];
  nextCursor: number | null;
}

/** A pure output limiter, so a source read cannot flood one agent turn. */
export function sliceFamilyCurriculumDocument(
  document: Extract<FamilyAssetSourceDocument, { ok: true }>,
  cursor: number,
): FamilyCurriculumReadPage {
  const start = Math.max(1, cursor);
  const segments: FamilyAssetSourceSegment[] = [];
  let chars = 0;
  for (const segment of document.segments) {
    if (segment.ordinal < start) continue;
    if (segments.length >= FAMILY_CURRICULUM_READ_MAX_SEGMENTS) break;
    const remaining = FAMILY_CURRICULUM_READ_MAX_CHARS - chars;
    if (remaining <= 0) break;
    const text = segment.text.slice(0, remaining);
    segments.push({ ...segment, text });
    chars += text.length;
    if (text.length < segment.text.length) break;
  }
  const last = segments.at(-1);
  const nextCursor =
    last && document.segments.some((segment) => segment.ordinal > last.ordinal)
      ? last.ordinal + 1
      : null;
  return { segments, nextCursor };
}

export async function readFamilyCurriculumSource(input: {
  familyId: string;
  assetId: string;
  cursor: number;
}): Promise<FamilyCurriculumSourceReadResult> {
  const ready = await getReadyFamilyCurriculum(input.familyId, input.assetId);
  if (!ready.ok) return ready;
  const document = await extractFamilyAssetSourceDocument(ready.asset);
  if (!document.ok) return document;
  return {
    ok: true,
    asset: ready.asset,
    document,
    page: sliceFamilyCurriculumDocument(document, input.cursor),
  };
}
