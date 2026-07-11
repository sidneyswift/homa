/**
 * Materials-studio calibration harness (MS-7): runs a fixed brief set
 * through the studio's creation paths (image-direct, html, hybrid),
 * renders real artifacts, optionally scores each with the vision
 * reviewer, and writes a dated findings report with the outputs. The
 * report's job is to keep the materials-studio skill's path-selection
 * table honest as image models change.
 *
 * Usage:
 *   pnpm materials:calibrate -- --family <uuid> [--briefs 3] [--no-score]
 *
 * --family should be a real (throwaway/synthetic) family id: generated
 * images upload under that family's Blob prefix and usage rows attribute
 * to it. The script prints every blob URL it created; clean up with
 * --cleanup afterward (deletes those blobs by prefix listing).
 *
 * Cadence (documented in the skill): re-run on any HOMA_IMAGE_MODEL
 * change and monthly. Outputs land in
 * docs/homa-planning/materials/calibration/<date>/ + a report md.
 */

import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
try {
  loadEnvFile(path.join(repoRoot, "apps/web/.env.local"));
} catch {
  // Env may arrive from the shell.
}

const { generateStudioImage, imageModelId } = await import(
  "../apps/web/lib/materials/generate-image"
);
const { wrapPrintablePage, wrapImagePage } = await import(
  "../apps/web/lib/materials/page-shell"
);
const { renderPrintableHtml } = await import("../apps/web/lib/materials/render-page");
const { reviewArtifact, reviewModelId } = await import(
  "../apps/web/lib/materials/review-artifact"
);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

const familyId = argValue("--family");
const briefLimit = Number(argValue("--briefs") ?? 99);
const score = !process.argv.includes("--no-score");
const cleanup = process.argv.includes("--cleanup");

if (!familyId) {
  console.error("Pass --family <uuid> (a synthetic/throwaway family).");
  process.exit(2);
}

if (cleanup) {
  const { deleteFamilyBlobs } = await import(
    "../apps/web/lib/materials/artifact-store"
  );
  const deleted = await deleteFamilyBlobs(familyId);
  console.log(`cleanup: deleted ${deleted} blob(s) under families/${familyId}/`);
  process.exit(0);
}

/** The hard cases, spanning where each path should win and lose. */
interface Brief {
  id: string;
  ask: string;
  paths: ("image" | "html" | "hybrid")[];
  imagePrompt: string;
  html?: (imageUrl: string | null) => string;
}

const TRACE_CSS = `<style>
  .sheet { font-family: 'Fredoka', sans-serif; color: #221e1a; }
  h1 { font-size: 28px; margin: 0 0 4px; }
  .hint { font-size: 15px; color: #6b6259; margin: 0 0 12px; }
  .trace { font-weight: 400; font-size: 100px; color: #d9d2c7; letter-spacing: 0.32em; line-height: 1.2; margin: 6px 0 0; }
  .dot { color: #6b6259; font-size: 20px; vertical-align: super; }
  .guide { border-top: 2.5px solid #6b6259; border-bottom: 2.5px solid #6b6259; height: 70px; position: relative; margin: 12px 0 22px; }
  .guide::after { content: ""; position: absolute; left: 0; right: 0; top: 50%; border-top: 2px dashed #b3a492; }
  .row { display: flex; flex-wrap: wrap; gap: 10px; margin: 12px 0; }
  .box { border: 2.5px solid #6b6259; width: 60px; height: 60px; border-radius: 8px; }
</style>
<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600&display=swap" rel="stylesheet">`;

