import { createHash } from "node:crypto";

import { wrapPrintableDocument } from "./page-shell";
import {
  materialArtifactBrand,
  type MaterialArtifactBrand,
} from "./brand-era";

/**
 * What it took to turn this material's stored html into the page images we
 * shipped (training-corpus plan, v0 render-pair archiver, gh#328).
 *
 * WHY THIS EXISTS:
 * `materials.html` is only the page BODIES (create_printable stores
 * joinPageBodies(...)). The document that actually renders is assembled at
 * render time by wrapPrintableDocument, which supplies the doctype, the
 * whole stylesheet, the sheet/footer scaffolding, and the fonts. So the
 * stored source alone does not reproduce the shipped page: change the
 * shell's CSS and the same html renders differently, silently.
 *
 * That matters because the render pairs are the most valuable training data
 * Homa manufactures. A (brief -> html) pair teaches the writer, and an
 * (html -> page image) pair teaches the image side, but only if the image
 * can be regenerated from the source. Without the shell fingerprint you
 * cannot tell whether a re-render reproduces the artifact or quietly
 * replaces it, and a corpus that cannot answer that is a corpus of guesses.
 *
 * Recording the fingerprint is also what lets the raster bytes be
 * disposable: superseded drafts have their pdf and preview blobs deleted on
 * finalize (library.ts), and that is fine for training as long as the row
 * keeps the html plus enough provenance to render it again the same way.
 *
 * This is provenance, not policy. Nothing reads it to make a decision; it
 * rides in the generation jsonb so a later export can group materials by
 * the exact pipeline that produced them.
 */

/** Letter at 96dpi, mirroring render-page.ts's LETTER_PX. */
export const RENDER_VIEWPORT = { width: 816, height: 1056 } as const;

/** Mirrors rasterize-pdf.ts. Kept here so the recorded provenance is one
 * object rather than three imports that can drift apart unnoticed. */
export const RENDER_RASTER_SCALE = 2.5;
export const RENDER_RASTER_JPEG_QUALITY = 85;

export interface RenderProvenance {
  /** The approved design era and constrained print profile that produced the
   * durable PDF and its previews. Missing on historical rows by design. */
  brand: MaterialArtifactBrand;
  /** Content hash of the document shell (doctype, stylesheet, sheet and
   * footer scaffolding) that wrapped this material's page bodies. Two
   * materials with the same fingerprint were shelled identically. */
  shellFingerprint: string;
  viewport: { width: number; height: number };
  rasterScale: number;
  rasterJpegQuality: number;
  /** Which renderer drew it, and its version when the driver reports one.
   * A page drawn by headless Chromium and one drawn by the fallback path
   * are not interchangeable evidence. */
  renderer: string;
  rendererVersion: string | null;
  /** Per-page previews are capped (PREVIEW_PAGE_CAP), so a reader knows
   * that missing previews past this index are policy, not loss. */
  previewPageCap: number;
}

let cachedShellFingerprint: string | null = null;

/**
 * Fingerprints the shell by rendering it around a fixed sentinel body and
 * hashing everything except that sentinel. Derived from the real function
 * rather than a hand-maintained version constant, because a version number
 * someone must remember to bump is a version number that goes stale in the
 * one commit where it mattered.
 */
export function pageShellFingerprint(): string {
  if (cachedShellFingerprint !== null) return cachedShellFingerprint;
  const sentinel = "__homa_shell_fingerprint_sentinel__";
  const shell = wrapPrintableDocument([sentinel], sentinel).split(sentinel).join("");
  cachedShellFingerprint = createHash("sha256").update(shell).digest("hex").slice(0, 16);
  return cachedShellFingerprint;
}

export function buildRenderProvenance(input: {
  renderer: string;
  rendererVersion?: string | null;
  previewPageCap: number;
}): RenderProvenance {
  return {
    brand: materialArtifactBrand(),
    shellFingerprint: pageShellFingerprint(),
    viewport: { width: RENDER_VIEWPORT.width, height: RENDER_VIEWPORT.height },
    rasterScale: RENDER_RASTER_SCALE,
    rasterJpegQuality: RENDER_RASTER_JPEG_QUALITY,
    renderer: input.renderer,
    rendererVersion: input.rendererVersion ?? null,
    previewPageCap: input.previewPageCap,
  };
}
