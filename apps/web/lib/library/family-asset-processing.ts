import { randomUUID } from "node:crypto";

import { loadSpreadsheetParser, loadWordParser } from "../office-document-loaders";
import { fetchFamilyAssetBytes } from "./family-asset-bytes";
import { readFamilyPdf, type FamilyPdfDocument } from "./family-pdf-reader";
import { FAMILY_ASSET_PROCESSING_BUDGET_MS, FAMILY_PDF_READ_BUDGET_MS, FAMILY_PDF_EXTRACTION_VERSION } from "./family-asset-read-contract";
import { embedText } from "../learning/embeddings";
import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import { captionSmsImage } from "../voice/caption-image";
import {
  familyAssetIngestionFailureOutcome,
  type FamilyAssetIngestionFailureKind,
  type FamilyAssetIngestionFailureOutcome,
  type VerifiedFamilyAssetIngestion,
  verifyFamilyAssetIngestion,
} from "./family-asset-ingestion";
import { proposeFamilyAssetIngestion } from "./family-asset-ingestion-model";
import {
  FAMILY_ASSET_PROCESSING_QUEUED_NOTE,
  FAMILY_ASSET_PROCESSING_RUNNING_NOTE,
  familyAssetProcessingRetryAvailable,
  isFamilyLibraryUrl,
  titleFromLibraryFileName,
  type FamilyAssetResourceKind,
  type FamilyAssetStatus,
} from "./family-assets";

export { FAMILY_ASSET_PROCESSING_MAX_BYTES } from "./family-asset-read-contract";

const WORD_DOCUMENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const SPREADSHEET_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]);
const MODEL_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const FAMILY_ASSET_PROCESSING_MAX_CHARS = 64_000;

/** Plus curriculum reading keeps page identity and may inspect more than the
 *  lightweight Library classifier. It still stays bounded to one ready file. */
export const FAMILY_CURRICULUM_SOURCE_MAX_SEGMENTS = 240;
export const FAMILY_CURRICULUM_SOURCE_MAX_CHARS = 1_000_000;
export const FAMILY_CURRICULUM_SOURCE_MAX_SEGMENT_CHARS = 32_000;
const FAMILY_CURRICULUM_TEXT_SEGMENT_CHARS = 12_000;

export type FamilyAssetProcessingCapability =
  | "text"
  | "pdf"
  | "word"
  | "spreadsheet"
  | "image";

export type FamilyAssetProcessingFailureReason =
  | FamilyAssetIngestionFailureKind
  | "too_large"
  | "transient"
  | "invalid_result";

export type FamilyAssetProcessingFailureOutcome =
  FamilyAssetIngestionFailureOutcome;

export interface ClaimedFamilyAsset {
  processingAttemptId?: string;
  id: string;
  familyId: string;
  title: string;
  originalName: string;
  url: string;
  mediaType: string;
  resourceKind: FamilyAssetResourceKind | null;
  language: string | null;
}

export type FamilyAssetTextExtraction =
  | { ok: true; text: string; coverageNote?: string }
  | { ok: false; reason: FamilyAssetProcessingFailureReason };

export type FamilyAssetSourceSegmentKind = "page" | "section" | "sheet" | "image";

export interface FamilyAssetSourceSegment {
  ordinal: number;
  locator: string;
  text: string;
  state?: "readable" | "blank" | "partial" | "unreadable";
  method?: "embedded" | "vision";
  model?: string | null;
  gaps?: string[];
}

export type FamilyAssetSourceDocument =
  | {
      ok: true;
      segmentKind: FamilyAssetSourceSegmentKind;
      segments: FamilyAssetSourceSegment[];
      totalSegments: number;
      truncated: boolean;
      nextCursor?: number | null;
      contentSha256?: string;
      extractionVersion?: string;
      coverageNote?: string;
    }
  | { ok: false; reason: FamilyAssetProcessingFailureReason };

