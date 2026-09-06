import { getBuiltinModule } from "node:process";
import { isAbsolute } from "node:path";
import { Worker } from "node:worker_threads";
import { PDFDocument, PDFName, PDFArray } from "pdf-lib";
import { MAX_PRINT_PAGES, type PreparedPrintRequest } from "@homa/core";

export const MAX_PRINT_PDF_BYTES = 32 * 1024 * 1024;
export const PRINT_PDF_BUDGET_MS = 40_000;

/** The external library is loaded above; use its native filename, not a bundle ID. */
function loadedPdfLibraryPath(): string {
  // Incident gh#1105: Turbopack replaced require.resolve with a numeric module
  // ID. Its external package alias also differs from the source package name.
  const nativeRequire = getBuiltinModule("module").createRequire(import.meta.url);
  for (const entry of Object.values(nativeRequire.cache)) {
    if (entry?.exports?.PDFDocument === PDFDocument && entry.exports.PDFName === PDFName
      && entry.exports.PDFArray === PDFArray && isAbsolute(entry.filename)) return entry.filename;
  }
  throw new Error("The loaded print PDF library is unavailable to the worker");
}

/** Isolated parser: termination is real, including synchronous PDF inflation. */
const subsetWorker = String.raw`
const { parentPort, workerData } = require("node:worker_threads");
const { PDFDocument, PDFName, PDFArray } = require(workerData.pdfLibPath);
(async () => {
  const source = await PDFDocument.load(workerData.bytes, { ignoreEncryption: false, throwOnInvalidObject: true, updateMetadata: false });
  const count = source.getPageCount();
  if (count < 1 || count > workerData.maxPages || count !== workerData.pageCount) throw new Error("page-count");
  // Generated materials are static print documents. Reject interactive page
  // graphs rather than copying links/actions that may pull excluded pages in.
  if (source.catalog.has(PDFName.of("AcroForm")) || source.catalog.has(PDFName.of("OpenAction"))
    || source.catalog.has(PDFName.of("AA")) || source.catalog.has(PDFName.of("Names"))) throw new Error("interactive-pdf");
  for (const page of source.getPages()) {
    const annots = page.node.lookup(PDFName.of("Annots"));
    if ((annots && (!(annots instanceof PDFArray) || annots.size() > 0)) || page.node.has(PDFName.of("AA"))) throw new Error("interactive-pdf");
  }
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, workerData.pageIndexes);
  for (const page of pages) output.addPage(page);
  const bytes = await output.save({ useObjectStreams: true, addDefaultPage: false });
  if (bytes.length === 0 || bytes.length > workerData.maxBytes) throw new Error("too-large");
  parentPort.postMessage({ ok: true, bytes }, [bytes.buffer]);
})().catch(() => parentPort.postMessage({ ok: false }));
`;

export async function subsetPrintPdf(
  bytes: Uint8Array,
  request: PreparedPrintRequest,
  signal: AbortSignal,
): Promise<Uint8Array> {
  signal.throwIfAborted();
  if (bytes.length < 5 || bytes.length > MAX_PRINT_PDF_BYTES || Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-"
    || !Number.isInteger(request.pageCount) || request.pageCount < 1 || request.pageCount > MAX_PRINT_PAGES
    || request.pageIndexes.length < 1 || request.pageIndexes.length > MAX_PRINT_PAGES
    || !request.pageIndexes.every((page, index) => Number.isInteger(page) && page >= 0 && page < request.pageCount && (index === 0 || page > request.pageIndexes[index - 1]!))) throw new Error("Invalid print PDF");
  return new Promise((resolve, reject) => {
    const worker = new Worker(subsetWorker, {
      eval: true,
      workerData: { bytes, pdfLibPath: loadedPdfLibraryPath(), maxPages: MAX_PRINT_PAGES, maxBytes: MAX_PRINT_PDF_BYTES, pageCount: request.pageCount, pageIndexes: request.pageIndexes },
      resourceLimits: { maxOldGenerationSizeMb: 256, stackSizeMb: 4 },
    });
    let settled = false;
    const finish = (result?: Uint8Array) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      clearTimeout(timer);
      void worker.terminate();
      if (result && result.length > 0 && result.length <= MAX_PRINT_PDF_BYTES) resolve(result);
      else reject(new Error("Could not verify the printable PDF"));
    };
    const abort = () => finish();
    const timer = setTimeout(abort, 10_000);
    signal.addEventListener("abort", abort, { once: true });
    worker.once("error", abort);
    worker.once("exit", () => finish());
    worker.once("message", (result: { ok?: unknown; bytes?: unknown }) => finish(result.ok === true && result.bytes instanceof Uint8Array ? result.bytes : undefined));
    if (signal.aborted) finish();
  });
}