const BRIEFS: Brief[] = [
  {
    id: "handwriting-dense",
    ask: "Letter O tracing page: title, instruction line, two rows of four pale trace O's with start dots, two writing guides",
    paths: ["image", "html"],
    imagePrompt:
      'A children\'s handwriting practice worksheet page, portrait: title "The Big Round O", one instruction line "Trace each O. Start at the dot.", two rows of four large pale gray letter O outlines each with a small starting dot at the top, and below each row a three-line handwriting guide (solid top line, dashed middle line, solid bottom line). Clean black and white, printable, no decorations.',
    html: () =>
      `${TRACE_CSS}<div class="sheet"><h1>The Big Round O</h1><p class="hint">Trace each O. Start at the dot.</p><p class="trace"><span class="dot">&#9679;</span>O O O O</p><div class="guide"></div><p class="trace"><span class="dot">&#9679;</span>O O O O</p><div class="guide"></div></div>`,
  },
  {
    id: "coloring-page",
    ask: "Coloring page: a friendly dragon reading a book under a tree, thick outlines",
    paths: ["image"],
    imagePrompt:
      "black and white coloring book line art, thick clean outlines, no shading, no gray fill, white background, a friendly round dragon sitting under a big oak tree reading a picture book, centered, full page, no text or letters",
  },
  {
    id: "counting-exact",
    ask: "Counting page: groups of exactly 3, 5, and 7 ladybugs with an answer box per group",
    paths: ["image", "hybrid"],
    imagePrompt:
      'A children\'s counting worksheet, portrait, black and white printable: title "Count the Ladybugs", three rows, the first row with EXACTLY 3 identical cartoon ladybugs, the second row with EXACTLY 5, the third row with EXACTLY 7, each row followed by one empty answer box. Thick outlines, no shading, no other text.',
    html: (imageUrl) => {
      const bug = imageUrl
        ? `<img src="${imageUrl}" style="width:64px;height:64px;object-fit:contain;" alt="" />`
        : `<span style="font-size:48px;">&#128030;</span>`;
      const row = (count: number) =>
        `<div class="row">${Array.from({ length: count }).map(() => bug).join("")}<div class="box"></div></div>`;
      return `${TRACE_CSS}<div class="sheet"><h1>Count the Ladybugs</h1><p class="hint">Count each row. Write the number in the box.</p>${row(3)}${row(5)}${row(7)}</div>`;
    },
  },
  {
    id: "flashcards-text",
    ask: "Six sight-word flash cards (the, and, said, look, here, play) with cut lines",
    paths: ["image", "html"],
    imagePrompt:
      'A printable page of six sight word flash cards in a 2x3 grid with dashed cut lines, each card showing one large word: "the", "and", "said", "look", "here", "play". Black and white, clean typography, portrait page, nothing else.',
    html: () =>
      `${TRACE_CSS}<style>.cards{display:grid;grid-template-columns:1fr 1fr;gap:14px;} .card{border:2px dashed #b3a492;border-radius:10px;padding:38px 10px;text-align:center;font-family:'Fredoka',sans-serif;font-size:44px;}</style><div class="sheet"><h1>Sight Words</h1><p class="hint">Cut along the dashed lines.</p><div class="cards"><div class="card">the</div><div class="card">and</div><div class="card">said</div><div class="card">look</div><div class="card">here</div><div class="card">play</div></div></div>`,
  },
  {
    id: "themed-hybrid",
    ask: "Space-themed addition worksheet: five sums under 10, one rocket illustration",
    paths: ["hybrid"],
    imagePrompt:
      "black and white coloring book line art, thick clean outlines, no shading, white background, a cheerful cartoon rocket ship blasting off with three small stars, centered, no text",
    html: (imageUrl) =>
      `${TRACE_CSS}<div class="sheet"><h1>Blast Off Addition</h1><p class="hint">Solve each one. Color the rocket when you finish!</p><div style="font-size:34px;line-height:2.2;font-family:'Fredoka',sans-serif;">2 + 3 = <span style="display:inline-block;width:70px;border-bottom:2.5px solid #6b6259;"></span><br/>4 + 4 = <span style="display:inline-block;width:70px;border-bottom:2.5px solid #6b6259;"></span><br/>1 + 6 = <span style="display:inline-block;width:70px;border-bottom:2.5px solid #6b6259;"></span><br/>5 + 2 = <span style="display:inline-block;width:70px;border-bottom:2.5px solid #6b6259;"></span><br/>3 + 3 = <span style="display:inline-block;width:70px;border-bottom:2.5px solid #6b6259;"></span></div>${imageUrl ? `<img src="${imageUrl}" style="width:2.6in;display:block;margin:12px auto 0;" alt="" />` : ""}</div>`,
  },
  {
    id: "poster-title",
    ask: "Kindness poster with the exact title 'Our Kind Words' and four short phrases",
    paths: ["image"],
    imagePrompt:
      'A warm children\'s poster, portrait, soft watercolor style with large clear lettering: the exact title "Our Kind Words" at the top, and four short phrases on gentle banners: "Please", "Thank you", "I can help", "You first". Light colors, printable, no other text.',
  },
  {
    id: "reference-restyle",
    ask: "Reference test: regenerate the coloring page swapping the dragon for a fox, keeping style and layout",
    paths: ["image"],
    imagePrompt:
      "Keep the exact art style, line weight, composition, and background of the reference image, but replace the main character with a friendly round fox reading a picture book. Still black and white coloring book line art, no text.",
  },
];

const date = new Date().toISOString().slice(0, 10);
const outDir = path.join(repoRoot, "docs/homa-planning/materials/calibration", date);
mkdirSync(outDir, { recursive: true });

