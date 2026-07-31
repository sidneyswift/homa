/**
 * backfill-library-covers: real book covers for /admin/library.
 *
 * The founder console's library shelf shows every ingested reference
 * and curriculum as a book. A record whose original bytes survive in
 * Blob deserves a real cover, meaning page 1 of the actual PDF the
 * co-founder dropped, not a generated placeholder. This script walks
 * inspo/ in Blob, rasterises the first page of every PDF, downscales
 * every image drop, and writes the result to inspo-covers/<id>.jpg.
 *
 * Why a script and not a route: the originals average 43MB and one is
 * 128MB, so rasterising on request would blow every deadline tier we
 * have. Covers are generated once, cached in Blob, and served straight
 * from their public URL. Records with no original never get one; the
 * shelf draws a designed cover from metadata instead.
 *
 * Idempotent and resumable. Re-running skips any record whose cover
 * already exists unless --force is passed, so an interrupted run just
 * gets started again.
 *
 * Usage:
 *   BLOB_READ_WRITE_TOKEN=... node --experimental-strip-types \
 *     scripts/backfill-library-covers.mts [--force] [--limit N] [--id <record-id>]
 */

import { list, put } from "@vercel/blob";

import { rasterizePdfToJpegs } from "../lib/materials/rasterize-pdf.ts";
import {
  coverPathForRecord,
  recordIdFromBlobPath,
} from "../lib/materials/library-shelf.ts";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = readFlag("--limit");
const ONLY_ID = readFlag("--id");

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : null;
}

/** Blob's own listing is the authority on which originals exist; the
 * analysis JSONs record a blobUrl on only 3 of 195 documents. */
async function listAll(prefix: string) {
  const blobs: { pathname: string; url: string; size: number }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, limit: 1000, cursor });
    blobs.push(...page.blobs.map((b) => ({ pathname: b.pathname, url: b.url, size: b.size })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

function isPdf(name: string): boolean {
  return /\.pdf$/i.test(name);
}

function isImage(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name);
}

async function main() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required. Inside apps/web: vercel env pull .env.blob && source .env.blob");
    process.exit(1);
  }

  const [originals, existingCovers] = await Promise.all([
    listAll("inspo/"),
    listAll("inspo-covers/"),
  ]);
  const haveCover = new Set(
    existingCovers.map((b) => b.pathname.replace(/^inspo-covers\//, "").replace(/\.jpg$/, "")),
  );

  // One cover per record: the largest file is the real material, the
  // rest are extra scan parts of the same book.
  const primaryByRecord = new Map<string, { pathname: string; url: string; size: number }>();
  for (const blob of originals) {
    const recordId = recordIdFromBlobPath(blob.pathname);
    if (!recordId) continue;
    const current = primaryByRecord.get(recordId);
    if (!current || blob.size > current.size) primaryByRecord.set(recordId, blob);
  }

  let targets = [...primaryByRecord.entries()];
  if (ONLY_ID) targets = targets.filter(([id]) => id === ONLY_ID);
  if (!FORCE) targets = targets.filter(([id]) => !haveCover.has(id));
  if (LIMIT) targets = targets.slice(0, Number(LIMIT));

  console.log(
    `originals: ${originals.length} across ${primaryByRecord.size} records | covers present: ${haveCover.size} | to generate: ${targets.length}`,
  );

  let made = 0;
  let skipped = 0;
  let failed = 0;

  for (const [recordId, blob] of targets) {
    const name = blob.pathname.split("/").slice(2).join("/");
    const mb = (blob.size / 1e6).toFixed(0);
    try {
      let jpeg: Buffer;

      if (isPdf(name)) {
        const response = await fetch(blob.url);
        if (!response.ok) throw new Error(`fetch ${response.status}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const { pageJpegs } = await rasterizePdfToJpegs(bytes, 1);
        if (!pageJpegs.length) throw new Error("no pages rendered");
        jpeg = pageJpegs[0];
      } else if (isImage(name)) {
        // An image drop is already its own cover; keep the bytes as-is
        // and let the shelf's CSS do the fitting.
        const response = await fetch(blob.url);
        if (!response.ok) throw new Error(`fetch ${response.status}`);
        jpeg = Buffer.from(await response.arrayBuffer());
      } else {
        skipped += 1;
        console.log(`  skip  ${recordId} (${name.slice(-40)}, unsupported type)`);
        continue;
      }

      await put(coverPathForRecord(recordId), jpeg, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      made += 1;
      console.log(`  cover ${recordId} (${mb}MB source)`);
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${recordId}: ${(error as Error).message}`);
    }
  }

  console.log(`\ndone. generated ${made}, skipped ${skipped}, failed ${failed}`);
}

await main();
