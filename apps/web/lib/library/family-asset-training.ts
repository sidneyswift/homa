import { createHash } from "node:crypto";

import {
  extractFamilyAssetSourceDocument,
  familyAssetProcessingCapability,
  type ClaimedFamilyAsset,
  type FamilyAssetSourceDocument,
} from "./family-asset-processing";
import {
  FAMILY_ASSET_TRAINING_EXCLUSION_REASONS,
  FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
  scanFamilyAssetTrainingContent,
  type FamilyAssetTrainingChildIdentity,
  type FamilyAssetTrainingExclusionReason,
} from "./family-asset-training-safety";
import type { FamilyAssetResourceKind, FamilyAssetStatus } from "./family-assets";
import { mapDb, type DbJson } from "../map/db";

export const FAMILY_ASSET_TRAINING_INGESTION_VERSION =
  "family-library-source-v1";
export const FAMILY_ASSET_TRAINING_PIPELINE_VERSION =
  "family-library-jsonl-v1";

type FamilyAssetTrainingDecision = "eligible" | "excluded" | "source_deleted";

export interface FamilyAssetTrainingSourceContext extends ClaimedFamilyAsset {
  byteSize: number;
  status: FamilyAssetStatus;
  contentSha256: string | null;
  deletedAt: string | null;
  children: FamilyAssetTrainingChildIdentity[];
}

export interface FamilyAssetTrainingExportSegment {
  locator: string;
  text: string;
}

export interface FamilyAssetTrainingExportRecord {
  schemaVersion: 1;
  recordId: string;
  sourceContentSha256: string | null;
  extractedContentSha256: string;
  content: {
    mediaType: string;
    resourceKind: FamilyAssetResourceKind | null;
    language: string | null;
    segmentKind: "page" | "section" | "sheet";
    segments: FamilyAssetTrainingExportSegment[];
  };
  provenance: {
    ingestionVersion: string;
    safetyPolicyVersion: string;
    pipelineVersion: string;
    transforms: FamilyAssetTrainingTransformManifest;
  };
}

export interface FamilyAssetTrainingTransformManifest {
  sourceExtractor: string;
  unicodeNormalization: "NFKC";
  safetyPolicy: string;
  outputFormat: string;
  segmentKind: "page" | "section" | "sheet" | null;
  segmentCount: number;
  totalSegments: number;
  truncated: boolean;
}

export interface PreparedFamilyAssetTrainingSource {
  familyId: string;
  sourceAssetId: string;
  sourceContentSha256: string | null;
  extractedContentSha256: string | null;
  sourceDeletedAt: string | null;
  decision: FamilyAssetTrainingDecision;
  exclusionReasons: FamilyAssetTrainingExclusionReason[];
  transformManifest: FamilyAssetTrainingTransformManifest;
  record: FamilyAssetTrainingExportRecord | null;
  recordSha256: string | null;
}

export interface FamilyAssetTrainingDatasetManifest {
  schemaVersion: 1;
  datasetVersion: string;
  pipelineVersion: string;
  ingestionVersion: string;
  safetyPolicyVersion: string;
  sourceDecisionCount: number;
  recordCount: number;
  decisionSha256: string;
  recordSha256s: string[];
  excludedByReason: Partial<Record<FamilyAssetTrainingExclusionReason, number>>;
}

export interface FamilyAssetTrainingDatasetArtifacts {
  jsonl: string;
  manifest: FamilyAssetTrainingDatasetManifest;
  manifestJson: string;
  manifestSha256: string;
}

export interface FamilyAssetTrainingPreparationDependencies {
  load(assetId: string): Promise<FamilyAssetTrainingSourceContext | null>;
  extract(asset: ClaimedFamilyAsset): Promise<FamilyAssetSourceDocument>;
}

export class FamilyAssetTrainingPreparationError extends Error {
  constructor(
    readonly code: "not-found" | "transient",
    message: string,
  ) {
    super(message);
    this.name = "FamilyAssetTrainingPreparationError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function transformManifest(input?: {
  segmentKind: "page" | "section" | "sheet";
  segmentCount: number;
  totalSegments: number;
  truncated: boolean;
}): FamilyAssetTrainingTransformManifest {
  return {
    sourceExtractor: FAMILY_ASSET_TRAINING_INGESTION_VERSION,
    unicodeNormalization: "NFKC",
    safetyPolicy: FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
    outputFormat: FAMILY_ASSET_TRAINING_PIPELINE_VERSION,
    segmentKind: input?.segmentKind ?? null,
    segmentCount: input?.segmentCount ?? 0,
    totalSegments: input?.totalSegments ?? 0,
    truncated: input?.truncated ?? false,
  };
}

