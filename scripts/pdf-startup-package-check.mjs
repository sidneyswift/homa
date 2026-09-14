import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
assert.equal(process.versions.node.split(".")[0], "24", "Match the hosted Node major");
const temporary = await realpath(await mkdtemp(path.join(tmpdir(), "homa-pdf-package-")));
const results = [];
try {
  for (const [label, relative] of [
    ["server", "eve/__server.func"],
    ["workflow", ".well-known/workflow/v1/flow.func"],
  ]) {
    const isolated = path.join(temporary, label);
    await cp(path.join(root, "apps/web/.vercel/output/functions", relative), isolated, {
      recursive: true, dereference: true,
    });
    // The child has no app credentials and cannot resolve modules from the
    // workspace. This catches an import that passed only via ancestor folders.
    const script = `
      import assert from "node:assert/strict";
      import { createRequire } from "node:module";
      import { pathToFileURL } from "node:url";
      const entry = ${JSON.stringify(path.join(isolated, "index.mjs"))};
      const started = performance.now();
      await import(pathToFileURL(entry).href);
      const importMs = performance.now() - started;
      assert.equal(Boolean(globalThis.pdfjsWorker), false);
      assert.equal(typeof globalThis.DOMMatrix, "undefined");
      const require = createRequire(entry);
      assert.equal(Object.keys(require.cache).some(name => /[/\\\\]sharp[/\\\\]/.test(name)), false,
        "Plain-text startup must not load native image processing");
      // Exercise the same ESM export condition as the app's dynamic import.
      const sharpUrl = import.meta.resolve("sharp");
      assert.ok(sharpUrl.startsWith(pathToFileURL(${JSON.stringify(isolated + path.sep)}).href));
      const { default: sharp } = await import(sharpUrl);
      const jpeg = await sharp({ create: { width: 2, height: 3, channels: 3, background: "red" } }).jpeg().toBuffer();
      const imageMetadata = await sharp(jpeg).metadata();
      assert.equal(imageMetadata.format, "jpeg");
      assert.equal(imageMetadata.width, 2);
      assert.equal(imageMetadata.height, 3);
      for (const specifier of ["pdfjs-dist/legacy/build/pdf.mjs", "pdfjs-dist/legacy/build/pdf.worker.mjs", "@napi-rs/canvas"]) {
        assert.ok(require.resolve(specifier).startsWith(${JSON.stringify(isolated + path.sep)}));
      }
      const pdf = await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.mjs")).href);
      await import(pathToFileURL(require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs")).href);
      const { createCanvas } = require("@napi-rs/canvas");
      const objects = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 80 80] /Resources << >> /Contents 4 0 R >>",
        "<< /Length 24 >>\\nstream\\n1 0 0 rg 0 0 80 80 re f\\nendstream"
      ];
      let source = "%PDF-1.4\\n"; const offsets = [0];
      objects.forEach((object, index) => { offsets.push(Buffer.byteLength(source)); source += (index + 1) + " 0 obj\\n" + object + "\\nendobj\\n"; });
      const xref = Buffer.byteLength(source);
      source += "xref\\n0 5\\n0000000000 65535 f \\n" + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \\n").join("");
      source += "trailer\\n<< /Size 5 /Root 1 0 R >>\\nstartxref\\n" + xref + "\\n%%EOF";
      const task = pdf.getDocument({ data: new Uint8Array(Buffer.from(source)) });
      try {
        const document = await task.promise;
        assert.equal(document.numPages, 1);
        const page = await document.getPage(1);
        const canvas = createCanvas(80, 80);
        await page.render({ canvas, viewport: page.getViewport({ scale: 1 }) }).promise;
        const pixel = canvas.getContext("2d").getImageData(40, 40, 1, 1).data;
        assert.deepEqual([...pixel], [255, 0, 0, 255]);
        assert.equal(canvas.toBuffer("image/jpeg").readUInt16BE(), 0xffd8);
      } finally { await task.destroy(); }
      console.log(JSON.stringify({ importMs, packageFirstUsePassed: true }));
      process.exit(0);
    `;
    const stdout = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: isolated,
      env: { PATH: process.env.PATH, VERCEL: "1", VERCEL_ENV: "preview" },
      encoding: "utf8", timeout: 30_000,
    });
    const result = JSON.parse(stdout.trim().split("\n").at(-1));
    results.push({ label, ...result });
  }
  console.log(JSON.stringify({ results, isolatedFromWorkspace: true }));
} finally {
  await rm(temporary, { recursive: true, force: true });
}
