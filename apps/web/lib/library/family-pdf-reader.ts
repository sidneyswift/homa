import type { PDFPageProxy, TextContent } from "pdfjs-dist/types/src/display/api";

import { withPdfForReading, rasterizePdfPageForReading } from "../materials/rasterize-pdf";
import { fetchFamilyAssetBytes } from "./family-asset-bytes";
import {
  FAMILY_PDF_EXTRACTION_VERSION, FAMILY_PDF_PAGE_MAX_CHARS, FAMILY_PDF_SOURCE_MAX_PAGES,
  type PdfPageRead,
} from "./family-asset-read-contract";
import { pdfPageCache, type PdfPageCache } from "./pdf-page-cache";
import { transcribePdfPage } from "./pdf-page-transcription";

export interface FamilyPdfReaderDependencies {
  download: typeof fetchFamilyAssetBytes;
  cache: PdfPageCache;
  transcribe: typeof transcribePdfPage;
}
export type FamilyPdfDocument = {
  ok: true; segmentKind: "page"; segments: PdfPageRead[]; totalSegments: number;
  truncated: boolean; contentSha256: string; extractionVersion: string;
  nextCursor: number | null; coverageNote: string;
} | { ok: false; reason: "too_large" | "transient" | "corrupt" | "encrypted" | "unreadable" };

/** Stop the text stream at the retained page limit instead of first collecting
 * every text item from an arbitrarily dense original. */
async function boundedEmbeddedText(page: PDFPageProxy, signal: AbortSignal) {
  const reader = (page.streamTextContent() as ReadableStream<TextContent>).getReader();
  const abort = () => { void reader.cancel(new Error("PDF text read aborted")).catch(() => {}); };
  signal.addEventListener("abort", abort, { once: true });
  let text = "";
  try {
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) return { text: text.trim(), truncated: false };
      for (const item of chunk.value.items) {
        if (!("str" in item)) continue;
        const remaining = FAMILY_PDF_PAGE_MAX_CHARS + 1 - text.length;
        text += (text ? " " : "") + item.str.slice(0, remaining);
        if (text.length > FAMILY_PDF_PAGE_MAX_CHARS) {
          await reader.cancel(new Error("PDF text reached the page limit"));
          return { text: text.slice(0, FAMILY_PDF_PAGE_MAX_CHARS).trim(), truncated: true };
        }
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

/** Existing tools retain workflow judgment. This service supplies exact page
 * identity, bounded decoding, canonical transcription and an honest cursor. */
export async function readFamilyPdf(
  asset: { id: string; familyId: string; url: string; mediaType: string },
  options: { startOrdinal: number; maxPages: number; maxChars: number; maxUncachedOcr: number; signal: AbortSignal; cachedOnly?: boolean },
  dependencies: FamilyPdfReaderDependencies = { download: fetchFamilyAssetBytes, cache: pdfPageCache, transcribe: transcribePdfPage },
): Promise<FamilyPdfDocument> {
  if (options.signal.aborted) return { ok: false, reason: "transient" };
  const downloaded = await dependencies.download(asset, options.signal);
  if (!downloaded.ok) return downloaded;
  if (options.signal.aborted) return { ok: false, reason: "transient" };
  const source = { ...asset, sha256: downloaded.sha256 };
  if (!(await dependencies.cache.bind(source))) return { ok: false, reason: "unreadable" };
  try {
    return await withPdfForReading(downloaded.bytes, options.signal, async (document) => {
      const totalSegments = document.numPages;
      const limit = Math.min(totalSegments, FAMILY_PDF_SOURCE_MAX_PAGES);
      const start = Math.max(1, options.startOrdinal);
      const segments: PdfPageRead[] = [];
      let chars = 0;
      let ocr = 0;
      let firstMissing: number | null = null;
      let nextCursor: number | null = start <= limit ? start : null;
      let truncated = totalSegments > limit || start > limit;
      for (let ordinal = start; ordinal <= Math.min(limit, start + options.maxPages - 1); ordinal++) {
        options.signal.throwIfAborted();
        let result = await dependencies.cache.get(source, ordinal);
        if (!result) {
          if (options.cachedOnly) { truncated = true; firstMissing ??= ordinal; continue; }
          const page = await document.getPage(ordinal);
          const pageSignal = AbortSignal.any([options.signal, AbortSignal.timeout(55_000)]);
          let lease: string | null = null;
          try {
            const embeddedResult = await boundedEmbeddedText(page, pageSignal);
            const embedded = embeddedResult.text;
            if (!embedded && ocr >= options.maxUncachedOcr) { nextCursor = ordinal; break; }
            lease = await dependencies.cache.claim(source, ordinal);
            if (!lease) {
              result = await dependencies.cache.get(source, ordinal);
              if (!result) { nextCursor = ordinal; break; }
            } else {
              if (embedded) {
                result = { ordinal, locator: `Page ${ordinal}`, text: embedded, state: embeddedResult.truncated ? "partial" : "readable",
                  method: "embedded", model: null, gaps: embeddedResult.truncated ? ["Embedded page text exceeded the page limit."] : [] };
              } else {
                ocr++;
                const jpeg = await rasterizePdfPageForReading(page, pageSignal);
                result = { ...await dependencies.transcribe({ jpeg, familyId: asset.familyId, signal: pageSignal }), ordinal, locator: `Page ${ordinal}` };
              }
              options.signal.throwIfAborted();
              if (!(await dependencies.cache.complete(source, result, lease))) return { ok: false, reason: "transient" } as const;
            }
          } finally {
            if (lease) await dependencies.cache.release(source, ordinal, lease);
            page.cleanup();
          }
        }
        if (!result) break;
        if (segments.length && chars + result.text.length > options.maxChars) { nextCursor = ordinal; break; }
        const available = Math.max(0, options.maxChars - chars);
        if (result.text.length > available) {
          result = { ...result, text: result.text.slice(0, available), state: "partial", gaps: [...result.gaps, "This response reached its text limit."] };
          truncated = true;
        }
        segments.push(result);
        chars += result.text.length;
        truncated ||= result.state === "partial" || result.state === "unreadable";
        nextCursor = ordinal < limit ? ordinal + 1 : null;
        if (chars >= options.maxChars) break;
      }
      if (firstMissing !== null) nextCursor = firstMissing;
      // Verification cannot call a source complete when its aggregate text
      // budget omitted cached pages, including unexamined missing pages.
      if (options.cachedOnly && nextCursor !== null) truncated = true;
      const inspected = segments.map(page => page.ordinal).join(", ");
      const coverageNote = start > limit
        ? `PDF page ${start} is outside the readable scope of ${limit} of ${totalSegments} pages.`
        : `Inspected PDF pages ${inspected || "none"} of ${totalSegments}. ${nextCursor === null ? "No further pages within this read scope." : `Continue at PDF page ${nextCursor}.`} ${totalSegments > limit ? `Reading stops at PDF page ${limit}; later pages were not read.` : ""}`.trim();
      return { ok: true, segmentKind: "page", segments, totalSegments, truncated,
        contentSha256: source.sha256, extractionVersion: FAMILY_PDF_EXTRACTION_VERSION, nextCursor, coverageNote };
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    return { ok: false, reason: name === "PasswordException" ? "encrypted" : name === "InvalidPDFException" ? "corrupt" : "transient" };
  }
}
