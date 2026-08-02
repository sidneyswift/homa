export const FAMILY_ASSET_FILE_KINDS = [
  "document",
  "image",
  "audio",
  "video",
  "archive",
  "link",
  "other",
] as const;

export type FamilyAssetFileKind = (typeof FAMILY_ASSET_FILE_KINDS)[number];

export const FAMILY_ASSET_RESOURCE_KINDS = [
  "worksheet",
  "book",
  "curriculum",
  "answer_key",
  "activity",
  "reference",
  "other",
] as const;

export type FamilyAssetResourceKind =
  (typeof FAMILY_ASSET_RESOURCE_KINDS)[number];

export const FAMILY_ASSET_STATUSES = [
  "ready",
  "processing",
  "needs_attention",
  "failed",
] as const;

export type FamilyAssetStatus = (typeof FAMILY_ASSET_STATUSES)[number];

export const FAMILY_ASSET_PROCESSING_QUEUED_NOTE =
  "Your original is saved and ready to download. Homa will organize its Library details next.";
export const FAMILY_ASSET_PROCESSING_RUNNING_NOTE =
  "Your original is saved and ready to download. Homa is organizing its Library details.";

export interface FamilyAssetChild {
  id: string;
  name: string;
}

export interface FamilyAssetSubject {
  id: string;
  label: string;
  source: "model" | "parent" | "import" | "system";
}