export interface FamilyAssetSourceExtractionWindow {
  startOrdinal: number;
  maxSegments: number;
  maxChars: number;
  cachedOnly?: boolean;
}

export interface FamilyAssetProcessingDependencies {
  claim(input: {
    familyId: string;
    assetId: string;
  }): Promise<ClaimedFamilyAsset | null>;
  extract(asset: ClaimedFamilyAsset, signal?: AbortSignal): Promise<FamilyAssetTextExtraction>;
  propose(input: {
    familyId: string | null;
    originalName: string;
    mediaType: string;
    extractedText: string;
    signal?: AbortSignal;
  }): Promise<unknown>;
  embed(input: {
    familyId: string;
    text: string;
    signal?: AbortSignal;
  }): Promise<string | null>;
  complete(input: {
    asset: ClaimedFamilyAsset;
    verified: Extract<VerifiedFamilyAssetIngestion, { ok: true }>;
    embedding: string | null;
    coverageNote?: string;
  }): Promise<void | boolean>;
  fail(input: {
    asset: ClaimedFamilyAsset;
    outcome: FamilyAssetProcessingFailureOutcome;
  }): Promise<void>;
}

function bareMediaType(mediaType: string): string {
  return mediaType.trim().toLowerCase().split(";", 1)[0] ?? "";
}

export function familyAssetProcessingCapability(
  mediaType: string,
): FamilyAssetProcessingCapability | null {
  const normalized = bareMediaType(mediaType);
  if (normalized.startsWith("text/")) return "text";
  if (normalized === "application/pdf") return "pdf";
  if (normalized === WORD_DOCUMENT_TYPE) return "word";
  if (SPREADSHEET_TYPES.has(normalized)) return "spreadsheet";
  if (MODEL_IMAGE_TYPES.has(normalized)) return "image";
  return null;
}

const TOO_LARGE_OUTCOME = {
  status: "needs_attention",
  errorCode: "content_too_large_to_process",
  processingNote:
    "Your original is saved and ready to download. This file is too large for Homa to organize its Library details automatically. Add them below instead.",
  preserveOriginal: true,
} as const satisfies FamilyAssetProcessingFailureOutcome;

const TRANSIENT_OUTCOME = {
  status: "failed",
  errorCode: "processing_failed",
  processingNote:
    "Your original is saved and ready to download. Homa could not finish organizing its Library details. Try organizing again.",
  preserveOriginal: true,
} as const satisfies FamilyAssetProcessingFailureOutcome;

const INVALID_RESULT_OUTCOME = {
  status: "failed",
  errorCode: "processing_invalid_result",
  processingNote:
    "Your original is saved and ready to download. Homa could not finish organizing its Library details. Try organizing again.",
  preserveOriginal: true,
} as const satisfies FamilyAssetProcessingFailureOutcome;

export function familyAssetProcessingFailureOutcome(
  reason: FamilyAssetProcessingFailureReason,
): FamilyAssetProcessingFailureOutcome {
  if (
    reason === "unreadable" ||
    reason === "encrypted" ||
    reason === "corrupt" ||
    reason === "unsupported"
  ) {
    return familyAssetIngestionFailureOutcome(reason);
  }
  if (reason === "too_large") return TOO_LARGE_OUTCOME;
  if (reason === "invalid_result") return INVALID_RESULT_OUTCOME;
  return TRANSIENT_OUTCOME;
}

export function familyAssetFieldsFromVerified(
  current: {
    title: string;
    defaultTitle: string;
    resourceKind: FamilyAssetResourceKind | null;
    language: string | null;
  },
  verified: Extract<VerifiedFamilyAssetIngestion, { ok: true }>,
): {
  title: string;
  resourceKind: FamilyAssetResourceKind | null;
  language: string | null;
} {
  return {
    title:
      current.title === current.defaultTitle && verified.title
        ? verified.title
        : current.title,
    resourceKind: current.resourceKind ?? verified.resourceKind,
    language: current.language ?? verified.language,
  };
}

