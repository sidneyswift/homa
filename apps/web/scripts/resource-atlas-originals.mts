/**
 * resource-atlas-originals: re-fetch the atlas corpus's missing files.
 *
 * 102 records in .cosmo were scraped from publisher sample pages in July
 * 2026. The analysis was kept, the PDFs were not, so /admin/library shows
 * them as "Never saved" with a to-do. The pages are still public, so the
 * files are recoverable, unlike the expired TeachersPayTeachers links.
 *
 * Pipeline: scrape the four publisher sample pages, pair each PDF with
 * the record it belongs to, download, VERIFY, then upload to Blob at
 * inspo/<record-id>/<filename> and record sourceUrl + blobUrl on the
 * analysis JSON so the provenance can never be lost this way again.
 *
 * The pairing is exact string work, not interpretation. A record id
 * preserves the scraped filename after its publisher prefix
 * (ref-2026-07-17-ba-3aanglemazes came from /3A/AngleMazes.pdf), so both
 * sides normalise to lowercase alphanumerics and must meet exactly. A
 * record matching zero or several candidates is REPORTED, never guessed.
 *
 * Then code verifies what the match proposed: .cosmo/references/
 * atlas-classification.json recorded a page count per original file at
 * scrape time, so every download is opened and counted before it is
 * allowed to upload. A page-count disagreement means the pairing is
 * wrong, and the file is skipped rather than filed under the wrong book.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... node --experimental-strip-types \
 *     apps/web/scripts/resource-atlas-originals.mts [--dry-run] [--limit N]
 */

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { list, put } from "@vercel/blob";

import { rasterizePdfToJpegs } from "../lib/materials/rasterize-pdf.ts";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LIMIT = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : Infinity;
})();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

/** The four pages the atlas scrape drew from, still public. */
const SOURCE_PAGES: { key: string; url: string }[] = [
  { key: "beast-academy", url: "https://beastacademy.com/resources/printables" },
  { key: "oak-meadow", url: "https://www.oakmeadow.com/curriculum-samples/" },
  { key: "bookshark", url: "https://www.bookshark.com/instructors-guide-samples" },
  { key: "dimensions-math", url: "https://www.singaporemath.com/pages/sample-pages" },
];

const PREFIX_TO_SOURCE: Record<string, string> = {
  "ba-": "beast-academy",
  "om-": "oak-meadow",
  "dm-": "dimensions-math",
  "bs-": "bookshark",
};

/**
 * Four Oak Meadow art coursebooks whose record slug was shortened at
 * scrape time ("om-painting" for Painting-Coursebook-Curriculum-Sample-
 * HS.pdf), so no string rule reaches them. Written out by hand rather
 * than loosened into a fuzzy rule, because loosening the rule to catch
 * these would also start matching the wrong editions of everything else.
 */
const MANUAL_PAIRS: Record<string, string> = {
  "om-drawing-design": "Drawing-and-Design-Coursebook-Curriculum-Sample-HS.pdf",
  "om-integrated-drawing": "Integrated-Drawing-Coursebook-Curriculum-Sample-HS.pdf",
  "om-painting": "Painting-Coursebook-Curriculum-Sample-HS.pdf",
  "om-photography": "Photography-Coursebook-Curriculum-Sample-HS.pdf",
};

const norm = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

