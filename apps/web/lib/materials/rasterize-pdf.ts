import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import "pdfjs-dist/legacy/build/pdf.worker.mjs";

/**
 * PDF bytes to per-page preview JPEGs (HOMA-M1, 2026-07-19): the review
 * pass and the chat preview must be pictures OF THE DELIVERED PDF, never
 * of the live browser page. Chromium's screen renderer and its print
 * engine disagree on real CSS (the sprite-slicing worksheet: screen
 * screenshots looked perfect, the shipped PDF was broken, and the vision
 * QC approved it because it never saw the artifact). Rasterizing the
 * generated PDF closes that gap: whatever the parent's printer will
 * draw is exactly what the reviewer and the chat card see.
 *
 * Engine: pdfjs-dist (Apache-2.0) drawing onto @napi-rs/canvas (MIT),
 * the same backend pdf.js itself targets for Node. Two loading quirks
 * are deliberate. The worker import above is side-effect only: it
 * registers WorkerMessageHandler on globalThis.pdfjsWorker, so pdf.js
 * never attempts the dynamic "./pdf.worker.mjs" import that breaks
 * under bundlers. And @napi-rs/canvas loads through a lazy dynamic
 * import (see loadNapiCanvas): a native .node addon must never be
 * inlined into a bundle, and the hosted eve build keeps both packages
 * external via agent.ts build.externalDependencies, the seam eve
 * provides for bundling-sensitive packages, so they ship as real
 * node_modules beside the function. The canvas factory below hands
 * pdf.js these canvases for every surface, page and internal scratch
 * alike.
 */

/**
 * 72pt-per-inch letter (612pt) times this scale is a 1530px-wide page
 * image, inside the 1300 to 1700px band the review model reads well.
 */
const RASTER_SCALE = 2.5;

/** Matches the JPEG quality the old page.screenshot previews used. */
const RASTER_JPEG_QUALITY = 85;

const nodeRequire = createRequire(import.meta.url);

type NapiCanvasModule = typeof import("@napi-rs/canvas");

let napiCanvasModule: NapiCanvasModule | null | undefined;

/**
 * Loads the native canvas backend lazily and remembers the outcome. A
 * dynamic import with a static specifier on purpose: build tools can see
 * and trace the package (the eve hosted build externalizes it via
 * agent.ts build.externalDependencies and ships it, platform binary
 * included, in the function's node_modules), webpackIgnore keeps webpack
 * from ever inlining a native .node addon, and laziness means a runtime
 * missing the binary degrades to the caller's fallback previews instead
 * of crashing the whole agent server at boot (this module sits in the
 * tool graph the eve server loads eagerly). On first success the DOM
 * globals pdf.js needs are asserted too; pdf.js polyfills them from its
 * own optional require at import time, but that lookup runs relative to
 * wherever its code was bundled and can miss.
 */