export interface FamilyAssetView {
  id: string;
  title: string;
  originalName: string;
  url: string;
  downloadUrl: string;
  mediaType: string;
  byteSize: number;
  fileKind: FamilyAssetFileKind;
  resourceKind: FamilyAssetResourceKind | null;
  authors: string[];
  publisher: string | null;
  language: string | null;
  status: FamilyAssetStatus;
  processingErrorCode: string | null;
  processingNote: string | null;
  sourceUploadId: string | null;
  sourceAttachmentId: string | null;
  parentAssetId: string | null;
  children: FamilyAssetChild[];
  subjects: FamilyAssetSubject[];
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type FamilyCurriculumUnitKind =
  | "week"
  | "lesson"
  | "day"
  | "chapter"
  | "unit";

export type FamilyCurriculumUnitConfidence = "high" | "medium" | "low";

export const FAMILY_CURRICULUM_UNIT_REVIEW_LABELS: Record<
  FamilyCurriculumUnitConfidence,
  string
> = {
  high: "Source match: clear",
  medium: "Source match: check Homa's summary",
  low: "Source match: check the unit boundary",
};

/** One read-only unit from the current approved decomposition of an original. */
export interface FamilyCurriculumUnitView {
  id: string;
  parentAssetId: string;
  isCurrent: boolean;
  ordinal: number;
  unitLabel: string;
  unitKind: FamilyCurriculumUnitKind;
  sourceLocator: string;
  confidence: FamilyCurriculumUnitConfidence;
  summary: string;
  children: FamilyAssetChild[];
  subjects: FamilyAssetSubject[];
}

const FAMILY_ASSET_PROCESSING_STALE_MS = 5 * 60 * 1000;
const RETRYABLE_PROCESSING_ERRORS = new Set([
  "processing_failed",
  "processing_invalid_result",
]);

export function familyAssetProcessingRetryAvailable(
  asset: Pick<
    FamilyAssetView,
    "status" | "processingErrorCode" | "updatedAt"
  >,
  now = new Date(),
): boolean {
  if (
    (asset.status === "failed" || asset.status === "needs_attention") &&
    asset.processingErrorCode !== null
  ) {
    return RETRYABLE_PROCESSING_ERRORS.has(asset.processingErrorCode);
  }
  if (asset.status !== "processing") return false;
  const updatedAt = new Date(asset.updatedAt).getTime();
  return (
    Number.isFinite(updatedAt) &&
    now.getTime() - updatedAt >= FAMILY_ASSET_PROCESSING_STALE_MS
  );
}

export const MAX_LIBRARY_UPLOAD_BYTES = 500 * 1024 * 1024;

export const LIBRARY_UPLOAD_CONTENT_TYPES = [
  "image/*",
  "video/*",
  "audio/*",
  "text/*",
  "application/pdf",
  "application/epub+zip",
  "application/zip",
  "application/vnd.amazon.ebook",
  "application/x-mobipocket-ebook",
  "application/msword",
  "application/rtf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.apple.keynote",
  "application/vnd.apple.numbers",
  "application/vnd.apple.pages",
] as const;

const ARCHIVE_MEDIA_TYPES = new Set([
  "application/epub+zip",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/zip",
]);

const DOCUMENT_MEDIA_TYPES = new Set([
  "application/msword",
  "application/pdf",
  "application/rtf",
  "application/vnd.apple.keynote",
  "application/vnd.apple.numbers",
  "application/vnd.apple.pages",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.presentation",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const LIBRARY_EXTENSION_MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".azw": "application/vnd.amazon.ebook",
  ".azw3": "application/vnd.amazon.ebook",
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".epub": "application/epub+zip",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".md": "text/markdown",
  ".mobi": "application/x-mobipocket-ebook",
  ".numbers": "application/vnd.apple.numbers",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".pages": "application/vnd.apple.pages",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".rtf": "application/rtf",
  ".txt": "text/plain",
  ".xls": "application/vnd.ms-excel",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

/** Exact file-container classification only. Resource meaning such as
 * "curriculum" or "worksheet" belongs to the model judgment layer. */
export function familyAssetFileKind(mediaType: string): FamilyAssetFileKind {
  const normalized = mediaType.trim().toLowerCase().split(";", 1)[0] ?? "";
  if (normalized.startsWith("image/")) return "image";
  if (normalized.startsWith("audio/")) return "audio";
  if (normalized.startsWith("video/")) return "video";
  if (normalized.startsWith("text/") || DOCUMENT_MEDIA_TYPES.has(normalized)) {
    return "document";
  }
  if (ARCHIVE_MEDIA_TYPES.has(normalized)) return "archive";
  return "other";
}

/** Browsers sometimes omit the MIME type for known educational files.
 * Keep the server allowlist meaningful by filling only exact, unambiguous
 * container extensions. Notably, `.key` is not inferred because it can be a
 * Keynote deck or a secret key; the browser must identify that type itself. */
export function libraryUploadMediaType(
  name: string,
  browserMediaType: string,
): string {
  const normalized = browserMediaType.trim().toLowerCase().split(";", 1)[0];
  if (normalized && normalized !== "application/octet-stream") return normalized;
  const extension = /\.[^.]+$/u.exec(name.normalize("NFKC").toLowerCase())?.[0];
  return extension ? LIBRARY_EXTENSION_MEDIA_TYPES[extension] ?? "" : "";
}

export function isLibraryUploadMediaTypeAllowed(mediaType: string): boolean {
  const normalized = mediaType.trim().toLowerCase().split(";", 1)[0] ?? "";
  return LIBRARY_UPLOAD_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith("/*")
      ? normalized.startsWith(allowed.slice(0, -1))
      : normalized === allowed,
  );
}

export function safeLibraryPathName(name: string): string {
  const cleaned = name
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^[-.]+|[-.]+$/gu, "");
  return cleaned.length > 0 ? cleaned.slice(-120) : "resource";
}

export function titleFromLibraryFileName(name: string): string {
  const normalized = name.normalize("NFKC").trim().slice(0, 180);
  const withoutExtension = normalized.replace(/\.[^.]{1,12}$/u, "").trim();
  return withoutExtension || normalized || "Untitled resource";
}

/** A client-supplied URL is only a candidate when it is in this exact
 * family's Library prefix on Homa's configured artifact store. */
export function isFamilyLibraryUrl(url: string, familyId: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".public.blob.vercel-storage.com") &&
      parsed.pathname.startsWith(`/families/${familyId}/library/`)
    );
  } catch {
    return false;
  }
}

export function formatFamilyAssetBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
}