function cosmoDir(): string {
  for (const candidate of [
    path.join(process.cwd(), ".cosmo"),
    path.join(process.cwd(), "..", "..", ".cosmo"),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("no .cosmo corpus found");
}

interface AtlasRecord {
  id: string;
  slug: string;
  source: string | null;
  title: string;
  file: string;
  doc: Record<string, unknown>;
  expectedPages: number | null;
}

function loadRecords(root: string): AtlasRecord[] {
  // Page counts recorded at scrape time: the oracle every download is
  // checked against.
  const classification = JSON.parse(
    readFileSync(path.join(root, "references", "atlas-classification.json"), "utf8"),
  ) as { items: { filename: string; pageCount: number }[] };
  const pagesByTail = new Map<string, number>();
  for (const item of classification.items) {
    pagesByTail.set(norm(item.filename.replace(/^atlas-/, "").replace(/\.pdf$/i, "")), item.pageCount);
  }

  const records: AtlasRecord[] = [];
  for (const dir of ["references", "curriculums"]) {
    for (const name of readdirSync(path.join(root, dir))) {
      if ((!name.startsWith("ref-") && !name.startsWith("cur-")) || !name.endsWith(".json")) continue;
      const file = path.join(root, dir, name);
      const doc = JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>;
      const id = typeof doc.id === "string" ? doc.id : null;
      if (!id || !/atlas|scrape/i.test(String(doc.droppedBy ?? ""))) continue;

      const m = id.match(/^(?:ref|cur)-\d{4}-\d{2}-\d{2}-(.+)$/);
      if (!m) continue;
      let slug = m[1];
      let source: string | null = null;
      for (const [prefix, key] of Object.entries(PREFIX_TO_SOURCE)) {
        if (slug.startsWith(prefix)) {
          source = key;
          slug = slug.slice(prefix.length);
          break;
        }
      }
      const core = norm(slug);
      let expectedPages: number | null = null;
      for (const [tail, pages] of pagesByTail) {
        if (tail.endsWith(core) || tail.includes(core)) {
          expectedPages = pages;
          break;
        }
      }
      records.push({
        id,
        slug,
        source,
        title: String(doc.title ?? ""),
        file,
        doc,
        expectedPages,
      });
    }
  }
  return records;
}

interface Candidate {
  url: string;
  source: string;
  base: string;
  segs: string[];
  fileName: string;
}

async function scrapePages(): Promise<Candidate[]> {
  const found: Candidate[] = [];
  for (const { key, url } of SOURCE_PAGES) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
      if (!res.ok) {
        console.log(`  ${key}: HTTP ${res.status}, skipping`);
        continue;
      }
      const html = await res.text();
      const seen = new Set<string>();
      for (const m of html.matchAll(/href="([^"]*\.pdf[^"]*)"/gi)) {
        let absolute: URL;
        try {
          absolute = new URL(m[1], url);
        } catch {
          continue;
        }
        if (seen.has(absolute.toString())) continue;
        seen.add(absolute.toString());
        const segments = absolute.pathname.split("/").filter(Boolean);
        const fileName = decodeURIComponent(segments[segments.length - 1] ?? "");
        found.push({
          url: absolute.toString(),
          source: key,
          base: norm(fileName.replace(/\.pdf$/i, "")),
          segs: segments.map(norm),
          fileName,
        });
      }
      console.log(`  ${key}: ${seen.size} pdf links`);
    } catch (error) {
      console.log(`  ${key}: ERROR ${(error as Error).message}`);
    }
    // Publishers are doing us a favour by hosting these; do not hammer.
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  return found;
}

/** Exactly one confident candidate, or null. Never a guess. */
function pair(record: AtlasRecord, candidates: Candidate[]): Candidate | null {
  const manual = MANUAL_PAIRS[`${record.source === "oak-meadow" ? "om-" : ""}${record.slug}`];
  if (manual) {
    const hit = candidates.filter((c) => c.fileName === manual);
    return hit.length === 1 ? hit[0] : null;
  }

  const key = norm(record.slug);
  const inSource = candidates.filter((c) => !record.source || c.source === record.source);

  // 1. Filename equality.
  let hits = inSource.filter((c) => c.base === key);

  // 2. Suffix match whose leftover prefix is a real path segment, which
  //    is Beast Academy's level directory: 3aanglemazes -> /3A/AngleMazes.
  if (hits.length === 0) {
    hits = inSource.filter((c) => {
      if (c.base.length < 5 || !key.endsWith(c.base)) return false;
      const lead = key.slice(0, key.length - c.base.length);
      return Boolean(lead) && c.segs.includes(lead);
    });
  }

  // 3. Dimensions Math ships as sp_dmT2A.pdf on a Shopify CDN, and the
  //    same page carries Primary Mathematics as SP_PM_STD_T2A. The "dm"
  //    marker is what keeps the two product lines apart; matching the
  //    bare level would silently cross them.
  if (hits.length === 0 && record.source === "dimensions-math") {
    hits = inSource.filter((c) => c.base.endsWith(`dm${key}`));
  }

  const unique = [...new Map(hits.map((h) => [h.url, h])).values()];
  return unique.length === 1 ? unique[0] : null;
}

async function main() {
  if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required (or pass --dry-run)");
    process.exit(1);
  }

  const root = cosmoDir();
  const records = loadRecords(root);
  console.log(`atlas records: ${records.length}`);

  // Anything already in Blob is done; this script is resumable.
  const held = new Set<string>();
  if (!DRY_RUN) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "inspo/", limit: 1000, cursor });
      for (const blob of page.blobs) {
        const id = blob.pathname.split("/")[1];
        if (id) held.add(id);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  console.log("scraping publisher sample pages:");
  const candidates = await scrapePages();
  console.log(`  ${candidates.length} candidate PDFs\n`);

  const todo = records.filter((r) => !held.has(r.id));
  let paired = 0;
  let uploaded = 0;
  let mismatched = 0;
  let failed = 0;
  const unpaired: AtlasRecord[] = [];

  for (const record of todo) {
    if (uploaded >= LIMIT) break;
    const match = pair(record, candidates);
    if (!match) {
      unpaired.push(record);
      continue;
    }
    paired += 1;
    if (DRY_RUN) {
      console.log(`  would fetch ${record.id.slice(0, 44).padEnd(44)} <- ${match.fileName}`);
      continue;
    }

    try {
      const res = await fetch(match.url, { headers: { "user-agent": UA }, redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new Error("not a PDF (publisher served something else)");
      }

      // Code verifies what the string match proposed.
      const { pageCount } = await rasterizePdfToJpegs(bytes, 1);
      if (record.expectedPages !== null && pageCount !== record.expectedPages) {
        mismatched += 1;
        console.log(
          `  MISMATCH ${record.id.slice(0, 40)}: ${pageCount} pages, scrape recorded ${record.expectedPages}. Skipped.`,
        );
        continue;
      }

      const blob = await put(`inspo/${record.id}/${match.fileName}`, bytes, {
        access: "public",
        contentType: "application/pdf",
        addRandomSuffix: false,
        allowOverwrite: true,
      });

      // Record provenance so this loss cannot recur silently.
      record.doc.sourceUrl = match.url;
      record.doc.blobUrl = blob.url;
      record.doc.resourcedAt = new Date().toISOString().slice(0, 10);
      writeFileSync(record.file, `${JSON.stringify(record.doc, null, 2)}\n`);

      uploaded += 1;
      console.log(
        `  ok ${record.id.slice(0, 42).padEnd(42)} ${String(pageCount).padStart(3)}p  ${(bytes.length / 1e6).toFixed(1)}MB`,
      );
    } catch (error) {
      failed += 1;
      console.log(`  FAIL ${record.id.slice(0, 42)}: ${(error as Error).message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  console.log(
    `\npaired ${paired}/${todo.length} | uploaded ${uploaded} | page-count mismatch ${mismatched} | failed ${failed}`,
  );
  if (unpaired.length) {
    console.log(`\nno confident pairing (${unpaired.length}), left alone:`);
    for (const record of unpaired) console.log(`  ${record.id}`);
  }
}

await main();