/**
 * Semantic search should recognize both what the source says and the verified
 * Library facts around it. The embedding helper owns the final 8,000-character
 * cap, so this document stays descriptive and deterministic.
 */
export function familyAssetEmbeddingDocument(input: {
  asset: ClaimedFamilyAsset;
  extractedText: string;
  verified: Extract<VerifiedFamilyAssetIngestion, { ok: true }>;
}): string {
  const verifiedTitle = input.verified.title ?? input.asset.title;
  const verifiedKind = input.verified.resourceKind ?? input.asset.resourceKind;
  const tags = input.verified.tags.map((tag) => tag.value);
  return [
    `Title: ${verifiedTitle}`,
    verifiedKind ? `Resource type: ${verifiedKind}` : null,
    tags.length > 0 ? `Topics: ${tags.join(", ")}` : null,
    input.extractedText,
  ]
    .filter((value): value is string => value !== null)
    .join("\n");
}

async function fetchBoundedFamilyAssetBytes(asset: ClaimedFamilyAsset, signal = AbortSignal.timeout(FAMILY_PDF_READ_BUDGET_MS)) {
  return await fetchFamilyAssetBytes(asset, signal);
}

function clipExtractedText(text: string): string {
  const normalized = text.trim();
  return normalized.length > FAMILY_ASSET_PROCESSING_MAX_CHARS
    ? normalized.slice(0, FAMILY_ASSET_PROCESSING_MAX_CHARS)
    : normalized;
}

async function extractPdfText(asset: ClaimedFamilyAsset, signal: AbortSignal): Promise<FamilyAssetTextExtraction> {
  const document = await readFamilyPdf(asset, { startOrdinal: 1, maxPages: 8,
    maxChars: FAMILY_ASSET_PROCESSING_MAX_CHARS, maxUncachedOcr: 3, signal });
  return familyPdfTextForIngestion(document);
}

export function familyPdfTextForIngestion(document: FamilyPdfDocument): FamilyAssetTextExtraction {
  if (!document.ok) return document;
  const text = clipExtractedText(document.segments.filter(page => page.state === "readable" || page.state === "partial")
    .map(page => `[Page ${page.ordinal}]\n${page.text}`).join("\n"));
  return text ? { ok: true, text, coverageNote: `Homa organized the Library details from PDF pages ${document.segments.map(page => page.ordinal).join(", ")} of ${document.totalSegments}.${document.nextCursor !== null ? " The remaining pages have not been read." : ""}${document.truncated ? " Some content was incomplete." : ""}${document.stoppedAt ? ` Homa could not finish reading PDF page ${document.stoppedAt.ordinal}.` : ""}` }
    : { ok: false, reason: "unreadable" };
}