interface Outcome {
  brief: Brief;
  path: string;
  ok: boolean;
  note: string;
  file?: string;
  seconds?: number;
  review?: { pass: boolean; issues: string[] } | null;
}

const outcomes: Outcome[] = [];
const createdBlobUrls: string[] = [];
let coloringPageUrl: string | null = null;

async function renderAndSave(
  brief: Brief,
  pathName: string,
  document: string,
): Promise<{ file: string; review: Outcome["review"] }> {
  const rendered = await renderPrintableHtml(document);
  const file = `${brief.id}--${pathName}.jpg`;
  writeFileSync(path.join(outDir, file), rendered.previewJpeg);
  let review: Outcome["review"] = null;
  if (score) {
    review = await reviewArtifact({
      familyId: familyId as string,
      channel: "web",
      previewJpeg: rendered.previewJpeg,
      brief: `The brief: ${brief.ask}`,
    });
  }
  return { file, review };
}

for (const brief of BRIEFS.slice(0, briefLimit)) {
  for (const pathName of brief.paths) {
    const started = Date.now();
    try {
      let imageUrl: string | null = null;
      if (pathName === "image" || pathName === "hybrid") {
        const references =
          brief.id === "reference-restyle" && coloringPageUrl
            ? [coloringPageUrl]
            : undefined;
        const generated = await generateStudioImage({
          familyId,
          channel: "web",
          prompt: brief.imagePrompt,
          shape: pathName === "image" ? "portrait" : "square",
          referenceImageUrls: references,
        });
        if (!generated.ok) {
          outcomes.push({ brief, path: pathName, ok: false, note: generated.note });
          continue;
        }
        imageUrl = generated.url;
        createdBlobUrls.push(generated.url);
        if (brief.id === "coloring-page") coloringPageUrl = generated.url;
      }

      const document =
        pathName === "image"
          ? wrapImagePage(imageUrl as string, "Calibration")
          : wrapPrintablePage((brief.html as NonNullable<Brief["html"]>)(imageUrl), "Calibration");
      const { file, review } = await renderAndSave(brief, pathName, document);
      outcomes.push({
        brief,
        path: pathName,
        ok: true,
        note: "rendered",
        file,
        seconds: Math.round((Date.now() - started) / 1000),
        review,
      });
      console.log(`done: ${brief.id} via ${pathName} (${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (error) {
      outcomes.push({
        brief,
        path: pathName,
        ok: false,
        note: error instanceof Error ? error.message : "unknown failure",
      });
      console.error(`FAILED: ${brief.id} via ${pathName}:`, error);
    }
  }
}

const lines: string[] = [
  `# Materials calibration · ${date}`,
  "",
  `Image model: \`${imageModelId()}\` · reviewer: \`${reviewModelId()}\` (auto-score ${score ? "on" : "off"}).`,
  "Generated by scripts/materials-calibration.mts. Findings feed the",
  "materials-studio skill's path-selection table; re-run on model swaps",
  "and monthly.",
  "",
  "| Brief | Path | Outcome | Auto-review | Time |",
  "|---|---|---|---|---|",
];
for (const outcome of outcomes) {
  const reviewLabel = outcome.review
    ? outcome.review.pass
      ? "pass"
      : `issues: ${outcome.review.issues.join("; ").slice(0, 160)}`
    : "n/a";
  lines.push(
    `| ${outcome.brief.id} | ${outcome.path} | ${outcome.ok ? "rendered" : `FAILED: ${outcome.note.slice(0, 120)}`} | ${reviewLabel} | ${outcome.seconds ?? "-"}s |`,
  );
}
lines.push("", "## Outputs", "");
for (const outcome of outcomes) {
  if (outcome.file) {
    lines.push(`### ${outcome.brief.id} · ${outcome.path}`, "", `![${outcome.brief.id} ${outcome.path}](./${outcome.file})`, "");
  }
}
lines.push("## Blob urls created (delete with --cleanup)", "");
for (const url of createdBlobUrls) lines.push(`- ${url}`);
lines.push("");

writeFileSync(path.join(outDir, "report.md"), lines.join("\n"));
console.log(`\nreport: ${path.join(outDir, "report.md")}`);
console.log(`blobs created: ${createdBlobUrls.length} (run with --cleanup to delete)`);
const failedOutcomes = outcomes.filter((outcome) => !outcome.ok);
if (failedOutcomes.length > 0) {
  console.error(`calibration failed: ${failedOutcomes.length} outcome(s) failed`);
}
process.exit(failedOutcomes.length > 0 ? 1 : 0);
