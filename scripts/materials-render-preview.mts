import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import process from "node:process";

import {
  splitPageBodies,
  wrapPrintableDocument,
} from "../apps/web/lib/materials/page-shell";
import { buildSpriteFixtureDocument } from "../apps/web/lib/materials/preview-regression-fixture";
import {
  closePrintableRenderer,
  renderPrintableHtml,
} from "../apps/web/lib/materials/render-page";

/**
 * Manual verification for HOMA-M1 (2026-07-19): runs the REAL
 * create_printable render pipeline (Chromium page.pdf, then previews
 * rasterized from the PDF bytes) on an HTML file and writes the PDF plus
 * every preview JPEG to a directory for eyeballing. Replay a production
 * material by saving its materials.html value to a file and passing the
 * path; stored page bodies (joined with the homa:page-break comment) are
 * split and wrapped by the real page shell, while a file that is already
 * a complete document (starts with <!doctype or <html) renders as-is.
 *
 * Usage:
 *   pnpm materials:render-preview -- [page.html] [--out DIR] [--child NAME]
 *
 * With no file the built-in sprite regression fixture renders (the CSS
 * technique that shipped broken on 2026-07-19). Local Chrome is found
 * automatically; CHROME_EXECUTABLE_PATH overrides discovery.
 */

interface CliOptions {
  htmlPath: string | null;
  outDir: string;
  childName: string;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    htmlPath: null,
    outDir: "materials-render-preview-out",
    childName: "",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      // pnpm forwards the separator itself; nothing to parse.
    } else if (arg === "--out") {
      options.outDir = argv[index + 1] ?? options.outDir;
      index += 1;
    } else if (arg === "--child") {
      options.childName = argv[index + 1] ?? "";
      index += 1;
    } else if (!arg.startsWith("-") && options.htmlPath === null) {
      options.htmlPath = arg;
    } else {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
  }
  return options;
}

function looksLikeCompleteDocument(html: string): boolean {
  return /^\s*(?:<!doctype|<html)/i.test(html);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  let document: string;
  let sourceLabel: string;
  if (options.htmlPath === null) {
    document = buildSpriteFixtureDocument();
    sourceLabel = "built-in sprite regression fixture";
  } else {
    const raw = await readFile(resolve(options.htmlPath), "utf8");
    if (looksLikeCompleteDocument(raw)) {
      document = raw;
      sourceLabel = `${options.htmlPath} (complete document, rendered as-is)`;
    } else {
      const pageBodies = splitPageBodies(raw);
      document = wrapPrintableDocument(pageBodies, options.childName);
      sourceLabel = `${options.htmlPath} (${pageBodies.length} stored page ${pageBodies.length === 1 ? "body" : "bodies"}, wrapped by the page shell)`;
    }
  }

  console.log(`Rendering: ${sourceLabel}`);
  const rendered = await renderPrintableHtml(document);

  const outDir = resolve(options.outDir);
  await mkdir(outDir, { recursive: true });
  const pdfPath = join(outDir, "material.pdf");
  await writeFile(pdfPath, rendered.pdf);
  const previewPaths: string[] = [];
  for (const [index, jpeg] of rendered.pageJpegs.entries()) {
    const previewPath = join(outDir, `page-${index + 1}.jpg`);
    await writeFile(previewPath, jpeg);
    previewPaths.push(previewPath);
  }

  console.log(`PDF page count: ${rendered.pageCount}`);
  console.log(`PDF: ${pdfPath}`);
  for (const previewPath of previewPaths) {
    console.log(`Preview (rasterized from the PDF): ${previewPath}`);
  }
  console.log(
    "Compare the JPEGs against the PDF in a viewer; they are the exact pixels the reviewer and the chat card see.",
  );
}

try {
  await main();
} finally {
  await closePrintableRenderer();
}
