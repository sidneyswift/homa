import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import sharp from "sharp";

import {
  buildSpriteFixtureDocument,
  FIXTURE_PAGE_COUNT,
  PRINT_PROOF_RECT_IN,
  PRINT_PROOF_RGB,
} from "../apps/web/lib/materials/preview-regression-fixture";
import { rasterizePdfToJpegs } from "../apps/web/lib/materials/rasterize-pdf";
import {
  closePrintableRenderer,
  PREVIEW_PAGE_CAP,
  renderPrintableHtml,
} from "../apps/web/lib/materials/render-page";
import { materialSaveFailureNote } from "../apps/web/lib/materials/save-failure-note";

/**
 * HOMA-M1 regression guard (2026-07-19): the review inputs and the chat
 * preview must be derived from the delivered PDF bytes, never from
 * screenshots of the live page (Chromium's screen and print renderers
 * diverge on CSS sprite slicing; the QC approved screenshots of a page
 * whose shipped PDF was broken). The fixture uses the exact diverging
 * technique plus a print-only magenta proof block that can only reach a
 * preview through the PDF. Needs a local Chrome (CHROME_EXECUTABLE_PATH
 * or a standard install path); run via `pnpm check:materials-preview`.
 */

const LETTER_WIDTH_IN = 8.5;

interface RawImage {
  data: Buffer;
  width: number;
  height: number;
  channels: number;
}

async function decodeJpeg(jpeg: Buffer): Promise<RawImage> {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    data,
    width: info.width,
    height: info.height,
    channels: info.channels,
  };
}

function pixelAt(image: RawImage, x: number, y: number): [number, number, number] {
  const offset = (y * image.width + x) * image.channels;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

function meanAbsoluteDiff(a: RawImage, b: RawImage): number {
  assert.equal(a.width, b.width);
  assert.equal(a.height, b.height);
  assert.equal(a.channels, b.channels);
  let total = 0;
  for (let index = 0; index < a.data.length; index += 1) {
    total += Math.abs(a.data[index] - b.data[index]);
  }
  return total / a.data.length;
}

describe("material save failure note (HOMA-M5)", () => {
  it("reports a non-child failure honestly without blaming the child id", () => {
    const note = materialSaveFailureNote(
      {
        code: "42501",
        message: 'new row violates row-level security policy for table "materials"',
        details: null,
      },
      true,
    );
    assert.match(note, /Nothing was saved/);
    assert.match(note, /row-level security/);
    assert.doesNotMatch(note, /family context block/);
    assert.match(note, /do not retry with different ids/);
  });

  it("suggests the child id only when the error text points at the child", () => {
    const note = materialSaveFailureNote(
      {
        code: "23503",
        message:
          'insert or update on table "materials" violates foreign key constraint "materials_child_id_fkey"',
        details: 'Key (child_id)=(0) is not present in table "children".',
      },
      true,
    );
    assert.match(note, /Nothing was saved/);
    assert.match(note, /family context block/);
  });

  it("never blames a child id that was not provided", () => {
    const note = materialSaveFailureNote(
      {
        code: "23503",
        message:
          'insert or update on table "materials" violates foreign key constraint "materials_child_id_fkey"',
        details: null,
      },
      false,
    );
    assert.doesNotMatch(note, /family context block/);
  });

  it("stays honest when the insert failed with no error object", () => {
    const note = materialSaveFailureNote(null, true);
    assert.match(note, /Nothing was saved/);
    assert.match(note, /unknown database error/);
  });
});

describe("printable previews come from the delivered PDF (HOMA-M1)", () => {
  after(async () => {
    await closePrintableRenderer();
  });

  it("rasterizes the generated PDF for every preview, not the live page", async () => {
    const rendered = await renderPrintableHtml(buildSpriteFixtureDocument());

    assert.equal(rendered.pageCount, FIXTURE_PAGE_COUNT);
    assert.equal(rendered.pageJpegs.length, FIXTURE_PAGE_COUNT);
    assert.ok(rendered.previewJpeg.equals(rendered.pageJpegs[0]));

    const preview = await decodeJpeg(rendered.previewJpeg);
    assert.ok(
      preview.width >= 1300 && preview.width <= 1700,
      `preview width ${preview.width}px is outside the 1300 to 1700px band`,
    );

    // The print-only proof block can only reach a preview through the
    // PDF: it is display none under screen media, so any screenshot of
    // the live page (the regressed behavior) has plain paper here.
    const dotsPerInch = preview.width / LETTER_WIDTH_IN;
    const centerX = Math.round(
      (PRINT_PROOF_RECT_IN.left + PRINT_PROOF_RECT_IN.width / 2) * dotsPerInch,
    );
    const centerY = Math.round(
      (PRINT_PROOF_RECT_IN.top + PRINT_PROOF_RECT_IN.height / 2) * dotsPerInch,
    );
    const [r, g, b] = pixelAt(preview, centerX, centerY);
    assert.ok(
      Math.abs(r - PRINT_PROOF_RGB.r) < 55 &&
        Math.abs(g - PRINT_PROOF_RGB.g) < 55 &&
        Math.abs(b - PRINT_PROOF_RGB.b) < 55,
      `print-only proof block missing from the preview (rgb(${r}, ${g}, ${b}) at ${centerX}, ${centerY}); previews were not derived from the PDF`,
    );

    // Structural proof: an independent rasterization of the returned PDF
    // bytes matches the previews pixel for pixel (dimensions included,
    // which also rules out the print-emulated screenshot fallback, whose
    // capture geometry differs).
    const independent = await rasterizePdfToJpegs(rendered.pdf, PREVIEW_PAGE_CAP);
    assert.equal(independent.pageCount, FIXTURE_PAGE_COUNT);
    for (let index = 0; index < FIXTURE_PAGE_COUNT; index += 1) {
      const previewPage = await decodeJpeg(rendered.pageJpegs[index]);
      const independentPage = await decodeJpeg(independent.pageJpegs[index]);
      const difference = meanAbsoluteDiff(previewPage, independentPage);
      assert.ok(
        difference < 1,
        `page ${index + 1} preview diverges from the PDF raster (mean abs diff ${difference.toFixed(3)})`,
      );
    }
  });
});