function excludedSource(input: {
  source: FamilyAssetTrainingSourceContext;
  reasons: FamilyAssetTrainingExclusionReason[];
  transforms?: FamilyAssetTrainingTransformManifest;
  extractedContentSha256?: string | null;
}): PreparedFamilyAssetTrainingSource {
  return {
    familyId: input.source.familyId,
    sourceAssetId: input.source.id,
    sourceContentSha256: input.source.contentSha256,
    extractedContentSha256: input.extractedContentSha256 ?? null,
    sourceDeletedAt: input.source.deletedAt,
    decision: input.reasons.includes("source_deleted")
      ? "source_deleted"
      : "excluded",
    exclusionReasons: input.reasons,
    transformManifest: input.transforms ?? transformManifest(),
    record: null,
    recordSha256: null,
  };
}

async function loadFamilyAssetTrainingSource(
  assetId: string,
): Promise<FamilyAssetTrainingSourceContext | null> {
  const sql = mapDb();
  const rows = await sql<
    Array<{
      id: string;
      family_id: string;
      title: string;
      original_name: string;
      url: string;
      media_type: string;
      byte_size: number | string;
      resource_kind: FamilyAssetResourceKind | null;
      language: string | null;
      status: FamilyAssetStatus;
      content_sha256: string | null;
      deleted_at: string | null;
    }>
  >`
    select id, family_id, title, original_name, url, media_type, byte_size,
           resource_kind, language, status, content_sha256,
           deleted_at::text as deleted_at
    from public.family_assets
    where id = ${assetId}
      and parent_asset_id is null
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  const children = await sql<
    Array<{ name: string; birth_date: string }>
  >`
    select name, to_char(birth_month, 'YYYY-MM-DD') as birth_date
    from public.children
    where family_id = ${row.family_id}
    order by id
  `;
  return {
    id: row.id,
    familyId: row.family_id,
    title: row.title,
    originalName: row.original_name,
    url: row.url,
    mediaType: row.media_type,
    resourceKind: row.resource_kind,
    language: row.language,
    byteSize: Number(row.byte_size),
    status: row.status,
    contentSha256: row.content_sha256,
    deletedAt: row.deleted_at,
    children: children.map((child) => ({
      name: child.name,
      birthDate: child.birth_date,
    })),
  };
}

const DEFAULT_PREPARATION_DEPENDENCIES: FamilyAssetTrainingPreparationDependencies = {
  load: loadFamilyAssetTrainingSource,
  extract: extractFamilyAssetSourceDocument,
};

function normalizedSegments(
  document: Extract<FamilyAssetSourceDocument, { ok: true }>,
): FamilyAssetTrainingExportSegment[] {
  return document.segments.flatMap((segment) => {
    const locator = segment.locator.normalize("NFKC").trim();
    const text = segment.text.normalize("NFKC").trim();
    return locator && text ? [{ locator, text }] : [];
  });
}

function textFromSegments(segments: FamilyAssetTrainingExportSegment[]): string {
  return segments
    .map((segment) => `[${segment.locator}]\n${segment.text}`)
    .join("\n\n");
}

function extractionFailureReason(
  reason: Extract<FamilyAssetSourceDocument, { ok: false }>['reason'],
): FamilyAssetTrainingExclusionReason | "transient" {
  if (reason === "transient") return "transient";
  if (reason === "too_large") return "source_too_large";
  if (reason === "unsupported") return "unsupported_source";
  return "unreadable_source";
}

export async function prepareFamilyAssetTrainingSource(
  input: { assetId: string; operatorExcluded?: boolean },
  dependencies: FamilyAssetTrainingPreparationDependencies =
    DEFAULT_PREPARATION_DEPENDENCIES,
): Promise<PreparedFamilyAssetTrainingSource> {
  const source = await dependencies.load(input.assetId);
  if (!source) {
    throw new FamilyAssetTrainingPreparationError(
      "not-found",
      "The requested root Family Library asset does not exist.",
    );
  }
  if (source.deletedAt) {
    return excludedSource({ source, reasons: ["source_deleted"] });
  }
  if (input.operatorExcluded) {
    return excludedSource({ source, reasons: ["operator_excluded"] });
  }
  if (source.status !== "ready") {
    return excludedSource({ source, reasons: ["source_not_ready"] });
  }

  const capability = familyAssetProcessingCapability(source.mediaType);
  if (!capability || capability === "image") {
    return excludedSource({ source, reasons: ["unsupported_source"] });
  }

  const extracted = await dependencies.extract(source);
  if (!extracted.ok) {
    const reason = extractionFailureReason(extracted.reason);
    if (reason === "transient") {
      throw new FamilyAssetTrainingPreparationError(
        "transient",
        "The source could not be read reliably. Retry the export.",
      );
    }
    return excludedSource({ source, reasons: [reason] });
  }
  if (extracted.segmentKind === "image") {
    return excludedSource({ source, reasons: ["unsupported_source"] });
  }

  const segments = normalizedSegments(extracted);
  const text = textFromSegments(segments);
  const extractedContentSha256 = text ? sha256(text) : null;
  const transforms = transformManifest({
    segmentKind: extracted.segmentKind,
    segmentCount: segments.length,
    totalSegments: extracted.totalSegments,
    truncated: extracted.truncated,
  });
  if (extracted.truncated) {
    return excludedSource({
      source,
      reasons: ["truncated_source"],
      transforms,
      extractedContentSha256,
    });
  }
  if (!text || !extractedContentSha256) {
    return excludedSource({
      source,
      reasons: ["unreadable_source"],
      transforms,
    });
  }

  const exclusionReasons = scanFamilyAssetTrainingContent({
    text,
    metadata: [source.title, source.originalName],
    children: source.children,
  });
  if (exclusionReasons.length > 0) {
    return excludedSource({
      source,
      reasons: exclusionReasons,
      transforms,
      extractedContentSha256,
    });
  }

  const recordId = sha256(
    [
      source.id,
      source.contentSha256 ?? "no-source-hash",
      extractedContentSha256,
      FAMILY_ASSET_TRAINING_INGESTION_VERSION,
      FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
    ].join(":"),
  );
  const record: FamilyAssetTrainingExportRecord = {
    schemaVersion: 1,
    recordId,
    sourceContentSha256: source.contentSha256,
    extractedContentSha256,
    content: {
      mediaType: source.mediaType,
      resourceKind: source.resourceKind,
      language: source.language,
      segmentKind: extracted.segmentKind,
      segments,
    },
    provenance: {
      ingestionVersion: FAMILY_ASSET_TRAINING_INGESTION_VERSION,
      safetyPolicyVersion: FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
      pipelineVersion: FAMILY_ASSET_TRAINING_PIPELINE_VERSION,
      transforms,
    },
  };
  const recordSha256 = sha256(JSON.stringify(record));
  return {
    familyId: source.familyId,
    sourceAssetId: source.id,
    sourceContentSha256: source.contentSha256,
    extractedContentSha256,
    sourceDeletedAt: null,
    decision: "eligible",
    exclusionReasons: [],
    transformManifest: transforms,
    record,
    recordSha256,
  };
}

function decisionDigest(
  sources: readonly PreparedFamilyAssetTrainingSource[],
): string {
  const decisions = [...sources]
    .sort((left, right) => left.sourceAssetId.localeCompare(right.sourceAssetId))
    .map((source) => ({
      sourceAssetId: source.sourceAssetId,
      sourceContentSha256: source.sourceContentSha256,
      extractedContentSha256: source.extractedContentSha256,
      decision: source.decision,
      exclusionReasons: source.exclusionReasons,
    }));
  return sha256(JSON.stringify(decisions));
}

export function buildFamilyAssetTrainingDatasetArtifacts(input: {
  datasetVersion: string;
  sources: readonly PreparedFamilyAssetTrainingSource[];
}): FamilyAssetTrainingDatasetArtifacts {
  const sorted = [...input.sources].sort((left, right) =>
    left.sourceAssetId.localeCompare(right.sourceAssetId),
  );
  const records = sorted.flatMap((source) =>
    source.record && source.recordSha256
      ? [{ record: source.record, sha256: source.recordSha256 }]
      : [],
  );
  const excludedByReason: Partial<
    Record<FamilyAssetTrainingExclusionReason, number>
  > = {};
  for (const reason of FAMILY_ASSET_TRAINING_EXCLUSION_REASONS) {
    const count = sorted.filter((source) =>
      source.exclusionReasons.includes(reason),
    ).length;
    if (count > 0) excludedByReason[reason] = count;
  }
  const manifest: FamilyAssetTrainingDatasetManifest = {
    schemaVersion: 1,
    datasetVersion: input.datasetVersion,
    pipelineVersion: FAMILY_ASSET_TRAINING_PIPELINE_VERSION,
    ingestionVersion: FAMILY_ASSET_TRAINING_INGESTION_VERSION,
    safetyPolicyVersion: FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
    sourceDecisionCount: sorted.length,
    recordCount: records.length,
    decisionSha256: decisionDigest(sorted),
    recordSha256s: records.map((record) => record.sha256).sort(),
    excludedByReason,
  };
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  return {
    jsonl:
      records.length > 0
        ? `${records.map((item) => JSON.stringify(item.record)).join("\n")}\n`
        : "",
    manifest,
    manifestJson,
    manifestSha256: sha256(manifestJson),
  };
}

function sourceIdempotencyKey(input: {
  datasetVersion: string;
  source: PreparedFamilyAssetTrainingSource;
}): string {
  return sha256(
    JSON.stringify({
      datasetVersion: input.datasetVersion,
      familyId: input.source.familyId,
      sourceAssetId: input.source.sourceAssetId,
      sourceContentSha256: input.source.sourceContentSha256,
      extractedContentSha256: input.source.extractedContentSha256,
      ingestionVersion: FAMILY_ASSET_TRAINING_INGESTION_VERSION,
      safetyPolicyVersion: FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION,
      decision: input.source.decision,
      exclusionReasons: input.source.exclusionReasons,
    }),
  );
}

export async function commitFamilyAssetTrainingDataset(input: {
  datasetVersion: string;
  sources: readonly PreparedFamilyAssetTrainingSource[];
  artifacts: FamilyAssetTrainingDatasetArtifacts;
}): Promise<{ status: "committed" | "already_committed"; recordCount: number }> {
  if (input.sources.length === 0) {
    throw new Error("A training dataset build needs at least one source decision.");
  }
  if (new Set(input.sources.map((source) => source.sourceAssetId)).size !== input.sources.length) {
    throw new Error("A training dataset build cannot contain the same source twice.");
  }
  const expectedArtifacts = buildFamilyAssetTrainingDatasetArtifacts({
    datasetVersion: input.datasetVersion,
    sources: input.sources,
  });
  if (expectedArtifacts.manifestSha256 !== input.artifacts.manifestSha256) {
    throw new Error("Training dataset artifacts do not match the source decisions.");
  }

  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    await transaction`
      insert into training.dataset_builds (dataset_version, pipeline_version)
      values (${input.datasetVersion}, ${FAMILY_ASSET_TRAINING_PIPELINE_VERSION})
      on conflict (dataset_version) do nothing
    `;
    const [build] = await transaction<
      Array<{
        id: string;
        pipeline_version: string;
        status: string;
        output_manifest_sha256: string | null;
        record_count: number;
      }>
    >`
      select id, pipeline_version, status, output_manifest_sha256, record_count
      from training.dataset_builds
      where dataset_version = ${input.datasetVersion}
      for update
    `;
    if (!build) throw new Error("Training dataset build could not be reserved.");
    if (build.pipeline_version !== FAMILY_ASSET_TRAINING_PIPELINE_VERSION) {
      throw new Error("This dataset version belongs to another pipeline version.");
    }
    if (build.status === "ready") {
      if (
        build.output_manifest_sha256 === input.artifacts.manifestSha256 &&
        build.record_count === input.artifacts.manifest.recordCount
      ) {
        return {
          status: "already_committed" as const,
          recordCount: build.record_count,
        };
      }
      throw new Error("This dataset version is already committed with other bytes.");
    }
    if (build.status !== "building") {
      throw new Error("This dataset version cannot accept new records.");
    }

    for (const source of input.sources) {
      const idempotencyKey = sourceIdempotencyKey({
        datasetVersion: input.datasetVersion,
        source,
      });
      await transaction`
        insert into training.family_asset_sources (
          dataset_build_id, family_id, source_asset_id,
          source_content_sha256, extracted_content_sha256,
          ingestion_version, safety_policy_version, transform_manifest,
          decision, exclusion_reasons, source_deleted_at, idempotency_key
        ) values (
          ${build.id}, ${source.familyId}, ${source.sourceAssetId},
          ${source.sourceContentSha256}, ${source.extractedContentSha256},
          ${FAMILY_ASSET_TRAINING_INGESTION_VERSION},
          ${FAMILY_ASSET_TRAINING_SAFETY_POLICY_VERSION},
          ${transaction.json(source.transformManifest as unknown as DbJson)},
          ${source.decision},
          ${transaction.array(source.exclusionReasons)}::text[],
          ${source.sourceDeletedAt}, ${idempotencyKey}
        )
        on conflict (idempotency_key) do nothing
      `;
      const [recordedSource] = await transaction<
        Array<{ id: string; decision: FamilyAssetTrainingDecision }>
      >`
        select id, decision
        from training.family_asset_sources
        where idempotency_key = ${idempotencyKey}
        limit 1
      `;
      if (!recordedSource || recordedSource.decision !== source.decision) {
        throw new Error("Training source decision could not be recorded.");
      }

      if (source.decision !== "eligible") continue;
      if (!source.record || !source.recordSha256) {
        throw new Error("An eligible training source is missing its export record.");
      }
      await transaction`
        insert into training.family_asset_exports (
          source_id, dataset_build_id, record_sha256,
          transform_manifest, status, included_at
        ) values (
          ${recordedSource.id}, ${build.id}, ${source.recordSha256},
          ${transaction.json(source.transformManifest as unknown as DbJson)},
          'included', now()
        )
        on conflict (source_id, dataset_build_id) do nothing
      `;
    }

    const exports = await transaction<Array<{ record_sha256: string }>>`
      select record_sha256
      from training.family_asset_exports
      where dataset_build_id = ${build.id}
        and status = 'included'
      order by record_sha256
    `;
    const recordedHashes = exports.map((row) => row.record_sha256);
    if (
      JSON.stringify(recordedHashes) !==
      JSON.stringify(input.artifacts.manifest.recordSha256s)
    ) {
      throw new Error("The recorded training exports do not match the manifest.");
    }

    const updated = await transaction<{ id: string }[]>`
      update training.dataset_builds
      set status = 'ready',
          output_manifest_sha256 = ${input.artifacts.manifestSha256},
          record_count = ${input.artifacts.manifest.recordCount},
          ready_at = now(),
          updated_at = now()
      where id = ${build.id}
        and status = 'building'
      returning id
    `;
    if (updated.length !== 1) {
      throw new Error("Training dataset build could not be finalized.");
    }
    return {
      status: "committed" as const,
      recordCount: input.artifacts.manifest.recordCount,
    };
  });
}

export async function acknowledgeFamilyAssetTrainingRemoval(input: {
  datasetVersion: string;
  sourceAssetId: string;
  evidence: string;
}): Promise<{ removed: number; datasetRetired: boolean }> {
  const evidence = input.evidence.normalize("NFKC").trim();
  if (evidence.length < 1 || evidence.length > 500) {
    throw new Error("Removal evidence must be between 1 and 500 characters.");
  }
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const removed = await transaction<{ dataset_build_id: string }[]>`
      update training.family_asset_exports export
      set status = 'removed',
          removed_at = now(),
          removal_evidence = ${evidence},
          updated_at = now()
      from training.family_asset_sources source,
           training.dataset_builds build
      where export.source_id = source.id
        and export.dataset_build_id = build.id
        and build.dataset_version = ${input.datasetVersion}
        and source.source_asset_id = ${input.sourceAssetId}
        and export.status = 'removal_required'
      returning export.dataset_build_id
    `;
    if (removed.length === 0) return { removed: 0, datasetRetired: false };

    const buildId = removed[0]?.dataset_build_id;
    if (!buildId) return { removed: removed.length, datasetRetired: false };
    const [remaining] = await transaction<{ count: number }[]>`
      select count(*)::int as count
      from training.family_asset_exports
      where dataset_build_id = ${buildId}
        and status = 'removal_required'
    `;
    const datasetRetired = (remaining?.count ?? 0) === 0;
    if (datasetRetired) {
      await transaction`
        update training.dataset_builds
        set status = 'retired', updated_at = now()
        where id = ${buildId}
          and status = 'withdrawal_required'
      `;
    }
    return { removed: removed.length, datasetRetired };
  });
}
