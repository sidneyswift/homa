import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { it } from "node:test";

import { curriculumPdfFixture } from "../library/pdf-read-fixture";

const rasterUrl = new URL("./rasterize-pdf.ts", import.meta.url).href;
const pdfBase64 = curriculumPdfFixture([{ text: "A real first-use PDF." }]).toString("base64");

for (const [environment, flag, lazy] of [
  ["preview", "1", true],
  ["preview", "0", false],
  ["production", "1", false],
] as const) {
  it(`keeps PDF loading and first-use rendering correct for ${environment}/${flag}`, () => {
    // Separate processes are necessary: the worker and native DOM polyfills
    // are process globals and would hide an eager-import regression in-suite.
    const script = `
      import assert from "node:assert/strict";
      import { rasterizePdfToJpegs, withPdfForReading } from ${JSON.stringify(rasterUrl)};
      assert.equal(Boolean(globalThis.pdfjsWorker), ${!lazy});
      assert.equal(typeof globalThis.DOMMatrix !== "undefined", ${!lazy});
      const bytes = Buffer.from(${JSON.stringify(pdfBase64)}, "base64");
      const text = await withPdfForReading(bytes, AbortSignal.timeout(10000), async document => {
        const page = await document.getPage(1);
        const content = await page.getTextContent();
        return content.items.map(item => item.str ?? "").join(" ");
      });
      assert.match(text, /A real first-use PDF/);
      assert.equal(typeof globalThis.pdfjsWorker?.WorkerMessageHandler, "function");
      const worker = globalThis.pdfjsWorker;
      const preview = await rasterizePdfToJpegs(bytes, 1);
      assert.equal(preview.pageCount, 1);
      assert.equal(preview.pageJpegs[0].readUInt16BE(), 0xffd8);
      assert.equal(globalThis.pdfjsWorker, worker);
      console.log("first-use read and render passed");
    `;
    const output = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", script], {
      env: { ...process.env, VERCEL_ENV: environment, HOMA_PREVIEW_LAZY_PDF: flag },
      encoding: "utf8",
      timeout: 30_000,
    });
    assert.match(output, /first-use read and render passed/);
  });
}