async function extractWordText(bytes: Uint8Array): Promise<FamilyAssetTextExtraction> {
  try {
    const mammoth = await loadWordParser();
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    const text = clipExtractedText(value);
    return text ? { ok: true, text } : { ok: false, reason: "unreadable" };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

async function extractSpreadsheetText(bytes: Uint8Array): Promise<FamilyAssetTextExtraction> {
  try {
    const XLSX = await loadSpreadsheetParser();
    const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
    const sheets = workbook.SheetNames.flatMap((name) => {
      const sheet = workbook.Sheets[name];
      const csv = sheet ? XLSX.utils.sheet_to_csv(sheet).trim() : "";
      return csv ? [`Sheet "${name}":\n${csv}`] : [];
    });
    const text = clipExtractedText(sheets.join("\n\n"));
    return text ? { ok: true, text } : { ok: false, reason: "unreadable" };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

export async function extractFamilyAssetText(
  asset: ClaimedFamilyAsset,
  signal = AbortSignal.timeout(FAMILY_ASSET_PROCESSING_BUDGET_MS),
): Promise<FamilyAssetTextExtraction> {
  if (!isFamilyLibraryUrl(asset.url, asset.familyId)) {
    return { ok: false, reason: "corrupt" };
  }
  const capability = familyAssetProcessingCapability(asset.mediaType);
  if (!capability) return { ok: false, reason: "unsupported" };

  if (capability === "pdf") return await extractPdfText(asset, signal);
  const downloaded = await fetchBoundedFamilyAssetBytes(asset, signal);
  if (!downloaded.ok) return downloaded;
  const { bytes } = downloaded;

  if (capability === "text") {
    const text = clipExtractedText(
      new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    );
    return text ? { ok: true, text } : { ok: false, reason: "unreadable" };
  }
  if (capability === "word") return await extractWordText(bytes);
  if (capability === "spreadsheet") return extractSpreadsheetText(bytes);

  const caption = await captionSmsImage({
    image: bytes,
    mediaType: bareMediaType(asset.mediaType),
    familyId: asset.familyId,
    channel: "web",
  });
  return caption
    ? { ok: true, text: caption }
    : { ok: false, reason: "unreadable" };
}

function splitSourceText(
  text: string,
  label: (ordinal: number) => string,
  startOrdinal = 1,
): FamilyAssetSourceSegment[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const segments: FamilyAssetSourceSegment[] = [];
  let offset = 0;
  let ordinal = startOrdinal;
  while (offset < normalized.length) {
    const hardEnd = Math.min(
      normalized.length,
      offset + FAMILY_CURRICULUM_TEXT_SEGMENT_CHARS,
    );
    const newline = normalized.lastIndexOf("\n", hardEnd);
    const end =
      hardEnd < normalized.length && newline > offset + 1_000
        ? newline
        : hardEnd;
    const part = normalized.slice(offset, end).trim();
    if (part) {
      segments.push({ ordinal, locator: label(ordinal), text: part });
      ordinal += 1;
    }
    offset = end;
    while (offset < normalized.length && /\s/u.test(normalized[offset] ?? "")) {
      offset += 1;
    }
  }
  return segments;
}

/**
 * Reads a ready Library original into deterministic page or section segments.
 * The caller owns family and Plus checks. Keeping this function free of those
 * decisions lets processing tests exercise extraction without billing state.
 */
export async function extractFamilyAssetSourceDocument(
  asset: ClaimedFamilyAsset,
  window?: FamilyAssetSourceExtractionWindow,
): Promise<FamilyAssetSourceDocument> {
  if (!isFamilyLibraryUrl(asset.url, asset.familyId)) {
    return { ok: false, reason: "corrupt" };
  }
  const capability = familyAssetProcessingCapability(asset.mediaType);
  if (!capability) return { ok: false, reason: "unsupported" };
  if (capability === "pdf") {
    return await readFamilyPdf(asset, {
      startOrdinal: window?.startOrdinal ?? 1,
      maxPages: window?.maxSegments ?? FAMILY_CURRICULUM_SOURCE_MAX_SEGMENTS,
      maxChars: window?.maxChars ?? FAMILY_CURRICULUM_SOURCE_MAX_CHARS,
      maxUncachedOcr: 1,
      cachedOnly: window?.cachedOnly,
      signal: AbortSignal.timeout(FAMILY_PDF_READ_BUDGET_MS),
    });
  }
  const downloaded = await fetchBoundedFamilyAssetBytes(asset);
  if (!downloaded.ok) return downloaded;
  const { bytes } = downloaded;

  if (capability === "text") {
    const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const clipped = decoded.slice(0, FAMILY_CURRICULUM_SOURCE_MAX_CHARS);
    const segments = splitSourceText(clipped, (ordinal) => `Section ${ordinal}`);
    return segments.length > 0
      ? {
          ok: true,
          segmentKind: "section",
          segments,
          totalSegments: segments.length,
          truncated: decoded.length > clipped.length,
        }
      : { ok: false, reason: "unreadable" };
  }

  if (capability === "word") {
    try {
      const mammoth = await loadWordParser();
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      const clipped = value.slice(0, FAMILY_CURRICULUM_SOURCE_MAX_CHARS);
      const segments = splitSourceText(clipped, (ordinal) => `Section ${ordinal}`);
      return segments.length > 0
        ? {
            ok: true,
            segmentKind: "section",
            segments,
            totalSegments: segments.length,
            truncated: value.length > clipped.length,
          }
        : { ok: false, reason: "unreadable" };
    } catch {
      return { ok: false, reason: "corrupt" };
    }
  }

  if (capability === "spreadsheet") {
    try {
      const XLSX = await loadSpreadsheetParser();
      const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
      const segments: FamilyAssetSourceSegment[] = [];
      let chars = 0;
      let truncated = false;
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name];
        const csv = sheet ? XLSX.utils.sheet_to_csv(sheet).trim() : "";
        if (!csv) continue;
        const remaining = FAMILY_CURRICULUM_SOURCE_MAX_CHARS - chars;
        if (remaining <= 0) {
          truncated = true;
          break;
        }
        const clipped = csv.slice(0, remaining);
        const sheetParts = splitSourceText(
          clipped,
          (ordinal) =>
            ordinal === 1 ? `Sheet ${name}` : `Sheet ${name}, part ${ordinal}`,
        );
        for (const part of sheetParts) {
          segments.push({ ...part, ordinal: segments.length + 1 });
        }
        chars += clipped.length;
        if (csv.length > clipped.length) {
          truncated = true;
          break;
        }
      }
      return segments.length > 0
        ? {
            ok: true,
            segmentKind: "sheet",
            segments,
            totalSegments: segments.length,
            truncated,
          }
        : { ok: false, reason: "unreadable" };
    } catch {
      return { ok: false, reason: "corrupt" };
    }
  }

  const caption = await captionSmsImage({
    image: bytes,
    mediaType: bareMediaType(asset.mediaType),
    familyId: asset.familyId,
    channel: "web",
  });
  return caption
    ? {
        ok: true,
        segmentKind: "image",
        segments: [{ ordinal: 1, locator: "Image 1", text: caption }],
        totalSegments: 1,
        truncated: false,
      }
    : { ok: false, reason: "unreadable" };
}

async function claimFamilyAssetProcessing(input: {
  familyId: string;
  assetId: string;
}): Promise<ClaimedFamilyAsset | null> {
  const sql = mapDb();
  const attemptId = randomUUID();
  const rows = await sql<
    Array<{
      id: string;
      family_id: string;
      title: string;
      original_name: string;
      url: string;
      media_type: string;
      resource_kind: FamilyAssetResourceKind | null;
      language: string | null;
    }>
  >`
    update public.family_assets
    set processing_note = ${FAMILY_ASSET_PROCESSING_RUNNING_NOTE},
        processing_attempt_id = ${attemptId},
        processing_version = ${FAMILY_PDF_EXTRACTION_VERSION},
        updated_at = now()
    where id = ${input.assetId}
      and family_id = ${input.familyId}
      and deleted_at is null
      and status = 'processing'
      and processing_note = ${FAMILY_ASSET_PROCESSING_QUEUED_NOTE}
    returning id, family_id, title, original_name, url, media_type,
              resource_kind, language
  `;
  const row = rows[0];
  return row
    ? {
        id: row.id,
        processingAttemptId: attemptId,
        familyId: row.family_id,
        title: row.title,
        originalName: row.original_name,
        url: row.url,
        mediaType: row.media_type,
        resourceKind: row.resource_kind,
        language: row.language,
      }
    : null;
}

async function completeFamilyAssetProcessing(input: {
  asset: ClaimedFamilyAsset;
  verified: Extract<VerifiedFamilyAssetIngestion, { ok: true }>;
  embedding: string | null;
  coverageNote?: string;
}): Promise<boolean> {
  const sql = mapDb();
  const completed = await sql.begin(async (transaction) => {
    const rows = await transaction<
      Array<{
        title: string;
        original_name: string;
        resource_kind: FamilyAssetResourceKind | null;
        language: string | null;
        has_parent_subjects: boolean;
      }>
    >`
      select asset.title, asset.original_name, asset.resource_kind, asset.language,
             exists (
               select 1 from public.family_asset_tags tag
               where tag.asset_id = asset.id
                 and tag.family_id = asset.family_id
                 and tag.kind = 'subject'
                 and tag.source = 'parent'
             ) as has_parent_subjects
      from public.family_assets asset
      where asset.id = ${input.asset.id}
        and asset.family_id = ${input.asset.familyId}
        and asset.deleted_at is null
        and asset.status = 'processing'
        and asset.processing_attempt_id = ${input.asset.processingAttemptId ?? null}
      for update
    `;
    const current = rows[0];
    if (!current) return false;

    const fields = familyAssetFieldsFromVerified(
      {
        title: current.title,
        defaultTitle: titleFromLibraryFileName(current.original_name),
        resourceKind: current.resource_kind,
        language: current.language,
      },
      input.verified,
    );

    await transaction`
      delete from public.family_asset_tags
      where asset_id = ${input.asset.id}
        and family_id = ${input.asset.familyId}
        and source = 'model'
    `;
    const uniqueTags = new Map(
      input.verified.tags.map((tag) => [
        [tag.kind, tag.catalogId ?? "", tag.value, tag.quote].join("\u0000"),
        tag,
      ]),
    );
    for (const tag of uniqueTags.values()) {
      if (tag.kind === "subject" && current.has_parent_subjects) continue;
      await transaction`
        insert into public.family_asset_tags (
          family_id, asset_id, kind, value, catalog_id, quote,
          source_locator, source
        )
        values (
          ${input.asset.familyId}, ${input.asset.id}, ${tag.kind},
          ${tag.value}, ${tag.catalogId}, ${tag.quote},
          ${tag.sourceLocator}, 'model'
        )
      `;
    }

    await transaction`
      update public.family_assets
      set title = ${fields.title},
          resource_kind = ${fields.resourceKind},
          language = ${fields.language},
          embedding = coalesce(
            ${input.embedding}::extensions.vector(1536),
            embedding
          ),
          status = 'ready',
          processing_error_code = null,
          processing_note = ${input.coverageNote ?? null},
          processed_at = now(),
          updated_at = now()
      where id = ${input.asset.id}
        and family_id = ${input.asset.familyId}
        and deleted_at is null
        and status = 'processing'
        and processing_attempt_id = ${input.asset.processingAttemptId ?? null}
    `;
    return true;
  });
  if (completed) {
    await emitMapEvent("library.asset_processed", {
      family_id: input.asset.familyId,
      asset_id: input.asset.id,
    });
  }
  return completed;
}

async function failFamilyAssetProcessing(input: {
  asset: ClaimedFamilyAsset;
  outcome: FamilyAssetProcessingFailureOutcome;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.family_assets
    set status = ${input.outcome.status},
        processing_error_code = ${input.outcome.errorCode},
        processing_note = ${input.outcome.processingNote},
        processed_at = null,
        updated_at = now()
    where id = ${input.asset.id}
      and family_id = ${input.asset.familyId}
      and deleted_at is null
      and status = 'processing'
      and processing_attempt_id = ${input.asset.processingAttemptId ?? null}
  `;
}

export const PRODUCTION_PROCESSING_DEPENDENCIES: FamilyAssetProcessingDependencies = {
  claim: claimFamilyAssetProcessing,
  extract: extractFamilyAssetText,
  propose: proposeFamilyAssetIngestion,
  embed: async ({ familyId, text, signal }) => await embedText(text, { familyId, signal }),
  complete: completeFamilyAssetProcessing,
  fail: failFamilyAssetProcessing,
};

export async function processFamilyAssetWithDependencies(
  input: { familyId: string; assetId: string },
  dependencies: FamilyAssetProcessingDependencies,
): Promise<
  | { ok: true; assetId: string }
  | { ok: false; reason: FamilyAssetProcessingFailureReason | "not-claimed" }
> {
  const signal = AbortSignal.timeout(FAMILY_ASSET_PROCESSING_BUDGET_MS);
  const asset = await dependencies.claim(input);
  if (!asset) return { ok: false, reason: "not-claimed" };

  let extracted: FamilyAssetTextExtraction;
  try {
    extracted = await dependencies.extract(asset, signal);
  } catch {
    extracted = { ok: false, reason: "transient" };
  }
  if (!extracted.ok) {
    await dependencies.fail({
      asset,
      outcome: familyAssetProcessingFailureOutcome(extracted.reason),
    });
    return { ok: false, reason: extracted.reason };
  }

  let proposal: unknown;
  try {
    proposal = await dependencies.propose({
      familyId: asset.familyId,
      originalName: asset.originalName,
      mediaType: asset.mediaType,
      extractedText: extracted.text,
      signal,
    });
  } catch {
    await dependencies.fail({
      asset,
      outcome: familyAssetProcessingFailureOutcome("transient"),
    });
    return { ok: false, reason: "transient" };
  }

  const verified = verifyFamilyAssetIngestion(proposal, extracted.text);
  if (!verified.ok) {
    await dependencies.fail({
      asset,
      outcome: familyAssetProcessingFailureOutcome("invalid_result"),
    });
    return { ok: false, reason: "invalid_result" };
  }

  let embedding: string | null = null;
  try {
    embedding = await dependencies.embed({
      familyId: asset.familyId,
      signal,
      text: familyAssetEmbeddingDocument({
        asset,
        extractedText: extracted.text,
        verified,
      }),
    });
  } catch {
    // Embeddings improve retrieval but never decide whether an original is
    // safely preserved or whether verified metadata may complete.
  }

  try {
    signal.throwIfAborted();
    const completed = await dependencies.complete({ asset, verified, embedding, coverageNote: extracted.coverageNote });
    if (completed === false) return { ok: false, reason: "not-claimed" };
    return { ok: true, assetId: asset.id };
  } catch {
    await dependencies.fail({
      asset,
      outcome: familyAssetProcessingFailureOutcome("transient"),
    });
    return { ok: false, reason: "transient" };
  }
}

export async function processQueuedFamilyAsset(input: {
  familyId: string;
  assetId: string;
}) {
  return await processFamilyAssetWithDependencies(
    input,
    PRODUCTION_PROCESSING_DEPENDENCIES,
  );
}

export async function queueFamilyAssetProcessingRetry(input: {
  familyId: string;
  assetId: string;
}): Promise<{ ok: true } | { ok: false; reason: "not-found" | "not-retryable" }> {
  const sql = mapDb();
  return await sql.begin(async (transaction) => {
    const rows = await transaction<
      Array<{
        status: FamilyAssetStatus;
        processing_error_code: string | null;
        updated_at: string;
        media_type: string;
        byte_size: number | string;
        processing_version: string | null;
      }>
    >`
      select status, processing_error_code, updated_at::text, media_type, byte_size, processing_version
      from public.family_assets
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
      for update
    `;
    const asset = rows[0];
    if (!asset) return { ok: false, reason: "not-found" } as const;
    if (
      !familyAssetProcessingRetryAvailable({
        status: asset.status,
        processingErrorCode: asset.processing_error_code,
        updatedAt: asset.updated_at,
        mediaType: asset.media_type,
        byteSize: Number(asset.byte_size),
        processingVersion: asset.processing_version,
      })
    ) {
      return { ok: false, reason: "not-retryable" } as const;
    }
    await transaction`
      update public.family_assets
      set status = 'processing',
          processing_attempt_id = null,
          processing_error_code = null,
          processing_note = ${FAMILY_ASSET_PROCESSING_QUEUED_NOTE},
          processed_at = null,
          updated_at = now()
      where id = ${input.assetId}
        and family_id = ${input.familyId}
        and deleted_at is null
    `;
    return { ok: true } as const;
  });
}
