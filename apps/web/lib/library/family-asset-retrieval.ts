import { MAP_SUBJECTS } from "@homa/core";

import { embedText } from "../learning/embeddings";
import { mapDb } from "../map/db";
import { siteUrl } from "../map/email";
import { familyAssetLibraryHref } from "./family-asset-reference";
import {
  FAMILY_ASSET_RESOURCE_KINDS,
  FAMILY_ASSET_STATUSES,
  type FamilyAssetResourceKind,
  type FamilyAssetStatus,
} from "./family-assets";

export const FAMILY_ASSET_SEARCH_MAX_RESULTS = 10;
export const FAMILY_ASSET_SEMANTIC_MAX_DISTANCE = 0.55;

export interface FamilyAssetEvidence {
  kind: "subject" | "topic" | "age_band" | "theme" | "work" | "entity";
  value: string;
  catalogId: string | null;
  quote: string;
  sourceLocator: string | null;
  source: "model" | "parent" | "import" | "system";
}

export interface FamilyAssetSource {
  id: string;
  title: string;
  originalName: string;
  originalUrl: string;
  citationUrl: string;
  libraryUrl: string;
  mediaType: string;
  byteSize: number;
  fileKind: string;
  resourceKind: FamilyAssetResourceKind | null;
  authors: string[];
  publisher: string | null;
  language: string | null;
  status: FamilyAssetStatus;
  processingNote: string | null;
  children: Array<{ id: string; name: string }>;
  evidence: FamilyAssetEvidence[];
  createdAt: string;
  updatedAt: string;
}

export type FamilyAssetMatchReason = "structured" | "keyword" | "meaning";

export interface FamilyAssetSearchResult extends FamilyAssetSource {
  matchReason: FamilyAssetMatchReason;
}

export interface FindFamilyAssetsInput {
  familyId: string;
  query?: string;
  resourceKinds?: readonly FamilyAssetResourceKind[];
  childId?: string;
  subjectIds?: readonly string[];
  statuses?: readonly FamilyAssetStatus[];
  limit?: number;
}

export interface FamilyAssetRetrievalDependencies {
  embed: typeof embedText;
}

const DEFAULT_RETRIEVAL_DEPENDENCIES: FamilyAssetRetrievalDependencies = {
  embed: embedText,
};

interface FamilyAssetSourceRow {
  id: string;
  title: string;
  original_name: string;
  url: string;
  media_type: string;
  byte_size: number | string;
  file_kind: string;
  resource_kind: FamilyAssetResourceKind | null;
  authors: string[];
  publisher: string | null;
  language: string | null;
  status: FamilyAssetStatus;
  processing_note: string | null;
  children: unknown;
  evidence: unknown;
  created_at: string;
  updated_at: string;
  lexical_rank?: number | string | null;
  semantic_distance?: number | string | null;
}

const RESOURCE_KIND_SET = new Set<string>(FAMILY_ASSET_RESOURCE_KINDS);
const STATUS_SET = new Set<string>(FAMILY_ASSET_STATUSES);
const SUBJECT_ID_SET = new Set(MAP_SUBJECTS.map((subject) => subject.id));

function parseChildren(value: unknown): Array<{ id: string; name: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return typeof row.id === "string" && typeof row.name === "string"
      ? [{ id: row.id, name: row.name }]
      : [];
  });
}

function parseEvidence(value: unknown): FamilyAssetEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    if (
      typeof row.kind !== "string" ||
      !["subject", "topic", "age_band", "theme", "work", "entity"].includes(
        row.kind,
      ) ||
      typeof row.value !== "string" ||
      typeof row.quote !== "string" ||
      typeof row.source !== "string" ||
      !["model", "parent", "import", "system"].includes(row.source)
    ) {
      return [];
    }
    return [
      {
        kind: row.kind as FamilyAssetEvidence["kind"],
        value: row.value,
        catalogId: typeof row.catalogId === "string" ? row.catalogId : null,
        quote: row.quote,
        sourceLocator:
          typeof row.sourceLocator === "string" ? row.sourceLocator : null,
        source: row.source as FamilyAssetEvidence["source"],
      },
    ];
  });
}

function numberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function familyAssetMatchReason(
  row: Pick<FamilyAssetSourceRow, "lexical_rank" | "semantic_distance">,
  hasQuery: boolean,
): FamilyAssetMatchReason {
  if (!hasQuery) return "structured";
  if ((numberOrNull(row.lexical_rank) ?? 0) > 0) return "keyword";
  return numberOrNull(row.semantic_distance) !== null ? "meaning" : "structured";
}

function toFamilyAssetSource(
  row: FamilyAssetSourceRow,
  evidenceLimit: number,
): FamilyAssetSource {
  return {
    id: row.id,
    title: row.title,
    originalName: row.original_name,
    originalUrl: row.url,
    citationUrl: `${siteUrl()}/api/library/assets/${row.id}/download`,
    libraryUrl: `${siteUrl()}${familyAssetLibraryHref(row.id)}`,
    mediaType: row.media_type,
    byteSize: Number(row.byte_size),
    fileKind: row.file_kind,
    resourceKind: row.resource_kind,
    authors: Array.isArray(row.authors) ? row.authors : [],
    publisher: row.publisher,
    language: row.language,
    status: row.status,
    processingNote: row.processing_note,
    children: parseChildren(row.children),
    evidence: parseEvidence(row.evidence).slice(0, evidenceLimit),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeSearchInput(input: FindFamilyAssetsInput) {
  return {
    query: input.query?.normalize("NFKC").trim().slice(0, 200) ?? "",
    resourceKinds: [...new Set(input.resourceKinds ?? [])].filter((kind) =>
      RESOURCE_KIND_SET.has(kind),
    ),
    childId: input.childId ?? null,
    subjectIds: [...new Set(input.subjectIds ?? [])].filter((id) =>
      SUBJECT_ID_SET.has(id),
    ),
    statuses: [...new Set(input.statuses ?? [])].filter((status) =>
      STATUS_SET.has(status),
    ),
    limit: Math.min(
      FAMILY_ASSET_SEARCH_MAX_RESULTS,
      Math.max(1, input.limit ?? 6),
    ),
  };
}

export async function findFamilyAssets(
  input: FindFamilyAssetsInput,
  dependencies: FamilyAssetRetrievalDependencies =
    DEFAULT_RETRIEVAL_DEPENDENCIES,
): Promise<FamilyAssetSearchResult[]> {
  const filters = normalizeSearchInput(input);
  const queryEmbedding = filters.query
    ? await dependencies.embed(filters.query, { familyId: input.familyId })
    : null;
  const sql = mapDb();
  const rows = await sql<FamilyAssetSourceRow[]>`
    with candidates as (
      select asset.id,
             case
               when ${filters.query.length > 0}
               then ts_rank_cd(
                 to_tsvector(
                   'english',
                   concat_ws(
                     ' ', asset.title, asset.original_name,
                     array_to_string(asset.authors, ' '), asset.publisher,
                     tag_search.search_text
                   )
                 ),
                 websearch_to_tsquery('english', ${filters.query})
               )
               else 0
             end as lexical_rank,
             case
               when ${queryEmbedding !== null} and asset.embedding is not null
               then asset.embedding <=> ${queryEmbedding}::extensions.vector(1536)
               else null
             end as semantic_distance,
             asset.created_at
      from public.family_assets asset
      left join lateral (
        select string_agg(tag.value, ' ') as search_text
        from public.family_asset_tags tag
        where tag.asset_id = asset.id
          and tag.family_id = ${input.familyId}
      ) tag_search on true
      where asset.family_id = ${input.familyId}
        and asset.deleted_at is null
        and (
          ${filters.resourceKinds.length === 0}
          or asset.resource_kind = any(${sql.array(filters.resourceKinds)}::text[])
        )
        and (
          ${filters.statuses.length === 0}
          or asset.status = any(${sql.array(filters.statuses)}::text[])
        )
        and (
          ${filters.childId === null}
          or exists (
            select 1 from public.family_asset_children child_link
            where child_link.asset_id = asset.id
              and child_link.family_id = ${input.familyId}
              and child_link.child_id = ${filters.childId}
          )
        )
        and (
          ${filters.subjectIds.length === 0}
          or exists (
            select 1 from public.family_asset_tags subject_tag
            where subject_tag.asset_id = asset.id
              and subject_tag.family_id = ${input.familyId}
              and subject_tag.kind = 'subject'
              and subject_tag.catalog_id = any(${sql.array(filters.subjectIds)}::text[])
          )
        )
        and (
          ${filters.query.length === 0}
          or to_tsvector(
            'english',
            concat_ws(
              ' ', asset.title, asset.original_name,
              array_to_string(asset.authors, ' '), asset.publisher,
              tag_search.search_text
            )
          ) @@ websearch_to_tsquery('english', ${filters.query})
          or (
            ${queryEmbedding !== null}
            and asset.embedding is not null
            and asset.embedding <=> ${queryEmbedding}::extensions.vector(1536)
              <= ${FAMILY_ASSET_SEMANTIC_MAX_DISTANCE}
          )
        )
      order by
        lexical_rank desc,
        semantic_distance asc nulls last,
        asset.created_at desc,
        asset.id
      limit ${filters.limit}
    )
    select asset.id, asset.title, asset.original_name, asset.url,
           asset.media_type, asset.byte_size, asset.file_kind,
           asset.resource_kind, asset.authors, asset.publisher, asset.language,
           asset.status, asset.processing_note,
           asset.created_at::text, asset.updated_at::text,
           candidates.lexical_rank, candidates.semantic_distance,
           coalesce(children.items, '[]'::jsonb) as children,
           coalesce(evidence.items, '[]'::jsonb) as evidence
    from candidates
    join public.family_assets asset
      on asset.id = candidates.id
     and asset.family_id = ${input.familyId}
    left join lateral (
      select jsonb_agg(
        jsonb_build_object('id', child.id, 'name', child.name)
        order by child.created_at, child.id
      ) as items
      from public.family_asset_children child_link
      join public.children child
        on child.id = child_link.child_id
       and child.family_id = child_link.family_id
      where child_link.asset_id = asset.id
        and child_link.family_id = ${input.familyId}
    ) children on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'kind', tag.kind,
          'value', tag.value,
          'catalogId', tag.catalog_id,
          'quote', tag.quote,
          'sourceLocator', tag.source_locator,
          'source', tag.source
        ) order by tag.created_at, tag.id
      ) as items
      from public.family_asset_tags tag
      where tag.asset_id = asset.id
        and tag.family_id = ${input.familyId}
    ) evidence on true
    order by
      candidates.lexical_rank desc,
      candidates.semantic_distance asc nulls last,
      candidates.created_at desc,
      asset.id
  `;
  return rows.map((row) => ({
    ...toFamilyAssetSource(row, 5),
    matchReason: familyAssetMatchReason(row, filters.query.length > 0),
  }));
}

export async function getFamilyAssetSource(
  familyId: string,
  assetId: string,
): Promise<FamilyAssetSource | null> {
  const sql = mapDb();
  const rows = await sql<FamilyAssetSourceRow[]>`
    select asset.id, asset.title, asset.original_name, asset.url,
           asset.media_type, asset.byte_size, asset.file_kind,
           asset.resource_kind, asset.authors, asset.publisher, asset.language,
           asset.status, asset.processing_note,
           asset.created_at::text, asset.updated_at::text,
           coalesce(children.items, '[]'::jsonb) as children,
           coalesce(evidence.items, '[]'::jsonb) as evidence
    from public.family_assets asset
    left join lateral (
      select jsonb_agg(
        jsonb_build_object('id', child.id, 'name', child.name)
        order by child.created_at, child.id
      ) as items
      from public.family_asset_children child_link
      join public.children child
        on child.id = child_link.child_id
       and child.family_id = child_link.family_id
      where child_link.asset_id = asset.id
        and child_link.family_id = ${familyId}
    ) children on true
    left join lateral (
      select jsonb_agg(
        jsonb_build_object(
          'kind', tag.kind,
          'value', tag.value,
          'catalogId', tag.catalog_id,
          'quote', tag.quote,
          'sourceLocator', tag.source_locator,
          'source', tag.source
        ) order by tag.created_at, tag.id
      ) as items
      from public.family_asset_tags tag
      where tag.asset_id = asset.id
        and tag.family_id = ${familyId}
    ) evidence on true
    where asset.id = ${assetId}
      and asset.family_id = ${familyId}
      and asset.deleted_at is null
    limit 1
  `;
  return rows[0] ? toFamilyAssetSource(rows[0], 20) : null;
}
