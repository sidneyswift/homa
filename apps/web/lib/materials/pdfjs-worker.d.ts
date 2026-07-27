/**
 * The pdf.worker.mjs build ships no type declarations. rasterize-pdf.ts
 * imports it for its side effect only (it registers WorkerMessageHandler
 * on globalThis.pdfjsWorker), so a shorthand declaration is all TS needs.
 */
declare module "pdfjs-dist/legacy/build/pdf.worker.mjs";