async function loadNapiCanvas(): Promise<NapiCanvasModule> {
  if (napiCanvasModule === undefined) {
    try {
      // A plain literal specifier on purpose (2026-07-28, gh#335): the
      // old webpackIgnore comment hid this dependency from Next's file
      // tracer too, so the package never shipped into the first Next
      // lambda to import this module and pdf.mjs's own DOMMatrix
      // polyfill require failed at runtime. serverExternalPackages now
      // keeps every bundler's hands off it, and the visible specifier
      // is what gets it traced into the deployed function.
      const loaded = (await import(
        "@napi-rs/canvas"
      )) as NapiCanvasModule & { default?: NapiCanvasModule };
      const resolved = loaded.default?.createCanvas ? loaded.default : loaded;
      const polyfillTarget = globalThis as Record<string, unknown>;
      polyfillTarget.DOMMatrix ??= resolved.DOMMatrix;
      polyfillTarget.Path2D ??= resolved.Path2D;
      polyfillTarget.ImageData ??= resolved.ImageData;
      napiCanvasModule = resolved;
    } catch (error) {
      napiCanvasModule = null;
      console.error(
        "@napi-rs/canvas is unavailable in this runtime; PDF preview rasterization cannot run:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  if (!napiCanvasModule) {
    throw new Error("@napi-rs/canvas is unavailable in this runtime");
  }
  return napiCanvasModule;
}

/** The already-loaded backend, for pdf.js's synchronous factory calls;
 * rasterizePdfToJpegs awaits the load before any pdf.js work starts. */
function loadedNapiCanvas(): NapiCanvasModule {
  if (!napiCanvasModule) {
    throw new Error("@napi-rs/canvas was not preloaded before rendering");
  }
  return napiCanvasModule;
}

type NapiCanvas = import("@napi-rs/canvas").Canvas;

interface NapiCanvasAndContext {
  canvas: NapiCanvas | null;
  context: unknown;
}

/**
 * The canvas factory pdf.js instantiates for every drawing surface of a
 * document (page canvases and internal pattern/group scratch canvases),
 * mirroring pdf.js's own NodeCanvasFactory but backed by this module's
 * own @napi-rs/canvas loading instead of a require pdf.js resolves
 * relative to wherever its code was bundled.
 */
class NapiCanvasFactory {
  create(width: number, height: number): NapiCanvasAndContext {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    const canvas = loadedNapiCanvas().createCanvas(width, height);
    return { canvas, context: canvas.getContext("2d") };
  }

  reset(
    canvasAndContext: NapiCanvasAndContext,
    width: number,
    height: number,
  ): void {
    if (!canvasAndContext.canvas || width <= 0 || height <= 0) {
      throw new Error("Invalid canvas reset");
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: NapiCanvasAndContext): void {
    if (!canvasAndContext.canvas) return;
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

/**
 * The Standard-14 font files, for the rare PDF that references a base
 * font without embedding it (Chromium's print engine embeds every font
 * it uses, so this is belt and suspenders). Resolution can fail inside a
 * bundled deploy where the package files were not traced; pdf.js then
 * falls back to metric substitutes and only the preview's font shapes
 * soften, so the failure is swallowed on purpose.
 */
function standardFontDataPath(): string | undefined {
  try {
    return (
      join(
        dirname(nodeRequire.resolve("pdfjs-dist/package.json")),
        "standard_fonts",
      ) + sep
    );
  } catch {
    return undefined;
  }
}

export interface RasterizedPdfPages {
  /** One JPEG per rasterized page, page 1 first, capped at maxPages. */
  pageJpegs: Buffer[];
  /** The PDF's true page count (uncapped), the count that ships. */
  pageCount: number;
}

export interface RasterizePdfOptions {
  /** Owner-supplied password for a protected original. */
  password?: string;
}

/**
 * rasterizePdfToJpegs(pdf, maxPages): the delivered PDF's own pixels,
 * page by page. Throws when the PDF cannot be parsed or the canvas
 * backend is unavailable; the caller owns the fallback decision.
 */
export async function rasterizePdfToJpegs(
  pdf: Buffer,
  maxPages: number,
  options: RasterizePdfOptions = {},
): Promise<RasterizedPdfPages> {
  // Load the canvas backend (and its DOM global polyfills) before any
  // pdf.js work so an unavailable runtime fails here, cleanly.
  await loadNapiCanvas();
  // Copy: pdf.js may transfer (detach) the buffer it is handed, and the
  // caller still uploads these exact bytes to Blob afterward.
  const task = getDocument({
    data: new Uint8Array(pdf),
    password: options.password,
    standardFontDataUrl: standardFontDataPath(),
    CanvasFactory: NapiCanvasFactory,
  });
  const document = await task.promise;
  try {
    const pageCount = document.numPages;
    const canvasFactory = new NapiCanvasFactory();
    const pageJpegs: Buffer[] = [];
    for (let index = 1; index <= Math.min(pageCount, maxPages); index += 1) {
      const page = await document.getPage(index);
      const viewport = page.getViewport({ scale: RASTER_SCALE });
      const target = canvasFactory.create(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      try {
        await page.render({
          canvas: target.canvas as unknown as HTMLCanvasElement,
          viewport,
          background: "#ffffff",
        }).promise;
        if (!target.canvas) throw new Error("Canvas destroyed mid-render");
        pageJpegs.push(
          Buffer.from(
            target.canvas.toBuffer("image/jpeg", RASTER_JPEG_QUALITY),
          ),
        );
      } finally {
        canvasFactory.destroy(target);
        page.cleanup();
      }
    }
    return { pageJpegs, pageCount };
  } finally {
    await task.destroy();
  }
}
