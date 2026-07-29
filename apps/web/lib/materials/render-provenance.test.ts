import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import { wrapPrintableDocument } from "./page-shell";
import {
  buildRenderProvenance,
  pageShellFingerprint,
  RENDER_RASTER_JPEG_QUALITY,
  RENDER_RASTER_SCALE,
  RENDER_VIEWPORT,
} from "./render-provenance";

const here = import.meta.dirname;

describe("page shell fingerprint", () => {
  it("depends on the shell, not on the page content it wraps", () => {
    // The fingerprint has to identify the shell alone. If page bodies
    // leaked into it, every material would get a unique value and the
    // field would answer no question at all.
    const other = "__a_completely_different_sentinel__";
    const shell = wrapPrintableDocument([other], other).split(other).join("");
    const expected = createHash("sha256").update(shell).digest("hex").slice(0, 16);
    assert.equal(pageShellFingerprint(), expected);
  });

  it("is stable across calls", () => {
    assert.equal(pageShellFingerprint(), pageShellFingerprint());
  });

  it("changes when the shell changes", () => {
    // Proves the guard actually guards: an edited stylesheet must produce
    // a different fingerprint, which is the whole reason a re-render can
    // be told apart from the original.
    const sentinel = "__s__";
    const shell = wrapPrintableDocument([sentinel], sentinel).split(sentinel).join("");
    const edited = shell.replace("margin: 0", "margin: 1px");
    assert.notEqual(shell, edited, "expected the replace to bite");
    assert.notEqual(
      createHash("sha256").update(edited).digest("hex").slice(0, 16),
      pageShellFingerprint(),
    );
  });
});

describe("render provenance", () => {
  it("records the renderer that actually drew the previews", () => {
    // A fallback preview is re-rendered in the browser and its own log
    // warns it may not match the shipped pdf, so a pair built from one is
    // weaker evidence. The field exists to keep that distinction.
    const raster = buildRenderProvenance({
      renderer: "pdfjs-raster",
      rendererVersion: "HeadlessChrome/140.0.0.0",
      previewPageCap: 6,
    });
    assert.equal(raster.renderer, "pdfjs-raster");
    assert.equal(raster.rendererVersion, "HeadlessChrome/140.0.0.0");

    const fallback = buildRenderProvenance({
      renderer: "screenshot-fallback",
      previewPageCap: 6,
    });
    assert.equal(fallback.renderer, "screenshot-fallback");
    assert.equal(fallback.rendererVersion, null);
  });

  it("carries everything needed to reproduce the raster", () => {
    const provenance = buildRenderProvenance({ renderer: "pdfjs-raster", previewPageCap: 6 });
    assert.deepEqual(provenance.viewport, { width: 816, height: 1056 });
    assert.equal(provenance.rasterScale, 2.5);
    assert.equal(provenance.rasterJpegQuality, 85);
    assert.equal(provenance.previewPageCap, 6);
    assert.match(provenance.shellFingerprint, /^[0-9a-f]{16}$/);
  });
});

describe("provenance constants do not drift from the pipeline", () => {
  // These are mirrored here so the recorded provenance is one object. A
  // mirror that silently falls out of date records a lie about how the
  // artifact was made, which is worse than recording nothing.

  it("matches the render viewport in render-page.ts", async () => {
    const source = await readFile(path.join(here, "render-page.ts"), "utf8");
    const match = source.match(/LETTER_PX = \{ width: (\d+), height: (\d+) \}/);
    assert.ok(match, "LETTER_PX not found in render-page.ts; update this guard");
    assert.equal(Number(match[1]), RENDER_VIEWPORT.width);
    assert.equal(Number(match[2]), RENDER_VIEWPORT.height);
  });

  it("matches the raster settings in rasterize-pdf.ts", async () => {
    const source = await readFile(path.join(here, "rasterize-pdf.ts"), "utf8");
    const scale = source.match(/RASTER_SCALE = ([\d.]+)/);
    const quality = source.match(/RASTER_JPEG_QUALITY = (\d+)/);
    assert.ok(scale && quality, "raster constants not found; update this guard");
    assert.equal(Number(scale[1]), RENDER_RASTER_SCALE);
    assert.equal(Number(quality[1]), RENDER_RASTER_JPEG_QUALITY);
  });

  it("matches PREVIEW_PAGE_CAP as create_printable passes it", async () => {
    const renderPage = await readFile(path.join(here, "render-page.ts"), "utf8");
    const cap = renderPage.match(/PREVIEW_PAGE_CAP = (\d+)/);
    assert.ok(cap, "PREVIEW_PAGE_CAP not found; update this guard");
    const tool = await readFile(
      path.join(here, "..", "..", "agent", "tools", "create_printable.ts"),
      "utf8",
    );
    // The tool must pass the real cap, not a literal that can drift.
    assert.match(tool, /previewPageCap: PREVIEW_PAGE_CAP/);
  });
});
