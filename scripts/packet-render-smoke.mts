/**
 * Disposable local proof for the packet pipeline (the Llanes incident
 * fix, 2026-07-17): renders a 4-page packet through the real shell and
 * renderer, then checks the PDF page count and that every per-page
 * preview exists and differs. Needs local Chrome; writes artifacts to
 * /tmp/packet-smoke. Not wired into CI (it needs a browser binary);
 * run by hand: pnpm tsx scripts/packet-render-smoke.mts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { wrapPrintableDocument } from "../apps/web/lib/materials/page-shell";
import { renderPrintableHtml } from "../apps/web/lib/materials/render-page";
import { colorTokens } from "../packages/design/src/contract/colors.ts";

const outDir = "/tmp/packet-smoke";
mkdirSync(outDir, { recursive: true });

function week(n: number, sounds: string, story: string): string {
  return `<style>
  .page { font-family: sans-serif; color: ${colorTokens.ink}; }
  h1 { font-size: 32px; text-align: center; color: ${colorTokens.infoInk}; margin: 4px 0 2px; }
  .sub { text-align: center; font-size: 18px; color: ${colorTokens.ink}; }
  .story { font-size: 22px; line-height: 1.7; background: ${colorTokens.paper}; border: 2px solid ${colorTokens.controlBoundary}; border-radius: 12px; padding: 16px 20px; margin-top: 24px; }
</style>
<div class="page">
  <h1>Story's Sound Blending Adventure</h1>
  <p class="sub">Week ${n}: ${sounds}</p>
  <div class="story">${story}</div>
</div>`;
}

const pages = [
  week(1, "new sounds sh, ch, th", "The truck can dash to the shop."),
  week(2, "new sound wh, plus review", "The truck can whiz. Whiz, whiz, whiz!"),
  week(3, "word families", "The dinosaur will chop a snack."),
  week(4, "mixed review", "When the sun comes up, the truck can dash."),
];

const document = wrapPrintableDocument(pages, "Story");
const rendered = await renderPrintableHtml(document);

writeFileSync(path.join(outDir, "packet.pdf"), rendered.pdf);
rendered.pageJpegs.forEach((jpeg, index) => {
  writeFileSync(path.join(outDir, `page-${index + 1}.jpg`), jpeg);
});

const pdfPageObjects = rendered.pdf
  .toString("latin1")
  .match(/\/Type\s*\/Page[^s]/g)?.length;

const distinctSizes = new Set(rendered.pageJpegs.map((jpeg) => jpeg.byteLength));

console.log(`pageCount reported: ${rendered.pageCount}`);
console.log(`pdf page objects:  ${pdfPageObjects}`);
console.log(`page previews:     ${rendered.pageJpegs.length} (distinct byte sizes: ${distinctSizes.size})`);
console.log(`preview == page 1: ${rendered.previewJpeg === rendered.pageJpegs[0]}`);

if (rendered.pageCount !== 4) throw new Error("expected pageCount 4");
if (pdfPageObjects !== 4) throw new Error("expected a 4-page PDF");
if (rendered.pageJpegs.length !== 4) throw new Error("expected 4 page previews");
if (distinctSizes.size < 4) throw new Error("page previews look identical; per-page clips are wrong");

console.log(`\nPASS: artifacts in ${outDir}`);
process.exit(0);
