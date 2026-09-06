/** Stored originals and readable documents have deliberately different limits. */
export const FAMILY_ASSET_PROCESSING_MAX_BYTES = 32 * 1024 * 1024;
export const FAMILY_PDF_MAX_BYTES = 64 * 1024 * 1024;
export const FAMILY_PDF_EXTRACTION_VERSION = "pdf-pages-v1";
export const FAMILY_PDF_PAGE_MAX_CHARS = 32_000;
export const FAMILY_PDF_SOURCE_MAX_PAGES = 240;
export const FAMILY_PDF_READ_BUDGET_MS = 80_000;
export const FAMILY_ASSET_PROCESSING_BUDGET_MS = 270_000;

export function familyAssetReadableByteLimit(mediaType: string): number {
  return mediaType.trim().toLowerCase().split(";", 1)[0] === "application/pdf"
    ? FAMILY_PDF_MAX_BYTES : FAMILY_ASSET_PROCESSING_MAX_BYTES;
}

export type PdfPageState = "readable" | "blank" | "partial" | "unreadable";
export interface PdfPageRead {
  ordinal: number;
  locator: string;
  text: string;
  state: PdfPageState;
  method: "embedded" | "vision";
  model: string | null;
  gaps: string[];
}
