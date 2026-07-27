import { wrapPrintableDocument } from "./page-shell";

/**
 * The HOMA-M1 regression fixture (2026-07-19): a worksheet built with the
 * exact technique that shipped broken in production, CSS sprite slicing
 * (one background image per cell, background-size 400% 400%,
 * background-position percentages, rotate transforms). Chromium's screen
 * renderer drew it perfectly while the print engine mangled it, so
 * screen screenshots passed the vision QC on a broken PDF.
 *
 * The fixture also plants a print-only proof block: a solid magenta
 * rectangle that exists ONLY under print media. It reaches the PDF
 * (page.pdf renders print media) but can never appear in a screen
 * screenshot, so a preview containing the magenta block is proof the
 * preview was derived from the delivered PDF bytes and not from the
 * live page. The test samples the block's center pixel.
 */

/** Where the print-only proof block sits on page 1, in inches from the
 * physical page's top-left corner. */
export const PRINT_PROOF_RECT_IN = {
  left: 1,
  top: 1,
  width: 2,
  height: 1,
} as const;

/** The proof block's color, chosen because nothing else on the fixture
 * page is anywhere near it. */
export const PRINT_PROOF_RGB = { r: 255, g: 0, b: 255 } as const;

/** How many pages the fixture document renders. */
export const FIXTURE_PAGE_COUNT = 2;

const SPRITE_CELL_COLORS = [
  "#e63946", "#f4a261", "#2a9d8f", "#264653",
  "#8ecae6", "#ffb703", "#fb8500", "#606c38",
  "#9d4edd", "#f72585", "#4361ee", "#4cc9f0",
  "#b5838d", "#6b705c", "#cb997e", "#3a5a40",
];

function spriteDataUrl(): string {
  const cells = SPRITE_CELL_COLORS.map((color, index) => {
    const x = (index % 4) * 100;
    const y = Math.floor(index / 4) * 100;
    return `<rect x="${x}" y="${y}" width="100" height="100" fill="${color}"/><text x="${x + 50}" y="${y + 62}" font-size="44" font-family="sans-serif" text-anchor="middle" fill="#ffffff">${index + 1}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${cells}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The percentage pairs that pick each sprite tile out of the 4x4 sheet
 * when background-size is 400% 400% (the diverging production technique). */
const SPRITE_POSITIONS = [
  "0% 0%", "33.333% 0%", "66.667% 0%", "100% 0%",
  "0% 33.333%", "33.333% 33.333%", "66.667% 33.333%", "100% 33.333%",
];

const SPRITE_ROTATIONS = [0, 90, 180, 270, 270, 180, 90, 0];

function spritePageBody(title: string, includeProofBlock: boolean): string {
  const url = spriteDataUrl();
  const cells = SPRITE_POSITIONS.map(
    (position, index) =>
      `<div class="sprite-cell" style="background-position: ${position}; transform: rotate(${SPRITE_ROTATIONS[index]}deg);"></div>`,
  ).join("\n    ");
  const proofBlock = includeProofBlock
    ? `<div class="print-proof"></div>`
    : "";
  return `<style>
  .fixture-title { font-size: 22px; font-weight: 700; margin: 0 0 6px; }
  .fixture-hint { font-size: 13px; color: #555; margin: 0 0 14px; }
  .sprite-grid {
    display: grid;
    grid-template-columns: repeat(4, 1.2in);
    gap: 0.25in;
    margin-top: 2.6in;
  }
  .sprite-cell {
    width: 1.2in;
    height: 1.2in;
    background-image: url("${url}");
    background-size: 400% 400%;
    background-repeat: no-repeat;
    border: 2px solid #333333;
    border-radius: 6px;
  }
  .print-proof { display: none; }
  @media print {
    .print-proof {
      display: block;
      position: absolute;
      top: ${PRINT_PROOF_RECT_IN.top}in;
      left: ${PRINT_PROOF_RECT_IN.left}in;
      width: ${PRINT_PROOF_RECT_IN.width}in;
      height: ${PRINT_PROOF_RECT_IN.height}in;
      background: rgb(${PRINT_PROOF_RGB.r}, ${PRINT_PROOF_RGB.g}, ${PRINT_PROOF_RGB.b});
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  }
</style>
<h1 class="fixture-title">${title}</h1>
<p class="fixture-hint">Match each sliced tile to its number on the sprite sheet.</p>
${proofBlock}
<div class="sprite-grid">
    ${cells}
</div>`;
}

/**
 * buildSpriteFixtureDocument(): the complete two-page document, wrapped
 * by the real page shell, ready for renderPrintableHtml. Page 1 carries
 * the print-only proof block.
 */
export function buildSpriteFixtureDocument(): string {
  return wrapPrintableDocument(
    [
      spritePageBody("Sprite slice worksheet, page one", true),
      spritePageBody("Sprite slice worksheet, page two", false),
    ],
    "Fixture",
  );
}
