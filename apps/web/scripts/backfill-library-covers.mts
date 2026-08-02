/**
 * backfill-library-covers: real book covers for /admin/library.
 *
 * The founder console's library shelf shows every ingested reference
 * and curriculum as a book. A record whose original bytes survive in
 * Blob deserves a real cover, meaning page 1 of the actual printable or
 * slide 1 of the actual presentation the co-founder dropped, not a
 * generated placeholder. This script walks inspo/ in Blob, renders the
 * first real page, and writes the result to inspo-covers/<id>.jpg.
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
 *     scripts/backfill-library-covers.mts [--force] [--limit N] [--id <record-id>] \
 *     [--source-url <exact-live-blob-url>]
 *
 * Set LIBRARY_COVER_PDF_PASSWORD only for a password-protected original
 * and always pair it with --id.
 */

import { readFile } from "node:fs/promises";

import { list, put } from "@vercel/blob";

import {
  renderLibraryCover,
  selectLibraryCoverSource,
} from "../lib/materials/library-cover-source.ts";
import {
  coverPathForRecord,
  recordIdFromBlobPath,
} from "../lib/materials/library-shelf.ts";

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const LIMIT = readFlag("--limit");
const ONLY_ID = readFlag("--id");
const SOURCE_URL = readFlag("--source-url");
const PDF_PASSWORD = process.env.LIBRARY_COVER_PDF_PASSWORD;

function readFlag(name: string): string | null {
  const index = args.indexOf(name);
  const value = index >= 0 ? args[index + 1] : null;
  return value && !value.startsWith("--") ? value : null;
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

async function claimedSourceUrls(recordId: string): Promise<Set<string>> {
  const folder = recordId.startsWith("cur-") ? "curriculums" : "references";
  const url = new URL(`../../../.cosmo/${folder}/${recordId}.json`, import.meta.url);
  try {
    const record = JSON.parse(await readFile(url, "utf8"));
    return new Set(
      (record.sourceFiles ?? [])
        .map((source: { blobUrl?: unknown }) => source.blobUrl)
        .filter((value: unknown): value is string => typeof value === "string"),
    );
  } catch {
    return new Set();
  }
}

async function main() {
  if (args.includes("--source-url") && !SOURCE_URL) {
    console.error("--source-url requires an exact live Blob URL");
    process.exit(1);
  }
  if (SOURCE_URL && !ONLY_ID) {
    console.error("--source-url requires --id so the source cannot cross record boundaries");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN is required. Inside apps/web: vercel env pull .env.blob && source .env.blob");
    process.exit(1);
  }
  if (PDF_PASSWORD && !ONLY_ID) {
    console.error(
      "LIBRARY_COVER_PDF_PASSWORD requires --id so it cannot be applied to unrelated records",
    );
    process.exit(1);
  }

  const [originals, existingCovers] = await Promise.all([
    listAll("inspo/"),
    listAll("inspo-covers/"),
  ]);
  const haveCover = new Set(
    existingCovers.map((b) => b.pathname.replace(/^inspo-covers\//, "").replace(/\.jpg$/, "")),
  );

  const recordIds = new Set<string>();
  for (const blob of originals) {
    const recordId = recordIdFromBlobPath(blob.pathname);
    if (recordId) recordIds.add(recordId);
  }

  let explicitSource: { pathname: string; url: string; size: number } | null = null;
  if (SOURCE_URL && ONLY_ID) {
    try {
      explicitSource = selectLibraryCoverSource(
        originals,
        ONLY_ID,
        SOURCE_URL,
        await claimedSourceUrls(ONLY_ID),
      );
    } catch (error) {
      console.error(`--source-url rejected: ${(error as Error).message}`);
      process.exit(1);
    }
  }

  let targets = ONLY_ID ? [ONLY_ID] : [...recordIds];
  if (!FORCE) targets = targets.filter((id) => !haveCover.has(id));
  if (LIMIT) targets = targets.slice(0, Number(LIMIT));

  console.log(
    `originals: ${originals.length} across ${recordIds.size} records | covers present: ${haveCover.size} | to generate: ${targets.length}`,
  );

  let made = 0;
  let failed = 0;

  for (const recordId of targets) {
    try {
      const blob =
        explicitSource && recordId === ONLY_ID
          ? explicitSource
          : selectLibraryCoverSource(originals, recordId);
      const name = blob.pathname.split("/").slice(2).join("/");
      const mb = (blob.size / 1e6).toFixed(0);

      const response = await fetch(blob.url);
      if (!response.ok) throw new Error(`fetch ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const rendered = await renderLibraryCover(name, bytes, {
        pdfPassword: PDF_PASSWORD ?? undefined,
      });

      await put(coverPathForRecord(recordId), rendered.jpeg, {
        access: "public",
        contentType: "image/jpeg",
        addRandomSuffix: false,
        allowOverwrite: true,
      });
      made += 1;
      console.log(
        `  cover ${recordId} (${mb}MB source, page 1 from ${rendered.renderedFrom})`,
      );
    } catch (error) {
      failed += 1;
      console.log(`  FAIL  ${recordId}: ${(error as Error).message}`);
    }
  }

  console.log(`\ndone. generated ${made}, failed ${failed}`);
  if (failed > 0) process.exitCode = 1;
}

await main();
